/**
 * Rate Limiter Middleware for Edge Runtime
 * Uses KV (Upstash Redis) for atomic, distributed rate limiting
 */
import { Context, Next } from 'hono';
export interface RateLimitOptions {
    requests: number;
    window: number;
    keyGenerator?: (c: Context) => string;
    skipIf?: (c: Context) => boolean;
    onLimitReached?: (c: Context) => void;
}
export interface RateLimitInfo {
    requests: number;
    remaining: number;
    reset: number;
    limit: number;
}
/**
 * Rate limiter using KV for atomic, distributed limiting
 */
export declare function rateLimit(options: RateLimitOptions): (c: Context, next: Next) => Promise<void>;
/**
 * API key based rate limiter
 */
export declare function apiKeyRateLimit(options?: Partial<RateLimitOptions>): (c: Context, next: Next) => Promise<void>;
/**
 * User-based rate limiter
 */
export declare function userRateLimit(options?: Partial<RateLimitOptions>): (c: Context, next: Next) => Promise<void>;
/**
 * Endpoint-specific rate limiter
 */
export declare function endpointRateLimit(endpoint: string, options?: Partial<RateLimitOptions>): (c: Context, next: Next) => Promise<void>;
//# sourceMappingURL=rateLimiter.d.ts.map