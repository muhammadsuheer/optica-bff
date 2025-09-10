/**
 * Standardized Error Taxonomy for Optia BFF
 * 
 * Provides machine-readable error codes, consistent response shapes,
 * and proper HTTP status mapping for all API endpoints.
 */

import type { Context } from 'hono'
import { logger } from '../observability/logger'
import { env } from '../config/env'

// =======================
// Error Code Taxonomy
// =======================

export enum ErrorCode {
  // Generic errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Authentication errors
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING',
  AUTH_INSUFFICIENT_PERMISSIONS = 'AUTH_INSUFFICIENT_PERMISSIONS',
  
  // Catalog errors
  CATALOG_PRODUCT_NOT_FOUND = 'CATALOG_PRODUCT_NOT_FOUND',
  CATALOG_CATEGORY_NOT_FOUND = 'CATALOG_CATEGORY_NOT_FOUND',
  CATALOG_SEARCH_INVALID = 'CATALOG_SEARCH_INVALID',
  
  // Commerce errors
  COMMERCE_CART_NOT_FOUND = 'COMMERCE_CART_NOT_FOUND',
  COMMERCE_CART_EXPIRED = 'COMMERCE_CART_EXPIRED',
  COMMERCE_ITEM_OUT_OF_STOCK = 'COMMERCE_ITEM_OUT_OF_STOCK',
  COMMERCE_INVALID_QUANTITY = 'COMMERCE_INVALID_QUANTITY',
  COMMERCE_ORDER_NOT_FOUND = 'COMMERCE_ORDER_NOT_FOUND',
  COMMERCE_PAYMENT_FAILED = 'COMMERCE_PAYMENT_FAILED',
  
  // External service errors
  WORDPRESS_CONNECTION_ERROR = 'WORDPRESS_CONNECTION_ERROR',
  WORDPRESS_AUTH_ERROR = 'WORDPRESS_AUTH_ERROR',
  SUPABASE_CONNECTION_ERROR = 'SUPABASE_CONNECTION_ERROR',
  CACHE_CONNECTION_ERROR = 'CACHE_CONNECTION_ERROR',
  
  // Webhook errors
  WEBHOOK_SIGNATURE_INVALID = 'WEBHOOK_SIGNATURE_INVALID',
  WEBHOOK_PAYLOAD_INVALID = 'WEBHOOK_PAYLOAD_INVALID',
  WEBHOOK_PROCESSING_FAILED = 'WEBHOOK_PROCESSING_FAILED',
  
  // Idempotency errors
  IDEMPOTENCY_KEY_CONFLICT = 'IDEMPOTENCY_KEY_CONFLICT',
  IDEMPOTENCY_KEY_INVALID = 'IDEMPOTENCY_KEY_INVALID',
}

// =======================
// Error Response Shape
// =======================

export interface ErrorResponse {
  error: {
    code: ErrorCode
    message: string
    details?: Record<string, any>
    traceId?: string
    timestamp: string
  }
}

// =======================
// Custom Error Classes
// =======================

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly details?: Record<string, any>
  public readonly isOperational: boolean

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: Record<string, any>,
    isOperational: boolean = true
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.isOperational = isOperational

    // Maintain proper stack trace
    Error.captureStackTrace(this, AppError)
  }

  /**
   * Convert to API response format
   */
  toResponse(traceId?: string): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        traceId,
        timestamp: new Date().toISOString()
      }
    }
  }
}

// =======================
// Error Factory Functions
// =======================

/**
 * Validation error (400)
 */
export function validationError(
  message: string,
  details?: Record<string, any>
): AppError {
  return new AppError(
    ErrorCode.VALIDATION_ERROR,
    message,
    400,
    details
  )
}

/**
 * Unauthorized error (401)
 */
export function unauthorizedError(
  message: string = 'Authentication required',
  details?: Record<string, any>
): AppError {
  return new AppError(
    ErrorCode.UNAUTHORIZED,
    message,
    401,
    details
  )
}

/**
 * Forbidden error (403)
 */
