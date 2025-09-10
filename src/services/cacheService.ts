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

import { kvClient } from '../lib/kvClient'
import { logger } from '../utils/logger'

// Cache configuration
interface CacheOptions {
  ttl?: number
  tags?: string[]
  compress?: boolean
  maxSize?: number
}

interface CacheStats {
  memoryHits: number
  kvHits: number
  misses: number
  sets: number
  deletes: number
  errors: number
  totalRequests: number
  memorySize: number
  kvSize: number
}

interface CacheEntry<T = any> {
  data: T
  expires: number
  tags: string[]
  compressed: boolean
  size: number
  hitCount: number
  createdAt: number
  lastAccessed: number
}

// Response size limits
const MAX_CACHE_SIZE = 2 * 1024 * 1024 // 2MB max per entry
const MAX_MEMORY_ENTRIES = 500 // Limit memory cache size
const COMPRESSION_THRESHOLD = 50 * 1024 // 50KB

class EdgeCacheService {
  private memoryCache = new Map<string, CacheEntry>()
  private stats: CacheStats = {
    memoryHits: 0,
    kvHits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    totalRequests: 0,
    memorySize: 0,
    kvSize: 0
  }

  /**
   * Get value from cache (memory -> KV -> miss)
   */
  async get<T = any>(key: string): Promise<T | null> {
    this.stats.totalRequests++

    try {
      // 1. Check memory cache first
      const memoryEntry = this.memoryCache.get(key)
      if (memoryEntry && memoryEntry.expires > Date.now()) {
        memoryEntry.hitCount++
        memoryEntry.lastAccessed = Date.now()
        this.stats.memoryHits++
        
        logger.debug('Cache hit (memory)', { key, hitCount: memoryEntry.hitCount })
        return this.deserializeValue(memoryEntry.data, memoryEntry.compressed) as T
      }

      // 2. Check KV cache
      const kvEntry = await kvClient.get<CacheEntry<string>>(key)
      if (kvEntry && kvEntry.expires > Date.now()) {
        this.stats.kvHits++
        
        // Store in memory for next access (with shorter TTL)
        const memoryTtl = Math.min(60000, kvEntry.expires - Date.now()) // Max 1 minute in memory
        this.setMemoryCache(key, kvEntry, memoryTtl)
        
        logger.debug('Cache hit (KV)', { key })
        return this.deserializeValue(kvEntry.data, kvEntry.compressed) as T
      }

      // 3. Cache miss
      this.stats.misses++
      logger.debug('Cache miss', { key })
      return null

    } catch (error) {
      this.stats.errors++
      logger.error('Cache get error', { key, error })
      return null
    }
  }

  /**
   * Set value in cache (both memory and KV)
   */
  async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const {
        ttl = 3600, // 1 hour default
        tags = [],
        compress = false,
        maxSize = MAX_CACHE_SIZE
      } = options

      // Serialize and validate size
      const serialized = JSON.stringify(value)
      if (serialized.length > maxSize) {
        logger.warn('Cache value too large', { key, size: serialized.length, maxSize })
        return false
      }

      // Determine if compression is needed
      const shouldCompress = compress || serialized.length > COMPRESSION_THRESHOLD
      const finalData = shouldCompress ? await this.compressData(serialized) : serialized

      const entry: CacheEntry<string> = {
        data: finalData,
        expires: Date.now() + (ttl * 1000),
        tags,
        compressed: shouldCompress,
        size: finalData.length,
        hitCount: 0,
        createdAt: Date.now(),
        lastAccessed: Date.now()
      }

      // Store in KV
      const kvSuccess = await kvClient.set(key, entry, { ttl })
      
      if (kvSuccess) {
        // Store in memory with shorter TTL
        const memoryTtl = Math.min(60000, ttl * 1000) // Max 1 minute in memory
        this.setMemoryCache(key, entry, memoryTtl)

        // Add to tag sets for invalidation
        for (const tag of tags) {
          await kvClient.sadd(tag, key)
        }

        this.stats.sets++
        logger.debug('Cache set', { key, size: entry.size, ttl, tags })
        return true
      }

