/**
 * Category Routes - High Performance Implementation
 *
 * Features:
 * - Hierarchical category support with tree structure
 * - Response caching with intelligent TTL
 * - Category analytics and product counts
 * - SEO-friendly URL slugs
 * - Performance monitoring per endpoint
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';
import { CacheService } from '../services/cacheService.js';
// Pre-compiled validation schemas
const categoryParamsSchema = z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
}).strict();
const categoryQuerySchema = z.object({
    parent_id: z.string().regex(/^\d+$/).transform(Number).optional(),
    include_children: z.string().transform(val => val === 'true').optional(),
    visible_only: z.string().transform(val => val !== 'false').optional().default(true),
    with_products: z.string().transform(val => val === 'true').optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
    per_page: z.string().regex(/^\d+$/).transform(Number).optional().default(50),
    sort_by: z.enum(['name', 'order', 'product_count', 'created_at']).optional().default('order'),
    order: z.enum(['asc', 'desc']).optional().default('asc'),
}).strict();
const createCategorySchema = z.object({
    name: z.string().min(2).max(100),
    slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
    description: z.string().max(1000).optional(),
    image_url: z.string().url().optional(),
    parent_id: z.number().positive().optional(),
    display_order: z.number().min(0).optional().default(0),
    is_visible: z.boolean().optional().default(true),
    seo_title: z.string().max(60).optional(),
    seo_description: z.string().max(160).optional(),
}).strict();
const updateCategorySchema = z.object({
    name: z.string().min(2).max(100).optional(),
    slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/).optional(),
    description: z.string().max(1000).optional(),
    image_url: z.string().url().optional(),
    parent_id: z.number().positive().optional(),
    display_order: z.number().min(0).optional(),
    is_visible: z.boolean().optional(),
    seo_title: z.string().max(60).optional(),
    seo_description: z.string().max(160).optional(),
}).strict();
// Performance monitoring
const routeStats = {
    categoriesList: { requests: 0, avgTime: 0, errors: 0 },
    categoryDetail: { requests: 0, avgTime: 0, errors: 0 },
    categoryTree: { requests: 0, avgTime: 0, errors: 0 },
    createCategory: { requests: 0, avgTime: 0, errors: 0 },
    updateCategory: { requests: 0, avgTime: 0, errors: 0 },
    deleteCategory: { requests: 0, avgTime: 0, errors: 0 },
};
// Mock data for development (replace with actual database service)
const mockCategories = [
    {
        id: 1,
        name: 'Electronics',
        slug: 'electronics',
        description: 'Electronic devices and accessories',
        display_order: 1,
        product_count: 150,
        is_visible: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
    },
    {
        id: 2,
        name: 'Smartphones',
        slug: 'smartphones',
        description: 'Latest smartphones and mobile devices',
        parent_id: 1,
        display_order: 1,
        product_count: 45,
        is_visible: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
    },
    {
        id: 3,
        name: 'Laptops',
        slug: 'laptops',
        description: 'Laptops and notebooks',
        parent_id: 1,
        display_order: 2,
        product_count: 32,
        is_visible: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
    },
];
let nextId = 4;
/**
 * Category routes with high performance optimizations
 */
