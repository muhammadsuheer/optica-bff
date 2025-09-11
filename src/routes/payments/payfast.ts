/**
 * PayFast Payment Routes - Hosted Checkout Flow
 * 
 * Handles PayFast payment integration with ITN verification and return processing.
 * Supports hosted checkout flow with server-to-server verification.
 */

import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { logger } from '../../observability/logger'
import { errorJson } from '../../lib/errors'
import { handleIdempotency } from '../../lib/idempotency'
import { readCartToken, echoCartToken } from '../../lib/cartToken'
import { config } from '../../config/env'
import { payfastService } from '../../services/payfast'

const payfast = new Hono()

// =======================
// Request Schemas
// =======================

const payfastStartSchema = z.object({
  billing_address: z.object({
    first_name: z.string().min(1).max(50),
    last_name: z.string().min(1).max(50),
    company: z.string().max(100).optional(),
    address_1: z.string().min(1).max(200),
    address_2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    postcode: z.string().min(1).max(20),
    country: z.string().length(2),
    email: z.string().email(),
    phone: z.string().max(20).optional()
  }),
  shipping_address: z.object({
    first_name: z.string().min(1).max(50),
    last_name: z.string().min(1).max(50),
    company: z.string().max(100).optional(),
    address_1: z.string().min(1).max(200),
    address_2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    postcode: z.string().min(1).max(20),
    country: z.string().length(2)
  }).optional(),
  payment_method: z.literal('payfast').default('payfast')
})

// =======================
// Routes
// =======================

/**
 * POST /payments/payfast/start - Start PayFast payment
 * Creates order and returns redirect URL
 */
payfast.post('/start', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  // Wrap in idempotency handling
  return handleIdempotency(c, async (): Promise<any> => {
    try {
      // Parse request body
      const body = await c.req.json()
      const paymentData = payfastStartSchema.parse(body)
      
      // Get cart token
      const cartToken = readCartToken(c)
      
      // Create order via WooCommerce Store API
      const orderResult = await payfastService.createOrder({
        billing_address: paymentData.billing_address,
        shipping_address: paymentData.shipping_address,
        payment_method: paymentData.payment_method,
        cart_token: cartToken
      })
      
      if (!orderResult.success) {
        return errorJson(c, 'PAYFAST_ORDER_CREATION_FAILED', orderResult.error || 'Failed to create order', 400, {
          traceId
        })
      }
      
      // Generate PayFast payment URL
      const paymentUrl = await payfastService.generatePaymentUrl(orderResult.order!)
      
      if (!paymentUrl) {
        return errorJson(c, 'PAYFAST_URL_GENERATION_FAILED', 'Failed to generate payment URL', 500, {
          traceId
        })
      }
      
      const latencyMs = Date.now() - startTime
      
      logger.info('PayFast payment started', {
        traceId,
        orderId: orderResult.order!.id,
        cartToken: cartToken ? 'present' : 'missing',
        latencyMs
      })
      
      // Echo the cart token in response
      echoCartToken(c, orderResult.cart_token)
      
      return c.json({
        order_id: orderResult.order!.id,
        redirect_url: paymentUrl,
        cart_token: orderResult.cart_token
      })
      
    } catch (error) {
      const latencyMs = Date.now() - startTime
      
      if (error instanceof z.ZodError) {
        return errorJson(c, 'VALIDATION_ERROR', 'Invalid request data', 400, {
          traceId,
          errors: error.errors
        })
      }
      
      logger.error('PayFast start error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
        latencyMs})
      
      return errorJson(c, 'PAYFAST_START_ERROR', 'Failed to start PayFast payment', 500, {
        traceId
      })
    }
  })
})

/**
 * GET /payments/payfast/return - Handle PayFast return
 * Processes gateway return and provides deep-link back to app
 */
