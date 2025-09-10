/**
 * Performance Monitoring Middleware for Edge Runtime
 */

import { Context, Next } from 'hono'
import { logger } from '../utils/logger'

export function performanceMonitoring() {
  return async (c: Context, next: Next) => {
    const start = performance.now()
    const startTime = Date.now()
    
    // Add request ID for tracing
    const requestId = crypto.randomUUID()
    c.set('requestId', requestId)
    
    try {
      await next()
      
      const duration = performance.now() - start
      const statusCode = c.res.status
      
      // Add performance headers
      c.header('X-Response-Time', `${duration.toFixed(2)}ms`)
      c.header('X-Request-ID', requestId)
      
      // Log performance metrics
      const logData = {
        requestId,
        method: c.req.method,
        path: c.req.path,
        status: statusCode,
        duration: `${duration.toFixed(2)}ms`,
        timestamp: new Date(startTime).toISOString(),
        userAgent: c.req.header('user-agent')
      }
      
      // Warn on slow requests
      if (duration > 1000) {
        logger.warn('Slow request detected', logData)
      } else if (duration > 500) {
        logger.info('Request completed (slow)', logData)
      } else {
        logger.debug('Request completed', logData)
      }
      
    } catch (error) {
      const duration = performance.now() - start
      
      logger.error('Request failed', {
        requestId,
        method: c.req.method,
        path: c.req.path,
        duration: `${duration.toFixed(2)}ms`,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      throw error
    }
  }
}