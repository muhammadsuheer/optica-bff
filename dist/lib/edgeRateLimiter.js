/**
 * Distributed Rate Limiter for Edge Runtime
 *
 * Features:
 * - Atomic operations using Redis INCR/EXPIRE
 * - Multiple rate limiting strategies (fixed window, sliding window)
 * - Scope-based rate limiting (IP, API key, user, endpoint)
 * - Graceful degradation when KV is unavailable
 * - Comprehensive metrics and headers
 */
import { HTTPException } from 'hono/http-exception';
import { kvClient } from './kvClient';
import { logger } from '../utils/logger';
// Lua script for atomic sliding window rate limiting
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Remove expired entries
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)

-- Count current requests
local current = redis.call('ZCARD', key)

if current < limit then
  -- Add current request
  redis.call('ZADD', key, now, now)
  -- Set expiration
  redis.call('EXPIRE', key, window)
  return {1, current + 1, limit - current - 1, now + window}
else
  -- Get oldest entry for reset time
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset_time = oldest[2] and (oldest[2] + window) or (now + window)
  return {0, current, 0, reset_time}
end
`;
// Lua script for atomic fixed window rate limiting
const FIXED_WINDOW_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Get current count
local current = redis.call('GET', key)
current = current and tonumber(current) or 0

if current < limit then
  -- Increment and set TTL if first request
  local new_count = redis.call('INCR', key)
  if new_count == 1 then
    redis.call('EXPIRE', key, window)
  end
  
  local ttl = redis.call('TTL', key)
  local reset_time = ttl > 0 and (now + ttl) or (now + window)
  
  return {1, new_count, limit - new_count, reset_time}
else
  local ttl = redis.call('TTL', key)
  local reset_time = ttl > 0 and (now + ttl) or (now + window)
  return {0, current, 0, reset_time}
end
`;
class EdgeRateLimiter {
    config;
    metrics = new Map();
    constructor(config) {
        this.config = {
            ...config,
            fallbackAction: config.fallbackAction || 'allow',
            strategy: config.strategy || 'fixed'
        };
    }
    /**
     * Check rate limit for a request
     */
    async checkLimit(c) {
        try {
            const key = this.generateKey(c);
            const now = Math.floor(Date.now() / 1000);
            let result;
            if (this.config.strategy === 'sliding') {
                result = await this.checkSlidingWindow(key, now);
            }
            else {
                result = await this.checkFixedWindow(key, now);
            }
            // Update metrics
            this.updateMetrics(key, result);
            return result;
        }
        catch (error) {
            logger.error('Rate limiter error', { error });
            // Fallback behavior
            const fallbackAllowed = this.config.fallbackAction === 'allow';
            return {
                allowed: fallbackAllowed,
                info: {
                    requests: 0,
                    remaining: fallbackAllowed ? this.config.requests : 0,
                    reset: Math.floor(Date.now() / 1000) + this.config.window,
                    limit: this.config.requests,
                    resetTime: new Date(Date.now() + this.config.window * 1000)
                },
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Middleware factory for Hono
     */
    middleware() {
        return async (c, next) => {
            const result = await this.checkLimit(c);
            // Set rate limit headers
            this.setHeaders(c, result.info);
            if (!result.allowed) {
                // Call custom handler if provided
                if (this.config.onLimitReached) {
                    this.config.onLimitReached(c, result.info);
                }
                // Log rate limit breach
                logger.warn('Rate limit exceeded', {
                    key: this.generateKey(c),
                    limit: this.config.requests,
                    window: this.config.window,
                    ip: this.getClientIP(c),
                    userAgent: c.req.header('user-agent'),
                    path: c.req.path
                });
                throw new HTTPException(429, {
                    message: 'Too Many Requests',
                    res: new Response(JSON.stringify({
                        error: 'Too Many Requests',
                        message: `Rate limit exceeded. Try again in ${result.info.reset - Math.floor(Date.now() / 1000)} seconds.`,
                        retryAfter: result.info.reset
                    }), {
                        status: 429,
                        headers: {
                            'Content-Type': 'application/json',
                            'Retry-After': (result.info.reset - Math.floor(Date.now() / 1000)).toString()
                        }
                    })
                });
            }
            await next();
        };
    }
    /**
     * Check sliding window rate limit using Lua script
     */
    async checkSlidingWindow(key, now) {
        const result = await kvClient.eval(SLIDING_WINDOW_SCRIPT, [key], [
            this.config.window.toString(),
            this.config.requests.toString(),
            now.toString()
        ]);
        if (!result || !Array.isArray(result)) {
            throw new Error('Invalid Lua script response');
        }
        const [allowed, current, remaining, resetTime] = result;
        return {
            allowed: allowed === 1,
            info: {
                requests: current,
                remaining: Math.max(0, remaining),
                reset: Math.floor(resetTime),
                limit: this.config.requests,
                resetTime: new Date(resetTime * 1000)
            }
        };
    }
    /**
     * Check fixed window rate limit using Lua script
     */
    async checkFixedWindow(key, now) {
        const result = await kvClient.eval(FIXED_WINDOW_SCRIPT, [key], [
            this.config.requests.toString(),
            this.config.window.toString(),
            now.toString()
        ]);
        if (!result || !Array.isArray(result)) {
            throw new Error('Invalid Lua script response');
        }
        const [allowed, current, remaining, resetTime] = result;
        return {
            allowed: allowed === 1,
            info: {
                requests: current,
                remaining: Math.max(0, remaining),
                reset: Math.floor(resetTime),
                limit: this.config.requests,
                resetTime: new Date(resetTime * 1000)
            }
        };
    }
    /**
     * Generate rate limit key based on scope
     */
    generateKey(c) {
        if (this.config.keyGenerator) {
            return `rl:custom:${this.config.keyGenerator(c)}`;
        }
        const windowStart = Math.floor(Date.now() / 1000 / this.config.window) * this.config.window;
        switch (this.config.scope) {
            case 'ip':
                const ip = this.getClientIP(c);
                const userAgent = c.req.header('user-agent') || 'unknown';
                const ipHash = this.hashString(`${ip}:${userAgent}`);
                return `rl:ip:${ipHash}:${windowStart}`;
            case 'api_key':
                const apiKey = c.req.header('x-api-key') ||
                    c.req.header('authorization')?.replace('Bearer ', '') ||
                    'anonymous';
                const keyHash = this.hashString(apiKey);
                return `rl:api_key:${keyHash}:${windowStart}`;
            case 'user_id':
                const user = c.get('user');
                const userId = user?.id || 'anonymous';
                return `rl:user:${userId}:${windowStart}`;
            case 'endpoint':
                const method = c.req.method;
                const path = c.req.path;
                const endpoint = `${method}:${path}`;
                return `rl:endpoint:${this.hashString(endpoint)}:${windowStart}`;
            default:
                throw new Error(`Unknown rate limit scope: ${this.config.scope}`);
        }
    }
    /**
     * Set rate limit headers
     */
    setHeaders(c, info) {
        c.header('X-RateLimit-Limit', info.limit.toString());
        c.header('X-RateLimit-Remaining', info.remaining.toString());
        c.header('X-RateLimit-Reset', info.reset.toString());
        c.header('X-RateLimit-Used', (info.limit - info.remaining).toString());
        if (info.remaining === 0) {
            c.header('Retry-After', (info.reset - Math.floor(Date.now() / 1000)).toString());
        }
    }
    /**
     * Get client IP address
     */
    getClientIP(c) {
        return c.req.header('cf-connecting-ip') || // Cloudflare
            c.req.header('x-real-ip') || // Nginx
            c.req.header('x-forwarded-for')?.split(',')[0] || // Load balancer
            c.req.header('x-client-ip') || // Apache
            'unknown';
    }
    /**
     * Simple string hashing for key generation
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
    /**
     * Update internal metrics
     */
    updateMetrics(key, result) {
        const scope = this.config.scope;
        if (result.allowed) {
            this.metrics.set(`${scope}:allowed`, (this.metrics.get(`${scope}:allowed`) || 0) + 1);
        }
        else {
            this.metrics.set(`${scope}:blocked`, (this.metrics.get(`${scope}:blocked`) || 0) + 1);
        }
        this.metrics.set(`${scope}:total`, (this.metrics.get(`${scope}:total`) || 0) + 1);
    }
    /**
     * Get rate limiter metrics
     */
    getMetrics() {
        return Object.fromEntries(this.metrics);
    }
    /**
     * Reset rate limit for a specific context
     */
    async reset(c) {
        try {
            const key = this.generateKey(c);
            return await kvClient.del(key);
        }
        catch (error) {
            logger.error('Rate limit reset error', { error });
            return false;
        }
    }
}
// Predefined rate limiters for common use cases
export const apiKeyRateLimit = new EdgeRateLimiter({
    requests: 1000,
    window: 3600, // 1 hour
    strategy: 'sliding',
    scope: 'api_key',
    fallbackAction: 'allow'
});
export const userRateLimit = new EdgeRateLimiter({
    requests: 100,
    window: 300, // 5 minutes
    strategy: 'sliding',
    scope: 'user_id',
    fallbackAction: 'allow'
});
export const endpointRateLimit = new EdgeRateLimiter({
    requests: 50,
    window: 60, // 1 minute
    strategy: 'fixed',
    scope: 'endpoint',
    fallbackAction: 'allow'
});
export const ipRateLimit = new EdgeRateLimiter({
    requests: 200,
    window: 900, // 15 minutes
    strategy: 'sliding',
    scope: 'ip',
    fallbackAction: 'deny'
});
// Export class and types
export { EdgeRateLimiter };
//# sourceMappingURL=edgeRateLimiter.js.map