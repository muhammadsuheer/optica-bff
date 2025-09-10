/**
 * WooCommerce Integration Routes for Edge Runtime
 * Handles WooCommerce API synchronization and webhooks
 */

import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import databaseService from '../services/databaseService'
import { logger } from '../utils/logger'
import { validateRequest, getValidated, commonSchemas } from '../middleware/validateRequest'
import { apiKey, hasPermission } from '../middleware/apiKey'
import { requireRole } from '../middleware/auth'
import { endpointRateLimit } from '../middleware/rateLimiter'
import { config } from '../config/env'

const woocommerce = new Hono()

// Request schemas
const syncProductsSchema = z.object({
  page: z.number().min(1).default(1),
  per_page: z.number().min(1).max(100).default(20),
  force: z.boolean().default(false)
})

const syncOrdersSchema = z.object({
  page: z.number().min(1).default(1),
  per_page: z.number().min(1).max(100).default(20),
  after: z.string().datetime().optional(),
  before: z.string().datetime().optional()
})

const webhookEventSchema = z.object({
  id: z.number(),
  action: z.enum(['created', 'updated', 'deleted']),
  resource: z.enum(['product', 'order', 'customer']),
  data: z.any()
})

// Apply middleware
woocommerce.use('*', apiKey({ allowedKeyTypes: ['admin'] }))
woocommerce.use('/sync/*', endpointRateLimit('wc-sync', { requests: 10, window: 60 })) // 10 sync requests per minute

/**
 * POST /woocommerce/sync/products - Sync products from WooCommerce
 */
woocommerce.post('/sync/products',
  requireRole(['admin', 'service_role']),
  validateRequest({ body: syncProductsSchema }),
  async (c) => {
    try {
      const { page, per_page, force } = getValidated<z.infer<typeof syncProductsSchema>>(c, 'body')
      
      logger.info('Starting product sync', { page, per_page, force })
      
      // Fetch products from WooCommerce API
      const wcProducts = await fetchWooCommerceProducts(page, per_page)
      
      if (!wcProducts || wcProducts.length === 0) {
        return c.json({
          message: 'No products found to sync',
          synced: 0,
          page,
          per_page
        })
      }

      // Transform and save products
      const syncedProducts = []
      for (const wcProduct of wcProducts) {
        try {
          const transformedProduct = transformWooProduct(wcProduct)
          const savedProduct = await databaseService.createProduct(transformedProduct)
          
          if (savedProduct) {
            syncedProducts.push(savedProduct)
          }
        } catch (error) {
          logger.warn('Failed to sync product', { 
            productId: wcProduct.id, 
            error: (error as Error).message 
          })
        }
      }

      logger.info('Product sync completed', {
        requested: wcProducts.length,
        synced: syncedProducts.length,
        page,
        per_page
      })

      return c.json({
        message: 'Products synced successfully',
        synced: syncedProducts.length,
        total_requested: wcProducts.length,
        page,
        per_page,
        products: syncedProducts.map(p => ({ id: p.id, name: p.name }))
      })
    } catch (error) {
      logger.error('Product sync error', { error })
      throw new HTTPException(500, { message: 'Product sync failed' })
    }
  }
)

/**
 * POST /woocommerce/sync/orders - Sync orders from WooCommerce
 */
woocommerce.post('/sync/orders',
  requireRole(['admin', 'service_role']),
  validateRequest({ body: syncOrdersSchema }),
  async (c) => {
    try {
      const { page, per_page, after, before } = getValidated<z.infer<typeof syncOrdersSchema>>(c, 'body')
      
      logger.info('Starting order sync', { page, per_page, after, before })
      
      // Fetch orders from WooCommerce API
      const wcOrders = await fetchWooCommerceOrders(page, per_page, after, before)
      
      if (!wcOrders || wcOrders.length === 0) {
        return c.json({
          message: 'No orders found to sync',
          synced: 0,
          page,
          per_page
        })
      }

      // Transform and save orders
      const syncedOrders = []
      for (const wcOrder of wcOrders) {
        try {
          const transformedOrder = transformWooOrder(wcOrder)
          const savedOrder = await databaseService.createOrder(transformedOrder)
          
          if (savedOrder) {
            syncedOrders.push(savedOrder)
          }
        } catch (error) {
          logger.warn('Failed to sync order', { 
            orderId: wcOrder.id, 
            error: (error as Error).message 
          })
        }
      }

      logger.info('Order sync completed', {
        requested: wcOrders.length,
        synced: syncedOrders.length,
        page,
        per_page
      })

      return c.json({
        message: 'Orders synced successfully',
        synced: syncedOrders.length,
        total_requested: wcOrders.length,
        page,
        per_page,
        orders: syncedOrders.map(o => ({ id: o.id, status: o.status }))
      })
    } catch (error) {
      logger.error('Order sync error', { error })
      throw new HTTPException(500, { message: 'Order sync failed' })
    }
  }
)

/**
 * POST /woocommerce/webhook - Handle WooCommerce webhooks
 */
woocommerce.post('/webhook',
  validateRequest({ body: webhookEventSchema }),
  async (c) => {
    try {
      const event = getValidated<z.infer<typeof webhookEventSchema>>(c, 'body')
      
      logger.info('Processing webhook event', {
        action: event.action,
        resource: event.resource,
        id: event.id
      })

      // Process webhook based on resource type
      switch (event.resource) {
        case 'product':
          await handleProductWebhook(event)
          break
        case 'order':
          await handleOrderWebhook(event)
          break
        case 'customer':
          await handleCustomerWebhook(event)
          break
        default:
          logger.warn('Unknown webhook resource', { resource: event.resource })
      }

      return c.json({
        message: 'Webhook processed successfully',
        event: {
          resource: event.resource,
          action: event.action,
          id: event.id
        }
      })
    } catch (error) {
      logger.error('Webhook processing error', { error })
      throw new HTTPException(500, { message: 'Webhook processing failed' })
    }
  }
)

