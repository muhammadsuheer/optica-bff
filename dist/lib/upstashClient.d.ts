/**
 * Official Upstash Redis Client for Edge Runtime
 * Replaces custom KV client for better performance and reliability
 */
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
export declare const redis: Redis;
export declare const rateLimiters: {
    api: Ratelimit;
    user: Ratelimit;
    ip: Ratelimit;
    auth: Ratelimit;
};
export declare class UpstashCacheService {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttl?: number): Promise<boolean>;
    del(key: string): Promise<boolean>;
    invalidateByPattern(pattern: string): Promise<number>;
    healthCheck(): Promise<{
        healthy: boolean;
        latency: number;
        error?: string;
    }>;
}
export declare const upstashCache: UpstashCacheService;
//# sourceMappingURL=upstashClient.d.ts.map