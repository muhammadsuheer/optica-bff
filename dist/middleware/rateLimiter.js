/**
 * Rate Limiter Middleware for Edge Runtime
 * Uses KV (Upstash Redis) for atomic, distributed rate limiting
 */
import { HTTPException } from 'hono/http-exception';
import { kvClient } from '../lib/kvClient';
import { config } from '../config/env';
import { logger } from '../utils/logger';
/**
 * Rate limiter using KV for atomic, distributed limiting
 */
export function rateLimit(options) {
    const { requests = config.rateLimiting.requests, window = config.rateLimiting.window, keyGenerator = defaultKeyGenerator, skipIf, onLimitReached } = options;
    return async (c, next) => {
        // Skip rate limiting if condition is met
        if (skipIf && skipIf(c)) {
            await next();
            return;
        }
        const key = `ratelimit:${keyGenerator(c)}`;
        const now = Math.floor(Date.now() / 1000);
        try {
            // Use atomic increment with expiry for sliding window
            const current = await kvClient.incr(key);
            // Set expiry on first increment
            if (current === 1) {
                await kvClient.expire(key, window);
            }
            // Get TTL to calculate reset time
            const ttl = await kvClient.ttl(key);
            const resetTime = ttl > 0 ? now + ttl : now + window;
            // Check if limit exceeded
            if (current > requests) {
                const rateLimitInfo = {
                    requests: current,
                    remaining: 0,
                    reset: resetTime,
                    limit: requests
                };
                // Set rate limit headers
                setRateLimitHeaders(c, rateLimitInfo);
                if (onLimitReached) {
                    onLimitReached(c);
                }
                logger.warn('Rate limit exceeded', {
                    key,
                    requests: current,
                    limit: requests,
                    window,
                    ip: getClientIP(c),
                    userAgent: c.req.header('user-agent')
                });
                throw new HTTPException(429, {
                    message: 'Too Many Requests',
                    cause: 'Rate limit exceeded'
                });
            }
            // Set rate limit headers
            const rateLimitInfo = {
                requests: current,
                remaining: Math.max(0, requests - current),
                reset: resetTime,
                limit: requests
            };
            setRateLimitHeaders(c, rateLimitInfo);
            logger.debug('Rate limit check passed', {
                key,
                requests: current,
                remaining: rateLimitInfo.remaining,
                limit: requests,
                window
            });
            await next();
        }
        catch (error) {
            if (error instanceof HTTPException) {
                throw error;
            }
            logger.error('Rate limiter error', { error, key });
            // Fail open - allow request if rate limiter fails
            logger.warn('Rate limiter failed, allowing request', { key });
            await next();
        }
    };
}
/**
 * Default key generator based on IP address
 */
function defaultKeyGenerator(c) {
    return getClientIP(c);
}
/**
 * Get client IP address from various headers
 */
function getClientIP(c) {
    const forwarded = c.req.header('x-forwarded-for');
    const realIP = c.req.header('x-real-ip');
    const cfConnectingIP = c.req.header('cf-connecting-ip');
    if (cfConnectingIP)
        return cfConnectingIP;
    if (realIP)
        return realIP;
    if (forwarded)
        return forwarded.split(',')[0].trim();
    return 'unknown';
}
/**
 * Set rate limit headers on response
 */
function setRateLimitHeaders(c, info) {
    c.header('X-RateLimit-Limit', String(info.limit));
    c.header('X-RateLimit-Remaining', String(info.remaining));
    c.header('X-RateLimit-Reset', String(info.reset));
    if (info.remaining === 0) {
        c.header('Retry-After', String(info.reset - Math.floor(Date.now() / 1000)));
    }
}
/**
 * API key based rate limiter
 */
export function apiKeyRateLimit(options = {}) {
    return rateLimit({
        requests: config.rateLimiting.requests,
        window: config.rateLimiting.window,
        ...options,
        keyGenerator: (c) => {
            const apiKey = c.req.header('x-api-key') || c.req.header('authorization')?.replace('Bearer ', '');
            if (apiKey) {
                return `api_key:${apiKey.substring(0, 16)}`;
            }
            return defaultKeyGenerator(c);
        }
    });
}
/**
 * User-based rate limiter
 */
export function userRateLimit(options = {}) {
    return rateLimit({
        requests: config.rateLimiting.requests,
        window: config.rateLimiting.window,
        ...options,
        keyGenerator: (c) => {
            const user = c.get('user');
            if (user?.id) {
                return `user:${user.id}`;
            }
            return defaultKeyGenerator(c);
        }
    });
}
/**
 * Endpoint-specific rate limiter
 */
export function endpointRateLimit(endpoint, options = {}) {
    return rateLimit({
        requests: 60, // Default 60 requests per window for endpoints
        window: 300, // 5 minutes
        ...options,
        keyGenerator: (c) => {
            const ip = getClientIP(c);
            return `endpoint:${endpoint}:${ip}`;
        }
    });
}
//# sourceMappingURL=rateLimiter.js.map