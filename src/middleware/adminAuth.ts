/**
 * Admin Authentication Middleware
 * 
 * Validates admin tokens for administrative operations.
 * Uses simple token-based authentication for admin endpoints.
 */

import type { Context, Next } from 'hono'
import { env } from '../config/env'
import { logger } from '../observability/logger'

// =======================
// Admin Token Validation
// =======================

/**
 * Admin authentication middleware
 * Validates x-admin-token header against configured admin tokens
 */
export function adminAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const traceId = (c as any).get('traceId')
    const adminToken = c.req.header('x-admin-token')
    
    if (!adminToken) {
      logger.warn('Admin request without token', { traceId })
      return c.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Admin token required',
          traceId
        }
      }, 401)
    }
    
    // Check if token is valid
    const validTokens = env.API_KEYS
    if (!validTokens.includes(adminToken)) {
      logger.warn('Invalid admin token', { traceId, tokenPrefix: adminToken.substring(0, 8) + '...' })
      return c.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid admin token',
          traceId
        }
      }, 401)
    }
    
    // Add admin context to request
    c.set('isAdmin', true)
    c.set('adminToken', adminToken)
    
    logger.debug('Admin request authenticated', { traceId })
    
    await next()
  }
}

/**
 * Optional admin authentication middleware
 * Allows requests to proceed even without admin token
 */
export function optionalAdminAuthMiddleware() {
  return async (c: Context, next: Next) => {
    const traceId = (c as any).get('traceId')
    const adminToken = c.req.header('x-admin-token')
    
    if (adminToken) {
      const validTokens = env.API_KEYS
      if (validTokens.includes(adminToken)) {
        c.set('isAdmin', true)
        c.set('adminToken', adminToken)
        logger.debug('Optional admin request authenticated', { traceId })
      } else {
        logger.warn('Invalid optional admin token', { traceId })
      }
    }
    
    await next()
  }
}
