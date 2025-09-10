/**
 * Performance Metrics API for Edge Runtime
 */
import { Hono } from 'hono';
import { upstashCache } from '../lib/upstashClient';
import { cacheService } from '../services/cacheService';
import { circuitBreakers } from '../middleware/circuitBreaker';
import { supabase } from '../services/supabase';
import { logger } from '../utils/logger';
const metrics = new Hono();
/**
 * GET /api/metrics/performance - Real-time performance metrics
 */
metrics.get('/performance', async (c) => {
    const startTime = performance.now();
    try {
        const [cacheStats, dbHealth, upstashHealth] = await Promise.allSettled([
            cacheService.getStats(),
            supabase.healthCheck().catch(() => ({ primary: { healthy: false, latency: 0 } })),
            upstashCache.healthCheck().catch(() => ({ healthy: false, latency: 0 }))
        ]);
        const responseTime = performance.now() - startTime;
        return c.json({
            timestamp: new Date().toISOString(),
            responseTime: `${responseTime.toFixed(2)}ms`,
            cache: {
                legacy: cacheStats.status === 'fulfilled' ? cacheStats.value : { error: 'Failed to get cache stats' },
                upstash: upstashHealth.status === 'fulfilled' ? upstashHealth.value : { error: 'Failed to get Upstash health' }
            },
            database: {
                primary: dbHealth.status === 'fulfilled' ? dbHealth.value.primary : { healthy: false, latency: 0 },
                backups: dbHealth.status === 'fulfilled' && 'backups' in dbHealth.value ? (dbHealth.value.backups || []) : []
            },
            circuitBreakers: {
                woocommerce: circuitBreakers.woocommerce.getMetrics(),
                supabase: circuitBreakers.supabase.getMetrics()
            },
            memory: typeof process !== 'undefined' && process.memoryUsage ? {
                rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
            } : { message: 'Memory info not available in Edge Runtime' },
            uptime: typeof process !== 'undefined' && process.uptime ?
                `${Math.round(process.uptime())}s` : 'N/A'
        });
    }
    catch (error) {
        logger.error('Metrics endpoint error', { error });
        return c.json({
            error: 'Failed to retrieve metrics',
            timestamp: new Date().toISOString()
        }, 500);
    }
});
/**
 * GET /api/metrics/health - Comprehensive health check
 */
metrics.get('/health', async (c) => {
    const checks = {
        cache: false,
        database: false,
        woocommerce: false,
        upstash: false,
        timestamp: new Date().toISOString()
    };
    let overallStatus = 'healthy';
    // Test Upstash cache
    try {
        const upstashHealth = await upstashCache.healthCheck();
        checks.upstash = upstashHealth.healthy;
        if (!checks.upstash)
            overallStatus = 'degraded';
    }
    catch (error) {
        checks.upstash = false;
        overallStatus = 'degraded';
    }
    // Test legacy cache
    try {
        const cacheHealth = await cacheService.healthCheck();
        checks.cache = cacheHealth.healthy;
        if (!checks.cache && overallStatus === 'healthy')
            overallStatus = 'degraded';
    }
    catch (error) {
        checks.cache = false;
        if (overallStatus === 'healthy')
            overallStatus = 'degraded';
    }
    // Test database
    try {
        const dbHealth = await supabase.healthCheck();
        checks.database = dbHealth.primary.healthy;
        if (!checks.database)
            overallStatus = 'degraded';
    }
    catch (error) {
        checks.database = false;
        overallStatus = 'unhealthy';
    }
    // Test WooCommerce (via circuit breaker)
    try {
        checks.woocommerce = circuitBreakers.woocommerce.getState() !== 'OPEN';
    }
    catch (error) {
        checks.woocommerce = false;
        if (overallStatus === 'healthy')
            overallStatus = 'degraded';
    }
    const statusCode = overallStatus === 'healthy' ? 200 :
        overallStatus === 'degraded' ? 200 : 503;
    return c.json({
        status: overallStatus,
        checks,
        timestamp: checks.timestamp
    }, statusCode);
});
/**
 * GET /api/metrics/cache - Cache-specific metrics
 */
metrics.get('/cache', async (c) => {
    try {
        const [legacyStats, upstashHealth] = await Promise.allSettled([
            cacheService.getStats(),
            upstashCache.healthCheck()
        ]);
        return c.json({
            timestamp: new Date().toISOString(),
            legacy: legacyStats.status === 'fulfilled' ? legacyStats.value : { error: 'Failed to get legacy cache stats' },
            upstash: upstashHealth.status === 'fulfilled' ? upstashHealth.value : { error: 'Failed to get Upstash health' }
        });
    }
    catch (error) {
        logger.error('Cache metrics error', { error });
        return c.json({
            error: 'Failed to retrieve cache metrics',
            timestamp: new Date().toISOString()
        }, 500);
    }
});
export default metrics;
//# sourceMappingURL=metrics.js.map