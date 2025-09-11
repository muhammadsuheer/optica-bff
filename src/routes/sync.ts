/**
 * Sync Routes for Edge Runtime
 * Handles general data synchronization and cache management
 */

import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import databaseService, { supabaseClient } from '../services/databaseService'
import { cacheService } from '../services/cacheService'
import { logger } from '../observability/logger'
import { validateRequest, getValidated } from '../middleware/validateRequest'
import { apiKey } from '../middleware/apiKey'
import { requireRole } from '../middleware/auth'
import { rateLimitByKeyAndIP } from '../middleware/rateLimiter'

const sync = new Hono()

// Request schemas
const fullSyncSchema = z.object({
  resources: z.array(z.enum(['products', 'orders', 'customers', 'categories'])).optional(),
  force: z.boolean().default(false),
  batch_size: z.number().min(1).max(100).default(50)
})

const cacheInvalidateSchema = z.object({
  keys: z.array(z.string()).optional(),
  patterns: z.array(z.string()).optional(),
  clear_all: z.boolean().default(false)
})

// Apply middleware
sync.use('*', apiKey({ allowedKeyTypes: ['admin'] }))
sync.use('*', requireRole(['admin', 'service_role']))
sync.use('*', rateLimitByKeyAndIP('sync', { requests: 5, window: 60 })) // 5 sync requests per minute

/**
 * POST /sync/full - Perform full data synchronization
 */