      return false

    } catch (error) {
      this.stats.errors++
      logger.error('Cache set error', { key, error })
      return false
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      // Remove from memory
      this.memoryCache.delete(key)

      // Remove from KV
      const kvSuccess = await kvClient.del(key)
      
      if (kvSuccess) {
        this.stats.deletes++
        logger.debug('Cache delete', { key })
      }

      return kvSuccess

    } catch (error) {
      this.stats.errors++
      logger.error('Cache delete error', { key, error })
      return false
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<{ deleted: number; errors: string[] }> {
    try {
      logger.info('Cache invalidation by tags', { tags })
      const result = await kvClient.invalidateByTags(tags)
      
      // Also clear related entries from memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.tags.some(tag => tags.includes(tag))) {
          this.memoryCache.delete(key)
        }
      }

      logger.info('Cache invalidation completed', { 
        tags, 
        deleted: result.deleted, 
        errors: result.errors.length 
      })

      return result

    } catch (error) {
      logger.error('Cache invalidation error', { tags, error })
      return { deleted: 0, errors: [error instanceof Error ? error.message : 'Unknown error'] }
    }
  }

  /**
   * Warm cache with precomputed value
   */
  async warm<T = any>(
    key: string, 
    generator: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    try {
      // Check if already cached
      const existing = await this.get<T>(key)
      if (existing !== null) {
        return existing
      }

      // Generate and cache value
      const value = await generator()
      await this.set(key, value, options)
      
      logger.debug('Cache warmed', { key })
      return value

    } catch (error) {
      logger.error('Cache warm error', { key, error })
      throw error
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: number; memoryHitRate: number; kvHitRate: number } {
    const totalHits = this.stats.memoryHits + this.stats.kvHits
    const hitRate = this.stats.totalRequests > 0 ? (totalHits / this.stats.totalRequests) * 100 : 0
    const memoryHitRate = this.stats.totalRequests > 0 ? (this.stats.memoryHits / this.stats.totalRequests) * 100 : 0
    const kvHitRate = this.stats.totalRequests > 0 ? (this.stats.kvHits / this.stats.totalRequests) * 100 : 0

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryHitRate: Math.round(memoryHitRate * 100) / 100,
      kvHitRate: Math.round(kvHitRate * 100) / 100
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = Date.now()
    
    try {
      // Test KV connectivity
      const testKey = `health:${Date.now()}`
      const testValue = { test: true, timestamp: Date.now() }
      
      await this.set(testKey, testValue, { ttl: 10 })
      const retrieved = await this.get(testKey)
      await this.del(testKey)
      
      const latency = Date.now() - startTime
      
      if (!retrieved || retrieved.test !== true) {
        return { healthy: false, latency, error: 'Cache read/write test failed' }
      }

      return { healthy: true, latency }

    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Private methods

  private setMemoryCache(key: string, entry: CacheEntry<string>, ttlMs: number): void {
    // Implement LRU eviction if memory cache is full
    if (this.memoryCache.size >= MAX_MEMORY_ENTRIES) {
      this.evictLRU()
    }

    this.memoryCache.set(key, {
      ...entry,
      expires: Date.now() + ttlMs
    })
  }

  private evictLRU(): void {
    let oldestKey = ''
    let oldestTime = Date.now()

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey)
      logger.debug('Evicted LRU cache entry', { key: oldestKey })
    }
  }

  private async compressData(data: string): Promise<string> {
    // Simple compression using built-in compression
    try {
      const stream = new CompressionStream('gzip')
      const writer = stream.writable.getWriter()
      const reader = stream.readable.getReader()

      writer.write(new TextEncoder().encode(data))
      writer.close()

      const chunks: Uint8Array[] = []
      let done = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) chunks.push(value)
      }

      const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
      let offset = 0
      for (const chunk of chunks) {
        compressed.set(chunk, offset)
        offset += chunk.length
      }

      return btoa(String.fromCharCode(...compressed))
    } catch (error) {
      logger.warn('Compression failed, using original data', { error })
      return data
    }
  }

  private async decompressData(compressedData: string): Promise<string> {
    try {
      const compressed = Uint8Array.from(atob(compressedData), c => c.charCodeAt(0))
      
      const stream = new DecompressionStream('gzip')
      const writer = stream.writable.getWriter()
      const reader = stream.readable.getReader()

      writer.write(compressed)
      writer.close()

      const chunks: Uint8Array[] = []
      let done = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) chunks.push(value)
      }

      const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
      let offset = 0
      for (const chunk of chunks) {
        decompressed.set(chunk, offset)
        offset += chunk.length
      }

      return new TextDecoder().decode(decompressed)
    } catch (error) {
      logger.warn('Decompression failed, using compressed data as-is', { error })
      return compressedData
    }
  }

  private deserializeValue(data: string, compressed: boolean): any {
    try {
      const jsonStr = compressed ? this.decompressData(data) : data
      return typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
    } catch (error) {
      logger.error('Cache value deserialization failed', { error })
      return null
    }
  }
}