export function forbiddenError(
  message: string = 'Insufficient permissions',
  details?: Record<string, any>
): AppError {
  return new AppError(
    ErrorCode.FORBIDDEN,
    message,
    403,
    details
  )
}

/**
 * Not found error (404)
 */
export function notFoundError(
  resource: string,
  identifier?: string,
  details?: Record<string, any>
): AppError {
  const message = identifier 
    ? `${resource} with identifier '${identifier}' not found`
    : `${resource} not found`
  
  return new AppError(
    ErrorCode.NOT_FOUND,
    message,
    404,
    details
  )
}

/**
 * Conflict error (409)
 */
export function conflictError(
  message: string,
  details?: Record<string, any>
): AppError {
  return new AppError(
    ErrorCode.CONFLICT,
    message,
    409,
    details
  )
}

/**
 * Rate limit error (429)
 */
export function rateLimitError(
  message: string = 'Rate limit exceeded',
  details?: Record<string, any>
): AppError {
  return new AppError(
    ErrorCode.RATE_LIMITED,
    message,
    429,
    details
  )
}

/**
 * Internal server error (500)
 */
export function internalError(
  message: string = 'Internal server error',
  details?: Record<string, any>
): AppError {
  return new AppError(
    ErrorCode.INTERNAL_ERROR,
    message,
    500,
    details,
    false // Not operational - indicates a bug
  )
}

// =======================
// Domain-Specific Errors
// =======================

/**
 * Catalog-related errors
 */
export const catalogErrors = {
  productNotFound: (id: string) => new AppError(
    ErrorCode.CATALOG_PRODUCT_NOT_FOUND,
    `Product with ID '${id}' not found`,
    404,
    { productId: id }
  ),

  categoryNotFound: (slug: string) => new AppError(
    ErrorCode.CATALOG_CATEGORY_NOT_FOUND,
    `Category with slug '${slug}' not found`,
    404,
    { categorySlug: slug }
  ),

  invalidSearch: (reason: string) => new AppError(
    ErrorCode.CATALOG_SEARCH_INVALID,
    `Invalid search query: ${reason}`,
    400,
    { reason }
  )
}

/**
 * Commerce-related errors
 */
export const commerceErrors = {
  cartNotFound: (cartId: string) => new AppError(
    ErrorCode.COMMERCE_CART_NOT_FOUND,
    `Cart with ID '${cartId}' not found`,
    404,
    { cartId }
  ),

  cartExpired: (cartId: string) => new AppError(
    ErrorCode.COMMERCE_CART_EXPIRED,
    `Cart with ID '${cartId}' has expired`,
    410,
    { cartId }
  ),

  itemOutOfStock: (productId: string, requested: number, available: number) => new AppError(
    ErrorCode.COMMERCE_ITEM_OUT_OF_STOCK,
    `Product '${productId}' is out of stock. Requested: ${requested}, Available: ${available}`,
    409,
    { productId, requested, available }
  ),

  invalidQuantity: (quantity: number, min: number, max: number) => new AppError(
    ErrorCode.COMMERCE_INVALID_QUANTITY,
    `Invalid quantity ${quantity}. Must be between ${min} and ${max}`,
    400,
    { quantity, min, max }
  ),

  orderNotFound: (orderId: string) => new AppError(
    ErrorCode.COMMERCE_ORDER_NOT_FOUND,
    `Order with ID '${orderId}' not found`,
    404,
    { orderId }
  ),

  paymentFailed: (reason: string, paymentId?: string) => new AppError(
    ErrorCode.COMMERCE_PAYMENT_FAILED,
    `Payment failed: ${reason}`,
    402,
    { reason, paymentId }
  )
}

/**
 * Authentication errors
 */
export const authErrors = {
  tokenInvalid: (reason?: string) => new AppError(
    ErrorCode.AUTH_TOKEN_INVALID,
    reason ? `Invalid token: ${reason}` : 'Invalid authentication token',
    401,
    { reason }
  ),

  tokenExpired: () => new AppError(
    ErrorCode.AUTH_TOKEN_EXPIRED,
    'Authentication token has expired',
    401
  ),

  tokenMissing: () => new AppError(
    ErrorCode.AUTH_TOKEN_MISSING,
    'Authentication token is required',
    401
  ),

  insufficientPermissions: (required: string, current?: string) => new AppError(
    ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS,
    `Insufficient permissions. Required: ${required}${current ? `, Current: ${current}` : ''}`,
    403,
    { required, current }
  )
}

