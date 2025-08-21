/**
 * WordPress Content Routes - High Performance Implementation
 *
 * Features:
 * - WordPress posts, pages, and media management
 * - Response caching with intelligent TTL
 * - SEO metadata and content optimization
 * - Performance monitoring per endpoint
 * - WordPress GraphQL and REST API integration
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';
import { CacheService } from '../services/cacheService.js';
// Pre-compiled validation schemas
const contentParamsSchema = z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
}).strict();
const postsQuerySchema = z.object({
    status: z.enum(['publish', 'draft', 'private']).optional(),
    author_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    category: z.string().optional(),
    tag: z.string().optional(),
    search: z.string().min(2).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
    per_page: z.string().regex(/^\d+$/).transform(Number).optional().default(10),
    sort_by: z.enum(['date', 'title', 'modified']).optional().default('date'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
}).strict();
const pagesQuerySchema = z.object({
    status: z.enum(['publish', 'draft', 'private']).optional(),
    parent_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    template: z.string().optional(),
    search: z.string().min(2).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
    per_page: z.string().regex(/^\d+$/).transform(Number).optional().default(20),
    sort_by: z.enum(['date', 'title', 'menu_order']).optional().default('menu_order'),
    order: z.enum(['asc', 'desc']).optional().default('asc'),
}).strict();
const mediaQuerySchema = z.object({
    mime_type: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
    per_page: z.string().regex(/^\d+$/).transform(Number).optional().default(20),
    sort_by: z.enum(['date', 'title', 'name']).optional().default('date'),
    order: z.enum(['asc', 'desc']).optional().default('desc'),
}).strict();
// Performance monitoring
const routeStats = {
    postsList: { requests: 0, avgTime: 0, errors: 0 },
    postDetail: { requests: 0, avgTime: 0, errors: 0 },
    pagesList: { requests: 0, avgTime: 0, errors: 0 },
    pageDetail: { requests: 0, avgTime: 0, errors: 0 },
    mediaList: { requests: 0, avgTime: 0, errors: 0 },
    mediaDetail: { requests: 0, avgTime: 0, errors: 0 },
    sitemapGenerate: { requests: 0, avgTime: 0, errors: 0 },
    searchContent: { requests: 0, avgTime: 0, errors: 0 },
};
// Mock data for development (replace with actual WordPress service)
const mockPosts = [
    {
        id: 1,
        title: 'Welcome to Our Store',
        content: '<p>This is our welcome post with rich content about our amazing products.</p>',
        excerpt: 'Welcome to our store where you can find amazing products.',
        slug: 'welcome-to-our-store',
        status: 'publish',
        author_id: 1,
        author_name: 'Admin',
        featured_image: 'https://example.com/welcome.jpg',
        categories: ['News', 'Announcements'],
        tags: ['welcome', 'store', 'products'],
        seo_title: 'Welcome to Our Amazing Store | Best Products Online',
        seo_description: 'Discover amazing products at our online store. Quality guaranteed, fast shipping.',
        published_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
    },
];
const mockPages = [
    {
        id: 1,
        title: 'About Us',
        content: '<p>Learn more about our company and mission.</p>',
        slug: 'about-us',
        status: 'publish',
        template: 'page-about.php',
        seo_title: 'About Us - Our Story and Mission',
        seo_description: 'Learn about our company history, mission, and values.',
        published_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
    },
];
const mockMedia = [
    {
        id: 1,
        url: 'https://example.com/uploads/product-image.jpg',
        alt_text: 'Product showcase image',
        caption: 'Our featured product lineup',
        mime_type: 'image/jpeg',
        file_size: 245760,
        width: 1200,
        height: 800,
        uploaded_at: '2024-01-01T00:00:00Z',
    },
];
/**
 * WordPress Content routes with high performance optimizations
 */
