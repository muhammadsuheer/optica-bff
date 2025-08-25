import { Redis } from 'ioredis';
import { LRUCache } from 'lru-cache';
import { envConfig } from '../config/env.js';
import { Counter, Gauge } from 'prom-client';
import { CacheKey } from '../utils/cacheKey.js';
import type { CacheEntry } from '../types/index.js';


export class CacheService {
  private redis: Redis;
  private l1Cache: LRUCache<string, CacheEntry>; // Ultra-hot cache
  private l2Cache: LRUCache<string, CacheEntry>; // Hot cache with larger capacity
  
  // Performance monitoring
  private stats = {
    l1Hits: 0,
    l2Hits: 0,
    redisHits: 0,
    misses: 0,
    totalRequests: 0,
    avgResponseTime: 0,
  };

  constructor() {
    // Initialize Redis connection with performance optimizations
    this.redis = new Redis(envConfig.redis.REDIS_URL, {
      password: envConfig.redis.REDIS_PASSWORD || undefined,
      db: envConfig.redis.REDIS_DB || 0,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      enableAutoPipelining: true, // Batch Redis commands automatically
      keepAlive: 30000, // Keep connections alive
      connectTimeout: 1000, // Fast connection timeout
      commandTimeout: 2000, // Fast command timeout
      enableReadyCheck: false, // Skip ready check for faster startup
    });

    // L1 Cache: Ultra-hot data with zero-allocation access patterns
    this.l1Cache = new LRUCache<string, CacheEntry>({
      max: 1000, // Increased for better hit rate
      ttl: 30000, // 30 seconds for ultra-hot data
      allowStale: false,
      updateAgeOnGet: true,
      updateAgeOnHas: true, // Update age on has() calls too
      dispose: () => cacheEvictions.inc({ tier: 'l1' }),
    });

    // L2 Cache: Hot data with larger capacity and stale tolerance
    this.l2Cache = new LRUCache<string, CacheEntry>({
      max: 5000, // Larger capacity for better hit rate
      ttl: 120000, // 2 minutes for hot data
      allowStale: true, // Allow stale data for better performance
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      dispose: () => cacheEvictions.inc({ tier: 'l2' }),
    });

    // Optimized Redis event handlers
    this.redis.on('error', this.handleRedisError);
    this.redis.on('connect', () => console.log('Redis connected'));
    this.redis.on('ready', () => console.log('Redis ready'));
  }

  private handleRedisError = (error: Error) => {
    console.error('Redis error:', error.message);
    // Don't log full stack traces in production for performance
  };

