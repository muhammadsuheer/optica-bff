/**
 * Official Upstash Redis Client for Edge Runtime
 * Replaces custom KV client for better performance and reliability
 */
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { config } from '../config/env';
import { logger } from '../utils/logger';
// Initialize Redis client
export const redis = new Redis({
    url: config.kv.url,
    token: config.kv.token,
});
// Rate limiters using official client
export const rateLimiters = {
    api: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1000, '1h'),
        analytics: true,
    }),
    user: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '5m'),
        analytics: true,
    }),
    ip: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(200, '15m'),
        analytics: true,
    }),
    auth: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '15m'),
        analytics: true,
    })
};
// Enhanced cache service using official client
export class UpstashCacheService {
    async get(key) {
        try {
            const result = await redis.get(key);
            if (result) {
                logger.debug('Cache hit (Upstash)', { key });
            }
            return result;
        }
        catch (error) {
            logger.error('Cache get error', { key, error });
            return null;
        }
    }
    async set(key, value, ttl = 3600) {
        try {
            await redis.setex(key, ttl, JSON.stringify(value));
            logger.debug('Cache set (Upstash)', { key, ttl });
            return true;
        }
        catch (error) {
            logger.error('Cache set error', { key, error });
            return false;
        }
    }
    async del(key) {
        try {
            const result = await redis.del(key);
            return result > 0;
        }
        catch (error) {
            logger.error('Cache delete error', { key, error });
            return false;
        }
    }
    async invalidateByPattern(pattern) {
        try {
            const keys = await redis.keys(pattern);
            if (keys.length === 0)
                return 0;
            const result = await redis.del(...keys);
            logger.info('Cache pattern invalidation', { pattern, deleted: result });
            return result;
        }
        catch (error) {
            logger.error('Cache invalidation error', { pattern, error });
            return 0;
        }
    }
    async healthCheck() {
        const startTime = Date.now();
        try {
            await redis.ping();
            const latency = Date.now() - startTime;
            return { healthy: true, latency };
        }
        catch (error) {
            return {
                healthy: false,
                latency: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
export const upstashCache = new UpstashCacheService();
//# sourceMappingURL=upstashClient.js.map