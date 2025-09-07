import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { config, validateEnvironment } from './config/env'

// Create Hono app instance
const app = new Hono()

// Global middleware
app.use('*', logger())

// CORS middleware
app.use('*', cors({
  origin: config.cors.origins.filter((origin): origin is string => origin !== undefined),
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  maxAge: 86400 // 24 hours
}))

// Health check endpoint
app.get('/api/health', (c) => {
  const validation = validateEnvironment()
  
  return c.json({
    status: validation.valid ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.app.environment,
    validation: validation.valid ? 'passed' : 'failed',
    errors: validation.valid ? undefined : validation.errors
  })
})

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'Optia BFF',
    version: '1.0.0',
    description: 'Production-ready Backend for Frontend connecting WooCommerce with modern applications',
    environment: config.app.environment,
    endpoints: {
      health: '/api/health',
      products: '/api/v1/products',
      orders: '/api/v1/orders',
      cart: '/api/v1/cart',
      search: '/api/v1/search',
      webhooks: '/api/v1/webhooks',
      admin: '/api/v1/admin'
    },
    documentation: 'https://github.com/muhammadsuheer/optia-bff#readme'
  })
})

// API routes placeholder (will be added in next steps)
app.get('/api/v1/*', (c) => {
  return c.json({
    success: false,
    error: 'Endpoint not implemented yet',
    message: 'This API endpoint is being built. Please check back soon!',
    available_endpoints: ['/api/health']
  }, 501)
})

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    available_endpoints: [
      '/api/health',
      '/api/v1/products',
      '/api/v1/orders', 
      '/api/v1/cart'
    ]
  }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  
  return c.json({
    success: false,
    error: 'Internal Server Error',
    message: config.app.environment === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  }, 500)
})

// Export for Vercel Edge Functions
export default app