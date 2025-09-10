/**
 * Official Upstash Redis Client for Edge Runtime
 *
 * Features:
 * - Official @upstash/redis HTTP client
 * - Edge-safe operations with automatic retries
 * - Tag-based cache invalidation
 * - Rate limiting with @upstash/ratelimit
 */
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
export declare const redis: Redis;
export declare const rateLimiters: {
    apiKey: Ratelimit;
    ip: Ratelimit;
    user: Ratelimit;
    auth: Ratelimit;
    search: Ratelimit;
    heavy: Ratelimit;
};
export declare class UpstashCacheService {
    private redis;
    constructor();
    /**
     * Get value from cache
     */
    get<T = any>(key: string): Promise<T | null>;
    /**
     * Set value in cache with TTL
     */
    set<T = any>(key: string, value: T, options?: {
        ttl?: number;
        tags?: string[];
    }): Promise<boolean>;
    /**
     * Delete value from cache
     */
    del(key: string): Promise<boolean>;
    /**
     * Invalidate cache by tags
     */
    invalidateByTags(tags: string[]): Promise<{
        deleted: number;
        errors: string[];
    }>;
    /**
     * Cached query wrapper
     */
    cachedQuery<T>(queryKey: string, queryFn: () => Promise<T>, ttl?: number): Promise<T>;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency: number;
        error?: string;
    }>;
    /**
     * Get cache statistics
     */
    getStats(): Promise<{
        info: Record<string, any>;
        memory: {
            used: number;
            peak: number;
        };
    }>;
}
export declare const upstashCache: UpstashCacheService;
export type { Redis };
//# sourceMappingURL=upstashRedis.d.ts.map