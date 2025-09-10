/**
 * Global Error Handler Middleware
 * 
 * Centralized error handling with proper logging, sanitization,
 * and standardized response format.
 */

import type { Context } from 'hono'
import { AppError, ErrorCode, type ErrorResponse } from '../lib/errors'
import { logger } from '../observability/logger'
import { env } from '../config/env'

/**
 * Global error handler middleware for Hono
 */
export function errorHandler(error: Error, c: Context) {
  const traceId = c.get('traceId') || 'unknown'
  const method = c.req.method
  const path = c.req.path
  
  // Handle known AppError instances
  if (error instanceof AppError) {
    logger.warn('Application error', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      method,
      path,
      traceId,
      stack: env.IS_DEVELOPMENT ? error.stack : undefined
    })
    
    return c.json(error.toResponse(traceId), error.statusCode)
  }
  
  // Handle unexpected errors
  logger.error('Unhandled error', {
    message: error.message,
    name: error.name,
    method,
    path,
    traceId,
    stack: error.stack
  })
  
  // Create sanitized error response
  const response: ErrorResponse = {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: env.IS_DEVELOPMENT ? error.message : 'Internal server error',
      details: env.IS_DEVELOPMENT ? { 
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 5) // Limit stack trace
      } : undefined,
      traceId,
      timestamp: new Date().toISOString()
    }
  }
  
  return c.json(response, 500)
}

/**
 * Async error boundary for route handlers
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(
  handler: T
): T {
  return (async (...args) => {
    try {
      return await handler(...args)
    } catch (error) {
      // Re-throw to be caught by global error handler
      throw error
    }
  }) as T
}
