/**
 * Rate Limiter Middleware for Edge Runtime
 * Uses KV (Upstash Redis) for distributed, atomic rate limiting
 */
import { EdgeRateLimiter, apiKeyRateLimit, userRateLimit, ipRateLimit } from '../lib/edgeRateLimiter';
/**
 * API Key rate limiting middleware
 * 1000 requests per hour per API key
 */
export function apiKeyRateLimitMiddleware() {
    return apiKeyRateLimit.middleware();
}
/**
 * User rate limiting middleware
 * 100 requests per 5 minutes per user
 */
export function userRateLimitMiddleware() {
    return userRateLimit.middleware();
}
/**
 * IP-based rate limiting middleware
 * 200 requests per 15 minutes per IP
 */
export function ipRateLimitMiddleware() {
    return ipRateLimit.middleware();
}
/**
 * Endpoint-specific rate limiting
 */
export function endpointRateLimit(requests, window) {
    const limiter = new EdgeRateLimiter({
        requests,
        window,
        strategy: 'sliding',
        scope: 'endpoint',
        fallbackAction: 'allow'
    });
    return limiter.middleware();
}
/**
 * Authentication endpoint rate limiting (stricter)
 */
export function authRateLimit() {
    const limiter = new EdgeRateLimiter({
        requests: 10, // Only 10 attempts
        window: 900, // Per 15 minutes
        strategy: 'sliding',
        scope: 'ip',
        fallbackAction: 'deny' // Deny on failure
    });
    return limiter.middleware();
}
/**
 * Search endpoint rate limiting
 */
export function searchRateLimit() {
    const limiter = new EdgeRateLimiter({
        requests: 30, // 30 searches
        window: 60, // Per minute
        strategy: 'sliding',
        scope: 'ip',
        fallbackAction: 'allow'
    });
    return limiter.middleware();
}
/**
 * Heavy operation rate limiting (sync, bulk operations)
 */
export function heavyOperationRateLimit() {
    const limiter = new EdgeRateLimiter({
        requests: 5, // Only 5 heavy operations
        window: 300, // Per 5 minutes
        strategy: 'fixed',
        scope: 'api_key',
        fallbackAction: 'deny'
    });
    return limiter.middleware();
}
/**
 * Custom rate limiter factory
 */
export function createRateLimit(options) {
    const limiter = new EdgeRateLimiter({
        strategy: 'sliding',
        fallbackAction: 'allow',
        ...options
    });
    return limiter.middleware();
}
// Export the EdgeRateLimiter class for direct use
export { EdgeRateLimiter };
// Export the predefined limiters
export { apiKeyRateLimit, userRateLimit, ipRateLimit };
//# sourceMappingURL=edgeRateLimiter.js.map