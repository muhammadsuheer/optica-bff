export declare const CACHE_KEYS: {
    PRODUCT_LIST: (filters: string, page: number) => string;
    PRODUCT_DETAIL: (id: number) => string;
    PRODUCT_VARIANTS: (id: number) => string;
    SEARCH_RESULTS: (query: string, filters: string) => string;
    SEARCH_SUGGESTIONS: (query: string) => string;
    CART_CONTENTS: (sessionId: string) => string;
    CART_TOTALS: (sessionId: string) => string;
    ORDER_DETAIL: (id: number) => string;
    ORDER_STATUS: (id: number) => string;
    ORDER_LIST: (filters: string, page: number) => string;
    CATEGORIES: () => string;
    TAGS: () => string;
    CUSTOMER_DETAIL: (id: number) => string;
    SYSTEM_STATUS: () => string;
    STORE_INFO: () => string;
};
export declare const CACHE_TTL: {
    PRODUCT_LIST: number;
    PRODUCT_DETAIL: number;
    PRODUCT_SEARCH: number;
    ORDER_LIST: number;
    ORDER_DETAIL: number;
    ORDER_STATUS: number;
    CART_CONTENTS: number;
    CART_TOTALS: number;
    SEARCH_RESULTS: number;
    SEARCH_SUGGESTIONS: number;
    CATEGORIES: number;
    TAGS: number;
    CUSTOMER_DETAIL: number;
    SYSTEM_STATUS: number;
    STORE_INFO: number;
};
export interface CacheEntry {
    key: string;
    data: any;
    expires: number;
    tags: string[];
    createdAt: number;
    hitCount: number;
}
export declare class CacheService {
    private memoryCache;
    private readonly maxMemorySize;
    private readonly memoryTTL;
    constructor();
    get<T = any>(key: string): Promise<T | null>;
    set(key: string, value: any, ttl: number, tags?: string[]): Promise<void>;
    invalidateByTags(tags: string[]): Promise<void>;
    invalidate(key: string): Promise<void>;
    clear(): Promise<void>;
    getStats(): Promise<{
        memorySize: number;
        databaseSize: number;
        hitRatio: number;
        topKeys: Array<{
            key: string;
            hits: number;
        }>;
    }>;
    cleanup(): Promise<void>;
    private setMemoryCache;
    private cleanupMemoryCache;
    private getResourceType;
    private updateCacheStats;
    wrap<T>(key: string, fn: () => Promise<T>, ttl: number, tags?: string[]): Promise<T>;
    getMany<T = any>(keys: string[]): Promise<Map<string, T | null>>;
    preload(entries: Array<{
        key: string;
        value: any;
        ttl: number;
        tags?: string[];
    }>): Promise<void>;
}
export declare const cacheService: CacheService;
export declare function invalidateCacheOnWebhook(topic: string, resourceId: number): Promise<void>;
//# sourceMappingURL=cache.d.ts.map