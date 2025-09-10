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
import { Context, Next } from 'hono';
interface RateLimitConfig {
    requests: number;
    window: number;
    strategy: 'fixed' | 'sliding';
    scope: 'ip' | 'api_key' | 'user_id' | 'endpoint';
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    keyGenerator?: (c: Context) => string;
    onLimitReached?: (c: Context, info: RateLimitInfo) => void;
    fallbackAction: 'allow' | 'deny';
}
interface RateLimitInfo {
    requests: number;
    remaining: number;
    reset: number;
    limit: number;
    resetTime: Date;
}
interface RateLimitResult {
    allowed: boolean;
    info: RateLimitInfo;
    error?: string;
}
declare class EdgeRateLimiter {
    private config;
    private metrics;
    constructor(config: RateLimitConfig);
    /**
     * Check rate limit for a request
     */
    checkLimit(c: Context): Promise<RateLimitResult>;
    /**
     * Middleware factory for Hono
     */
    middleware(): (c: Context, next: Next) => Promise<void>;
    /**
     * Check sliding window rate limit using Lua script
     */
    private checkSlidingWindow;
    /**
     * Check fixed window rate limit using Lua script
     */
    private checkFixedWindow;
    /**
     * Generate rate limit key based on scope
     */
    private generateKey;
    /**
     * Set rate limit headers
     */
    private setHeaders;
    /**
     * Get client IP address
     */
    private getClientIP;
    /**
     * Simple string hashing for key generation
     */
    private hashString;
    /**
     * Update internal metrics
     */
    private updateMetrics;
    /**
     * Get rate limiter metrics
     */
    getMetrics(): Record<string, number>;
    /**
     * Reset rate limit for a specific context
     */
    reset(c: Context): Promise<boolean>;
}
export declare const apiKeyRateLimit: EdgeRateLimiter;
export declare const userRateLimit: EdgeRateLimiter;
export declare const endpointRateLimit: EdgeRateLimiter;
export declare const ipRateLimit: EdgeRateLimiter;
export { EdgeRateLimiter };
export type { RateLimitConfig, RateLimitInfo, RateLimitResult };
//# sourceMappingURL=edgeRateLimiter.d.ts.map