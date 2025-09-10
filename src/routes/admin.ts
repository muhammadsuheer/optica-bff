/**
 * Admin Routes - Cache Management and System Operations
 * 
 * Secured endpoints for cache invalidation and system maintenance.
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

// Services and adapters
import { bumpListVersion, productCache } from '../adapters/cache'
import { logger } from '../utils/logger'
import { env } from '../config/env'

// Types
import type { Context } from 'hono'

// =======================
// Validation Schemas
// =======================

const adminTokenSchema = z.object({
  'x-admin-token': z.string().min(1, 'Admin token required')
})

const cacheBumpSchema = z.object({
  type: z.enum(['catalog', 'products', 'all']).default('catalog'),
  namespace: z.string().optional().default('catalog')
})

// =======================
// Middleware
// =======================

/**
 * Admin authentication middleware
 */
const adminAuth = async (c: Context, next: () => Promise<void>) => {
  const adminToken = c.req.header('x-admin-token')
  const traceId = c.get('traceId')
  
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
  
  // Validate token
  if (!env.API_KEYS.includes(adminToken)) {
    logger.warn('Invalid admin token', { 
      traceId, 
      tokenPrefix: adminToken.substring(0, 8) + '...' 
    })
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED', 
        message: 'Invalid admin token',
        traceId
      }
    }, 401)
  }
  
  // Add admin context
  c.set('isAdmin', true)
  logger.debug('Admin request authenticated', { traceId })
  
  await next()
}

// =======================
// Router Setup
// =======================

export const adminRoutes = new Hono()

// Apply admin auth to all routes
adminRoutes.use('*', adminAuth)

// =======================
// Cache Management
// =======================

/**
 * POST /v1/admin/catalog/bump
 * Bump catalog version to invalidate cache
 */
adminRoutes.post(
  '/catalog/bump',
  zValidator('json', cacheBumpSchema),
  async (c: Context) => {
    const { type, namespace } = c.req.valid('json')
    const traceId = c.get('traceId')
    
    try {
      let result = {
        type,
        namespace,
        invalidatedCount: 0,
        newVersion: '',
        timestamp: new Date().toISOString()
      }
      
      switch (type) {
        case 'catalog':
        case 'all':
          // Bump catalog version
          result.newVersion = await bumpListVersion(namespace)
          result.invalidatedCount = await productCache.invalidateAll()
          break
          
        case 'products':
          // Just invalidate product cache without version bump
          result.invalidatedCount = await productCache.invalidateAll()
          break
      }
      
      logger.info('Cache invalidated via admin', {
        type,
        namespace,
        invalidatedCount: result.invalidatedCount,
        newVersion: result.newVersion,
        traceId
      })
      
      return c.json({
        success: true,
        data: result,
        meta: {
          traceId,
          timestamp: new Date().toISOString()
        }
      })
      
    } catch (error) {
      logger.error('Cache invalidation failed', { error, type, namespace, traceId })
      
      return c.json({
        success: false,
        error: {
          code: 'CACHE_INVALIDATION_ERROR',
          message: 'Failed to invalidate cache',
          traceId
        }
      }, 500)
    }
  }
)

/**
 * GET /v1/admin/cache/status
 * Get cache status and statistics
 */
adminRoutes.get('/cache/status', async (c: Context) => {
  const traceId = c.get('traceId')
  
  try {
    // Get cache health status
    const cacheHealth = await productCache.healthCheck?.() || { healthy: true }
    
    return c.json({
      success: true,
      data: {
        healthy: cacheHealth.healthy,
        timestamp: new Date().toISOString(),
        ...cacheHealth
      },
      meta: {
        traceId,
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    logger.error('Cache status check failed', { error, traceId })
    
    return c.json({
      success: false,
      error: {
        code: 'CACHE_STATUS_ERROR',
        message: 'Failed to get cache status',
        traceId
      }
    }, 500)
  }
})

export { adminRoutes }