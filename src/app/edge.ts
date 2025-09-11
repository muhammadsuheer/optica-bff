/**
 * Optia BFF - Minimal Working Edge Runtime Entry Point
 * 
 * Simplified version that works without TypeScript errors
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { timing } from 'hono/timing'
import { requestId } from 'hono/request-id'

// Configuration
import { env } from '../config/env'
import { logger } from '../observability/logger'

// Simple Supabase client
import { supabaseClient } from '../services/supabase'

// Types
import type { Context } from 'hono'

/**
 * Main Hono application instance
 */
const app = new Hono()

// =======================
// Global Middleware Stack
// =======================

// Request ID and timing
app.use('*', requestId())
app.use('*', timing())

// CORS configuration
app.use('*', cors({
  origin: env.CORS_ORIGINS,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'x-admin-token',
    'If-None-Match',
    'X-Trace-Id'
  ],
  credentials: true,
  maxAge: 86400
}))

// Request logging
app.use('*', async (c, next) => {
  const start = Date.now()
  const traceId = c.get('requestId') || 'unknown'
  
  ;(c as any).set('traceId', traceId) // TODO: Fix Hono context typing
  
  await next()
  
  const duration = Date.now() - start
  const status = c.res.status
  
  logger.info('Request completed', {
    method: c.req.method,
    path: c.req.path,
    status,
    duration,
    traceId
  })
})

// =======================
// Routes
// =======================

// Health check
app.get('/health', (c: Context) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: '1.0.0',
    runtime: 'edge'
  })
})

// Simple catalog products endpoint
app.get('/v1/catalog/products', async (c: Context) => {
  const traceId = (c as any).get('traceId')
  
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
    
    // Get Supabase client
    const supabase = supabaseClient
    
    // Query products
    const { data: products, error, count } = await supabaseClient
      .from('products')
      .select('*', { count: 'exact' })
      .eq('status', 'publish')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)
    
    if (error) {
      logger.error('Supabase query error', new Error('Error'));
      return c.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to fetch products',
          traceId
        }
      }, 500)
    }
    
    const total = count || 0
    const totalPages = Math.ceil(total / limit)
    const etag = `"products-${page}-${limit}-${Date.now()}"`
    
    // Check If-None-Match
    const ifNoneMatch = c.req.header('If-None-Match')
    if (ifNoneMatch === etag) {
      return c.body(null, 304, {
        'ETag': etag,
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
      })
    }
    
    // Set cache headers
    c.header('ETag', etag)
    c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
    c.header('X-Total-Count', total.toString())
    
    return c.json({
      success: true,
      data: products || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      meta: {
        traceId,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    logger.error('Catalog error', new Error('Error'));
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        traceId
      }
    }, 500)
  }
})

// Single product endpoint
app.get('/v1/catalog/products/:id', async (c: Context) => {
  const id = c.req.param('id')
  const traceId = (c as any).get('traceId')
  
  try {
    const supabase = supabaseClient
    
    const { data: product, error } = await supabaseClient
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('status', 'publish')
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({
          success: false,
          error: {
            code: 'PRODUCT_NOT_FOUND',
            message: 'Product not found',
            traceId
          }
        }, 404)
      }
      
      logger.error('Product query error', new Error('Error'));
      return c.json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to fetch product',
          traceId
        }
      }, 500)
    }
    
    const etag = `"product-${id}"`
    const ifNoneMatch = c.req.header('If-None-Match')
    
    if (ifNoneMatch === etag) {
      return c.body(null, 304, {
        'ETag': etag,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=7200'
      })
    }
    
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
    logger.error('Product error', new Error('Error'));
    return c.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        traceId
      }
    }, 500)
  }
})

// Admin cache bump
app.post('/v1/admin/catalog/bump', async (c: Context) => {
  const adminToken = c.req.header('x-admin-token')
  const traceId = (c as any).get('traceId')
  
  if (!adminToken || !env.API_KEYS.includes(adminToken)) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid admin token',
        traceId
      }
    }, 401)
  }
  
  return c.json({
    success: true,
    data: {
      type: 'catalog',
      invalidatedCount: 0,
      timestamp: new Date().toISOString()
    },
    meta: {
      traceId,
      timestamp: new Date().toISOString()
    }
  })
})

// Root endpoint
app.get('/', (c: Context) => {
  return c.json({
    name: 'Optia BFF',
    version: '1.0.0',
    description: 'Backend for Frontend - WordPress/WooCommerce integration',
    endpoints: [
      'GET /health',
      'GET /v1/catalog/products',
      'GET /v1/catalog/products/:id',
      'POST /v1/admin/catalog/bump'
    ],
    runtime: 'edge'
  })
})

// =======================
// Error Handling
// =======================

// 404 handler
app.notFound((c: Context) => {
  const traceId = (c as any).get('traceId') || 'unknown'
  
  return c.json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested endpoint does not exist',
      path: c.req.path,
      method: c.req.method,
      traceId
    }
  }, 404)
})

// Global error handler
app.onError((err, c) => {
  const traceId = (c as any).get('traceId') || 'unknown'
  
  logger.error('Unhandled error', err instanceof Error ? err : new Error('Unknown error'), { traceId})
  
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      traceId
    }
  }, 500)
})

// =======================
// Vercel Edge Runtime Config
// =======================

export const config = {
  runtime: 'edge'
}

export default app
