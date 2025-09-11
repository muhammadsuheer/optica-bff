/**
 * WooCommerce Webhook Handler - Edge Runtime Compatible
 * 
 * Handles WooCommerce webhooks with signature verification and QStash enqueuing.
 * Provides immediate acknowledgment and background processing.
 */

import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { logger } from '../../observability/logger'
import { errorJson } from '../../lib/errors'
import { webhookVerifiers } from '../../utils/crypto'
import { qstashClient } from '../../lib/qstash'
import { config } from '../../config/env'

const wooWebhooks = new Hono()

// =======================
// Constants
// =======================

const MAX_PAYLOAD_SIZE = 1024 * 1024 // 1MB
const SUPPORTED_EVENTS = [
  'product.created',
  'product.updated',
  'product.deleted',
  'product.variation.created',
  'product.variation.updated',
  'product.variation.deleted',
  'category.created',
  'category.updated',
  'category.deleted',
  'order.created',
  'order.updated',
  'coupon.updated'
]

// =======================
// Routes
// =======================

/**
 * POST /webhooks/woo - WooCommerce webhook handler
 */
wooWebhooks.post('/', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    // Get raw body for signature verification
    const rawBody = await c.req.text()
    
    // Check payload size
    if (rawBody.length > MAX_PAYLOAD_SIZE) {
      logger.warn('WooCommerce webhook payload too large', {
        traceId,
        size: rawBody.length
      })
      
      return errorJson(c, 'WEBHOOK_PAYLOAD_TOO_LARGE', 'Payload too large', 413, {
        traceId
      })
    }
    
    // Get headers
    const signature = c.req.header('x-wc-webhook-signature')
    const source = c.req.header('x-wc-webhook-source')
    const event = c.req.header('x-wc-webhook-event')
    const deliveryId = c.req.header('x-wc-webhook-delivery-id')
    const occurredAt = c.req.header('x-wc-webhook-occurred-at')
    
    if (!signature || !event) {
      return errorJson(c, 'WEBHOOK_MISSING_HEADERS', 'Missing required webhook headers', 400, {
        traceId
      })
    }
    
    // Verify event is supported
    if (!SUPPORTED_EVENTS.includes(event)) {
      logger.info('WooCommerce webhook event not supported', {
        traceId,
        event
      })
      
      return c.json({ message: 'Event not supported' }, 200)
    }
    
    // Verify signature
    const secret = config.woocommerce.webhookSecret
    if (!secret) {
      logger.error('WooCommerce webhook secret not configured', new Error('Error'));
      
      return errorJson(c, 'WEBHOOK_SECRET_NOT_CONFIGURED', 'Webhook secret not configured', 500, {
        traceId
      })
    }
    
    const isValidSignature = await webhookVerifiers.woocommerce(rawBody, signature, secret)
    if (!isValidSignature) {
      logger.warn('Invalid WooCommerce webhook signature', {
        traceId,
        source,
        event,
        deliveryId
      })
      
      return errorJson(c, 'WEBHOOK_SIGNATURE_INVALID', 'Invalid signature', 401, {
        traceId
      })
    }
    
    // Parse payload
    let payload
    try {
      payload = JSON.parse(rawBody)
    } catch (error) {
      return errorJson(c, 'WEBHOOK_PAYLOAD_INVALID', 'Invalid JSON payload', 400, {
        traceId
      })
    }
    
    // Enqueue to QStash for background processing
    const enqueueResult = await qstashClient.enqueueWebhook(
      'woocommerce',
      event,
      payload,
      deliveryId
    )
    
    if (!enqueueResult.success) {
      logger.error('Failed to enqueue WooCommerce webhook', undefined, {
        traceId,
        event,
        deliveryId,
        error: enqueueResult.error
      })
      
      return errorJson(c, 'WEBHOOK_ENQUEUE_FAILED', 'Failed to enqueue webhook', 500, {
        traceId
      })
    }
    
    const processingTime = Date.now() - startTime
    
    logger.info('WooCommerce webhook enqueued', {
      traceId,
      event,
      deliveryId,
      messageId: enqueueResult.messageId,
      processingTime
    })
    
    return c.json({
      message: 'Webhook received and queued for processing',
      messageId: enqueueResult.messageId,
      processingTime
    })
    
  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error('WooCommerce webhook processing error', error instanceof Error ? error : new Error('Unknown error'), {
      traceId,
      processingTime
    })
    
    return errorJson(c, 'WEBHOOK_PROCESSING_ERROR', 'Internal server error', 500, {
      traceId
    })
  }
})

/**
 * GET /webhooks/woo/health - Webhook health check
 */
wooWebhooks.get('/health', async (c) => {
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    // Check QStash connectivity
    const qstashHealth = await qstashClient.healthCheck()
    
    return c.json({
      healthy: qstashHealth.healthy,
      services: {
        qstash: {
          healthy: qstashHealth.healthy,
          latency: qstashHealth.latency,
          error: qstashHealth.error
        }
      },
      supported_events: SUPPORTED_EVENTS,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    logger.error('WooCommerce webhook health check failed', error instanceof Error ? error : new Error('Unknown error'), {
      traceId
    })
    
    return errorJson(c, 'WEBHOOK_HEALTH_CHECK_FAILED', 'Health check failed', 500, {
      traceId
    })
  }
})

export default wooWebhooks
