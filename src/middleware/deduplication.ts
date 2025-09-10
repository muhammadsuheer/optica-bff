/**
 * Request Deduplication Middleware for Edge Runtime
 * Prevents duplicate in-flight requests
 */

import { Context, Next } from 'hono'
import { logger } from '../utils/logger'

const pendingRequests = new Map<string, Promise<Response>>()

export function requestDeduplication() {
  return async (c: Context, next: Next) => {
    // Only deduplicate GET requests
    if (c.req.method !== 'GET') {
      await next()
      return
    }

    const apiKey = c.req.header('x-api-key') || 'anonymous'
    const dedupeKey = `${c.req.method}:${c.req.path}:${apiKey}`
    
    // Check if identical request is already in flight
    if (pendingRequests.has(dedupeKey)) {
      logger.debug('Request deduplication hit', { key: dedupeKey })
      const cachedResponse = await pendingRequests.get(dedupeKey)!
      
      // Clone response for this request
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: {
          ...Object.fromEntries(Array.from(cachedResponse.headers.entries())),
          'X-Deduplication': 'hit'
        }
      })
    }
    
    // Create promise for this request
    const requestPromise = new Promise<Response>(async (resolve, reject) => {
      try {
        await next()
        resolve(c.res)
      } catch (error) {
        reject(error)
      }
    })
    
    pendingRequests.set(dedupeKey, requestPromise)
    
    try {
      await requestPromise
      c.header('X-Deduplication', 'miss')
    } finally {
      // Clean up after request completes
      pendingRequests.delete(dedupeKey)
    }
  }
}