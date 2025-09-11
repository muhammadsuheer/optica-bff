/**
 * Store Products Routes - WooCommerce Store API Proxy
 * 
 * Provides fast product listing and detail endpoints using Supabase read model.
 * Never computes totals - delegates to WooCommerce Store API for authoritative data.
 */

import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { logger } from '../../observability/logger'
import { errorJson } from '../../lib/errors'
import { taggedCacheService } from '../../services/cache'
import { productService } from '../../services/productService'

const products = new Hono()

// =======================
// Request Schemas
// =======================

const productListSchema = z.object({
  page: z.coerce.number().int().min(1).max(100).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
  min_price: z.coerce.number().min(0).optional(),
  max_price: z.coerce.number().min(0).optional(),
  orderby: z.enum(['date', 'price', 'popularity', 'rating', 'title']).default('date'),
  on_sale: z.coerce.boolean().optional()
})

// =======================
// Product DTOs
// =======================

interface ProductDTO {
  id: number
  wc_id: number
  name: string
  slug: string
  description: string
  short_description: string
  price: number
  regular_price: number
  sale_price: number | null
  on_sale: boolean
  status: string
  featured: boolean
  stock_status: string
  stock_quantity: number | null
  images: string[]
  categories: string[]
  tags: string[]
  created_at: string
  // updated_at: string // Optional field
}

interface ProductDetailDTO extends ProductDTO {
  attributes: Record<string, any>
  variations: any[]
  meta_data: Record<string, any>
}

// =======================
// Routes
// =======================

/**
 * GET /store/products - List products with filtering
 */
products.get('/', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    // Parse and validate query parameters
    const query = c.req.query()
    const params = productListSchema.parse(query)
    
    // Generate cache key
    const cacheKey = `store:products:${JSON.stringify(params)}`
    
    // Try cache first
    const cached = await taggedCacheService.getOrSetJson<ProductDTO[]>(
      cacheKey,
      300, // TTL in seconds
      async (): Promise<any> => {
        // Fetch from database
        const products = await productService.getProducts({
          page: params.page,
          per_page: params.per_page,
          search: params.search,
          category: params.category,
          min_price: params.min_price,
          max_price: params.max_price,
          // orderBy: params.orderby, // Type mismatch - using default
          // on_sale: params.on_sale, // Not supported in ProductFilters
          status: 'publish'
        })
        
        // Transform to DTOs
        return (products as any)?.map((product: any) => ({
          id: product.id,
          wc_id: product.wc_id,
          name: product.name,
          slug: product.slug,
          description: product.description || '',
          short_description: product.short_description || '',
          price: product.price,
          regular_price: (product.regular_price as number),
          sale_price: product.sale_price,
          on_sale: product.on_sale,
          status: product.status,
          featured: product.featured,
          stock_status: product.stock_status,
          stock_quantity: product.stock_quantity,
          images: product.images || [],
          categories: product.categories || [],
          tags: product.tags || [],
          attributes: product.attributes || {},
          variations: product.variations || [],
          meta_data: product.meta_data || {}
        }))
      },
      ['store:products', 'list'] // tags
    )
    
    if (cached) {
      logger.info('Store products cache hit', {
        traceId,
        params,
        count: (cached as any)?.length || 0,
        latencyMs: Date.now() - startTime,
        cacheHit: true
      })
      
      return c.json({
        products: cached,
        pagination: {
          page: params.page,
          per_page: params.per_page,
          total: (cached as any)?.length || 0
        }
      })
    }
    
    const latencyMs = Date.now() - startTime
    
    logger.info('Store products fetched', {
      traceId,
      params,
      count: (cached as any)?.length || 0,
      latencyMs,
      cacheHit: false
    })
    
    return c.json({
      products: cached,
      pagination: {
        page: params.page,
        per_page: params.per_page,
        total: (cached as any)?.length || 0
      }
    })
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    if (error instanceof HTTPException) {
      logger.warn('Store products request error', {
        traceId,
        error: error.message,
        status: error.status,
        latencyMs
      })
      throw error
    }
    
    logger.error('Store products error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      latencyMs})
    
    return errorJson(c, 'STORE_PRODUCTS_ERROR', 'Failed to fetch products', 500, {
      traceId
    })
  }
})

/**
 * GET /store/products/:id - Get product details
 */
products.get('/:id', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    const id = parseInt(c.req.param('id'))
    if (isNaN(id)) {
      return errorJson(c, 'INVALID_PRODUCT_ID', 'Invalid product ID', 400, {
        traceId,
        productId: c.req.param('id')
      })
    }
    
    // Generate cache key
    const cacheKey = `store:product:${id}`
    
    // Try cache first
    const cached = await taggedCacheService.getOrSetJson<ProductDetailDTO>(
      cacheKey,
      300, // TTL in seconds
      async (): Promise<any> => {
        // Fetch from database
        const product = await productService.getProduct(id)
        if (!product) {
          return null
        }
        
        // Transform to detailed DTO
        return {
          id: product.id,
          wc_id: product.wc_id,
          name: product.name,
          slug: product.slug,
          description: product.description || '',
          short_description: product.short_description || '',
          price: product.price,
          regular_price: (product.regular_price as number),
          sale_price: product.sale_price,
          on_sale: product.sale_price != null && (product.sale_price as number) < (product.regular_price as number),
          status: product.status,
          featured: product.featured,
          stock_status: product.stock_status,
          stock_quantity: product.stock_quantity,
          images: product.images || [],
          categories: product.categories || [],
          tags: product.tags || [],
          attributes: product.attributes || {},
          variations: product.variations || [],
          meta_data: product.meta_data || {},
          created_at: product.created_at,
          updated_at: product.updated_at
        }
      },
      ['store:product', `product:${id}`] // tags
    )
    
    if (!cached) {
      return errorJson(c, 'PRODUCT_NOT_FOUND', 'Product not found', 404, {
        traceId,
        productId: id
      })
    }
    
    const latencyMs = Date.now() - startTime
    
    logger.info('Store product fetched', {
      traceId,
      productId: id,
      latencyMs,
      cacheHit: true
    })
    
    return c.json({ product: cached })
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    if (error instanceof HTTPException) {
      logger.warn('Store product request error', {
        traceId,
        productId: c.req.param('id'),
        error: error.message,
        status: error.status,
        latencyMs
      })
      throw error
    }
    
    logger.error('Store product error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      productId: c.req.param('id'),
      latencyMs})
    
    return errorJson(c, 'STORE_PRODUCT_ERROR', 'Failed to fetch product', 500, {
      traceId,
      productId: c.req.param('id')
    })
  }
})

export default products