export function createWordPressRoutes(cacheService) {
    const wp = new Hono();
    /**
     * GET /wordpress/posts - Fetch WordPress posts
     */
    wp.get('/posts', validateRequest({ query: postsQuerySchema }), async (c) => {
        const startTime = Date.now();
        routeStats.postsList.requests++;
        try {
            const query = c.req.query();
            const validatedQuery = postsQuerySchema.parse(query);
            // Create cache key based on filters
            const cacheKey = `wp:posts:list:${JSON.stringify(validatedQuery)}`;
            // Try cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                const responseTime = Date.now() - startTime;
                c.header('X-Response-Time', `${responseTime}ms`);
                c.header('X-Cache-Status', 'hit');
                const response = {
                    success: true,
                    data: cached.posts,
                    meta: {
                        total: cached.total,
                        page: validatedQuery.page,
                        perPage: validatedQuery.per_page,
                        totalPages: Math.ceil(cached.total / validatedQuery.per_page),
                    },
                };
                return c.json(response);
            }
            // Filter posts based on query parameters
            let filteredPosts = [...mockPosts];
            if (validatedQuery.status) {
                filteredPosts = filteredPosts.filter(p => p.status === validatedQuery.status);
            }
            if (validatedQuery.author_id) {
                filteredPosts = filteredPosts.filter(p => p.author_id === validatedQuery.author_id);
            }
            if (validatedQuery.category) {
                filteredPosts = filteredPosts.filter(p => p.categories.includes(validatedQuery.category));
            }
            if (validatedQuery.tag) {
                filteredPosts = filteredPosts.filter(p => p.tags.includes(validatedQuery.tag));
            }
            if (validatedQuery.search) {
                const searchTerm = validatedQuery.search.toLowerCase();
                filteredPosts = filteredPosts.filter(p => p.title.toLowerCase().includes(searchTerm) ||
                    p.content.toLowerCase().includes(searchTerm) ||
                    p.excerpt.toLowerCase().includes(searchTerm));
            }
            // Sort posts
            filteredPosts.sort((a, b) => {
                let comparison = 0;
                switch (validatedQuery.sort_by) {
                    case 'title':
                        comparison = a.title.localeCompare(b.title);
                        break;
                    case 'modified':
                        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
                        break;
                    case 'date':
                    default:
                        comparison = new Date(a.published_at).getTime() - new Date(b.published_at).getTime();
                        break;
                }
                return validatedQuery.order === 'desc' ? -comparison : comparison;
            });
            // Pagination
            const total = filteredPosts.length;
            const startIndex = (validatedQuery.page - 1) * validatedQuery.per_page;
            const paginatedPosts = filteredPosts.slice(startIndex, startIndex + validatedQuery.per_page);
            // Cache result for 5 minutes
            await cacheService.set(cacheKey, { posts: paginatedPosts, total }, 300);
            const responseTime = Date.now() - startTime;
            routeStats.postsList.avgTime = (routeStats.postsList.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=300');
            const response = {
                success: true,
                data: paginatedPosts,
                meta: {
                    total,
                    page: validatedQuery.page,
                    perPage: validatedQuery.per_page,
                    totalPages: Math.ceil(total / validatedQuery.per_page),
                },
            };
            return c.json(response);
        }
        catch (error) {
            routeStats.postsList.errors++;
            console.error('WordPress posts list route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'WP_POSTS_FETCH_ERROR',
                    message: 'Failed to fetch WordPress posts',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * GET /wordpress/posts/:id - Fetch single WordPress post
     */
    wp.get('/posts/:id', validateRequest({ params: contentParamsSchema }), async (c) => {
        const startTime = Date.now();
        routeStats.postDetail.requests++;
        try {
            const { id } = c.req.param();
            const parsedId = parseInt(id);
            const cacheKey = `wp:post:${parsedId}`;
            // Try cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                const responseTime = Date.now() - startTime;
                c.header('X-Response-Time', `${responseTime}ms`);
                c.header('X-Cache-Status', 'hit');
                return c.json({
                    success: true,
                    data: cached,
                });
            }
            const post = mockPosts.find(p => p.id === parsedId);
            if (!post) {
                const response = {
                    success: false,
                    error: {
                        code: 'WP_POST_NOT_FOUND',
                        message: 'WordPress post not found',
                    },
                };
                return c.json(response, 404);
            }
            // Cache for 10 minutes
            await cacheService.set(cacheKey, post, 600);
            const responseTime = Date.now() - startTime;
            routeStats.postDetail.avgTime = (routeStats.postDetail.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=600');
            return c.json({
                success: true,
                data: post,
            });
        }
        catch (error) {
            routeStats.postDetail.errors++;
            console.error('WordPress post detail route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'WP_POST_FETCH_ERROR',
                    message: 'Failed to fetch WordPress post',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * GET /wordpress/pages - Fetch WordPress pages
     */
    wp.get('/pages', validateRequest({ query: pagesQuerySchema }), async (c) => {
        const startTime = Date.now();
        routeStats.pagesList.requests++;
        try {
            const query = c.req.query();
            const validatedQuery = pagesQuerySchema.parse(query);
            // Create cache key based on filters
            const cacheKey = `wp:pages:list:${JSON.stringify(validatedQuery)}`;
            // Try cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                const responseTime = Date.now() - startTime;
                c.header('X-Response-Time', `${responseTime}ms`);
                c.header('X-Cache-Status', 'hit');
                const response = {
                    success: true,
                    data: cached.pages,
                    meta: {
                        total: cached.total,
                        page: validatedQuery.page,
                        perPage: validatedQuery.per_page,
                        totalPages: Math.ceil(cached.total / validatedQuery.per_page),
                    },
                };
                return c.json(response);
            }
            // Filter pages based on query parameters
            let filteredPages = [...mockPages];
            if (validatedQuery.status) {
                filteredPages = filteredPages.filter(p => p.status === validatedQuery.status);
            }
            if (validatedQuery.parent_id !== undefined) {
                filteredPages = filteredPages.filter(p => p.parent_id === validatedQuery.parent_id);
            }
            if (validatedQuery.template) {
                filteredPages = filteredPages.filter(p => p.template === validatedQuery.template);
            }
            if (validatedQuery.search) {
                const searchTerm = validatedQuery.search.toLowerCase();
                filteredPages = filteredPages.filter(p => p.title.toLowerCase().includes(searchTerm) ||
                    p.content.toLowerCase().includes(searchTerm));
            }
            // Pagination
            const total = filteredPages.length;
            const startIndex = (validatedQuery.page - 1) * validatedQuery.per_page;
            const paginatedPages = filteredPages.slice(startIndex, startIndex + validatedQuery.per_page);
            // Cache result for 10 minutes
            await cacheService.set(cacheKey, { pages: paginatedPages, total }, 600);
            const responseTime = Date.now() - startTime;
            routeStats.pagesList.avgTime = (routeStats.pagesList.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=600');
            const response = {
                success: true,
                data: paginatedPages,
                meta: {
                    total,
                    page: validatedQuery.page,
                    perPage: validatedQuery.per_page,
                    totalPages: Math.ceil(total / validatedQuery.per_page),
                },
            };
            return c.json(response);
        }
        catch (error) {
            routeStats.pagesList.errors++;
            console.error('WordPress pages list route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'WP_PAGES_FETCH_ERROR',
                    message: 'Failed to fetch WordPress pages',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * GET /wordpress/pages/:id - Fetch single WordPress page
     */
    wp.get('/pages/:id', validateRequest({ params: contentParamsSchema }), async (c) => {
        const startTime = Date.now();
        routeStats.pageDetail.requests++;
        try {
            const { id } = c.req.param();
            const parsedId = parseInt(id);
            const cacheKey = `wp:page:${parsedId}`;
            // Try cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                const responseTime = Date.now() - startTime;
                c.header('X-Response-Time', `${responseTime}ms`);
                c.header('X-Cache-Status', 'hit');
                return c.json({
                    success: true,
                    data: cached,
                });
            }
            const page = mockPages.find(p => p.id === parsedId);
            if (!page) {
                const response = {
                    success: false,
                    error: {
                        code: 'WP_PAGE_NOT_FOUND',
                        message: 'WordPress page not found',
                    },
                };
                return c.json(response, 404);
            }
            // Cache for 30 minutes (pages change less frequently)
            await cacheService.set(cacheKey, page, 1800);
            const responseTime = Date.now() - startTime;
            routeStats.pageDetail.avgTime = (routeStats.pageDetail.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=1800');
            return c.json({
                success: true,
                data: page,
            });
        }
        catch (error) {
            routeStats.pageDetail.errors++;
            console.error('WordPress page detail route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'WP_PAGE_FETCH_ERROR',
                    message: 'Failed to fetch WordPress page',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * GET /wordpress/media - Fetch WordPress media library
     */
    wp.get('/media', validateRequest({ query: mediaQuerySchema }), async (c) => {
        const startTime = Date.now();
        routeStats.mediaList.requests++;
        try {
            const query = c.req.query();
            const validatedQuery = mediaQuerySchema.parse(query);
            // Create cache key based on filters
            const cacheKey = `wp:media:list:${JSON.stringify(validatedQuery)}`;
            // Try cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                const responseTime = Date.now() - startTime;
                c.header('X-Response-Time', `${responseTime}ms`);
                c.header('X-Cache-Status', 'hit');
                const response = {
                    success: true,
                    data: cached.media,
                    meta: {
                        total: cached.total,
                        page: validatedQuery.page,
                        perPage: validatedQuery.per_page,
                        totalPages: Math.ceil(cached.total / validatedQuery.per_page),
                    },
                };
                return c.json(response);
            }
            // Filter media based on query parameters
            let filteredMedia = [...mockMedia];
            if (validatedQuery.mime_type) {
                filteredMedia = filteredMedia.filter(m => m.mime_type.includes(validatedQuery.mime_type));
            }
            // Pagination
            const total = filteredMedia.length;
            const startIndex = (validatedQuery.page - 1) * validatedQuery.per_page;
            const paginatedMedia = filteredMedia.slice(startIndex, startIndex + validatedQuery.per_page);
            // Cache result for 15 minutes
            await cacheService.set(cacheKey, { media: paginatedMedia, total }, 900);
            const responseTime = Date.now() - startTime;
            routeStats.mediaList.avgTime = (routeStats.mediaList.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=900');
            const response = {
                success: true,
                data: paginatedMedia,
                meta: {
                    total,
                    page: validatedQuery.page,
                    perPage: validatedQuery.per_page,
                    totalPages: Math.ceil(total / validatedQuery.per_page),
                },
            };
            return c.json(response);
        }
        catch (error) {
            routeStats.mediaList.errors++;
            console.error('WordPress media list route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'WP_MEDIA_FETCH_ERROR',
                    message: 'Failed to fetch WordPress media',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * GET /wordpress/media/:id - Fetch single media item
     */
    wp.get('/media/:id', validateRequest({ params: contentParamsSchema }), async (c) => {
        const startTime = Date.now();
        routeStats.mediaDetail.requests++;
        try {
            const { id } = c.req.param();
            const parsedId = parseInt(id);
            const cacheKey = `wp:media:${parsedId}`;
            // Try cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                const responseTime = Date.now() - startTime;
                c.header('X-Response-Time', `${responseTime}ms`);
                c.header('X-Cache-Status', 'hit');
                return c.json({
                    success: true,
                    data: cached,
                });
            }
            const mediaItem = mockMedia.find(m => m.id === parsedId);
            if (!mediaItem) {
                const response = {
                    success: false,
                    error: {
                        code: 'WP_MEDIA_NOT_FOUND',
                        message: 'Media item not found',
                    },
                };
                return c.json(response, 404);
            }
            // Cache for 1 hour
            await cacheService.set(cacheKey, mediaItem, 3600);
            const responseTime = Date.now() - startTime;
            routeStats.mediaDetail.avgTime = (routeStats.mediaDetail.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=3600');
            return c.json({
                success: true,
                data: mediaItem,
            });
        }
        catch (error) {
            routeStats.mediaDetail.errors++;
            console.error('WordPress media detail route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'WP_MEDIA_FETCH_ERROR',
                    message: 'Failed to fetch media item',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * GET /wordpress/search - Search across WordPress content
     */
    wp.get('/search', validateRequest({
        query: z.object({
            q: z.string().min(2),
            content_type: z.enum(['posts', 'pages', 'all']).optional().default('all'),
            page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
            per_page: z.string().regex(/^\d+$/).transform(Number).optional().default(10),
        })
    }), async (c) => {
        const startTime = Date.now();
        routeStats.searchContent.requests++;
        try {
            const query = c.req.query();
            const validatedQuery = z.object({
                q: z.string().min(2),
                content_type: z.enum(['posts', 'pages', 'all']).optional().default('all'),
                page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
                per_page: z.string().regex(/^\d+$/).transform(Number).optional().default(10),
            }).parse(query);
            const searchTerm = validatedQuery.q.toLowerCase();
            let results = [];
            // Search posts
            if (validatedQuery.content_type === 'posts' || validatedQuery.content_type === 'all') {
                const matchingPosts = mockPosts.filter(post => post.title.toLowerCase().includes(searchTerm) ||
                    post.content.toLowerCase().includes(searchTerm) ||
                    post.excerpt.toLowerCase().includes(searchTerm));
                results.push(...matchingPosts);
            }
            // Search pages
            if (validatedQuery.content_type === 'pages' || validatedQuery.content_type === 'all') {
                const matchingPages = mockPages.filter(page => page.title.toLowerCase().includes(searchTerm) ||
                    page.content.toLowerCase().includes(searchTerm));
                results.push(...matchingPages);
            }
            // Pagination
            const total = results.length;
            const startIndex = (validatedQuery.page - 1) * validatedQuery.per_page;
            const paginatedResults = results.slice(startIndex, startIndex + validatedQuery.per_page);
            const responseTime = Date.now() - startTime;
            routeStats.searchContent.avgTime = (routeStats.searchContent.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Search-Query', validatedQuery.q);
            const response = {
                success: true,
                data: paginatedResults,
                meta: {
                    total,
                    page: validatedQuery.page,
                    perPage: validatedQuery.per_page,
                    totalPages: Math.ceil(total / validatedQuery.per_page),
                },
            };
            return c.json(response);
        }
        catch (error) {
            routeStats.searchContent.errors++;
            console.error('WordPress search route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'WP_SEARCH_ERROR',
                    message: 'Failed to search WordPress content',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * GET /wordpress/sitemap - Generate XML sitemap data
     */
    wp.get('/sitemap', async (c) => {
        const startTime = Date.now();
        routeStats.sitemapGenerate.requests++;
        try {
            const cacheKey = 'wp:sitemap';
            // Try cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                const responseTime = Date.now() - startTime;
                c.header('X-Response-Time', `${responseTime}ms`);
                c.header('X-Cache-Status', 'hit');
                return c.json({
                    success: true,
                    data: cached,
                });
            }
            const sitemapData = [];
            // Add published posts
            const publishedPosts = mockPosts.filter(p => p.status === 'publish');
            publishedPosts.forEach(post => {
                sitemapData.push({
                    url: `/blog/${post.slug}`,
                    lastmod: post.updated_at,
                    changefreq: 'weekly',
                    priority: 0.7,
                    type: 'post'
                });
            });
            // Add published pages
            const publishedPages = mockPages.filter(p => p.status === 'publish');
            publishedPages.forEach(page => {
                sitemapData.push({
                    url: `/${page.slug}`,
                    lastmod: page.updated_at,
                    changefreq: 'monthly',
                    priority: 0.8,
                    type: 'page'
                });
            });
            // Cache sitemap for 1 hour
            await cacheService.set(cacheKey, sitemapData, 3600);
            const responseTime = Date.now() - startTime;
            routeStats.sitemapGenerate.avgTime = (routeStats.sitemapGenerate.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=3600');
            return c.json({
                success: true,
                data: sitemapData,
            });
        }
        catch (error) {
            routeStats.sitemapGenerate.errors++;
            console.error('WordPress sitemap route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'WP_SITEMAP_ERROR',
                    message: 'Failed to generate sitemap',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    return wp;
}
