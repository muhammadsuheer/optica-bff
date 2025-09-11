/**
 * Store Cart Routes - WooCommerce Store API Proxy
 * 
 * Handles cart operations with Cart-Token management.
 * All operations forward to WooCommerce Store API for authoritative totals/stock/tax.
 */

import { Hono } from 'hono'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { logger } from '../../observability/logger'
import { errorJson } from '../../lib/errors'
import { readCartToken, echoCartToken, forwardCartToken, getOrMintCartToken } from '../../lib/cartToken'
import { config } from '../../config/env'

const cart = new Hono()

// =======================
// Request Schemas
// =======================

const addItemSchema = z.object({
  id: z.number().int().positive(),
  quantity: z.number().int().min(1).max(999),
  variation_id: z.number().int().positive().optional(),
  variation: z.record(z.string(), z.string()).optional()
})

const updateItemsSchema = z.object({
  items: z.array(z.object({
    key: z.string(),
    quantity: z.number().int().min(0).max(999)
  }))
})

const removeItemSchema = z.object({
  key: z.string()
})

// =======================
// WooCommerce Store API Client
// =======================

class WooStoreApiClient {
  private baseUrl: string
  
  constructor() {
    this.baseUrl = `${config.woocommerce.apiUrl}/wp-json/wc/store/v1`
  }
  
