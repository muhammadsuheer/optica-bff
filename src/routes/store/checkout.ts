/**
 * Store Checkout Routes - WooCommerce Store API Proxy
 * 
 * Handles checkout operations with Cart-Token and Idempotency-Key support.
 * All operations forward to WooCommerce Store API for authoritative processing.
 */

import { Hono } from 'hono'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { logger } from '../../observability/logger'
import { errorJson } from '../../lib/errors'
import { readCartToken, echoCartToken } from '../../lib/cartToken'
import { handleIdempotency } from '../../lib/idempotency'
import { config } from '../../config/env'

const checkout = new Hono()

// =======================
// Request Schemas
// =======================

const checkoutAddressSchema = z.object({
  first_name: z.string().min(1).max(50),
  last_name: z.string().min(1).max(50),
  company: z.string().max(100).optional(),
  address_1: z.string().min(1).max(200),
  address_2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postcode: z.string().min(1).max(20),
  country: z.string().length(2), // ISO country code
  email: z.string().email(),
  phone: z.string().max(20).optional()
})

const checkoutUpdateSchema = z.object({
  billing_address: checkoutAddressSchema.optional(),
  shipping_address: checkoutAddressSchema.optional(),
  payment_method: z.string().min(1).max(50).optional(),
  shipping_method: z.string().optional(),
  customer_note: z.string().max(500).optional()
})

