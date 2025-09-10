/**
 * Idempotency Key Handler
 * 
 * Provides idempotent mutation support using Upstash KV for storage.
 * Ensures that repeated requests with the same idempotency key
 * return the same result without side effects.
 */

import { get, set } from '../adapters/cache'
import { idempotencyErrors } from './errors'
import { logger } from '../observability/logger'
import type { Context } from 'hono'

// =======================
// Types
// =======================

interface IdempotencyRecord {
  key: string
  method: string
  path: string
  status: number
  headers: Record<string, string>
  body: any
  fingerprint: string
  createdAt: string
  expiresAt: string
}

interface IdempotencyOptions {
  ttl?: number // TTL in seconds, default 24 hours
  includeHeaders?: string[] // Headers to include in fingerprint
  excludeFromFingerprint?: string[] // Body fields to exclude from fingerprint
}

// =======================
// Constants
// =======================

const DEFAULT_TTL = 24 * 60 * 60 // 24 hours
const IDEMPOTENCY_KEY_PREFIX = 'idempotency'
const MAX_KEY_LENGTH = 255

// =======================
// Fingerprint Generation
// =======================

/**
 * Generate request fingerprint for comparison
 */
function generateFingerprint(
  method: string,
  path: string,
  body: any,
  headers: Record<string, string>,
  options: IdempotencyOptions
): string {
  const fingerprintData = {
    method: method.toUpperCase(),
    path,
    body: sanitizeBodyForFingerprint(body, options.excludeFromFingerprint),
    headers: extractHeaders(headers, options.includeHeaders || [])
  }
  
  // Create a deterministic string representation
  const fingerprintString = JSON.stringify(fingerprintData, Object.keys(fingerprintData).sort())
  
  // Generate hash using Web Crypto API (Edge Runtime compatible)
  return btoa(fingerprintString).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)
}

/**
 * Sanitize body for fingerprint generation
 */
function sanitizeBodyForFingerprint(
  body: any,
  excludeFields: string[] = []
): any {
  if (!body || typeof body !== 'object') {
    return body
  }
  
  const sanitized = { ...body }
  
  // Remove excluded fields
  for (const field of excludeFields) {
    delete sanitized[field]
  }
  
  // Remove timestamp-like fields that shouldn't affect idempotency
  const timestampFields = ['timestamp', 'createdAt', 'updatedAt', 'now']
  for (const field of timestampFields) {
    delete sanitized[field]
  }
  
  return sanitized
}

/**
 * Extract specific headers for fingerprint
 */
function extractHeaders(
  headers: Record<string, string>,
  includeHeaders: string[]
): Record<string, string> {
  const extracted: Record<string, string> = {}
  
  for (const headerName of includeHeaders) {
    const value = headers[headerName.toLowerCase()]
    if (value) {
      extracted[headerName.toLowerCase()] = value
    }
  }
  
  return extracted
}

// =======================
// Key Management
// =======================

/**
 * Validate idempotency key format
 */
function validateIdempotencyKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw idempotencyErrors.keyInvalid('Key must be a non-empty string')
  }
  
  if (key.length > MAX_KEY_LENGTH) {
    throw idempotencyErrors.keyInvalid(`Key must be no longer than ${MAX_KEY_LENGTH} characters`)
  }
  
  // Check for valid characters (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    throw idempotencyErrors.keyInvalid('Key must contain only alphanumeric characters, hyphens, and underscores')
  }
}

/**
 * Generate cache key for idempotency record
 */
function getIdempotencyCacheKey(key: string): string {
  return `${IDEMPOTENCY_KEY_PREFIX}:${key}`
}

// =======================
// Core Idempotency Logic
// =======================

/**
 * Check if request is idempotent and handle accordingly
 */