payfast.get('/return', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    // Parse return parameters
    const query = c.req.query()
    const returnData = {
      m_payment_id: query.m_payment_id,
      pf_payment_id: query.pf_payment_id,
      payment_status: query.payment_status,
      item_name: query.item_name,
      item_description: query.item_description,
      amount_gross: query.amount_gross,
      amount_fee: query.amount_fee,
      amount_net: query.amount_net,
      custom_str1: query.custom_str1,
      custom_str2: query.custom_str2,
      custom_str3: query.custom_str3,
      custom_str4: query.custom_str4,
      custom_str5: query.custom_str5,
      name_first: query.name_first,
      name_last: query.name_last,
      email_address: query.email_address,
      merchant_id: query.merchant_id,
      signature: query.signature
    }
    
    // Verify return signature
    const isValidReturn = await payfastService.verifyReturnSignature(returnData)
    
    if (!isValidReturn) {
      logger.error('Invalid PayFast return signature - potential security issue', new Error('Error'));
      
      // Return error page
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
          <h1>Payment Error</h1>
          <p>Invalid payment return. Please contact support.</p>
          <script>
            // Deep link back to app
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'PAYFAST_RETURN_ERROR',
                error: 'Invalid signature'
              }));
            } else {
              // Fallback for web
              window.location.href = '/payment-error';
            }
          </script>
        </body>
        </html>
      `, 400)
    }
    
    const latencyMs = Date.now() - startTime
    
    logger.info('PayFast return processed', {
      traceId,
      pf_payment_id: returnData.pf_payment_id,
      payment_status: returnData.payment_status,
      latencyMs
    })
    
    // Return success page with deep-link
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment ${returnData.payment_status === 'COMPLETE' ? 'Success' : 'Pending'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body>
        <h1>Payment ${returnData.payment_status === 'COMPLETE' ? 'Successful' : 'Pending'}</h1>
        <p>Your payment has been ${returnData.payment_status === 'COMPLETE' ? 'processed successfully' : 'received and is being processed'}.</p>
        <script>
          // Deep link back to app
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYFAST_RETURN_SUCCESS',
              payment_status: '${returnData.payment_status}',
              pf_payment_id: '${returnData.pf_payment_id}',
              m_payment_id: '${returnData.m_payment_id}'
            }));
          } else {
            // Fallback for web
            window.location.href = '/payment-success?status=${returnData.payment_status}&id=${returnData.pf_payment_id}';
          }
        </script>
      </body>
      </html>
    `)
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    logger.error('PayFast return error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      latencyMs})
    
    // Return error page
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body>
        <h1>Payment Error</h1>
        <p>An error occurred processing your payment return. Please contact support.</p>
        <script>
          // Deep link back to app
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAYFAST_RETURN_ERROR',
              error: 'Processing error'
            }));
          } else {
            // Fallback for web
            window.location.href = '/payment-error';
          }
        </script>
      </body>
      </html>
    `, 500)
  }
})

/**
 * POST /payments/payfast/itn - Handle PayFast ITN (Instant Transaction Notification)
 * Server-to-server verification and order status update
 */
payfast.post('/itn', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    // Get raw body for signature verification
    const rawBody = await c.req.text()
    
    // Parse ITN data
    const itnData = new URLSearchParams(rawBody)
    const itnParams: Record<string, string> = {}
    
    for (const [key, value] of Array.from(itnData.entries())) {
      itnParams[key] = value
    }
    
    // Verify ITN signature
    const isValidITN = await payfastService.verifyITNSignature(itnParams, rawBody)
    
    if (!isValidITN) {
      logger.warn('Invalid PayFast ITN signature', {
        traceId,
        pf_payment_id: itnParams.pf_payment_id
      })
      
      return c.text('INVALID', 400)
    }
    
    // Check for duplicate processing
    const gatewayTxnId = itnParams.pf_payment_id
    const isDuplicate = await payfastService.isDuplicateTransaction(gatewayTxnId)
    
    if (isDuplicate) {
      logger.info('Duplicate PayFast ITN ignored', {
        traceId,
        pf_payment_id: gatewayTxnId
      })
      
      return c.text('OK', 200)
    }
    
    // Process ITN and update order
    const processResult = await payfastService.processITN(itnParams)
    
    if (!processResult.success) {
      logger.error('PayFast ITN processing failed', new Error(processResult.error || 'Unknown error'), {traceId,
        pf_payment_id: gatewayTxnId})
      
      return c.text('ERROR', 500)
    }
    
    const latencyMs = Date.now() - startTime
    
    logger.info('PayFast ITN processed', {
      traceId,
      pf_payment_id: gatewayTxnId,
      payment_status: itnParams.payment_status,
      order_id: processResult.orderId,
      latencyMs
    })
    
    return c.text('OK', 200)
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    logger.error('PayFast ITN error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      latencyMs})
    
    return c.text('ERROR', 500)
  }
})

export default payfast
