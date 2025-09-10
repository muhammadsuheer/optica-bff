/**
 * Edge-Compatible Cache Service with KV Backend
 *
 * Features:
 * - Multi-layer caching (memory + KV)
 * - Tag-based invalidation
 * - Response size limits (4MB max)
 * - Automatic compression for large values
 * - Performance metrics
 */
interface CacheOptions {
    ttl?: number;
    tags?: string[];
    compress?: boolean;
    maxSize?: number;
}
interface CacheStats {
    memoryHits: number;
    kvHits: number;
    misses: number;
    sets: number;
    deletes: number;
    errors: number;
    totalRequests: number;
    memorySize: number;
    kvSize: number;
}
interface CacheEntry<T = any> {
    data: T;
    expires: number;
    tags: string[];
    compressed: boolean;
    size: number;
    hitCount: number;
    createdAt: number;
    lastAccessed: number;
}
declare class EdgeCacheService {
    private memoryCache;
    private stats;
    /**
     * Get value from cache (memory -> KV -> miss)
     */
    get<T = any>(key: string): Promise<T | null>;
    /**
     * Set value in cache (both memory and KV)
     */
    set<T = any>(key: string, value: T, options?: CacheOptions): Promise<boolean>;
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
     * Warm cache with precomputed value
     */
    warm<T = any>(key: string, generator: () => Promise<T>, options?: CacheOptions): Promise<T>;
    /**
     * Get cache statistics
     */
    getStats(): CacheStats & {
        hitRate: number;
        memoryHitRate: number;
        kvHitRate: number;
    };
    /**
     * Health check
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency: number;
        error?: string;
    }>;
    private setMemoryCache;
    private evictLRU;
    private compressData;
    private decompressData;
    private deserializeValue;
}
export declare const cacheService: EdgeCacheService;
export { EdgeCacheService };
export type { CacheOptions, CacheStats, CacheEntry };
export declare const CACHE_KEYS: {
    PRODUCTS: {
        LIST: (filters: any, page: number) => string;
        SINGLE: (id: number) => string;
        SEARCH: (query: string, limit: number) => string;
        CATEGORIES: () => string;
        POPULAR: (limit: number) => string;
    };
    CART: {
        SESSION: (sessionId: string) => string;
        USER: (userId: string) => string;
        TOTALS: (cartId: string, type: string) => string;
    };
    ORDERS: {
        SINGLE: (id: number) => string;
        LIST: (filters: any, page: number) => string;
        STATUS: (id: number) => string;
    };
    CUSTOMERS: {
        SINGLE: (id: number) => string;
        LIST: (filters: any, page: number) => string;
    };
    HEALTH: {
        DATABASE: () => string;
        SYSTEM: () => string;
        CACHE: () => string;
    };
};
export declare const CACHE_TTL: {
    PRODUCTS: {
        LIST: number;
        SINGLE: number;
        SEARCH: number;
        CATEGORIES: number;
        POPULAR: number;
    };
    CART: {
        SESSION: number;
        USER: number;
        TOTALS: number;
    };
    ORDERS: {
        SINGLE: number;
        LIST: number;
        STATUS: number;
    };
    CUSTOMERS: {
        SINGLE: number;
        LIST: number;
    };
    HEALTH: {
        DATABASE: number;
        SYSTEM: number;
        CACHE: number;
    };
};
export declare const CACHE_TAGS: {
    PRODUCTS: string;
    PRODUCT_LIST: string;
    PRODUCT_SEARCH: string;
    CART: string;
    ORDERS: string;
    CUSTOMERS: string;
    HEALTH: string;
};
//# sourceMappingURL=cacheService.d.ts.map