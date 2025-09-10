/**
 * Edge-Compatible Cache Key Generator
 * Uses Web Crypto API instead of Node.js crypto
 */
/**
 * Generate cache key with hash for consistent length
 */
export declare function generateCacheKey(prefix: string, data: any): Promise<string>;
/**
 * Sanitize cache key to ensure compatibility
 */
export declare function sanitizeCacheKey(key: string): string;
/**
 * Create cache key with TTL suffix
 */
export declare function createTtlKey(baseKey: string, ttl: number): string;
/**
 * Extract expiry time from TTL key
 */
export declare function getExpiryFromKey(key: string): number | null;
/**
 * Check if cache key has expired
 */
export declare function isKeyExpired(key: string): boolean;
//# sourceMappingURL=cacheKey.d.ts.map