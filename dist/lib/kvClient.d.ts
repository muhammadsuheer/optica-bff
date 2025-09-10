/**
 * Vercel KV (Upstash Redis) Client for Edge Runtime
 *
 * Features:
 * - JSON serialization with 4MB limit enforcement
 * - Exponential backoff for transient errors
 * - Tag-based invalidation system
 * - Bulk operations for performance
 * - TypeScript type safety
 */
interface KVConfig {
    url: string;
    token: string;
    readOnlyToken?: string;
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    timeout: number;
}
interface KVSetOptions {
    ttl?: number;
    nx?: boolean;
    xx?: boolean;
}
interface KVIncrOptions {
    ttl?: number;
    by?: number;
}
interface KVResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}
interface BulkSetItem {
    key: string;
    value: any;
    ttl?: number;
}
declare class KVClient {
    private config;
    private baseUrl;
    constructor(customConfig?: Partial<KVConfig>);
    /**
     * Get a value by key
     */
    get<T = any>(key: string): Promise<T | null>;
    /**
     * Set a value with optional TTL
     */
    set<T = any>(key: string, value: T, options?: KVSetOptions): Promise<boolean>;
    /**
     * Delete a key
     */
    del(key: string): Promise<boolean>;
    /**
     * Atomic increment
     */
    incr(key: string, options?: KVIncrOptions): Promise<number | null>;
    /**
     * Atomic decrement
     */
    decr(key: string, options?: KVIncrOptions): Promise<number | null>;
    /**
     * Set expiration time
     */
    expire(key: string, ttl: number): Promise<boolean>;
    /**
     * Get time-to-live for a key
     */
    ttl(key: string): Promise<number>;
    /**
     * Add key to a tag set (for tag-based invalidation)
     */
    sadd(tag: string, key: string): Promise<boolean>;
    /**
     * Get all keys in a tag set
     */
    smembers(tag: string): Promise<string[]>;
    /**
     * Tag-based cache invalidation
     */
    invalidateByTags(tags: string[]): Promise<{
        deleted: number;
        errors: string[];
    }>;
    /**
     * Bulk get operations
     */
    bulkGet<T = any>(keys: string[]): Promise<Map<string, T>>;
    /**
     * Bulk set operations
     */
    bulkSet(items: BulkSetItem[]): Promise<number>;
    /**
     * Bulk delete operations
     */
    bulkDel(keys: string[]): Promise<number>;
    /**
     * Execute Lua script for atomic operations
     */
    eval(script: string, keys?: string[], args?: string[]): Promise<any>;
    /**
     * Health check
     */
    ping(): Promise<boolean>;
    /**
     * Get connection info
     */
    info(): Promise<Record<string, any> | null>;
    private request;
    private validateKey;
    private validateValue;
    private chunkArray;
    private sleep;
}
export declare const kvClient: KVClient;
export { KVClient };
export type { KVConfig, KVSetOptions, KVIncrOptions, KVResponse, BulkSetItem };
//# sourceMappingURL=kvClient.d.ts.map