  async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    cartToken?: string | null
  ): Promise<{ data: T; cartToken: string | null }> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>
    }
    
    if (cartToken) {
      headers['Cart-Token'] = cartToken
    }
    
    const response = await fetch(url, {
      ...options,
      headers
    })
    
    if (!response.ok) {
      throw new Error(`WooCommerce Store API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    const responseCartToken = response.headers.get('Cart-Token') || response.headers.get('cart-token')
    
    return {
      data: data as T,
      cartToken: responseCartToken
    }
  }
}

const wooStoreApi = new WooStoreApiClient()

// =======================
// Routes
// =======================

/**
 * GET /store/cart - Get cart contents
 */
cart.get('/', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    // Get or mint cart token
    const tokenInfo = await getOrMintCartToken(c, (wooStoreApi as any).baseUrl)
    
    // Fetch cart from WooCommerce Store API
    const { data: cartData, cartToken } = await wooStoreApi.makeRequest(
      '/cart',
      { method: 'GET' },
      tokenInfo.token
    )
    
    const latencyMs = Date.now() - startTime
    
    logger.info('Store cart fetched', {
      traceId,
      cartToken: cartToken ? 'present' : 'missing',
      isNew: tokenInfo.isNew,
      latencyMs
    })
    
    // Echo the cart token in response
    echoCartToken(c, cartToken)
    
    return c.json({
      cart: cartData,
      cart_token: cartToken
    })
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    logger.error('Store cart error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      latencyMs})
    
    return errorJson(c, 'STORE_CART_ERROR', 'Failed to fetch cart', 500, {
      traceId
    })
  }
})

/**
 * POST /store/cart/add-item - Add item to cart
 */
cart.post('/add-item', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    // Parse request body
    const body = await c.req.json()
    const itemData = addItemSchema.parse(body)
    
    // Get cart token
    const cartToken = readCartToken(c)
    
    // Add item via WooCommerce Store API
    const { data: cartData, cartToken: responseCartToken } = await wooStoreApi.makeRequest(
      '/cart/add-item',
      {
        method: 'POST',
        body: JSON.stringify(itemData)
      },
      cartToken
    )
    
    const latencyMs = Date.now() - startTime
    
    logger.info('Store cart item added', {
      traceId,
      productId: itemData.id,
      quantity: itemData.quantity,
      cartToken: responseCartToken ? 'present' : 'missing',
      latencyMs
    })
    
    // Echo the cart token in response
    echoCartToken(c, responseCartToken)
    
    return c.json({
      message: 'Item added to cart',
      cart: cartData,
      cart_token: responseCartToken
    }, 201)
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    if (error instanceof z.ZodError) {
      return errorJson(c, 'VALIDATION_ERROR', 'Invalid request data', 400, {
        traceId,
        errors: error.errors
      })
    }
    
    logger.error('Store cart add item error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      latencyMs})
    
    return errorJson(c, 'STORE_CART_ADD_ERROR', 'Failed to add item to cart', 500, {
      traceId
    })
  }
})

/**
 * PUT /store/cart/items - Update cart items
 */
cart.put('/items', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    // Parse request body
    const body = await c.req.json()
    const updateData = updateItemsSchema.parse(body)
    
    // Get cart token
    const cartToken = readCartToken(c)
    
    // Update items via WooCommerce Store API
    const { data: cartData, cartToken: responseCartToken } = await wooStoreApi.makeRequest(
      '/cart/items',
      {
        method: 'PUT',
        body: JSON.stringify(updateData)
      },
      cartToken
    )
    
    const latencyMs = Date.now() - startTime
    
    logger.info('Store cart items updated', {
      traceId,
      itemCount: updateData.items.length,
      cartToken: responseCartToken ? 'present' : 'missing',
      latencyMs
    })
    
    // Echo the cart token in response
    echoCartToken(c, responseCartToken)
    
    return c.json({
      message: 'Cart items updated',
      cart: cartData,
      cart_token: responseCartToken
    })
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    if (error instanceof z.ZodError) {
      return errorJson(c, 'VALIDATION_ERROR', 'Invalid request data', 400, {
        traceId,
        errors: error.errors
      })
    }
    
    logger.error('Store cart update items error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      latencyMs})
    
    return errorJson(c, 'STORE_CART_UPDATE_ERROR', 'Failed to update cart items', 500, {
      traceId
    })
  }
})

/**
 * POST /store/cart/remove-item - Remove item from cart
 */
cart.post('/remove-item', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    // Parse request body
    const body = await c.req.json()
    const removeData = removeItemSchema.parse(body)
    
    // Get cart token
    const cartToken = readCartToken(c)
    
    // Remove item via WooCommerce Store API
    const { data: cartData, cartToken: responseCartToken } = await wooStoreApi.makeRequest(
      '/cart/remove-item',
      {
        method: 'POST',
        body: JSON.stringify(removeData)
      },
      cartToken
    )
    
    const latencyMs = Date.now() - startTime
    
    logger.info('Store cart item removed', {
      traceId,
      itemKey: removeData.key,
      cartToken: responseCartToken ? 'present' : 'missing',
      latencyMs
    })
    
    // Echo the cart token in response
    echoCartToken(c, responseCartToken)
    
    return c.json({
      message: 'Item removed from cart',
      cart: cartData,
      cart_token: responseCartToken
    })
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    if (error instanceof z.ZodError) {
      return errorJson(c, 'VALIDATION_ERROR', 'Invalid request data', 400, {
        traceId,
        errors: error.errors
      })
    }
    
    logger.error('Store cart remove item error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      latencyMs})
    
    return errorJson(c, 'STORE_CART_REMOVE_ERROR', 'Failed to remove item from cart', 500, {
      traceId
    })
  }
})

/**
 * DELETE /store/cart - Clear entire cart
 */
cart.delete('/', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    // Get cart token
    const cartToken = readCartToken(c)
    
    // Clear cart via WooCommerce Store API
    const { data: cartData, cartToken: responseCartToken } = await wooStoreApi.makeRequest(
      '/cart',
      { method: 'DELETE' },
      cartToken
    )
    
    const latencyMs = Date.now() - startTime
    
    logger.info('Store cart cleared', {
      traceId,
      cartToken: responseCartToken ? 'present' : 'missing',
      latencyMs
    })
    
    // Echo the cart token in response
    echoCartToken(c, responseCartToken)
    
    return c.json({
      message: 'Cart cleared successfully',
      cart: cartData,
      cart_token: responseCartToken
    })
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    logger.error('Store cart clear error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      latencyMs})
    
    return errorJson(c, 'STORE_CART_CLEAR_ERROR', 'Failed to clear cart', 500, {
      traceId
    })
  }
})

export default cart
