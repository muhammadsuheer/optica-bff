/**
 * Health Check Routes for Edge Runtime
 * Provides system health, readiness, and liveness endpoints
 */

import { Hono } from 'hono'
import databaseService from '../services/databaseService'
import { cacheService } from '../services/cacheService'
import { logger } from '../utils/logger'
import { config } from '../config/env'

const health = new Hono()

/**
 * GET /health - Basic health check
 */
health.get('/', async (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '1.0.0'
  })
})

/**
 * GET /health/live - Liveness probe (for container orchestration)
 */
health.get('/live', async (c) => {
  return c.json({
    status: 'alive',
    timestamp: new Date().toISOString()
  })
})

/**
 * GET /health/ready - Readiness probe with dependency checks
 */
health.get('/ready', async (c) => {
  const checks = {
    database: false,
    cache: false,
    timestamp: new Date().toISOString()
  }

  let overallStatus = 'ready'

  try {
    // Check database connectivity
    const dbHealth = await databaseService.healthCheck()
    checks.database = dbHealth.healthy
    
    if (!dbHealth.healthy) {
      overallStatus = 'not ready'
      logger.warn('Database health check failed', dbHealth)
    }
  } catch (error) {
    checks.database = false
    overallStatus = 'not ready'
    logger.error('Database health check error', { error })
  }

  try {
    // Check cache service
    const cacheHealth = await cacheService.healthCheck()
    checks.cache = cacheHealth.healthy
    
    if (!cacheHealth.healthy) {
      overallStatus = 'not ready'
      logger.warn('Cache health check failed', { error: cacheHealth.error })
    }
  } catch (error) {
    checks.cache = false
    overallStatus = 'not ready'
    logger.error('Cache health check error', { error })
  }

  const status = overallStatus === 'ready' ? 200 : 503

  return c.json({
    status: overallStatus,
    checks,
    timestamp: checks.timestamp
  }, status)
})

/**
 * GET /health/detailed - Comprehensive health information
 */
health.get('/detailed', async (c) => {
  const startTime = Date.now()
  
  const healthInfo = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    version: '1.0.0',
    uptime: process.uptime ? process.uptime() : 0,
    memory: getMemoryUsage(),
    checks: {
      database: null as any,
      cache: null as any
    },
    performance: {
      responseTime: 0
    }
  }

  // Database health check
  try {
    const dbHealth = await databaseService.healthCheck()
    healthInfo.checks.database = {
      status: dbHealth.healthy ? 'healthy' : 'unhealthy',
      responseTime: dbHealth.responseTime,
      details: dbHealth
    }
    
    if (!dbHealth.healthy) {
      healthInfo.status = 'degraded'
    }
  } catch (error) {
    healthInfo.checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    healthInfo.status = 'unhealthy'
  }

  // Cache health check
  try {
    const cacheHealth = await cacheService.healthCheck()
    healthInfo.checks.cache = {
      status: cacheHealth.healthy ? 'healthy' : 'unhealthy',
      latency: cacheHealth.latency,
      error: cacheHealth.error
    }
    
    if (!cacheHealth.healthy) {
      healthInfo.status = 'degraded'
    }
  } catch (error) {
    healthInfo.checks.cache = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    if (healthInfo.status === 'healthy') {
      healthInfo.status = 'degraded'
    }
  }

  healthInfo.performance.responseTime = Date.now() - startTime

  const statusCode = healthInfo.status === 'healthy' ? 200 : 
                    healthInfo.status === 'degraded' ? 200 : 503

  return c.json(healthInfo, statusCode)
})

/**
 * GET /health/metrics - Performance metrics
 */
health.get('/metrics', async (c) => {
  try {
    const metrics = await databaseService.getPerformanceMetrics()
    
    return c.json({
      timestamp: new Date().toISOString(),
      database: metrics,
      cache: await cacheService.getStats(),
      memory: getMemoryUsage()
    })
  } catch (error) {
    logger.error('Failed to get metrics', { error })
    return c.json({
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

/**
 * POST /health/reset-cache - Reset cache (admin only)
 */
health.post('/reset-cache', async (c) => {
  try {
    await cacheService.invalidateByTags(['*'])
    
    logger.info('Cache reset via health endpoint')
    
    return c.json({
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Failed to reset cache', { error })
    return c.json({
      error: 'Failed to reset cache',
      timestamp: new Date().toISOString()
    }, 500)
  }
})

/**
 * Get memory usage information
 */
function getMemoryUsage() {
  // Edge runtime may not have process.memoryUsage
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage()
    return {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`
    }
  }
  
  return { message: 'Memory information not available in Edge runtime' }
}

export default health