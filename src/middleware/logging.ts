/**
 * Request Logging Middleware
 * 
 * Structured request/response logging with PII sanitization
 * and performance metrics.
 */

import type { Context, Next } from 'hono'
import { logger } from '../observability/logger'
import { env } from '../config/env'

/**
 * Sanitize headers to remove sensitive information
 */
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {}
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-session-id'
  ]
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase()
    if (sensitiveHeaders.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

/**
 * Get client IP address
 */
function getClientIP(c: Context): string {
  // Check various headers for real IP
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip', // Cloudflare
    'x-vercel-forwarded-for' // Vercel
  ]
  
  for (const header of headers) {
    const value = c.req.header(header)
    if (value) {
      // Take the first IP if comma-separated
      return value.split(',')[0].trim()
    }
  }
  
  return 'unknown'
}

/**
 * Request logging middleware
 */
export function requestLogger() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now()
    const traceId = c.get('traceId')
    const method = c.req.method
    const path = c.req.path
    const userAgent = c.req.header('User-Agent') || 'unknown'
    const clientIP = getClientIP(c)
    
    // Log request start (debug level to avoid spam)
    if (env.LOG_LEVEL === 'debug') {
      logger.debug('Request started', {
        method,
        path,
        traceId,
        clientIP,
        userAgent,
        headers: sanitizeHeaders(Object.fromEntries(c.req.raw.headers.entries()))
      })
    }
    
    let error: Error | null = null
    
    try {
      await next()
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err))
      throw err // Re-throw to be handled by error middleware
    } finally {
      const duration = Date.now() - startTime
      const status = c.res.status
      const contentLength = c.res.headers.get('content-length')
      
      // Determine log level based on status and duration
      let logLevel: 'info' | 'warn' | 'error' = 'info'
      if (error || status >= 500) {
        logLevel = 'error'
      } else if (status >= 400 || duration > 5000) {
        logLevel = 'warn'
      }
      
      // Log request completion
      logger[logLevel]('Request completed', {
        method,
        path,
        status,
        duration,
        traceId,
        clientIP,
        userAgent,
        contentLength: contentLength ? parseInt(contentLength) : undefined,
        error: error ? {
          name: error.name,
          message: error.message
        } : undefined
      })
      
      // Add performance headers
      c.header('X-Response-Time', `${duration}ms`)
      
      // Add trace ID to response headers for debugging
      if (traceId) {
        c.header('X-Trace-Id', traceId)
      }
    }
  }
}

/**
 * API access logging for sensitive operations
 */
export function auditLogger(operation: string) {
  return async (c: Context, next: Next) => {
    const traceId = c.get('traceId')
    const userId = c.get('userId') // Set by auth middleware
    const method = c.req.method
    const path = c.req.path
    const clientIP = getClientIP(c)
    
    logger.info('API access', {
      operation,
      method,
      path,
      userId,
      clientIP,
      traceId,
      timestamp: new Date().toISOString()
    })
    
    await next()
  }
}
