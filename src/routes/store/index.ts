/**
 * Store Routes Index - WooCommerce Store API Proxy
 * 
 * Aggregates all store-related routes and applies common middleware.
 */

import { Hono } from 'hono'
import { logger } from '../../observability/logger'
import { cartTokenMiddleware } from '../../lib/cartToken'
import { config } from '../../config/env'

// Import store route modules
import productsRoutes from './products'
import categoriesRoutes from './categories'
import cartRoutes from './cart'
import checkoutRoutes from './checkout'

const store = new Hono()

// =======================
// Middleware
// =======================

// Apply cart token middleware to all store routes
store.use('*', cartTokenMiddleware(`${config.woocommerce.apiUrl}/wp-json/wc/store/v1`))

// =======================
// Route Registration
// =======================

// Register store routes
store.route('/products', productsRoutes)
store.route('/categories', categoriesRoutes)
store.route('/cart', cartRoutes)
store.route('/checkout', checkoutRoutes)

// =======================
// Store API Info
// =======================

/**
 * GET /store - Store API information
 */
store.get('/', (c) => {
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  logger.info('Store API info requested', { traceId })
  
  return c.json({
    name: 'Optia Store API',
    version: '1.0.0',
    description: 'WooCommerce Store API proxy with Cart-Token support',
    endpoints: {
      products: {
        list: 'GET /store/products',
        detail: 'GET /store/products/:id'
      },
      categories: {
        list: 'GET /store/categories',
        detail: 'GET /store/categories/:id'
      },
      cart: {
        get: 'GET /store/cart',
        add_item: 'POST /store/cart/add-item',
        update_items: 'PUT /store/cart/items',
        remove_item: 'POST /store/cart/remove-item',
        clear: 'DELETE /store/cart'
      },
      checkout: {
        get: 'GET /store/checkout',
        update: 'PUT /store/checkout',
        process: 'POST /store/checkout'
      }
    },
    features: {
      cart_token: 'Automatic Cart-Token management',
      idempotency: 'Idempotency-Key support for checkout',
      caching: 'Intelligent caching with tag-based invalidation',
      error_handling: 'Standardized error responses'
    }
  })
})

export default store
