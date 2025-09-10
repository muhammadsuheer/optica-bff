/**
 * Rate Limiter Middleware for Edge Runtime
 * Uses KV (Upstash Redis) for distributed, atomic rate limiting
 */
import { Context, Next } from 'hono';
import { EdgeRateLimiter, apiKeyRateLimit, userRateLimit, ipRateLimit } from '../lib/edgeRateLimiter';
/**
 * API Key rate limiting middleware
 * 1000 requests per hour per API key
 */
export declare function apiKeyRateLimitMiddleware(): (c: Context, next: Next) => Promise<void>;
/**
 * User rate limiting middleware
 * 100 requests per 5 minutes per user
 */
export declare function userRateLimitMiddleware(): (c: Context, next: Next) => Promise<void>;
/**
 * IP-based rate limiting middleware
 * 200 requests per 15 minutes per IP
 */
export declare function ipRateLimitMiddleware(): (c: Context, next: Next) => Promise<void>;
/**
 * Endpoint-specific rate limiting
 */
export declare function endpointRateLimit(requests: number, window: number): (c: Context, next: Next) => Promise<void>;
/**
 * Authentication endpoint rate limiting (stricter)
 */
export declare function authRateLimit(): (c: Context, next: Next) => Promise<void>;
/**
 * Search endpoint rate limiting
 */
export declare function searchRateLimit(): (c: Context, next: Next) => Promise<void>;
/**
 * Heavy operation rate limiting (sync, bulk operations)
 */
export declare function heavyOperationRateLimit(): (c: Context, next: Next) => Promise<void>;
/**
 * Custom rate limiter factory
 */
export declare function createRateLimit(options: {
    requests: number;
    window: number;
    scope: 'ip' | 'api_key' | 'user_id' | 'endpoint';
    strategy?: 'fixed' | 'sliding';
    fallbackAction?: 'allow' | 'deny';
    keyGenerator?: (c: Context) => string;
}): (c: Context, next: Next) => Promise<void>;
export { EdgeRateLimiter };
export { apiKeyRateLimit, userRateLimit, ipRateLimit };
//# sourceMappingURL=edgeRateLimiter.d.ts.map