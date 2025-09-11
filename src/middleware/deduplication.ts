/**
 * Request Deduplication Middleware
 * 
 * Prevents duplicate processing of identical requests using Redis-based locks
 * Edge-safe implementation for Vercel Edge Runtime
 */

import type { Context, Next } from 'hono'
import { cacheService } from '../services/cacheService'
import { logger } from '../observability/logger'
import { errorJson } from '../lib/errors'

interface DeduplicationOptions {
  /** TTL for deduplication lock in seconds (default: 60) */
  ttlSeconds?: number
  /** Custom key generator function */
  keyGenerator?: (c: Context) => string
  /** Skip deduplication for certain methods (default: ['GET', 'HEAD', 'OPTIONS']) */
  skipMethods?: string[]
  /** Skip deduplication for certain paths */
  skipPaths?: string[]
}

/**
 * Request deduplication middleware
 * Prevents duplicate processing using distributed locks
 */
export function requestDeduplication(options: DeduplicationOptions = {}) {
  const {
    ttlSeconds = 60,
    keyGenerator = defaultKeyGenerator,
    skipMethods = ['GET', 'HEAD', 'OPTIONS'],
    skipPaths = []
  } = options

  return async (c: Context, next: Next) => {
    const traceId = (c as any).get('traceId') || 'unknown'
    const method = c.req.method
    const path = c.req.path
    
    // Skip deduplication for certain methods and paths
    if (skipMethods.includes(method) || skipPaths.some(p => path.startsWith(p))) {
      return next()
    }
    
    try {
      const dedupeKey = keyGenerator(c)
      const lockKey = `dedupe:${dedupeKey}`
      
      // Try to acquire lock
      const acquired = await cacheService.set(lockKey, traceId, { ttl: ttlSeconds, nx: true })
      
      if (!acquired) {
        // Request is duplicate - check if original is still processing
        const existingTraceId = await cacheService.get(lockKey)
        
        logger.warn('Duplicate request detected', {
          traceId,
          originalTraceId: existingTraceId,
          path,
          method,
          dedupeKey
        })
        
        return errorJson(
          c,
          'DUPLICATE_REQUEST',
          'Request is already being processed',
          409,
          { 
            originalTraceId: existingTraceId,
            retryAfter: ttlSeconds 
          },
          traceId
        )
      }
      
      logger.debug('Deduplication lock acquired', {
        traceId,
        dedupeKey,
        ttlSeconds
      })
      
      try {
        await next()
        
        // Release lock after successful processing
        await cacheService.del(lockKey)
        
      } catch (error) {
        // Release lock on error to allow retries
        await cacheService.del(lockKey)
        throw error
      }
      
    } catch (error) {
      if (error instanceof Error && error.message.includes('DUPLICATE_REQUEST')) {
        throw error // Re-throw duplicate request errors
      }
      
      logger.error('Deduplication middleware error', error instanceof Error ? error : new Error('Unknown error'), {
        traceId,
        path,
        method
      })
      
      // Continue processing on deduplication errors
      await next()
    }
  }
}

/**
 * Default key generator for deduplication
 * Creates key based on method, path, and request body hash
 */
function defaultKeyGenerator(c: Context): string {
  const method = c.req.method
  const path = c.req.path
  const query = new URL(c.req.url).search
  
  // For POST/PUT/PATCH requests, include body hash
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    // Note: This is a simplified hash - in production you might want a proper hash
    const bodyHash = c.req.header('content-length') || '0'
    return `${method}:${path}${query}:${bodyHash}`
  }
  
  return `${method}:${path}${query}`
}

/**
 * Idempotency key based deduplication
 * Uses client-provided idempotency key for deduplication
 */
export function idempotencyDeduplication(options: { ttlSeconds?: number } = {}) {
  const { ttlSeconds = 300 } = options // 5 minutes default
  
  return async (c: Context, next: Next) => {
    const traceId = (c as any).get('traceId') || 'unknown'
    const idempotencyKey = c.req.header('idempotency-key')
    
    if (!idempotencyKey) {
      return next() // No idempotency key, skip deduplication
    }
    
    try {
      const lockKey = `idem:${idempotencyKey}`
      const resultKey = `idem_result:${idempotencyKey}`
      
      // Check if we already have a result for this idempotency key
      const existingResult = await cacheService.get(resultKey)
      if (existingResult) {
        logger.debug('Returning cached idempotent result', {
          traceId,
          idempotencyKey
        })
        
        const result = JSON.parse(existingResult as string)
        return c.json(result.body, result.status, result.headers)
      }
      
      // Try to acquire processing lock
      const acquired = await cacheService.set(lockKey, traceId, { ttl: 60, nx: true }) // 1 minute lock
      
      if (!acquired) {
        logger.warn('Idempotent request already processing', {
          traceId,
          idempotencyKey
        })
        
        return errorJson(
          c,
          'PROCESSING',
          'Request is already being processed',
          409,
          { idempotencyKey, retryAfter: 60 },
          traceId
        )
      }
      
      try {
        await next()
        
        // Cache the result for future identical requests
        const headerEntries: [string, string][] = []
        c.res.headers.forEach((value: string, key: string) => {
          headerEntries.push([key, value])
        })
        
        const response = {
          body: await c.res.clone().json().catch(() => null),
          status: c.res.status,
          headers: Object.fromEntries(headerEntries)
        }
        
        await cacheService.set(resultKey, JSON.stringify(response), { ttl: ttlSeconds })
        await cacheService.del(lockKey) // Release processing lock
        
      } catch (error) {
        await cacheService.del(lockKey) // Release lock on error
        throw error
      }
      
    } catch (error) {
      logger.error('Idempotency deduplication error', error instanceof Error ? error : new Error('Unknown error'), {
        traceId,
        idempotencyKey
      })
      
      // Continue processing on deduplication errors
      await next()
    }
  }
}

/**
 * Webhook deduplication
 * Specialized deduplication for webhook events
 */
export function webhookDeduplication(options: { ttlSeconds?: number } = {}) {
  const { ttlSeconds = 300 } = options // 5 minutes default
  
  return async (c: Context, next: Next) => {
    const traceId = (c as any).get('traceId') || 'unknown'
    const webhookId = c.req.header('x-webhook-id') || c.req.header('x-event-id')
    
    if (!webhookId) {
      return next() // No webhook ID, skip deduplication
    }
    
    try {
      const dedupeKey = `webhook:${webhookId}`
      
      // Check if we've already processed this webhook
      const processed = await cacheService.get(dedupeKey)
      if (processed) {
        logger.info('Duplicate webhook ignored', {
          traceId,
          webhookId
        })
        
        return c.json({ message: 'Webhook already processed', webhookId }, 200)
      }
      
      // Mark as processing
      await cacheService.set(dedupeKey, traceId, { ttl: ttlSeconds })
      
      await next()
      
    } catch (error) {
      logger.error('Webhook deduplication error', error instanceof Error ? error : new Error('Unknown error'), {
        traceId,
        webhookId
      })
      
      // Continue processing on deduplication errors
      await next()
    }
  }
}