  /**
   * Gets a value from cache with optimized hot-path lookups
   * L1 (ultra-hot) -> L2 (hot) -> Redis -> null
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Ensure key is properly namespaced
      const namespacedKey = CacheKey.isOurs(key) ? key : CacheKey.buildKey('custom', key);

      // L1: Check ultra-hot cache first (sub-ms access)
      const l1Entry = this.l1Cache.get(namespacedKey);
      if (l1Entry && this.isEntryValid(l1Entry)) {
        cacheHits.inc({ tier: 'l1' });
        return l1Entry.data as T;
      }

      // L2: Check hot cache
      const l2Entry = this.l2Cache.get(namespacedKey);
      if (l2Entry && this.isEntryValid(l2Entry)) {
        // Promote to L1 if accessed frequently
        this.l1Cache.set(namespacedKey, l2Entry);
        cacheHits.inc({ tier: 'l2' });
        return l2Entry.data as T;
      }

      // L3: Check Redis cache
  const redisValue = await this.redis.get(namespacedKey);
      if (redisValue) {
        const entry: CacheEntry<T> = JSON.parse(redisValue);
        
        if (this.isEntryValid(entry)) {
          // Populate both L1 and L2 caches
      this.l2Cache.set(namespacedKey, entry);
      this.l1Cache.set(namespacedKey, entry);
      cacheHits.inc({ tier: 'redis' });
          return entry.data;
        } else {
          // Remove expired entry
          await this.redis.del(namespacedKey);
        }
      }
    cacheMisses.inc();
      return null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Sets a value in all cache tiers with optimized hot-path storage
   */
  async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    const namespacedKey = CacheKey.isOurs(key) ? key : CacheKey.buildKey('custom', key);
    
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000, // Convert to milliseconds
    };

    try {
      // Determine cache tier based on key pattern for optimization
      const isUltraHot = this.isUltraHotKey(namespacedKey);
      const isHot = isUltraHot || this.isHotKey(namespacedKey);

      // Always set in Redis for persistence
      await this.redis.setex(namespacedKey, ttlSeconds, JSON.stringify(entry));

      // Set in appropriate memory cache tiers
      if (isUltraHot) {
        // Ultra-hot data: store in L1 cache
        this.l1Cache.set(namespacedKey, entry, { ttl: Math.min(ttlSeconds * 1000, 30000) });
      }
      
      if (isHot) {
        // Hot data: store in L2 cache
        this.l2Cache.set(namespacedKey, entry, { ttl: ttlSeconds * 1000 });
      }
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Determines if a key represents ultra-hot data (products, sessions)
   */
  private isUltraHotKey(key: string): boolean {
    const parts = CacheKey.parse(key);
    return parts.includes('product') || parts.includes('session') || parts.includes('user');
  }

  /**
   * Determines if a key represents hot data (product lists, search results)
   */
  private isHotKey(key: string): boolean {
    const parts = CacheKey.parse(key);
    return parts.includes('products') || parts.includes('search') || parts.includes('health');
  }

  /**
   * Deletes a value from all cache tiers
   */
  async delete(key: string): Promise<void> {
    try {
      const namespacedKey = CacheKey.isOurs(key) ? key : CacheKey.buildKey('custom', key);
      
      // Remove from all cache tiers
      this.l1Cache.delete(namespacedKey);
      this.l2Cache.delete(namespacedKey);
      await this.redis.del(namespacedKey);
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Clears all cache entries matching a pattern from all tiers
   * Optimized to avoid iterator issues and improve performance
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const namespacedPattern = CacheKey.isOurs(pattern) ? pattern : CacheKey.buildKey('custom', pattern);
      
      // Clear L1 cache entries matching pattern (convert iterator to array)
      const l1Keys = Array.from(this.l1Cache.keys());
      for (const key of l1Keys) {
        if (this.matchesPattern(key, namespacedPattern)) {
          this.l1Cache.delete(key);
        }
      }

      // Clear L2 cache entries matching pattern (convert iterator to array)
      const l2Keys = Array.from(this.l2Cache.keys());
      for (const key of l2Keys) {
        if (this.matchesPattern(key, namespacedPattern)) {
          this.l2Cache.delete(key);
        }
      }

      // Clear Redis entries matching pattern
      const keys = await this.redis.keys(namespacedPattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error(`Cache deletePattern error for pattern ${pattern}:`, error);
    }
  }

  /**
   * Gets or sets a value with a factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds = 60
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Checks if multiple keys exist in any cache tier
   */
  async exists(...keys: string[]): Promise<boolean[]> {
    try {
      const namespacedKeys = keys.map(key => 
        CacheKey.isOurs(key) ? key : CacheKey.buildKey('custom', key)
      );

      const results = namespacedKeys.map(key => {
        // Check L1 cache first
        if (this.l1Cache.has(key)) return true;
        // Check L2 cache
        if (this.l2Cache.has(key)) return true;
        return false;
      });

      // For keys not found in memory, check Redis
      const redisChecks = await Promise.all(
        namespacedKeys.map(async (key, index) => {
          if (results[index]) return true;
          return (await this.redis.exists(key)) === 1;
        })
      );

      return redisChecks;
    } catch (error) {
      console.error('Cache exists error:', error);
      return keys.map(() => false);
    }
  }

  /**
   * Gets multiple values at once with optimized tier checking
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    try {
      const namespacedKeys = keys.map(key => 
        CacheKey.isOurs(key) ? key : CacheKey.buildKey('custom', key)
      );

      // Check L1 cache first for all keys
      const l1MissingKeys: string[] = [];
      for (let i = 0; i < namespacedKeys.length; i++) {
        const key = namespacedKeys[i];
        const originalKey = keys[i];
        const l1Entry = this.l1Cache.get(key);
        
        if (l1Entry && this.isEntryValid(l1Entry)) {
          results.set(originalKey, l1Entry.data as T);
        } else {
          l1MissingKeys.push(key);
        }
      }

      // Check L2 cache for remaining keys
      const l2MissingKeys: string[] = [];
      for (const key of l1MissingKeys) {
        const originalKey = keys[namespacedKeys.indexOf(key)];
        const l2Entry = this.l2Cache.get(key);
        
        if (l2Entry && this.isEntryValid(l2Entry)) {
          results.set(originalKey, l2Entry.data as T);
          // Promote to L1
          this.l1Cache.set(key, l2Entry);
        } else {
          l2MissingKeys.push(key);
        }
      }

      // Get remaining keys from Redis
      if (l2MissingKeys.length > 0) {
        const redisValues = await this.redis.mget(...l2MissingKeys);
        
        for (let i = 0; i < l2MissingKeys.length; i++) {
          const key = l2MissingKeys[i];
          const originalKey = keys[namespacedKeys.indexOf(key)];
          const value = redisValues[i];
          
          if (value) {
            try {
              const entry: CacheEntry<T> = JSON.parse(value);
              if (this.isEntryValid(entry)) {
                results.set(originalKey, entry.data);
                // Store in both L1 and L2 caches
                this.l2Cache.set(key, entry);
                this.l1Cache.set(key, entry);
              }
            } catch (parseError) {
              console.error(`Failed to parse cached value for key ${key}:`, parseError);
            }
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Cache getMany error:', error);
      return results;
    }
  }

  /**
   * Checks Redis connection health
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets cache statistics for monitoring
   */
  getStats() {
    return {
      l1Cache: {
        size: this.l1Cache.size,
        max: this.l1Cache.max,
        hitRatio: this.l1Cache.size / (this.l1Cache.max || 1),
      },
      l2Cache: {
        size: this.l2Cache.size,
        max: this.l2Cache.max,
        hitRatio: this.l2Cache.size / (this.l2Cache.max || 1),
      },
      redis: {
        status: this.redis.status,
      },
    };
  }

  /**
   * Gets the Redis instance for advanced operations
   */
  getRedisInstance(): Redis {
    return this.redis;
  }

  /**
   * Closes cache connections and clears memory
   */
  async close(): Promise<void> {
    this.l1Cache.clear();
    this.l2Cache.clear();
    await this.redis.quit();
  }

  /**
   * Checks if a cache entry is still valid
   */
  private isEntryValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Checks if a string matches a pattern (simple glob-like matching)
   */
  private matchesPattern(str: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regexPattern}$`).test(str);
  }

  /** Metrics snapshot for /metrics enrichment */
  getMemoryCacheStats() {
    return {
      l1Size: this.l1Cache.size,
      l2Size: this.l2Cache.size,
    };
  }
}

// Prometheus metrics (module-level singletons)
export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Cache hits by tier',
  labelNames: ['tier'] as const,
});
export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Cache misses total',
});
export const cacheEvictions = new Counter({
  name: 'cache_evictions_total',
  help: 'LRU cache evictions',
  labelNames: ['tier'] as const,
});
export const cacheMemoryGauge = new Gauge({
  name: 'cache_memory_sizes',
  help: 'In-memory LRU cache sizes',
  labelNames: ['tier'] as const,
});