/**
 * GET /woocommerce/status - Get sync status and statistics
 */
woocommerce.get('/status',
  requireRole(['admin', 'service_role']),
  async (c) => {
    try {
      const status = await getSyncStatus()
      
      return c.json(status)
    } catch (error) {
      logger.error('Get sync status error', { error })
      throw new HTTPException(500, { message: 'Failed to get sync status' })
    }
  }
)

/**
 * Helper Functions
 */

/**
 * Fetch products from WooCommerce API
 */
async function fetchWooCommerceProducts(page: number, per_page: number): Promise<any[]> {
  const url = `${config.woocommerce.apiUrl}/products`
  const params = new URLSearchParams({
    page: page.toString(),
    per_page: per_page.toString(),
    status: 'publish'
  })

  const response = await fetch(`${url}?${params}`, {
    headers: {
      'Authorization': `Basic ${btoa(`${config.woocommerce.readKeys.consumerKey}:${config.woocommerce.readKeys.consumerSecret}`)}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Fetch orders from WooCommerce API
 */
async function fetchWooCommerceOrders(
  page: number, 
  per_page: number, 
  after?: string, 
  before?: string
): Promise<any[]> {
  const url = `${config.woocommerce.apiUrl}/orders`
  const params = new URLSearchParams({
    page: page.toString(),
    per_page: per_page.toString()
  })

  if (after) params.append('after', after)
  if (before) params.append('before', before)

  const response = await fetch(`${url}?${params}`, {
    headers: {
      'Authorization': `Basic ${btoa(`${config.woocommerce.readKeys.consumerKey}:${config.woocommerce.readKeys.consumerSecret}`)}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

/**
 * Transform WooCommerce product to database format
 */
function transformWooProduct(wcProduct: any) {
  return {
    wc_id: wcProduct.id,
    name: wcProduct.name,
    slug: wcProduct.slug,
    description: wcProduct.description,
    short_description: wcProduct.short_description,
    sku: wcProduct.sku,
    price: wcProduct.price ? Math.round(parseFloat(wcProduct.price) * 100) / 100 : 0,
    sale_price: wcProduct.sale_price ? Math.round(parseFloat(wcProduct.sale_price) * 100) / 100 : null,
    stock_quantity: wcProduct.stock_quantity,
    status: wcProduct.status,
    featured: wcProduct.featured,
    images: wcProduct.images?.map((img: any) => img.src) || [],
    categories: wcProduct.categories?.map((cat: any) => cat.id) || [],
    tags: wcProduct.tags?.map((tag: any) => tag.name) || [],
    attributes: wcProduct.attributes || {},
    weight: wcProduct.weight ? parseFloat(wcProduct.weight) : null,
    dimensions: wcProduct.dimensions || {},
    date_created: wcProduct.date_created,
    date_modified: wcProduct.date_modified,
    synced_at: new Date().toISOString()
  }
}

/**
 * Transform WooCommerce order to database format
 */
function transformWooOrder(wcOrder: any) {
  return {
    wc_id: wcOrder.id,
    order_key: wcOrder.order_key,
    status: wcOrder.status,
    currency: wcOrder.currency,
    total: Math.round(parseFloat(wcOrder.total) * 100) / 100,
    subtotal: Math.round(parseFloat(wcOrder.subtotal || '0') * 100) / 100,
    tax_total: Math.round(parseFloat(wcOrder.total_tax) * 100) / 100,
    shipping_total: Math.round(parseFloat(wcOrder.shipping_total) * 100) / 100,
    customer_id: wcOrder.customer_id || null,
    customer_note: wcOrder.customer_note || null,
    billing: wcOrder.billing || {},
    shipping: wcOrder.shipping || {},
    line_items: wcOrder.line_items || [],
    payment_method: wcOrder.payment_method,
    payment_method_title: wcOrder.payment_method_title,
    date_created: wcOrder.date_created,
    date_modified: wcOrder.date_modified,
    date_completed: wcOrder.date_completed,
    date_paid: wcOrder.date_paid,
    synced_at: new Date().toISOString()
  }
}

/**
 * Handle product webhook events
 */
async function handleProductWebhook(event: any) {
  switch (event.action) {
    case 'created':
    case 'updated':
      const transformedProduct = transformWooProduct(event.data)
      await databaseService.createProduct(transformedProduct)
      break
    case 'deleted':
      // Handle product deletion if needed
      break
  }
}

/**
 * Handle order webhook events
 */
async function handleOrderWebhook(event: any) {
  switch (event.action) {
    case 'created':
    case 'updated':
      const transformedOrder = transformWooOrder(event.data)
      await databaseService.createOrder(transformedOrder)
      break
    case 'deleted':
      // Handle order deletion if needed
      break
  }
}

/**
 * Handle customer webhook events
 */
async function handleCustomerWebhook(event: any) {
  switch (event.action) {
    case 'created':
    case 'updated':
      // Handle customer sync if needed
      break
    case 'deleted':
      // Handle customer deletion if needed
      break
  }
}

/**
 * Get synchronization status
 */
async function getSyncStatus() {
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  return {
    status: 'operational',
    last_sync: new Date().toISOString(),
    statistics: {
      products: {
        total: 0, // Would query actual count
        synced_today: 0,
        last_sync: null
      },
      orders: {
        total: 0, // Would query actual count
        synced_today: 0,
        last_sync: null
      }
    },
    health: {
      api_reachable: true,
      sync_queue_size: 0,
      error_rate: 0
    }
  }
}

export default woocommerce