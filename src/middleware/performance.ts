/**
 * Performance Monitoring Middleware
 * 
 * Tracks request performance metrics and adds timing headers
 * Edge-safe implementation for Vercel Edge Runtime
 */

import type { Context, Next } from 'hono'
import { logger } from '../observability/logger'
import databaseService, { supabaseClient } from '../services/databaseService'

interface PerformanceMetrics {
  requestStart: number
  responseTime: number
  memoryUsage?: {
    used: number
    total: number
    percentage: number
  }
}

/**
 * Performance monitoring middleware
 * Tracks timing and adds performance headers
 */
export function performanceMonitoring() {
  return async (c: Context, next: Next) => {
    const startTime = performance.now()
    const traceId = (c as any).get('traceId') || 'unknown'
    
    // Add start time to context
    c.set('performanceStart', startTime)
    
    try {
      await next()
      
      const responseTime = performance.now() - startTime
      
      // Add performance headers
      c.header('X-Response-Time', `${responseTime.toFixed(2)}ms`)
      c.header('X-Trace-ID', traceId)
      
      // Log slow requests (> 1 second)
      if (responseTime > 1000) {
        logger.warn('Slow request detected', {
          traceId,
          path: c.req.path,
          method: c.req.method,
          responseTime: `${responseTime.toFixed(2)}ms`,
          userAgent: c.req.header('user-agent')
        })
      }
      
      // Record metrics for analytics (async, don't block response)
      recordPerformanceMetric(c, responseTime, traceId).catch(error => {
        logger.error('Failed to record performance metric', error instanceof Error ? error : new Error('Unknown error'))
      })
      
    } catch (error) {
      const responseTime = performance.now() - startTime
      
      // Add performance headers even for errors
      c.header('X-Response-Time', `${responseTime.toFixed(2)}ms`)
      c.header('X-Trace-ID', traceId)
      
      logger.error('Request failed with performance tracking', error instanceof Error ? error : new Error('Unknown error'), {
        traceId,
        path: c.req.path,
        method: c.req.method,
        responseTime: `${responseTime.toFixed(2)}ms`
      })
      
      throw error
    }
  }
}

/**
 * Record performance metric to database
 * Non-blocking async operation
 */
async function recordPerformanceMetric(c: Context, responseTime: number, traceId: string): Promise<void> {
  try {
    // Use database service to record metric
    await databaseService.analytics.logMetric(
      'request_duration',
      responseTime,
      {
        path: c.req.path,
        method: c.req.method,
        status: c.res.status.toString(),
        traceId
      }
    )
    
  } catch (error) {
    // Don't throw - this is best effort logging
    logger.debug('Failed to record performance metric', { error, traceId })
  }
}

/**
 * Get memory usage (Edge-safe)
 * Returns mock data in Edge Runtime where process.memoryUsage() isn't available
 */
export function getMemoryUsage(): { used: number; total: number; percentage: number } {
  try {
    // In Edge Runtime, process.memoryUsage() may not be available
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return {
        used: usage.heapUsed,
        total: usage.heapTotal,
        percentage: Math.round((usage.heapUsed / usage.heapTotal) * 100)
      }
    }
    
    // Fallback for Edge Runtime
    return {
      used: 0,
      total: 0,
      percentage: 0
    }
  } catch {
    // Safe fallback
    return {
      used: 0,
      total: 0,
      percentage: 0
    }
  }
}

/**
 * Performance timing utility
 * Measures execution time of async operations
 */
export async function measureAsync<T>(
  operation: () => Promise<T>,
  operationName: string,
  traceId?: string
): Promise<{ result: T; duration: number }> {
  const startTime = performance.now()
  
  try {
    const result = await operation()
    const duration = performance.now() - startTime
    
    logger.debug(`Operation completed: ${operationName}`, {
      duration: `${duration.toFixed(2)}ms`,
      traceId
    })
    
    return { result, duration }
  } catch (error) {
    const duration = performance.now() - startTime
    
    logger.error(`Operation failed: ${operationName}`, error instanceof Error ? error : new Error('Unknown error'), {
      duration: `${duration.toFixed(2)}ms`,
      traceId
    })
    
    throw error
  }
}