const checkoutProcessSchema = z.object({
  payment_method: z.string().min(1).max(50),
  payment_data: z.record(z.string(), z.any()).optional(),
  // Optional fields for conflict detection
  total: z.string().optional(),
  expected_item_count: z.number().optional()
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
      const errorText = await response.text()
      throw new Error(`WooCommerce Store API error: ${response.status} ${response.statusText} - ${errorText}`)
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
 * GET /store/checkout - Get checkout draft
 */
checkout.get('/', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    // Get cart token
    const cartToken = readCartToken(c)
    
    // Fetch checkout from WooCommerce Store API
    const { data: checkoutData, cartToken: responseCartToken } = await wooStoreApi.makeRequest(
      '/checkout',
      { method: 'GET' },
      cartToken
    )
    
    const latencyMs = Date.now() - startTime
    
    logger.info('Store checkout fetched', {
      traceId,
      cartToken: responseCartToken ? 'present' : 'missing',
      latencyMs
    })
    
    // Echo the cart token in response
    echoCartToken(c, responseCartToken)
    
    return c.json({
      checkout: checkoutData,
      cart_token: responseCartToken
    })
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    logger.error('Store checkout error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      latencyMs})
    
    return errorJson(c, 'STORE_CHECKOUT_ERROR', 'Failed to fetch checkout', 500, {
      traceId
    })
  }
})

/**
 * PUT /store/checkout - Update checkout (addresses, payment method, etc.)
 */
checkout.put('/', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    // Parse request body
    const body = await c.req.json()
    const updateData = checkoutUpdateSchema.parse(body)
    
    // Get cart token
    const cartToken = readCartToken(c)
    
    // Update checkout via WooCommerce Store API
    const { data: checkoutData, cartToken: responseCartToken } = await wooStoreApi.makeRequest(
      '/checkout',
      {
        method: 'PUT',
        body: JSON.stringify(updateData)
      },
      cartToken
    )
    
    const latencyMs = Date.now() - startTime
    
    logger.info('Store checkout updated', {
      traceId,
      cartToken: responseCartToken ? 'present' : 'missing',
      latencyMs
    })
    
    // Echo the cart token in response
    echoCartToken(c, responseCartToken)
    
    return c.json({
      message: 'Checkout updated',
      checkout: checkoutData,
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
    
    logger.error('Store checkout update error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      latencyMs})
    
    return errorJson(c, 'STORE_CHECKOUT_UPDATE_ERROR', 'Failed to update checkout', 500, {
      traceId
    })
  }
})

/**
 * POST /store/checkout - Process checkout (create order)
 * Supports Idempotency-Key for safe retries
 */
checkout.post('/', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  // Wrap in idempotency handling
  return handleIdempotency(c, async (): Promise<any> => {
    try {
      // Parse request body
      const body = await c.req.json()
      const processData = checkoutProcessSchema.parse(body)
      
      // Get cart token
      const cartToken = readCartToken(c)
      
      // CRITICAL: Refresh cart and recalculate totals before processing
      logger.info('Refreshing cart before checkout', { traceId, cartToken: cartToken ? 'present' : 'missing' })
      
      // 1. Refresh cart to get latest state
      const { data: cartData, cartToken: refreshedCartToken } = await wooStoreApi.makeRequest(
        '/cart',
        { method: 'GET' },
        cartToken
      )
      
      // 2. Recalculate totals to ensure accuracy
      const { data: totalsData, cartToken: totalsCartToken } = await wooStoreApi.makeRequest(
        '/cart/totals',
        { method: 'POST' },
        refreshedCartToken
      )
      
      // 3. Get current checkout state to compare
      const { data: currentCheckout } = await wooStoreApi.makeRequest(
        '/checkout',
        { method: 'GET' },
        totalsCartToken
      )
      
      // 4. Check for cart conflicts (cart changed since client last saw it)
      const clientExpectedTotal = processData.payment_data?.total || processData.total
      const actualTotal = (totalsData as any)?.total_price || (currentCheckout as any)?.totals?.total_price
      
      if (clientExpectedTotal && actualTotal && Math.abs(parseFloat(clientExpectedTotal) - parseFloat(actualTotal)) > 0.01) {
        logger.warn('Cart conflict detected - totals mismatch', {
          traceId,
          clientExpectedTotal,
          actualTotal,
          difference: Math.abs(parseFloat(clientExpectedTotal) - parseFloat(actualTotal))
        })
        
        return errorJson(c, 'CART_CONFLICT', 'Cart contents or totals have changed since last update', 409, {
          traceId,
          current_cart: cartData,
          current_totals: totalsData,
          expected_total: clientExpectedTotal,
          actual_total: actualTotal
        })
      }
      
      // 5. Check if cart items changed
      const clientExpectedItemCount = processData.payment_data?.item_count || body.expected_item_count
      const actualItemCount = (cartData as any)?.items_count || (cartData as any)?.items?.length || 0
      
      if (clientExpectedItemCount && actualItemCount !== clientExpectedItemCount) {
        logger.warn('Cart conflict detected - item count mismatch', {
          traceId,
          clientExpectedItemCount,
          actualItemCount
        })
        
        return errorJson(c, 'CART_CONFLICT', 'Cart items have changed since last update', 409, {
          traceId,
          current_cart: cartData,
          expected_item_count: clientExpectedItemCount,
          actual_item_count: actualItemCount
        })
      }
      
      // 6. Use the refreshed cart token for checkout processing
      const finalCartToken = totalsCartToken || refreshedCartToken
      
      logger.info('Cart refresh completed, proceeding with checkout', {
        traceId,
        cartItemCount: actualItemCount,
        cartTotal: actualTotal,
        paymentMethod: processData.payment_method
      })
      
      // Process checkout via WooCommerce Store API
      const { data: orderData, cartToken: responseCartToken } = await wooStoreApi.makeRequest(
        '/checkout',
        {
          method: 'POST',
          body: JSON.stringify(processData)
        },
        finalCartToken
      )
      
      const latencyMs = Date.now() - startTime
      
      logger.info('Store checkout processed', {
        traceId,
        orderId: (orderData as any)?.id,
        paymentMethod: processData.payment_method,
        cartToken: responseCartToken ? 'present' : 'missing',
        latencyMs
      })
      
      // Echo the cart token in response
      echoCartToken(c, responseCartToken)
      
      // Check if this is a PayFast order and return redirect URL
      if (processData.payment_method === 'payfast' && (orderData as any)?.payment_url) {
        return c.json({
          message: 'Order created successfully',
          order: orderData,
          redirect_url: (orderData as any)?.payment_url,
          cart_token: responseCartToken
        })
      }
      
      return c.json({
        message: 'Order created successfully',
        order: orderData,
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
      
      logger.error('Store checkout process error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
        latencyMs})
      
      return errorJson(c, 'STORE_CHECKOUT_PROCESS_ERROR', 'Failed to process checkout', 500, {
        traceId
      })
    }
  })
})

export default checkout