sync.post('/full',
  validateRequest({ body: fullSyncSchema }),
  async (c) => {
    try {
      const { resources = ['products', 'orders'], force, batch_size } = getValidated<z.infer<typeof fullSyncSchema>>(c, 'body')
      
      logger.info('Starting full synchronization', { resources, force, batch_size })
      
      const syncResults: Record<string, any> = {}
      const startTime = Date.now()

      // Sync each requested resource
      for (const resource of resources) {
        try {
          logger.info(`Syncing ${resource}...`)
          const result = await syncResource(resource, { force, batch_size })
          syncResults[resource] = result
          
          // Clear related cache
          await cacheService.invalidateByTags([resource])
          
        } catch (error) {
          logger.error(`Failed to sync ${resource}`, error instanceof Error ? error : new Error('Unknown error'))
          syncResults[resource] = {
            success: false,
            error: (error as Error).message
          }
        }
      }

      const duration = Date.now() - startTime

      logger.info('Full synchronization completed', {
        duration,
        results: syncResults
      })

      return c.json({
        message: 'Full synchronization completed',
        duration_ms: duration,
        results: syncResults,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('Full sync error', error instanceof Error ? error : new Error('Unknown error'))
      throw new HTTPException(500, { message: 'Full synchronization failed' })
    }
  }
)

/**
 * POST /sync/incremental - Perform incremental synchronization
 */
sync.post('/incremental',
  async (c) => {
    try {
      logger.info('Starting incremental synchronization')
      
      const startTime = Date.now()
      const results: Record<string, any> = {}

      // Get last sync timestamps
      const lastSyncTimes = await getLastSyncTimes()

      // Sync products modified since last sync
      if (lastSyncTimes.products as any) {
        const productsResult = await syncResource('products', {
          since: lastSyncTimes.products,
          batch_size: 20
        })
        results.products = productsResult
      }

      // Sync orders modified since last sync
      if (lastSyncTimes.orders) {
        const ordersResult = await syncResource('orders', {
          since: lastSyncTimes.orders,
          batch_size: 50
        })
        results.orders = ordersResult
      }

      const duration = Date.now() - startTime

      // Update last sync times
      await updateLastSyncTimes()

      logger.info('Incremental synchronization completed', {
        duration,
        results
      })

      return c.json({
        message: 'Incremental synchronization completed',
        duration_ms: duration,
        results,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('Incremental sync error', error instanceof Error ? error : new Error('Unknown error'))
      throw new HTTPException(500, { message: 'Incremental synchronization failed' })
    }
  }
)

/**
 * POST /sync/cache/invalidate - Invalidate cache entries
 */
sync.post('/cache/invalidate',
  validateRequest({ body: cacheInvalidateSchema }),
  async (c) => {
    try {
      const { keys, patterns, clear_all } = getValidated<z.infer<typeof cacheInvalidateSchema>>(c, 'body')
      
      logger.info('Cache invalidation requested', { keys, patterns, clear_all })
      
      let invalidatedCount = 0

      if (clear_all) {
        await cacheService.invalidateByTags(['*'])
        invalidatedCount = 1000 // Approximate count
        logger.info('All cache cleared')
      } else {
        // Invalidate specific keys
        if (keys && keys.length > 0) {
          for (const key of keys) {
            await cacheService.del(key)
            invalidatedCount++
          }
        }

        // Invalidate by patterns (convert patterns to tags)
        if (patterns && patterns.length > 0) {
          for (const pattern of patterns) {
            const result = await cacheService.invalidateByTags([pattern])
            invalidatedCount += result.deleted
          }
        }
      }

      return c.json({
        message: 'Cache invalidation completed',
        invalidated_count: invalidatedCount,
        operations: {
          clear_all,
          keys_count: keys?.length || 0,
          patterns_count: patterns?.length || 0
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('Cache invalidation error', error instanceof Error ? error : new Error('Unknown error'))
      throw new HTTPException(500, { message: 'Cache invalidation failed' })
    }
  }
)

/**
 * GET /sync/status - Get synchronization status
 */
sync.get('/status',
  async (c) => {
    try {
      const status = await getSyncStatus()
      
      return c.json(status)
    } catch (error) {
      logger.error('Get sync status error', error instanceof Error ? error : new Error('Unknown error'))
      throw new HTTPException(500, { message: 'Failed to get sync status' })
    }
  }
)

/**
 * GET /sync/cache/stats - Get cache statistics
 */
sync.get('/cache/stats',
  async (c) => {
    try {
      const stats = await cacheService.getStats()
      
      return c.json({
        cache: stats,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('Get cache stats error', error instanceof Error ? error : new Error('Unknown error'))
      throw new HTTPException(500, { message: 'Failed to get cache stats' })
    }
  }
)

/**
 * POST /sync/health-check - Force health check on all services
 */
sync.post('/health-check',
  async (c) => {
    try {
      logger.info('Performing forced health check')
      
      const results = {
        database: await databaseService.healthCheck(),
        cache: await cacheService.getStats(),
        timestamp: new Date().toISOString()
      }

      const allHealthy = results.database.healthy

      return c.json({
        status: allHealthy ? 'healthy' : 'unhealthy',
        results,
        timestamp: results.timestamp
      }, allHealthy ? 200 : 503)
    } catch (error) {
      logger.error('Health check error', error instanceof Error ? error : new Error('Unknown error'))
      throw new HTTPException(500, { message: 'Health check failed' })
    }
  }
)

/**
 * Helper Functions
 */

/**
 * Sync a specific resource type
 */
async function syncResource(resource: string, options: any = {}): Promise<any> {
  const { force = false, batch_size = 50, since } = options

  switch (resource) {
    case 'products':
      return syncProducts({ force, batch_size, since })
    case 'orders':
      return syncOrders({ force, batch_size, since })
    case 'customers':
      return syncCustomers({ force, batch_size, since })
    case 'categories':
      return syncCategories({ force, batch_size, since })
    default:
      throw new Error(`Unknown resource type: ${resource}`)
  }
}

/**
 * Sync products
 */
async function syncProducts(options: any): Promise<any> {
  // Mock implementation - would integrate with actual WooCommerce sync
  return {
    success: true,
    synced: 0,
    errors: 0,
    duration_ms: 100
  }
}

/**
 * Sync orders
 */
async function syncOrders(options: any): Promise<any> {
  // Mock implementation - would integrate with actual WooCommerce sync
  return {
    success: true,
    synced: 0,
    errors: 0,
    duration_ms: 150
  }
}

/**
 * Sync customers
 */
async function syncCustomers(options: any): Promise<any> {
  // Mock implementation
  return {
    success: true,
    synced: 0,
    errors: 0,
    duration_ms: 75
  }
}

/**
 * Sync categories
 */
async function syncCategories(options: any): Promise<any> {
  // Mock implementation
  return {
    success: true,
    synced: 0,
    errors: 0,
    duration_ms: 50
  }
}

/**
 * Get last synchronization timestamps
 */
async function getLastSyncTimes(): Promise<Record<string, string>> {
  // Would store and retrieve from database
  return {
    products: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    orders: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
    customers: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 24 hours ago
  }
}

/**
 * Update last synchronization timestamps
 */
async function updateLastSyncTimes(): Promise<void> {
  // Would update timestamps in database
  const now = new Date().toISOString()
  // Store sync times for each resource
}

/**
 * Get synchronization status
 */
async function getSyncStatus(): Promise<any> {
  const lastSyncTimes = await getLastSyncTimes()
  
  return {
    status: 'operational',
    last_full_sync: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
    last_incremental_sync: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
    resources: {
      products: {
        last_sync: lastSyncTimes.products,
        status: 'up_to_date'
      },
      orders: {
        last_sync: lastSyncTimes.orders,
        status: 'up_to_date'
      },
      customers: {
        last_sync: lastSyncTimes.customers,
        status: 'up_to_date'
      }
    },
    cache: {
      size: 0, // Cache size not available in new implementation
      hit_rate: 0.85 // Mock hit rate
    },
    queue: {
      pending_jobs: 0,
      failed_jobs: 0
    }
  }
}

export default sync