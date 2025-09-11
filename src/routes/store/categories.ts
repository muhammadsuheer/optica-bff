/**
 * Store Categories Routes - WooCommerce Store API Proxy
 * 
 * Provides fast category listing and detail endpoints using Supabase read model.
 * Cached with tag-based invalidation for performance.
 */

import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { logger } from '../../observability/logger'
import { errorJson } from '../../lib/errors'
import { taggedCacheService } from '../../services/cache'
import { categoryService } from '../../services/categoryService'

const categories = new Hono()

// =======================
// Request Schemas
// =======================

const categoryListSchema = z.object({
  page: z.coerce.number().int().min(1).max(100).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  parent: z.coerce.number().int().optional(),
  hide_empty: z.coerce.boolean().default(false),
  orderby: z.enum(['name', 'slug', 'count', 'id']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc')
})

// =======================
// Category DTOs
// =======================

interface CategoryDTO {
  id: number
  wc_id: number
  name: string
  slug: string
  description: string
  parent_id: number | null
  count: number
  image?: {
    id: number
    src: string
    name: string
    alt: string
  }
}

interface CategoryDetailDTO extends CategoryDTO {
  children?: CategoryDTO[]
  products?: {
    id: number
    name: string
    slug: string
    price: number
    image?: string
  }[]
}

// =======================
// Routes
// =======================

/**
 * GET /store/categories - List categories
 */
categories.get('/', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    // Parse and validate query parameters
    const query = c.req.query()
    const params = categoryListSchema.parse(query)
    
    // Generate cache key
    const cacheKey = `store:categories:${JSON.stringify(params)}`
    
    // Try cache first
    const cached = await taggedCacheService.getOrSetJson<CategoryDTO[]>(
      cacheKey,
      300, // TTL in seconds
      async (): Promise<any> => {
        // Fetch from database
        const categories = await categoryService.getCategories()
        
        // Apply filters
        let filteredCategories = categories
        
        if (params.search) {
          filteredCategories = filteredCategories.filter(cat =>
            cat.name.toLowerCase().includes(params.search!.toLowerCase()) ||
            cat.description?.toLowerCase().includes(params.search!.toLowerCase())
          )
        }
        
        if (params.parent !== undefined) {
          filteredCategories = filteredCategories.filter(cat => cat.parent_id === params.parent)
        }
        
        if (params.hide_empty) {
          filteredCategories = filteredCategories.filter(cat => cat.count > 0)
        }
        
        // Apply sorting
        filteredCategories.sort((a, b) => {
          const aValue = a[params.orderby]
          const bValue = b[params.orderby]
          
          if (params.order === 'asc') {
            return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
          } else {
            return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
          }
        })
        
        // Apply pagination
        const startIndex = (params.page - 1) * params.per_page
        const endIndex = startIndex + params.per_page
        const paginatedCategories = filteredCategories.slice(startIndex, endIndex)
        
        // Transform to DTOs
        return paginatedCategories.map(category => ({
          id: category.id,
          wc_id: category.wc_id,
          name: category.name,
          slug: category.slug,
          description: category.description || '',
          parent_id: category.parent_id,
          count: category.count
        }))
      },
      ['store:categories', 'list'] // tags
    )
    
    const latencyMs = Date.now() - startTime
    
    logger.info('Store categories fetched', {
      traceId,
      params,
      count: (cached as any)?.length || 0,
      latencyMs,
      cacheHit: true
    })
    
    return c.json({
      categories: cached,
      pagination: {
        page: params.page,
        per_page: params.per_page,
        total: (cached as any)?.length || 0
      }
    })
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    if (error instanceof HTTPException) {
      logger.warn('Store categories request error', {
        traceId,
        error: error.message,
        status: error.status,
        latencyMs
      })
      throw error
    }
    
    logger.error('Store categories error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      latencyMs})
    
    return errorJson(c, 'STORE_CATEGORIES_ERROR', 'Failed to fetch categories', 500, {
      traceId
    })
  }
})

/**
 * GET /store/categories/:id - Get category details
 */
categories.get('/:id', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    const id = parseInt(c.req.param('id'))
    if (isNaN(id)) {
      return errorJson(c, 'INVALID_CATEGORY_ID', 'Invalid category ID', 400, {
        traceId,
        categoryId: c.req.param('id')
      })
    }
    
    // Generate cache key
    const cacheKey = `store:category:${id}`
    
    // Try cache first
    const cached = await taggedCacheService.getOrSetJson<CategoryDetailDTO>(
      cacheKey,
      300, // TTL in seconds
      async (): Promise<any> => {
        // Fetch from database
        const category = await categoryService.getCategoryByWcId(id)
        if (!category) {
          return null
        }
        
        // Get child categories
        const allCategories = await categoryService.getCategories()
        const children = allCategories
          .filter(cat => cat.parent_id === category.id)
          .map(cat => ({
            id: cat.id,
            wc_id: cat.wc_id,
            name: cat.name,
            slug: cat.slug,
            description: cat.description || '',
            parent_id: cat.parent_id,
            count: cat.count
          }))
        
        // Transform to detailed DTO
        return {
          id: category.id,
          wc_id: category.wc_id,
          name: category.name,
          slug: category.slug,
          description: category.description || '',
          parent_id: category.parent_id,
          count: category.count,
          children: children.length > 0 ? children : undefined
        }
      },
      ['store:categories', `category:${id}`] // tags
    )
    
    if (!cached) {
      return errorJson(c, 'CATEGORY_NOT_FOUND', 'Category not found', 404, {
        traceId,
        categoryId: id
      })
    }
    
    const latencyMs = Date.now() - startTime
    
    logger.info('Store category fetched', {
      traceId,
      categoryId: id,
      latencyMs,
      cacheHit: true
    })
    
    return c.json({ category: cached })
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    if (error instanceof HTTPException) {
      logger.warn('Store category request error', {
        traceId,
        error: error.message,
        status: error.status,
        latencyMs
      })
      throw error
    }
    
    logger.error('Store category error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      latencyMs})
    
    return errorJson(c, 'STORE_CATEGORY_ERROR', 'Failed to fetch category', 500, {
      traceId
    })
  }
})

export default categories
