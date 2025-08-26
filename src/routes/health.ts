import { Hono } from 'hono';
import type { Redis } from 'ioredis';
import { WPGraphQLClient } from '../services/wpGraphqlClient.js';
import { WooRestApiClient } from '../services/wooRestApiClient.js';
import { WooStoreApiClient } from '../services/wooStoreApiClient.js';
import { CacheService } from '../services/cacheService.js';
import type { HealthCheck, ApiResponse } from '../types/index.js';
import { logger } from '../utils/logger.js';

// Enhanced caching with multiple TTL levels
let healthCache = {
  liveness: { timestamp: 0, result: null as any },
  readiness: { timestamp: 0, result: null as any },
};

const CACHE_TTL = {
  liveness: 2000,  // 2 seconds (very frequent checks)
  readiness: 5000, // 5 seconds (moderate frequency)
  extended: 30000, // 30 seconds (for /health/full)
};

// Performance monitoring
const healthStats = {
  liveness: { requests: 0, avgTime: 0, errors: 0, cacheHits: 0 },
  readiness: { requests: 0, avgTime: 0, errors: 0, cacheHits: 0 },
  full: { requests: 0, avgTime: 0, errors: 0, cacheHits: 0 },
};

// Service timeout configurations
const SERVICE_TIMEOUTS = {
  redis: 1000,     // 1 second
  wordpress: 2000, // 2 seconds  
  woocommerce: 2000, // 2 seconds
  store: 1500,     // 1.5 seconds
};

/**
 * Health check routes with split /live and /ready endpoints for enterprise monitoring
 */
