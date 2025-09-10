/**
 * Catalog Routes - Product and Category Endpoints
 * 
 * RESTful API for browsing products and categories with
 * caching, filtering, and search capabilities.
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

// Middleware
import { searchRateLimit } from '../../middleware/ratelimit'
import { idempotencyMiddleware } from '../../lib/idempotency'
import { asyncHandler } from '../../middleware/errors'

// Services
import { catalogService } from '../../services/catalog.service'

// Errors
import { catalogErrors, validationError } from '../../lib/errors'

// Cache
import { withCache, productCache } from '../../adapters/cache'

// Types
import type { Context } from 'hono'

// =======================
// Validation Schemas
// =======================

const productFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['publish', 'draft']).optional(),
  featured: z.coerce.boolean().optional(),
  category: z.string().optional(),
  search: z.string().min(1).max(100).optional(),
  sort: z.enum(['name', 'price', 'date', 'popularity']).default('date'),
  order: z.enum(['asc', 'desc']).default('desc'),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional()
})

const productIdSchema = z.object({
  id: z.string().uuid('Invalid product ID format')
})

// =======================
// Router Setup
// =======================

export const catalogRoutes = new Hono()

// Apply rate limiting to search endpoints
catalogRoutes.use('/search/*', searchRateLimit())

// =======================
// Product Endpoints
// =======================

/**
 * GET /v1/catalog/products
 * List products with filtering and pagination
 */
catalogRoutes.get(
  '/products',
  zValidator('query', productFiltersSchema),
  asyncHandler(async (c: Context) => {
    const filters = c.req.valid('query')
    const traceId = c.get('traceId')
    
    // Generate cache key based on filters
    const cacheKey = `products:${JSON.stringify(filters)}`
    
    const result = await withCache(
      cacheKey,
      () => catalogService.getProducts(filters),
      { ttl: 300, namespace: 'catalog' } // 5 minutes
    )
    
    // Add pagination headers
    if (result.pagination) {
      c.header('X-Total-Count', result.pagination.total.toString())
      c.header('X-Page', result.pagination.page.toString())
      c.header('X-Per-Page', result.pagination.perPage.toString())
      c.header('X-Total-Pages', result.pagination.totalPages.toString())
    }
    
    // Add cache headers
    c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    c.header('Vary', 'Accept-Encoding')
    
    return c.json({
      success: true,
      data: result.products,
      pagination: result.pagination,
      meta: {
        traceId,
        cached: result.cached || false,
        timestamp: new Date().toISOString()
      }
    })
  })
)

/**
 * GET /v1/catalog/products/:id
 * Get single product by ID
 */
catalogRoutes.get(
  '/products/:id',
  zValidator('param', productIdSchema),
  asyncHandler(async (c: Context) => {
    const { id } = c.req.valid('param')
    const traceId = c.get('traceId')
    
    const product = await withCache(
      `product:${id}`,
      async () => {
        const result = await catalogService.getProductById(id)
        if (!result) {
          throw catalogErrors.productNotFound(id)
        }
        return result
      },
      { ttl: 3600, namespace: 'catalog' } // 1 hour
    )
    
    // Add cache headers
    c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200')
    c.header('ETag', `"${product.updatedAt}"`)
    
    return c.json({
      success: true,
      data: product,
      meta: {
        traceId,
        timestamp: new Date().toISOString()
      }
    })
  })
)

/**
 * GET /v1/catalog/products/featured
 * Get featured products
 */
catalogRoutes.get(
  '/products/featured',
  zValidator('query', z.object({
    limit: z.coerce.number().int().min(1).max(50).default(10)
  })),
  asyncHandler(async (c: Context) => {
    const { limit } = c.req.valid('query')
    const traceId = c.get('traceId')
    
    const products = await withCache(
      `featured:${limit}`,
      () => catalogService.getFeaturedProducts(limit),
      { ttl: 1800, namespace: 'catalog' } // 30 minutes
    )
    
    c.header('Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600')
    
    return c.json({
      success: true,
      data: products,
      meta: {
        traceId,
        count: products.length,
        timestamp: new Date().toISOString()
      }
    })
  })
)

