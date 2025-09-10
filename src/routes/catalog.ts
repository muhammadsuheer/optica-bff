/**
 * Catalog Routes - Product Listings with ETag Caching
 * 
 * Provides cached product endpoints with proper ETag handling
 * and Supabase integration.
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

// Services and adapters
import { productRepository } from '../adapters/supabase'
import { withCache, getListVersion, generateVersionedKey } from '../adapters/cache'
import { logger } from '../utils/logger'

// Types
import type { Context } from 'hono'

// =======================
// Validation Schemas
// =======================

const productListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['publish', 'draft']).optional().default('publish'),
  featured: z.coerce.boolean().optional(),
  search: z.string().min(1).max(100).optional()
})

const productIdSchema = z.object({
  id: z.string().uuid('Invalid product ID format')
})

// =======================
// Router Setup
// =======================

export const catalogRoutes = new Hono()

// =======================
// Product Endpoints
// =======================

/**
 * GET /v1/catalog/products
 * List products with caching and ETag support
 */
catalogRoutes.get(
  '/products',
  zValidator('query', productListSchema),
  async (c: Context) => {
    const filters = c.req.valid('query')
    const traceId = c.get('traceId')
    
    try {
      // Generate cache key with version
      const listVersion = await getListVersion('catalog')
      const cacheKey = generateVersionedKey('catalog', 'products', 
        JSON.stringify(filters), listVersion)
      
      // Check If-None-Match header for 304 response
      const ifNoneMatch = c.req.header('If-None-Match')
      const etag = `"${cacheKey}"`
      
      if (ifNoneMatch === etag) {
        logger.debug('ETag match, returning 304', { traceId, etag })
        return c.body(null, 304, {
          'ETag': etag,
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
        })
      }
      
      // Get products with caching
      const result = await withCache(
        cacheKey,
        async () => {
          const { data: products, count } = await productRepository.findMany({
            status: filters.status,
            featured: filters.featured,
            search: filters.search,
            limit: filters.limit,
            offset: (filters.page - 1) * filters.limit
          })
          
          return {
            products: products || [],
            total: count || 0
          }
        },
        { ttl: 300, namespace: 'catalog' }
      )
      
      const totalPages = Math.ceil(result.total / filters.limit)
      
      // Set cache headers
      c.header('ETag', etag)
      c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
      c.header('Vary', 'Accept-Encoding')
      c.header('X-Total-Count', result.total.toString())
      c.header('X-Page', filters.page.toString())
      
      return c.json({
        success: true,
        data: result.products,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: result.total,
          totalPages,
          hasNext: filters.page < totalPages,
          hasPrev: filters.page > 1
        },
        meta: {
          traceId,
          cached: result.cached || false,
          version: listVersion,
          timestamp: new Date().toISOString()
        }
      })
      
    } catch (error) {
      logger.error('Failed to fetch products', { error, filters, traceId })
      
      return c.json({
        success: false,
        error: {
          code: 'PRODUCT_FETCH_ERROR',
          message: 'Failed to fetch products',
          traceId
        }
      }, 500)
    }
  }
)

/**
 * GET /v1/catalog/products/:id
 * Get single product with caching
 */
catalogRoutes.get(
  '/products/:id',
  zValidator('param', productIdSchema),
  async (c: Context) => {
    const { id } = c.req.valid('param')
    const traceId = c.get('traceId')
    
    try {
      // Generate cache key
      const cacheKey = `catalog:v1:product:${id}`
      
      // Check If-None-Match header
      const ifNoneMatch = c.req.header('If-None-Match')
      const etag = `"product-${id}"`
      
      if (ifNoneMatch === etag) {
        logger.debug('ETag match for product, returning 304', { traceId, id, etag })
        return c.body(null, 304, {
          'ETag': etag,
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200'
        })
      }
      
      // Get product with caching
      const product = await withCache(
        cacheKey,
        async () => {
          const result = await productRepository.findById(id)
          if (!result) {
            throw new Error('Product not found')
          }
          return result
        },
        { ttl: 3600, namespace: 'catalog' }
      )
      
      // Set cache headers
      c.header('ETag', etag)
      c.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200')
      
      return c.json({
        success: true,
        data: product,
        meta: {
          traceId,
          timestamp: new Date().toISOString()
        }
      })
      
    } catch (error) {
      logger.error('Failed to fetch product', { error, id, traceId })
      
      if (error.message === 'Product not found') {
        return c.json({
          success: false,
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found',
            traceId
          }
        }, 404)
      }
      
      return c.json({
        success: false,
        error: {
          code: 'PRODUCT_FETCH_ERROR',
          message: 'Failed to fetch product',
          traceId
        }
      }, 500)
    }
  }
)

export { catalogRoutes }