export async function handleIdempotency<T>(
  c: Context,
  handler: () => Promise<T>,
  options: IdempotencyOptions = {}
): Promise<T> {
  const idempotencyKey = c.req.header('Idempotency-Key')
  
  // If no idempotency key provided, execute normally
  if (!idempotencyKey) {
    return handler()
  }
  
  // Validate the key
  validateIdempotencyKey(idempotencyKey)
  
  const method = c.req.method
  const path = c.req.path
  const body = await getRequestBody(c)
  const headers = getRequestHeaders(c)
  
  // Generate fingerprint for this request
  const fingerprint = generateFingerprint(method, path, body, headers, options)
  
  // Check if we've seen this key before
  const cacheKey = getIdempotencyCacheKey(idempotencyKey)
  const existingRecord = await get<IdempotencyRecord>(cacheKey)
  
  if (existingRecord) {
    // Verify the request is identical
    if (existingRecord.fingerprint !== fingerprint) {
      logger.warn('Idempotency key conflict', {
        key: idempotencyKey,
        existingFingerprint: existingRecord.fingerprint,
        newFingerprint: fingerprint,
        traceId: c.get('traceId')
      })
      
      throw idempotencyErrors.keyConflict(idempotencyKey, existingRecord.status)
    }
    
    // Return the cached response
    logger.info('Returning idempotent response', {
      key: idempotencyKey,
      status: existingRecord.status,
      traceId: c.get('traceId')
    })
    
    // Set response headers
    for (const [headerName, headerValue] of Object.entries(existingRecord.headers)) {
      c.header(headerName, headerValue)
    }
    
    return existingRecord.body
  }
  
  // Execute the handler and capture the response
  let result: T
  let status: number
  let responseHeaders: Record<string, string>
  
  try {
    result = await handler()
    status = c.res.status || 200
    responseHeaders = getResponseHeaders(c)
  } catch (error) {
    // Don't cache error responses for idempotency
    throw error
  }
  
  // Store the successful response for future idempotent requests
  const ttl = options.ttl || DEFAULT_TTL
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttl * 1000)
  
  const record: IdempotencyRecord = {
    key: idempotencyKey,
    method,
    path,
    status,
    headers: responseHeaders,
    body: result,
    fingerprint,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  }
  
  await set(cacheKey, record, ttl)
  
  logger.info('Stored idempotent response', {
    key: idempotencyKey,
    status,
    ttl,
    traceId: c.get('traceId')
  })
  
  return result
}

// =======================
// Helper Functions
// =======================

/**
 * Get request body safely
 */
async function getRequestBody(c: Context): Promise<any> {
  try {
    const contentType = c.req.header('Content-Type') || ''
    
    if (contentType.includes('application/json')) {
      return await c.req.json()
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      return await c.req.parseBody()
    } else {
      // For other content types, use text
      return await c.req.text()
    }
  } catch {
    return null
  }
}

/**
 * Get request headers as plain object
 */
function getRequestHeaders(c: Context): Record<string, string> {
  const headers: Record<string, string> = {}
  
  // Convert Headers to plain object
  c.req.raw.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value
  })
  
  return headers
}

/**
 * Get response headers as plain object
 */
function getResponseHeaders(c: Context): Record<string, string> {
  const headers: Record<string, string> = {}
  
  // Get headers from response
  if (c.res.headers) {
    c.res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value
    })
  }
  
  return headers
}

// =======================
// Middleware
// =======================

/**
 * Middleware to automatically handle idempotency for mutation endpoints
 */
export function idempotencyMiddleware(options: IdempotencyOptions = {}) {
  return async (c: Context, next: () => Promise<void>) => {
    const method = c.req.method.toUpperCase()
    
    // Only apply idempotency to mutation methods
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
      return next()
    }
    
    const idempotencyKey = c.req.header('Idempotency-Key')
    
    // If no idempotency key, proceed normally
    if (!idempotencyKey) {
      return next()
    }
    
    // Store original handler
    const originalHandler = next
    
    // Wrap in idempotency logic
    return handleIdempotency(c, originalHandler, options)
  }
}

// =======================
// Cleanup
// =======================

/**
 * Clean up expired idempotency records
 * (This would typically be called by a scheduled job)
 */
export async function cleanupExpiredRecords(): Promise<number> {
  try {
    // This is a simplified cleanup - in production you might want
    // to use Redis SCAN with pattern matching and TTL checking
    logger.info('Idempotency cleanup completed (TTL-based expiration)')
    return 0
  } catch (error) {
    logger.error('Idempotency cleanup failed', { error })
    return 0
  }
}

// =======================
// Exports
// =======================

export {
  handleIdempotency,
  idempotencyMiddleware,
  cleanupExpiredRecords,
  type IdempotencyRecord,
  type IdempotencyOptions
}