// Export singleton instance
export const cacheService = new EdgeCacheService()

// Export class for testing
export { EdgeCacheService }

// Export types
export type { CacheOptions, CacheStats, CacheEntry }

// Cache key utilities for consistent key generation
export const CACHE_KEYS = {
  PRODUCTS: {
    LIST: (filters: any, page: number) => `products:list:${JSON.stringify(filters)}:${page}`,
    SINGLE: (id: number) => `products:${id}`,
    SEARCH: (query: string, limit: number) => `products:search:${query}:${limit}`,
    CATEGORIES: () => 'products:categories',
    POPULAR: (limit: number) => `products:popular:${limit}`
  },
  CART: {
    SESSION: (sessionId: string) => `cart:session:${sessionId}`,
    USER: (userId: string) => `cart:user:${userId}`,
    TOTALS: (cartId: string, type: string) => `cart:totals:${type}:${cartId}`
  },
  ORDERS: {
    SINGLE: (id: number) => `orders:${id}`,
    LIST: (filters: any, page: number) => `orders:list:${JSON.stringify(filters)}:${page}`,
    STATUS: (id: number) => `orders:${id}:status`
  },
  CUSTOMERS: {
    SINGLE: (id: number) => `customers:${id}`,
    LIST: (filters: any, page: number) => `customers:list:${JSON.stringify(filters)}:${page}`
  },
  HEALTH: {
    DATABASE: () => 'health:database',
    SYSTEM: () => 'health:system',
    CACHE: () => 'health:cache'
  }
}

// Cache TTL constants
export const CACHE_TTL = {
  PRODUCTS: {
    LIST: 3600,     // 1 hour
    SINGLE: 3600,   // 1 hour
    SEARCH: 1800,   // 30 minutes
    CATEGORIES: 7200, // 2 hours
    POPULAR: 1800   // 30 minutes
  },
  CART: {
    SESSION: 1800,  // 30 minutes
    USER: 3600,     // 1 hour
    TOTALS: 300     // 5 minutes
  },
  ORDERS: {
    SINGLE: 1800,   // 30 minutes
    LIST: 300,      // 5 minutes
    STATUS: 60      // 1 minute
  },
  CUSTOMERS: {
    SINGLE: 3600,   // 1 hour
    LIST: 600       // 10 minutes
  },
  HEALTH: {
    DATABASE: 300,  // 5 minutes
    SYSTEM: 180,    // 3 minutes
    CACHE: 60       // 1 minute
  }
}

// Cache tags for invalidation
export const CACHE_TAGS = {
  PRODUCTS: 'products',
  PRODUCT_LIST: 'product_list',
  PRODUCT_SEARCH: 'product_search',
  CART: 'cart',
  ORDERS: 'orders',
  CUSTOMERS: 'customers',
  HEALTH: 'health'
}