export function createCategoryRoutes(cacheService) {
    const categories = new Hono();
    // Helper function to build category tree
    const buildCategoryTree = (categories, parentId) => {
        return categories
            .filter(cat => cat.parent_id === parentId)
            .sort((a, b) => a.display_order - b.display_order)
            .map(cat => ({
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            product_count: cat.product_count,
            depth: parentId ? 1 : 0, // Simplified depth calculation
            children: buildCategoryTree(categories, cat.id),
        }));
    };
    /**
     * GET /categories - Fetch categories list with filtering
     */
    categories.get('/', validateRequest({ query: categoryQuerySchema }), async (c) => {
        const startTime = Date.now();
        routeStats.categoriesList.requests++;
        try {
            const query = c.req.query();
            const validatedQuery = categoryQuerySchema.parse(query);
            // Create cache key based on filters
            const cacheKey = `categories:list:${JSON.stringify(validatedQuery)}`;
            // Try cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                const responseTime = Date.now() - startTime;
                c.header('X-Response-Time', `${responseTime}ms`);
                c.header('X-Cache-Status', 'hit');
                const response = {
                    success: true,
                    data: cached.categories,
                    meta: {
                        total: cached.total,
                        page: validatedQuery.page,
                        perPage: validatedQuery.per_page,
                        totalPages: Math.ceil(cached.total / validatedQuery.per_page),
                    },
                };
                return c.json(response);
            }
            // Filter categories based on query parameters
            let filteredCategories = [...mockCategories];
            if (validatedQuery.parent_id !== undefined) {
                filteredCategories = filteredCategories.filter(c => c.parent_id === validatedQuery.parent_id);
            }
            if (validatedQuery.visible_only) {
                filteredCategories = filteredCategories.filter(c => c.is_visible);
            }
            if (validatedQuery.with_products) {
                filteredCategories = filteredCategories.filter(c => c.product_count > 0);
            }
            // Add children if requested
            if (validatedQuery.include_children) {
                filteredCategories = filteredCategories.map(cat => ({
                    ...cat,
                    children: mockCategories.filter(child => child.parent_id === cat.id),
                }));
            }
            // Sort categories
            filteredCategories.sort((a, b) => {
                let comparison = 0;
                switch (validatedQuery.sort_by) {
                    case 'name':
                        comparison = a.name.localeCompare(b.name);
                        break;
                    case 'product_count':
                        comparison = a.product_count - b.product_count;
                        break;
                    case 'created_at':
                        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        break;
                    case 'order':
                    default:
                        comparison = a.display_order - b.display_order;
                        break;
                }
                return validatedQuery.order === 'desc' ? -comparison : comparison;
            });
            // Pagination
            const total = filteredCategories.length;
            const startIndex = (validatedQuery.page - 1) * validatedQuery.per_page;
            const paginatedCategories = filteredCategories.slice(startIndex, startIndex + validatedQuery.per_page);
            // Cache result for 5 minutes
            await cacheService.set(cacheKey, { categories: paginatedCategories, total }, 300);
            const responseTime = Date.now() - startTime;
            routeStats.categoriesList.avgTime = (routeStats.categoriesList.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=300');
            const response = {
                success: true,
                data: paginatedCategories,
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
            routeStats.categoriesList.errors++;
            console.error('Categories list route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'CATEGORIES_FETCH_ERROR',
                    message: 'Failed to fetch categories',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * GET /categories/tree - Get hierarchical category tree
     */
    categories.get('/tree', async (c) => {
        const startTime = Date.now();
        routeStats.categoryTree.requests++;
        try {
            const cacheKey = 'categories:tree';
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
            const visibleCategories = mockCategories.filter(c => c.is_visible);
            const tree = buildCategoryTree(visibleCategories);
            // Cache tree for 10 minutes
            await cacheService.set(cacheKey, tree, 600);
            const responseTime = Date.now() - startTime;
            routeStats.categoryTree.avgTime = (routeStats.categoryTree.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=600');
            return c.json({
                success: true,
                data: tree,
            });
        }
        catch (error) {
            routeStats.categoryTree.errors++;
            console.error('Category tree route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'CATEGORY_TREE_ERROR',
                    message: 'Failed to fetch category tree',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * GET /categories/:id - Fetch single category
     */
    categories.get('/:id', validateRequest({ params: categoryParamsSchema }), async (c) => {
        const startTime = Date.now();
        routeStats.categoryDetail.requests++;
        try {
            const { id } = c.req.param();
            const parsedId = parseInt(id);
            const cacheKey = `category:${parsedId}`;
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
            const category = mockCategories.find(c => c.id === parsedId);
            if (!category) {
                const response = {
                    success: false,
                    error: {
                        code: 'CATEGORY_NOT_FOUND',
                        message: 'Category not found',
                    },
                };
                return c.json(response, 404);
            }
            // Add children
            const categoryWithChildren = {
                ...category,
                children: mockCategories.filter(child => child.parent_id === category.id),
            };
            // Cache for 10 minutes
            await cacheService.set(cacheKey, categoryWithChildren, 600);
            const responseTime = Date.now() - startTime;
            routeStats.categoryDetail.avgTime = (routeStats.categoryDetail.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            c.header('X-Cache-Status', 'miss');
            c.header('Cache-Control', 'public, max-age=600');
            return c.json({
                success: true,
                data: categoryWithChildren,
            });
        }
        catch (error) {
            routeStats.categoryDetail.errors++;
            console.error('Category detail route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'CATEGORY_FETCH_ERROR',
                    message: 'Failed to fetch category',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * POST /categories - Create new category
     */
    categories.post('/', validateRequest({ body: createCategorySchema }), async (c) => {
        const startTime = Date.now();
        routeStats.createCategory.requests++;
        try {
            const body = await c.req.json();
            const data = createCategorySchema.parse(body);
            // Check if slug already exists
            const existingCategory = mockCategories.find(c => c.slug === data.slug);
            if (existingCategory) {
                const response = {
                    success: false,
                    error: {
                        code: 'SLUG_ALREADY_EXISTS',
                        message: 'Category slug already exists',
                    },
                };
                return c.json(response, 409);
            }
            // Validate parent exists if specified
            if (data.parent_id) {
                const parentCategory = mockCategories.find(c => c.id === data.parent_id);
                if (!parentCategory) {
                    const response = {
                        success: false,
                        error: {
                            code: 'PARENT_CATEGORY_NOT_FOUND',
                            message: 'Parent category not found',
                        },
                    };
                    return c.json(response, 400);
                }
            }
            const newCategory = {
                id: nextId++,
                ...data,
                description: data.description || '',
                product_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            mockCategories.push(newCategory);
            // Invalidate caches
            await cacheService.deletePattern('categories:*');
            const responseTime = Date.now() - startTime;
            routeStats.createCategory.avgTime = (routeStats.createCategory.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json({
                success: true,
                data: newCategory,
            }, 201);
        }
        catch (error) {
            routeStats.createCategory.errors++;
            console.error('Create category route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'CATEGORY_CREATE_ERROR',
                    message: 'Failed to create category',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * PUT /categories/:id - Update category
     */
    categories.put('/:id', validateRequest({
        params: categoryParamsSchema,
        body: updateCategorySchema
    }), async (c) => {
        const startTime = Date.now();
        routeStats.updateCategory.requests++;
        try {
            const { id } = c.req.param();
            const parsedId = parseInt(id);
            const body = await c.req.json();
            const updateData = updateCategorySchema.parse(body);
            const categoryIndex = mockCategories.findIndex(c => c.id === parsedId);
            if (categoryIndex === -1) {
                const response = {
                    success: false,
                    error: {
                        code: 'CATEGORY_NOT_FOUND',
                        message: 'Category not found',
                    },
                };
                return c.json(response, 404);
            }
            // Check slug uniqueness if being updated
            if (updateData.slug) {
                const existingCategory = mockCategories.find(c => c.slug === updateData.slug && c.id !== parsedId);
                if (existingCategory) {
                    const response = {
                        success: false,
                        error: {
                            code: 'SLUG_ALREADY_EXISTS',
                            message: 'Category slug already exists',
                        },
                    };
                    return c.json(response, 409);
                }
            }
            const updatedCategory = {
                ...mockCategories[categoryIndex],
                ...updateData,
                updated_at: new Date().toISOString(),
            };
            mockCategories[categoryIndex] = updatedCategory;
            // Invalidate caches
            await cacheService.delete(`category:${parsedId}`);
            await cacheService.deletePattern('categories:*');
            const responseTime = Date.now() - startTime;
            routeStats.updateCategory.avgTime = (routeStats.updateCategory.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json({
                success: true,
                data: updatedCategory,
            });
        }
        catch (error) {
            routeStats.updateCategory.errors++;
            console.error('Update category route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'CATEGORY_UPDATE_ERROR',
                    message: 'Failed to update category',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    /**
     * DELETE /categories/:id - Delete category
     */
    categories.delete('/:id', validateRequest({ params: categoryParamsSchema }), async (c) => {
        const startTime = Date.now();
        routeStats.deleteCategory.requests++;
        try {
            const { id } = c.req.param();
            const parsedId = parseInt(id);
            const categoryIndex = mockCategories.findIndex(c => c.id === parsedId);
            if (categoryIndex === -1) {
                const response = {
                    success: false,
                    error: {
                        code: 'CATEGORY_NOT_FOUND',
                        message: 'Category not found',
                    },
                };
                return c.json(response, 404);
            }
            // Check for child categories
            const hasChildren = mockCategories.some(c => c.parent_id === parsedId);
            if (hasChildren) {
                const response = {
                    success: false,
                    error: {
                        code: 'CATEGORY_HAS_CHILDREN',
                        message: 'Cannot delete category with child categories',
                    },
                };
                return c.json(response, 400);
            }
            mockCategories.splice(categoryIndex, 1);
            // Invalidate caches
            await cacheService.delete(`category:${parsedId}`);
            await cacheService.deletePattern('categories:*');
            const responseTime = Date.now() - startTime;
            routeStats.deleteCategory.avgTime = (routeStats.deleteCategory.avgTime + responseTime) / 2;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json({
                success: true,
                data: { deleted: true },
            });
        }
        catch (error) {
            routeStats.deleteCategory.errors++;
            console.error('Delete category route error:', error);
            const response = {
                success: false,
                error: {
                    code: 'CATEGORY_DELETE_ERROR',
                    message: 'Failed to delete category',
                },
            };
            const responseTime = Date.now() - startTime;
            c.header('X-Response-Time', `${responseTime}ms`);
            return c.json(response, 500);
        }
    });
    return categories;
}
