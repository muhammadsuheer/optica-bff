/**
 * Distributed Tracing Middleware
 * 
 * Generates and propagates trace IDs for request correlation
 * across services and logs.
 */

import type { Context, Next } from 'hono'
import { env } from '../config/env'

/**
 * Generate a unique trace ID
 */
function generateTraceId(): string {
  // Use crypto.randomUUID if available (Edge Runtime)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  
  // Fallback to timestamp + random
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 15)
  return `${timestamp}-${random}`
}

/**
 * Extract trace ID from various headers
 */
function extractTraceId(c: Context): string | null {
  // Check common tracing headers
  const traceHeaders = [
    'x-trace-id',
    'x-request-id',
    'x-correlation-id',
    'traceparent', // W3C Trace Context
    'x-amzn-trace-id', // AWS
    'x-cloud-trace-context', // Google Cloud
    'x-vercel-trace' // Vercel
  ]
  
  for (const header of traceHeaders) {
    const value = c.req.header(header)
    if (value) {
      // For W3C traceparent, extract trace ID portion
      if (header === 'traceparent') {
        const parts = value.split('-')
        if (parts.length >= 2) {
          return parts[1]
        }
      }
      return value
    }
  }
  
  return null
}

/**
 * Tracing middleware
 */
export function tracingMiddleware() {
  return async (c: Context, next: Next) => {
    if (!env.ENABLE_TRACING) {
      return next()
    }
    
    // Get or generate trace ID
    let traceId = extractTraceId(c)
    if (!traceId) {
      traceId = generateTraceId()
    }
    
    // Store trace ID in context for use by other middleware/handlers
    c.set('traceId', traceId)
    
    // Add trace ID to response headers
    c.header('X-Trace-Id', traceId)
    
    // Add W3C Trace Context header for downstream services
    const traceparent = `00-${traceId}-${generateSpanId()}-01`
    c.header('traceparent', traceparent)
    
    await next()
  }
}

/**
 * Generate a span ID for W3C Trace Context
 */
function generateSpanId(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  }
  
  // Fallback
  return Math.random().toString(16).substring(2, 18).padStart(16, '0')
}

/**
 * Create a child span for tracing operations within a request
 */
export function createSpan(c: Context, operationName: string): {
  traceId: string
  spanId: string
  finish: (metadata?: Record<string, any>) => void
} {
  const traceId = c.get('traceId') || generateTraceId()
  const spanId = generateSpanId()
  const startTime = Date.now()
  
  return {
    traceId,
    spanId,
    finish: (metadata = {}) => {
      const duration = Date.now() - startTime
      
      // In a full observability setup, you'd send this to your tracing backend
      // For now, we'll just log it
      if (env.LOG_LEVEL === 'debug') {
        console.log('Span completed', {
          traceId,
          spanId,
          operationName,
          duration,
          metadata
        })
      }
    }
  }
}

/**
 * Utility to trace async operations
 */
export async function withSpan<T>(
  c: Context,
  operationName: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const span = createSpan(c, operationName)
  
  try {
    const result = await operation()
    span.finish({ ...metadata, success: true })
    return result
  } catch (error) {
    span.finish({ 
      ...metadata, 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}