/**
 * External service errors
 */
export const serviceErrors = {
  wordpressConnection: (message: string) => new AppError(
    ErrorCode.WORDPRESS_CONNECTION_ERROR,
    `WordPress connection failed: ${message}`,
    502,
    { service: 'wordpress' }
  ),

  supabaseConnection: (message: string) => new AppError(
    ErrorCode.SUPABASE_CONNECTION_ERROR,
    `Supabase connection failed: ${message}`,
    502,
    { service: 'supabase' }
  ),

  cacheConnection: (message: string) => new AppError(
    ErrorCode.CACHE_CONNECTION_ERROR,
    `Cache connection failed: ${message}`,
    502,
    { service: 'cache' }
  )
}

/**
 * Webhook errors
 */
export const webhookErrors = {
  invalidSignature: (expected?: string) => new AppError(
    ErrorCode.WEBHOOK_SIGNATURE_INVALID,
    'Webhook signature verification failed',
    401,
    { expected }
  ),

  invalidPayload: (reason: string) => new AppError(
    ErrorCode.WEBHOOK_PAYLOAD_INVALID,
    `Invalid webhook payload: ${reason}`,
    400,
    { reason }
  ),

  processingFailed: (reason: string, webhookId?: string) => new AppError(
    ErrorCode.WEBHOOK_PROCESSING_FAILED,
    `Webhook processing failed: ${reason}`,
    500,
    { reason, webhookId }
  )
}

/**
 * Idempotency errors
 */
export const idempotencyErrors = {
  keyConflict: (key: string, originalStatus: number) => new AppError(
    ErrorCode.IDEMPOTENCY_KEY_CONFLICT,
    `Idempotency key '${key}' has already been used with different parameters`,
    409,
    { idempotencyKey: key, originalStatus }
  ),

  keyInvalid: (reason: string) => new AppError(
    ErrorCode.IDEMPOTENCY_KEY_INVALID,
    `Invalid idempotency key: ${reason}`,
    400,
    { reason }
  )
}

// =======================
// Error Handler Middleware
// =======================

/**
 * Global error handler for Hono
 */
export function errorHandler(error: Error, c: Context) {
  const traceId = c.get('traceId') || 'unknown'
  
  // Handle known AppError instances
  if (error instanceof AppError) {
    logger.warn('Application error', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
      traceId,
      stack: error.stack
    })
    
    return c.json(error.toResponse(traceId), error.statusCode)
  }
  
  // Handle unexpected errors
  logger.error('Unhandled error', {
    message: error.message,
    stack: error.stack,
    traceId
  })
  
  // Don't leak internal error details in production
  const isDevelopment = env.NODE_ENV === 'development'
  const response: ErrorResponse = {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: isDevelopment ? error.message : 'Internal server error',
      details: isDevelopment ? { stack: error.stack } : undefined,
      traceId,
      timestamp: new Date().toISOString()
    }
  }
  
  return c.json(response, 500)
}

// =======================
// Utility Functions
// =======================

/**
 * Wrap async functions to catch and convert errors
 */
export function catchErrors<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      
      // Convert unknown errors to internal errors
      throw internalError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
    }
  }) as T
}

/**
 * Assert condition and throw error if false
 */
export function assert(
  condition: boolean,
  error: AppError
): asserts condition {
  if (!condition) {
    throw error
  }
}

// =======================
// Exports
// =======================

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (c: Context) => {
  const traceId = c.get('traceId') || 'unknown'
  
  return c.json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested endpoint does not exist',
      path: c.req.path,
      method: c.req.method,
      traceId
    }
  }, 404)
}

export {
  AppError,
  ErrorCode,
  type ErrorResponse,
  notFoundHandler
}
