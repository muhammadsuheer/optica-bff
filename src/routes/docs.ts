/**
 * Documentation Routes
 * 
 * Serves OpenAPI specification and API documentation.
 */

import { Hono } from 'hono'
import { logger } from '../observability/logger'
import { openApiSpec } from '../docs/openapi'

const docs = new Hono()

/**
 * GET /docs/openapi.json - Serve OpenAPI specification
 */
docs.get('/openapi.json', (c) => {
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  logger.info('OpenAPI specification requested', { traceId })
  
  return c.json(openApiSpec)
})

/**
 * GET /docs - API documentation info
 */
docs.get('/', (c) => {
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  logger.info('API documentation requested', { traceId })
  
  return c.json({
    name: 'Optia BFF API Documentation',
    version: '1.0.0',
    description: 'Backend for Frontend API with WooCommerce Store API proxy and PayFast integration',
    openapi: '/docs/openapi.json',
    endpoints: {
      store: {
        products: 'GET /store/products',
        product: 'GET /store/products/:id',
        cart: 'GET /store/cart',
        'cart-add': 'POST /store/cart/add-item',
        'cart-update': 'PUT /store/cart/items',
        'cart-remove': 'POST /store/cart/remove-item',
        'cart-clear': 'DELETE /store/cart',
        checkout: 'GET /store/checkout',
        'checkout-update': 'PUT /store/checkout',
        'checkout-process': 'POST /store/checkout'
      },
      payments: {
        'payfast-start': 'POST /payments/payfast/start',
        'payfast-return': 'GET /payments/payfast/return',
        'payfast-itn': 'POST /payments/payfast/itn'
      },
      webhooks: {
        woo: 'POST /webhooks/woo'
      },
      operations: {
        'replay-dlq': 'POST /ops/replay/:id'
      }
    },
    features: {
      cart_token: 'Automatic Cart-Token management for WooCommerce Store API',
      idempotency: 'Idempotency-Key support for safe retries',
      caching: 'Intelligent caching with tag-based invalidation',
      error_handling: 'Standardized error responses with trace IDs',
      webhooks: 'Edge-safe webhook processing with QStash enqueuing',
      reconciliation: 'Periodic sync with checkpoint-based reconciliation',
      dlq: 'Dead Letter Queue for failed job processing and replay'
    }
  })
})

export default docs
