/**
 * Edge Webhook Handler - Fast Response with Job Enqueuing
 *
 * Features:
 * - WebCrypto signature verification
 * - Sub-500ms response time
 * - Idempotency protection
 * - Job enqueuing to background workers
 */
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { webhookVerifiers } from '../utils/crypto';
import { kvClient } from '../lib/kvClient';
import { logger } from '../utils/logger';
import { randomUUID } from '../utils/crypto';
import { config } from '../config/env';
const webhooks = new Hono();
// Webhook job queue configuration
const WEBHOOK_QUEUE_KEY = 'webhook:jobs';
const IDEMPOTENCY_TTL = 3600; // 1 hour
const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB
/**
 * POST /webhooks/woocommerce - WooCommerce webhook handler
 */
webhooks.post('/woocommerce', async (c) => {
    const startTime = Date.now();
    try {
        // Get raw body for signature verification
        const rawBody = await c.req.text();
        // Check payload size
        if (rawBody.length > MAX_PAYLOAD_SIZE) {
            logger.warn('Webhook payload too large', { size: rawBody.length });
            throw new HTTPException(413, { message: 'Payload too large' });
        }
        // Get headers
        const signature = c.req.header('x-wc-webhook-signature');
        const source = c.req.header('x-wc-webhook-source');
        const event = c.req.header('x-wc-webhook-event');
        const deliveryId = c.req.header('x-wc-webhook-delivery-id');
        if (!signature || !event) {
            throw new HTTPException(400, { message: 'Missing required webhook headers' });
        }
        // Verify signature
        const secret = config.webhooks.wooCommerceSecret;
        if (!secret) {
            throw new HTTPException(500, { message: 'Webhook secret not configured' });
        }
        const isValidSignature = await webhookVerifiers.woocommerce(rawBody, signature, secret);
        if (!isValidSignature) {
            logger.warn('Invalid webhook signature', { source, event, deliveryId });
            throw new HTTPException(401, { message: 'Invalid signature' });
        }
        // Check idempotency
        const idempotencyKey = `webhook:wc:${deliveryId || randomUUID()}`;
        const existingJob = await kvClient.get(idempotencyKey);
        if (existingJob) {
            logger.info('Duplicate webhook ignored', { idempotencyKey, event });
            return c.json({
                message: 'Webhook processed (duplicate)',
                jobId: existingJob,
                processingTime: Date.now() - startTime
            });
        }
        // Parse payload
        let payload;
        try {
            payload = JSON.parse(rawBody);
        }
        catch (error) {
            throw new HTTPException(400, { message: 'Invalid JSON payload' });
        }
        // Create webhook job
        const job = {
            id: randomUUID(),
            source: 'woocommerce',
            event,
            payload,
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: 3,
            idempotencyKey
        };
        // Enqueue job
        const jobEnqueued = await enqueueWebhookJob(job);
        if (!jobEnqueued) {
            throw new HTTPException(500, { message: 'Failed to enqueue webhook job' });
        }
        // Store idempotency key
        await kvClient.set(idempotencyKey, job.id, { ttl: IDEMPOTENCY_TTL });
        const processingTime = Date.now() - startTime;
        logger.info('WooCommerce webhook enqueued', {
            jobId: job.id,
            event,
            source,
            processingTime
        });
        return c.json({
            message: 'Webhook received and queued for processing',
            jobId: job.id,
            processingTime
        });
    }
    catch (error) {
        const processingTime = Date.now() - startTime;
        if (error instanceof HTTPException) {
            logger.warn('Webhook request error', {
                error: error.message,
                status: error.status,
                processingTime
            });
            throw error;
        }
        logger.error('Webhook processing error', { error, processingTime });
        throw new HTTPException(500, { message: 'Internal server error' });
    }
});
/**
 * POST /webhooks/stripe - Stripe webhook handler
 */
webhooks.post('/stripe', async (c) => {
    const startTime = Date.now();
    try {
        const rawBody = await c.req.text();
        const signature = c.req.header('stripe-signature');
        const event = c.req.header('stripe-event');
        if (!signature) {
            throw new HTTPException(400, { message: 'Missing Stripe signature' });
        }
        // Verify signature
        const secret = config.webhooks.stripeSecret;
        if (!secret) {
            throw new HTTPException(500, { message: 'Stripe webhook secret not configured' });
        }
        const isValidSignature = await webhookVerifiers.stripe(rawBody, signature, secret);
        if (!isValidSignature) {
            logger.warn('Invalid Stripe webhook signature');
            throw new HTTPException(401, { message: 'Invalid signature' });
        }
        // Parse and enqueue (similar to WooCommerce)
        const payload = JSON.parse(rawBody);
        const job = {
            id: randomUUID(),
            source: 'stripe',
            event: payload.type,
            payload,
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: 3,
            idempotencyKey: `webhook:stripe:${payload.id}`
        };
        await enqueueWebhookJob(job);
        const processingTime = Date.now() - startTime;
        return c.json({
            message: 'Webhook received',
            jobId: job.id,
            processingTime
        });
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Stripe webhook error', { error });
        throw new HTTPException(500, { message: 'Internal server error' });
    }
});
/**
 * GET /webhooks/status/:jobId - Check webhook job status
 */
webhooks.get('/status/:jobId', async (c) => {
    try {
        const jobId = c.req.param('jobId');
        if (!jobId) {
            throw new HTTPException(400, { message: 'Job ID required' });
        }
        const jobStatus = await kvClient.get(`webhook:status:${jobId}`);
        if (!jobStatus) {
            throw new HTTPException(404, { message: 'Job not found' });
        }
        return c.json(jobStatus);
    }
    catch (error) {
        if (error instanceof HTTPException)
            throw error;
        logger.error('Webhook status check error', { error });
        throw new HTTPException(500, { message: 'Internal server error' });
    }
});
/**
 * Enqueue webhook job for background processing
 */
async function enqueueWebhookJob(job) {
    try {
        // Add job to processing queue
        const queueSuccess = await kvClient.set(`${WEBHOOK_QUEUE_KEY}:${job.id}`, job, { ttl: 86400 } // 24 hours
        );
        if (!queueSuccess) {
            return false;
        }
        // Add to processing list for workers to pick up
        await kvClient.sadd(WEBHOOK_QUEUE_KEY, job.id);
        // Set initial job status
        await kvClient.set(`webhook:status:${job.id}`, {
            id: job.id,
            status: 'queued',
            createdAt: job.timestamp,
            updatedAt: Date.now(),
            retryCount: 0,
            error: null
        }, { ttl: 86400 });
        return true;
    }
    catch (error) {
        logger.error('Job enqueue error', { jobId: job.id, error });
        return false;
    }
}
export default webhooks;
//# sourceMappingURL=edgeWebhooks.js.map