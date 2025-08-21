import { Hono } from 'hono';
import { webhookService } from '../services/webhookService.js';
import { logger } from '../utils/logger.js';

// Create webhook routes
const webhookRoutes = new Hono();

/**
 * WooCommerce webhook endpoint
 * Handles all WooCommerce webhook events
 */
webhookRoutes.post('/woocommerce', async (c) => {
  const startTime = Date.now();
  
  try {
    const body = await c.req.text();
    const signature = c.req.header('X-WC-Webhook-Signature') || '';
    const topic = c.req.header('X-WC-Webhook-Topic') || '';
    const deliveryId = c.req.header('X-WC-Webhook-Delivery-ID') || '';
    
    // Validate required headers
    if (!topic) {
      logger.warn('Webhook missing topic header', { 
        headers: 'Missing headers data' 
      });
      return c.json({ error: 'Missing X-WC-Webhook-Topic header' }, 400);
    }

    if (!signature) {
      logger.warn('Webhook missing signature', { topic });
      return c.json({ error: 'Missing X-WC-Webhook-Signature header' }, 401);
    }

    // Parse webhook payload
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (parseError) {
      logger.error('Invalid webhook JSON payload', { 
        topic, 
        error: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
        bodyPreview: body.substring(0, 200) 
      });
      return c.json({ error: 'Invalid JSON payload' }, 400);
    }

    // Process webhook using validation and processing pattern
    const userAgent = c.req.header('User-Agent') || '';
    const validationResult = await webhookService.validateWebhook(body, signature, userAgent);
    
    if (!validationResult.isValid) {
      logger.warn('Webhook validation failed', {
        topic,
        error: validationResult.error,
        deliveryId
      });
      
      return c.json({
        error: validationResult.error || 'Webhook validation failed',
        delivery_id: deliveryId
      }, 400);
    }

    // Process validated webhook
    const success = await webhookService.processWebhook(validationResult);
    
    const processingTime = Date.now() - startTime;
    
    // Log webhook processing result
    logger.info('Webhook processed', {
      topic,
      resourceId: validationResult.payload?.id,
      deliveryId,
      success,
      processingTime: `${processingTime}ms`
    });
    
    // Set response headers
    c.header('X-Processing-Time', `${processingTime}ms`);
    c.header('X-Delivery-ID', deliveryId || 'unknown');
    
    if (success) {
      return c.json({ 
        message: 'Webhook processed successfully',
        delivery_id: deliveryId,
        processing_time: `${processingTime}ms`
      }, 200);
    } else {
      return c.json({ 
        error: 'Webhook processing failed',
        delivery_id: deliveryId 
      }, 400);
    }
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Webhook endpoint error', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: `${processingTime}ms`,
      stack: error instanceof Error ? error.stack : undefined 
    });
    
    c.header('X-Processing-Time', `${processingTime}ms`);
    
    return c.json({ 
      error: 'Internal webhook processing error',
      processing_time: `${processingTime}ms`
    }, 500);
  }
});

/**
 * Webhook statistics endpoint
 * Provides insights into webhook processing
 */
webhookRoutes.get('/stats', async (c) => {
  try {
    const stats = await webhookService.getWebhookStats();
    
    return c.json({
      success: true,
      data: {
        ...stats,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }
    });
    
  } catch (error) {
    logger.error('Webhook stats error', { error: error instanceof Error ? error.message : 'Unknown error' });
    
    return c.json({ 
      success: false,
      error: 'Failed to retrieve webhook statistics' 
    }, 500);
  }
});

/**
 * Webhook health check endpoint
 */
webhookRoutes.get('/health', async (c) => {
  try {
    // Simple health check since our webhook service doesn't have a healthCheck method
    const stats = await webhookService.getWebhookStats();
    
    return c.json({
      status: 'healthy',
      service: 'webhook-processor',
      timestamp: new Date().toISOString(),
      stats
    });
    
  } catch (error) {
    logger.error('Webhook health check failed', { error: error instanceof Error ? error.message : 'Unknown error' });
    
    return c.json({
      status: 'unhealthy',
      service: 'webhook-processor',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, 500);
  }
});

/**
 * Test webhook endpoint (for development)
 */
webhookRoutes.post('/test', async (c) => {
  try {
    const testPayload = await c.req.json();
    
    logger.info('Test webhook received', testPayload);
    
    return c.json({
      message: 'Test webhook received',
      payload: testPayload,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Test webhook error', { error: error instanceof Error ? error.message : 'Unknown error' });
    
    return c.json({ 
      error: 'Test webhook failed',
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

export { webhookRoutes };