/**
 * GET /v1/catalog/search
 * Search products
 */
catalogRoutes.get(
  '/search',
  zValidator('query', z.object({
    q: z.string().min(1).max(100),
    page: z.coerce.number().int().min(1).default(1),
    per_page: z.coerce.number().int().min(1).max(50).default(20),
    category: z.string().optional(),
    min_price: z.coerce.number().min(0).optional(),
    max_price: z.coerce.number().min(0).optional()
  })),
  asyncHandler(async (c: Context) => {
    const query = c.req.valid('query')
    const traceId = c.get('traceId')
    
    // Validate search query
    if (query.q.trim().length < 2) {
      throw catalogErrors.invalidSearch('Search query must be at least 2 characters')
    }
    
    const result = await withCache(
      `search:${JSON.stringify(query)}`,
      () => catalogService.searchProducts(query),
      { ttl: 300, namespace: 'catalog' } // 5 minutes
    )
    
    // Add search-specific headers
    c.header('X-Search-Query', query.q)
    c.header('X-Search-Results', result.total.toString())
    c.header('Cache-Control', 'public, max-age=300')
    
    return c.json({
      success: true,
      data: result.products,
      pagination: result.pagination,
      meta: {
        traceId,
        searchQuery: query.q,
        totalResults: result.total,
        searchTime: result.searchTime,
        timestamp: new Date().toISOString()
      }
    })
  })
)

// =======================
// Category Endpoints
// =======================

/**
 * GET /v1/catalog/categories
 * List all categories
 */
catalogRoutes.get(
  '/categories',
  zValidator('query', z.object({
    parent: z.string().optional(),
    include_empty: z.coerce.boolean().default(false)
  })),
  asyncHandler(async (c: Context) => {
    const filters = c.req.valid('query')
    const traceId = c.get('traceId')
    
    const categories = await withCache(
      `categories:${JSON.stringify(filters)}`,
      () => catalogService.getCategories(filters),
      { ttl: 3600, namespace: 'catalog' } // 1 hour
    )
    
    c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200')
    
    return c.json({
      success: true,
      data: categories,
      meta: {
        traceId,
        count: categories.length,
        timestamp: new Date().toISOString()
      }
    })
  })
)

/**
 * GET /v1/catalog/categories/:slug
 * Get category by slug
 */
catalogRoutes.get(
  '/categories/:slug',
  zValidator('param', z.object({
    slug: z.string().min(1).max(100)
  })),
  asyncHandler(async (c: Context) => {
    const { slug } = c.req.valid('param')
    const traceId = c.get('traceId')
    
    const category = await withCache(
      `category:${slug}`,
      async () => {
        const result = await catalogService.getCategoryBySlug(slug)
        if (!result) {
          throw catalogErrors.categoryNotFound(slug)
        }
        return result
      },
      { ttl: 3600, namespace: 'catalog' } // 1 hour
    )
    
    c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200')
    
    return c.json({
      success: true,
      data: category,
      meta: {
        traceId,
        timestamp: new Date().toISOString()
      }
    })
  })
)

// =======================
// Cache Management
// =======================

/**
 * POST /v1/catalog/cache/invalidate
 * Invalidate catalog cache (admin only)
 */
catalogRoutes.post(
  '/cache/invalidate',
  // TODO: Add admin authentication middleware
  asyncHandler(async (c: Context) => {
    const traceId = c.get('traceId')
    
    const invalidated = await productCache.invalidateAll()
    
    return c.json({
      success: true,
      data: {
        invalidatedKeys: invalidated
      },
      meta: {
        traceId,
        timestamp: new Date().toISOString()
      }
    })
  })
)

// =======================
// Export
// =======================

export { catalogRoutes }