export function createHealthRoutes(cacheService: CacheService): Hono {
  const health = new Hono();

  /**
   * GET /health/live - Enhanced liveness probe with ultra-fast caching
   */
  health.get('/live', async (c) => {
    const startTime = Date.now();
    healthStats.liveness.requests++;

    try {
      // Check cache first for maximum performance
      const now = Date.now();
      if (healthCache.liveness.result && (now - healthCache.liveness.timestamp) < CACHE_TTL.liveness) {
        healthStats.liveness.cacheHits++;
        
        const responseTime = Date.now() - startTime;
        healthStats.liveness.avgTime = (healthStats.liveness.avgTime + responseTime) / 2;
        
        c.header('X-Response-Time', `${responseTime}ms`);
        c.header('X-Health-Type', 'liveness');
        c.header('X-Cache-Status', 'hit');
        
        return c.json(healthCache.liveness.result, 200);
      }

      // Fast basic health check (no external dependencies)
      const healthCheck: HealthCheck = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          redis: 'connected', // For liveness, basic connectivity assumed
          wordpress: 'connected', 
          woocommerce: 'connected',
          database: 'connected', // Assume connected for liveness
        },
        uptime: process.uptime(),
        version: '1.0.0',
      };

      const response: ApiResponse<HealthCheck> = {
        success: true,
        data: healthCheck,
      };

      // Cache the result
      healthCache.liveness = {
        timestamp: now,
        result: response,
      };

      const responseTime = Date.now() - startTime;
      healthStats.liveness.avgTime = (healthStats.liveness.avgTime + responseTime) / 2;
      
      c.header('X-Response-Time', `${responseTime}ms`);
      c.header('X-Health-Type', 'liveness');
      c.header('X-Cache-Status', 'miss');
      
      return c.json(response, 200);
    } catch (error) {
  healthStats.liveness.errors++;
  logger.error('Liveness check error:', error as Error);

      const healthCheck: HealthCheck = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          redis: 'disconnected',
          wordpress: 'disconnected',
          woocommerce: 'disconnected',
          database: 'disconnected',
        },
        uptime: process.uptime(),
        version: '1.0.0',
      };

      const response: ApiResponse<HealthCheck> = {
        success: false,
        data: healthCheck,
        error: {
          code: 'LIVENESS_CHECK_ERROR',
          message: 'Liveness check failed',
        },
      };

      const responseTime = Date.now() - startTime;
      healthStats.liveness.avgTime = (healthStats.liveness.avgTime + responseTime) / 2;
      c.header('X-Response-Time', `${responseTime}ms`);
      c.header('X-Health-Type', 'liveness');

      return c.json(response, 503);
    }
  });

  /**
   * GET /health/ready - Enhanced readiness probe with parallel dependency checking
   */
  health.get('/ready', async (c) => {
    const startTime = Date.now();
    healthStats.readiness.requests++;

    try {
      // Check cache first for performance
      const now = Date.now();
      if (healthCache.readiness.result && (now - healthCache.readiness.timestamp) < CACHE_TTL.readiness) {
        healthStats.readiness.cacheHits++;
        
        const responseTime = Date.now() - startTime;
        healthStats.readiness.avgTime = (healthStats.readiness.avgTime + responseTime) / 2;
        
        c.header('X-Response-Time', `${responseTime}ms`);
        c.header('X-Health-Type', 'readiness');
        c.header('X-Cache-Status', 'hit');
        
        return c.json(healthCache.readiness.result, healthCache.readiness.result.success ? 200 : 503);
      }

      // Get Redis instance from cache service
      const redis = (cacheService as any).redis;
      
      // Create service instances with dependency injection
      const wpClient = new WPGraphQLClient(redis);
      const wooRestClient = new WooRestApiClient();
      const wooStoreClient = new WooStoreApiClient();

      // Enhanced parallel health checks with individual timeouts
      const healthCheckPromises = [
        Promise.race([
          cacheService.healthCheck(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis timeout')), SERVICE_TIMEOUTS.redis)
          )
        ]).catch(() => false),
        
        Promise.race([
          wpClient.healthCheck(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('WordPress timeout')), SERVICE_TIMEOUTS.wordpress)
          )
        ]).catch(() => false),
        
        Promise.race([
          wooRestClient.healthCheck(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('WooCommerce REST timeout')), SERVICE_TIMEOUTS.woocommerce)
          )
        ]).catch(() => false),
        
        Promise.race([
          wooStoreClient.healthCheck(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('WooCommerce Store timeout')), SERVICE_TIMEOUTS.store)
          )
        ]).catch(() => false),
        
        // Database health check
        (async () => {
          try {
            const { checkDatabaseHealth } = await import('../services/databaseService.js');
            return await Promise.race([
              checkDatabaseHealth(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Database timeout')), 2000)
              )
            ]);
          } catch {
            return false;
          }
        })()
      ];

      // Execute all checks in parallel with proper error handling
      const [redisHealth, wpHealth, wooRestHealth, wooStoreHealth, databaseHealth] = await Promise.all(healthCheckPromises);

      const services = {
        redis: redisHealth ? 'connected' : 'disconnected',
        wordpress: wpHealth ? 'connected' : 'disconnected',
        woocommerce: (wooRestHealth && wooStoreHealth) ? 'connected' : 'disconnected',
        database: databaseHealth ? 'connected' : 'disconnected',
      } as const;

      const allHealthy = Object.values(services).every(status => status === 'connected');

      const healthCheck: HealthCheck = {
        status: allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services,
        uptime: process.uptime(),
        version: '1.0.0',
      };

      const response: ApiResponse<HealthCheck> = {
        success: allHealthy,
        data: healthCheck,
      };

      // Cache the result for future requests
      healthCache.readiness = {
        timestamp: now,
        result: response,
      };

      const responseTime = Date.now() - startTime;
      healthStats.readiness.avgTime = (healthStats.readiness.avgTime + responseTime) / 2;

      c.header('X-Response-Time', `${responseTime}ms`);
      c.header('X-Health-Type', 'readiness');
      c.header('X-Cache-Status', 'miss');

      return c.json(response, allHealthy ? 200 : 503);
    } catch (error) {
  healthStats.readiness.errors++;
  logger.error('Readiness check error:', error as Error);

      const healthCheck: HealthCheck = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          redis: 'disconnected',
          wordpress: 'disconnected',
          woocommerce: 'disconnected',
          database: 'disconnected',
        },
        uptime: process.uptime(),
        version: '1.0.0',
      };

      const response: ApiResponse<HealthCheck> = {
        success: false,
        data: healthCheck,
        error: {
          code: 'READINESS_CHECK_ERROR',
          message: 'Readiness check failed',
        },
      };

      const responseTime = Date.now() - startTime;
      healthStats.readiness.avgTime = (healthStats.readiness.avgTime + responseTime) / 2;
      c.header('X-Response-Time', `${responseTime}ms`);
      c.header('X-Health-Type', 'readiness');

      return c.json(response, 503);
    }
  });

  /**
   * GET /health/full - Comprehensive health check with detailed metrics
   */
  health.get('/full', async (c) => {
    const startTime = Date.now();
    healthStats.full.requests++;

    try {
      // Get Redis instance and create service instances
      const redis = (cacheService as any).redis;
      const wpClient = new WPGraphQLClient(redis);
      const wooRestClient = new WooRestApiClient();
      const wooStoreClient = new WooStoreApiClient();

      // Detailed health checks with performance metrics
      const detailedChecks = await Promise.allSettled([
        Promise.race([
          (async () => {
            const start = Date.now();
            const result = await cacheService.healthCheck();
            return { service: 'redis', healthy: result, responseTime: Date.now() - start };
          })(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Redis timeout')), SERVICE_TIMEOUTS.redis)
          )
        ]),
        
        Promise.race([
          (async () => {
            const start = Date.now();
            const result = await wpClient.healthCheck();
            return { service: 'wordpress', healthy: result, responseTime: Date.now() - start };
          })(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('WordPress timeout')), SERVICE_TIMEOUTS.wordpress)
          )
        ]),
        
        Promise.race([
          (async () => {
            const start = Date.now();
            const result = await wooRestClient.healthCheck();
            return { service: 'woocommerce-rest', healthy: result, responseTime: Date.now() - start };
          })(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('WooCommerce REST timeout')), SERVICE_TIMEOUTS.woocommerce)
          )
        ]),
        
        Promise.race([
          (async () => {
            const start = Date.now();
            const result = await wooStoreClient.healthCheck();
            return { service: 'woocommerce-store', healthy: result, responseTime: Date.now() - start };
          })(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('WooCommerce Store timeout')), SERVICE_TIMEOUTS.store)
          )
        ])
      ]);

      // Process detailed results with proper typing
      const serviceDetails = detailedChecks.map((result, index) => {
        const services = ['redis', 'wordpress', 'woocommerce-rest', 'woocommerce-store'];
        if (result.status === 'fulfilled' && result.value && typeof result.value === 'object') {
          return result.value as { service: string; healthy: boolean; responseTime: number };
        } else {
          return {
            service: services[index],
            healthy: false,
            responseTime: -1,
            error: result.status === 'rejected' ? (result.reason?.message || 'Unknown error') : 'Service check failed',
          };
        }
      });

      // Aggregate service status with safe property access
      const redisHealthy = serviceDetails[0]?.healthy === true;
      const wpHealthy = serviceDetails[1]?.healthy === true;
      const wooHealthy = (serviceDetails[2]?.healthy === true && serviceDetails[3]?.healthy === true);

      const services = {
        redis: redisHealthy ? 'connected' : 'disconnected',
        wordpress: wpHealthy ? 'connected' : 'disconnected',
        woocommerce: wooHealthy ? 'connected' : 'disconnected',
      } as const;

      const allHealthy = Object.values(services).every(status => status === 'connected');

      const healthCheck = {
        status: allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services,
        uptime: process.uptime(),
        version: '1.0.0',
        details: serviceDetails,
        performance: healthStats,
      };

      const response: ApiResponse<typeof healthCheck> = {
        success: allHealthy,
        data: healthCheck,
      };

      const responseTime = Date.now() - startTime;
      healthStats.full.avgTime = (healthStats.full.avgTime + responseTime) / 2;

      c.header('X-Response-Time', `${responseTime}ms`);
      c.header('X-Health-Type', 'full');
      c.header('X-Cache-Status', 'miss');

      return c.json(response, allHealthy ? 200 : 503);
    } catch (error) {
  healthStats.full.errors++;
  logger.error('Full health check error:', error as Error);

      const response: ApiResponse<any> = {
        success: false,
        error: {
          code: 'FULL_HEALTH_CHECK_ERROR',
          message: 'Full health check failed',
        },
      };

      const responseTime = Date.now() - startTime;
      healthStats.full.avgTime = (healthStats.full.avgTime + responseTime) / 2;
      c.header('X-Response-Time', `${responseTime}ms`);
      c.header('X-Health-Type', 'full');

      return c.json(response, 503);
    }
  });

  /**
   * GET /health/stats - Performance statistics endpoint
   */
  health.get('/stats', async (c) => {
    const stats = {
      performance: healthStats,
      cache: {
        liveness: {
          cached: healthCache.liveness.result !== null,
          age: healthCache.liveness.timestamp ? Date.now() - healthCache.liveness.timestamp : -1,
        },
        readiness: {
          cached: healthCache.readiness.result !== null,
          age: healthCache.readiness.timestamp ? Date.now() - healthCache.readiness.timestamp : -1,
        },
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
    
    return c.json({ success: true, data: stats });
  });

  /**
   * GET /health - Legacy endpoint (redirects to /ready)
   */
  health.get('/', async (c) => {
    return c.redirect('/health/ready', 301);
  });

  return health;
}
