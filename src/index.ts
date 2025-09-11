/**
 * Optia BFF (Backend for Frontend) - Edge Runtime Compatible
 * Built with HonoJS for Vercel Edge Functions
 */

import { Hono } from 'hono'

type Variables = {
  traceId: string
}
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { logger as honoLogger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import { v4 as uuidv4 } from 'uuid'

// Import configuration and utilities
import { config } from './config/env'
import { logger } from './observability/logger'

// Import routes (keep only non-legacy routes)
import authRoutes from './routes/auth'
import healthRoutes from './routes/health'
import ordersRoutes from './routes/orders'
import customersRoutes from './routes/customers'
import woocommerceRoutes from './routes/woocommerce'
import syncRoutes from './routes/sync'
import metricsRoutes from './routes/metrics'

// Import new store and payment routes
import storeRoutes from './routes/store'
import payfastRoutes from './routes/payments/payfast'
import wooWebhookRoutes from './routes/webhooks/woo'
import replayRoutes from './routes/ops/replay'
import docsRoutes from './routes/docs'

// Import middleware
import { rateLimitByKeyAndIP } from './middleware/rateLimiter'
import { performanceMonitoring } from './middleware/performance'
import { requestDeduplication } from './middleware/deduplication'

// Environment validation is handled in edgeEnv.ts at startup

// Initialize Hono app
const app = new Hono<{ Variables: Variables }>()

// Global middleware - order matters!
app.use('*', performanceMonitoring())

app.use('*', requestDeduplication())

// traceId middleware
app.use('*', async (c, next) => {
  if (!(c as any).get('traceId')) (c as any).set('traceId', uuidv4()) // TODO: Fix Hono context typing
  await next()
})

app.use('*', honoLogger((message) => {
  logger.info(message)
}))

app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", config.supabase.url, "https://*.supabase.co"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },
  crossOriginEmbedderPolicy: false, // Disable for Edge compatibility
}))

app.use('*', cors({
  origin: config.cors.origins,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Session-ID',
    'X-Cart-Session',
    'X-Requested-With',
    'Cart-Token',
    'Idempotency-Key'
  ],
  exposeHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-Response-Time'
  ],
  credentials: true,
  maxAge: 86400
}))

// Global rate limiting
app.use('*', rateLimitByKeyAndIP('global', {
  requests: config.rateLimiting.requests, 
  window: config.rateLimiting.window
}))

// Health check routes (no API key required)
app.route('/health', healthRoutes)

// Documentation routes (no API key required)
app.route('/docs', docsRoutes)

// Store API routes (public with Cart-Token support)
app.route('/store', storeRoutes as any) // TODO: Fix route typing

// Payment routes
app.route('/payments/payfast', payfastRoutes)

// Webhook routes
app.route('/webhooks/woo', wooWebhookRoutes)

// Operations routes (admin API key required)
app.route('/ops/replay', replayRoutes)

// Legacy API routes with authentication (removed legacy products/cart routes)
app.route('/api/auth', authRoutes)
app.route('/api/orders', ordersRoutes)
app.route('/api/customers', customersRoutes)
app.route('/api/woocommerce', woocommerceRoutes)
app.route('/api/sync', syncRoutes)
app.route('/api/metrics', metricsRoutes)

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Optia BFF',
    version: '1.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      docs: '/docs',
      store: '/store',
      payments: '/payments/payfast',
      webhooks: '/webhooks/woo',
      operations: '/ops/replay',
      legacy: {
        auth: '/api/auth',
        products: '/api/products',
        cart: '/api/cart',
        orders: '/api/orders',
        customers: '/api/customers',
        woocommerce: '/api/woocommerce',
        sync: '/api/sync',
        webhooks: '/api/webhooks',
        metrics: '/api/metrics'
      }
    }
  })
})

// API documentation endpoint
app.get('/api', (c) => {
  return c.json({
    name: 'Optia BFF API',
    version: '1.0.0',
    documentation: {
      auth: {
        signup: 'POST /api/auth/signup',
        signin: 'POST /api/auth/signin',
        signout: 'POST /api/auth/signout',
        user: 'GET /api/auth/user',
        refresh: 'POST /api/auth/refresh'
      },
      products: {
        list: 'GET /api/products',
        detail: 'GET /api/products/:id',
        search: 'GET /api/products/search',
        categories: 'GET /api/products/categories',
        stream: 'GET /api/products/stream',
        popular: 'GET /api/products/popular'
      },
      cart: {
        get: 'GET /api/cart',
        add: 'POST /api/cart/items',
        update: 'PUT /api/cart/items/:itemId',
        remove: 'DELETE /api/cart/items/:itemId',
        clear: 'DELETE /api/cart',
        totals: 'GET /api/cart/totals'
      },
      metrics: {
        performance: 'GET /api/metrics/performance',
        cache: 'GET /api/metrics/cache',
        circuitBreakers: 'GET /api/metrics/circuit-breakers'
      }
    },
    authentication: {
      apiKey: 'Required for all API endpoints via X-API-Key header',
      jwt: 'Required for protected endpoints via Authorization: Bearer <token> header'
    }
  })
})

// Performance metrics are available via /api/metrics routes

// Global error handler
app.onError((err, c) => {
  const traceId = (c as any).get('traceId') || 'unknown'
  
  if (err instanceof HTTPException) {
    logger.warn('HTTP Exception', {
      status: err.status,
      message: err.message,
      path: c.req.path,
      method: c.req.method,
      traceId
    })
    
    return c.json({
      error: {
        code: 'HTTP_EXCEPTION',
        message: err.message,
        traceId,
        timestamp: new Date().toISOString()
      }
    }, err.status)
  }

  logger.error('Unhandled error', err instanceof Error ? err : new Error('Unknown error'), {
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
    traceId})

  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal Server Error',
      traceId,
      timestamp: new Date().toISOString()
    }
  }, 500)
})

// 404 handler
app.notFound((c) => {
  const traceId = (c as any).get('traceId') || 'unknown'
  
  logger.warn('Route not found', {
    path: c.req.path,
    method: c.req.method,
    userAgent: c.req.header('user-agent'),
    traceId
  })

  return c.json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${c.req.method} ${c.req.path} not found`,
      traceId,
      timestamp: new Date().toISOString()
    }
  }, 404)
})

// Startup logging
logger.info('Optia BFF starting', {
  name: 'Optia BFF',
  version: '1.0.0',
  environment: config.nodeEnv,
  runtime: 'edge'
})

// Export for Vercel Edge Functions
export default app