/**
 * Request Validation Middleware for Edge Runtime
 * Uses Zod for schema validation
 */

import { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { logger } from '../utils/logger'

export interface ValidationTarget {
  body?: z.ZodSchema
  query?: z.ZodSchema
  params?: z.ZodSchema
  headers?: z.ZodSchema
}

/**
 * Main validation middleware factory
 */
export function validateRequest(schemas: ValidationTarget) {
  return async (c: Context, next: Next) => {
    const errors: Record<string, any> = {}

    try {
      // Validate request body
      if (schemas.body) {
        try {
          const body = await c.req.json()
          const validatedBody = schemas.body.parse(body)
          c.set('validatedBody', validatedBody)
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.body = formatZodErrors(error)
          } else {
            errors.body = 'Invalid JSON in request body'
          }
        }
      }

      // Validate query parameters
      if (schemas.query) {
        try {
          const query = Object.fromEntries(new URL(c.req.url).searchParams)
          const validatedQuery = schemas.query.parse(query)
          c.set('validatedQuery', validatedQuery)
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.query = formatZodErrors(error)
          }
        }
      }

      // Validate path parameters
      if (schemas.params) {
        try {
          const params = c.req.param()
          const validatedParams = schemas.params.parse(params)
          c.set('validatedParams', validatedParams)
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.params = formatZodErrors(error)
          }
        }
      }

      // Validate headers
      if (schemas.headers) {
        try {
          const headers = Object.fromEntries(
            Object.entries(c.req.header()).map(([key, value]) => [key.toLowerCase(), value])
          )
          const validatedHeaders = schemas.headers.parse(headers)
          c.set('validatedHeaders', validatedHeaders)
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.headers = formatZodErrors(error)
          }
        }
      }

      // Check if there were any validation errors
      if (Object.keys(errors).length > 0) {
        logger.warn('Request validation failed', {
          path: c.req.path,
          method: c.req.method,
          errors,
          userAgent: c.req.header('user-agent')
        })

        throw new HTTPException(400, {
          message: 'Validation failed',
          res: new Response(JSON.stringify({
            error: 'Validation failed',
            details: errors
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        })
      }

      await next()
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }
      
      logger.error('Validation middleware error', { error })
      throw new HTTPException(500, { message: 'Internal validation error' })
    }
  }
}

/**
 * Format Zod validation errors for API response
 */
function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {}
  
  error.issues.forEach(issue => {
    const path = issue.path.join('.')
    if (!formatted[path]) {
      formatted[path] = []
    }
    formatted[path].push(issue.message)
  })
  
  return formatted
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.string().optional().default('1').transform(Number).pipe(z.number().min(1)),
    limit: z.string().optional().default('20').transform(Number).pipe(z.number().min(1).max(100)),
    offset: z.string().optional().transform(val => val ? Number(val) : 0).pipe(z.number().min(0))
  }),

  // Sorting
  sort: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('asc')
  }),

  // ID parameter
  idParam: z.object({
    id: z.string().transform(Number).pipe(z.number().positive())
  }),

  // Search
  search: z.object({
    q: z.string().min(1).max(100).optional(),
    query: z.string().min(1).max(100).optional()
  }),

  // Date ranges
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional()
  }),

  // API Key header
  apiKeyHeaders: z.object({
    'x-api-key': z.string().min(32)
  }),

  // Product filters
  productFilters: z.object({
    category: z.string().optional(),
    status: z.enum(['publish', 'draft', 'private']).optional(),
    featured: z.string().transform(val => val === 'true').optional(),
    inStock: z.string().transform(val => val === 'true').optional(),
    minPrice: z.string().transform(Number).pipe(z.number().min(0)).optional(),
    maxPrice: z.string().transform(Number).pipe(z.number().min(0)).optional()
  })
}

/**
 * Validate body with schema
 */
export function validateBody<T extends z.ZodSchema>(schema: T) {
  return validateRequest({ body: schema })
}

/**
 * Validate query parameters with schema
 */
export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return validateRequest({ query: schema })
}

/**
 * Validate path parameters with schema
 */
export function validateParams<T extends z.ZodSchema>(schema: T) {
  return validateRequest({ params: schema })
}

/**
 * Get validated data from context
 */
export function getValidated<T = any>(c: Context, type: 'body' | 'query' | 'params' | 'headers'): T {
  const key = `validated${type.charAt(0).toUpperCase() + type.slice(1)}`
  return c.get(key) as T
}

/**
 * Product creation/update schema
 */
export const productSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  short_description: z.string().optional(),
  sku: z.string().optional(),
  price: z.number().min(0).optional(),
  sale_price: z.number().min(0).optional(),
  stock_quantity: z.number().int().min(0).optional(),
  status: z.enum(['publish', 'draft', 'private']).default('draft'),
  featured: z.boolean().default(false),
  categories: z.array(z.number()).optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(z.string().url()).optional(),
  weight: z.number().min(0).optional(),
  dimensions: z.object({
    length: z.number().min(0),
    width: z.number().min(0),
    height: z.number().min(0)
  }).optional(),
  attributes: z.record(z.string(), z.any()).optional()
})

/**
 * Cart item schema
 */
export const cartItemSchema = z.object({
  product_id: z.number().positive(),
  quantity: z.number().int().min(1).max(100), // Reduced from 999 to prevent abuse
  variation_id: z.number().positive().optional(),
  variation: z.record(z.string(), z.string()).optional(),
  // Note: price validation happens server-side for security
})

/**
 * Order schema
 */
export const orderSchema = z.object({
  customer_id: z.number().positive().optional(),
  billing: z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    address_1: z.string().min(1),
    address_2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postcode: z.string().min(1),
    country: z.string().length(2).refine(
      (code) => /^[A-Z]{2}$/.test(code), 
      { message: "Country must be a valid 2-letter ISO code (uppercase)" }
    )
  }),
  shipping: z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    address_1: z.string().min(1),
    address_2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postcode: z.string().min(1),
    country: z.string().length(2).refine(
      (code) => /^[A-Z]{2}$/.test(code), 
      { message: "Country must be a valid 2-letter ISO code (uppercase)" }
    )
  }).optional(),
  line_items: z.array(cartItemSchema),
  shipping_method: z.string().optional(),
  payment_method: z.string().optional(),
  currency: z.string().length(3).refine(
    (code) => /^[A-Z]{3}$/.test(code),
    { message: "Currency must be a valid 3-letter ISO code (uppercase)" }
  ).default('USD'),
  coupon_codes: z.array(z.string()).optional()
})
