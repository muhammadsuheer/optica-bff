import { supabase } from './supabase'
import { config } from '../config/env'

// Cache key generation utilities
export const CACHE_KEYS = {
  // Product caching
  PRODUCT_LIST: (filters: string, page: number) => 
    `products:list:${btoa(filters)}:${page}`,
  PRODUCT_DETAIL: (id: number) => 
    `products:detail:${id}`,
  PRODUCT_VARIANTS: (id: number) => 
    `products:${id}:variants`,
  
  // Search caching
  SEARCH_RESULTS: (query: string, filters: string) => 
    `search:${btoa(query)}:${btoa(filters)}`,
  SEARCH_SUGGESTIONS: (query: string) => 
    `search:suggestions:${btoa(query)}`,
  
  // Cart caching
  CART_CONTENTS: (sessionId: string) => 
    `cart:${sessionId}`,
  CART_TOTALS: (sessionId: string) => 
    `cart:${sessionId}:totals`,
  
  // Order caching
  ORDER_DETAIL: (id: number) => 
    `orders:detail:${id}`,
  ORDER_STATUS: (id: number) => 
    `orders:${id}:status`,
  ORDER_LIST: (filters: string, page: number) => 
    `orders:list:${btoa(filters)}:${page}`,
  
  // Category and tag caching
  CATEGORIES: () => 'categories:all',
  TAGS: () => 'tags:all',
  
  // Customer caching
  CUSTOMER_DETAIL: (id: number) => 
    `customers:detail:${id}`,
  
  // System caching
  SYSTEM_STATUS: () => 'system:status',
  STORE_INFO: () => 'store:info'
}

// Cache TTL configuration
export const CACHE_TTL = {
  // Products - long TTL due to infrequent changes
  PRODUCT_LIST: config.cache.ttl.products,      // 1 hour
  PRODUCT_DETAIL: config.cache.ttl.products * 2, // 2 hours
  PRODUCT_SEARCH: config.cache.ttl.search,     // 30 minutes
  
  // Orders - shorter TTL due to frequent status changes
  ORDER_LIST: 300,         // 5 minutes
  ORDER_DETAIL: 600,       // 10 minutes
  ORDER_STATUS: 60,        // 1 minute
  
  // Cart - very short TTL for real-time experience
  CART_CONTENTS: 300,      // 5 minutes
  CART_TOTALS: 300,        // 5 minutes
  
  // Search - moderate TTL
  SEARCH_RESULTS: config.cache.ttl.search,     // 30 minutes
  SEARCH_SUGGESTIONS: config.cache.ttl.search * 2, // 1 hour
  
  // Categories and tags - long TTL
  CATEGORIES: config.cache.ttl.categories,     // 2 hours
  TAGS: config.cache.ttl.categories,          // 2 hours
  
  // Customers - moderate TTL
  CUSTOMER_DETAIL: 1800,   // 30 minutes
  
  // System - short TTL
  SYSTEM_STATUS: 300,      // 5 minutes
  STORE_INFO: 3600,        // 1 hour
}

export interface CacheEntry {
  key: string
  data: any
  expires: number
  tags: string[]
  createdAt: number
  hitCount: number
}

export class CacheService {
  private memoryCache = new Map<string, CacheEntry>()
  private readonly maxMemorySize = 1000 // Maximum number of items in memory cache
  private readonly memoryTTL = 300000 // 5 minutes in memory max

  constructor() {
    // Clean up expired memory cache entries every minute
    setInterval(() => {
      this.cleanupMemoryCache()
    }, 60000)

    console.log('Cache service initialized with multi-layer caching')
  }

  // Get data from cache (memory first, then database)
  async get<T = any>(key: string): Promise<T | null> {
    try {
      // 1. Check memory cache first (fastest)
      const memoryResult = this.memoryCache.get(key)
      if (memoryResult && memoryResult.expires > Date.now()) {
        memoryResult.hitCount++
        return memoryResult.data as T
      }

      // 2. Check Supabase cache
      const { data, error } = await supabase.getClient()
        .from('cache_index')
        .select('data, expires_at, hit_count, tags')
        .eq('cache_key', key)
        .gt('expires_at', new Date().toISOString())
        .single() as any

      if (error || !data) {
        return null
      }

      // Store in memory for next request (with shorter TTL)
      this.setMemoryCache(key, data.data, Math.min(this.memoryTTL, new Date(data.expires_at).getTime() - Date.now()), data.tags || [])

      // Update access stats in background
      this.updateCacheStats(key).catch(console.error)

      return data.data as T
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  // Set data in cache (both memory and database)
  async set(key: string, value: any, ttl: number, tags: string[] = []): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + ttl * 1000)
      const resourceType = this.getResourceType(key)
      
      // Store in memory
      this.setMemoryCache(key, value, ttl * 1000, tags)

      // Store in Supabase
      await (supabase.getClient() as any)
        .from('cache_index')
        .upsert({
          cache_key: key,
          resource_type: resourceType,
          tags,
          data: value,
          expires_at: expiresAt.toISOString(),
          hit_count: 0,
          accessed_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Cache set error:', error)
      // Don't throw - cache failures shouldn't break the app
    }
  }

  // Invalidate cache by tags
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      // Clear from memory cache
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.tags.some(tag => tags.includes(tag))) {
          this.memoryCache.delete(key)
        }
      }

      // Delete from Supabase by tags
      await supabase.getClient()
        .from('cache_index')
        .delete()
        .overlaps('tags', tags)

      console.log(`Cache invalidated for tags: ${tags.join(', ')}`)
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }

  // Invalidate specific cache key
  async invalidate(key: string): Promise<void> {
    try {
      // Remove from memory
      this.memoryCache.delete(key)

      // Remove from database
      await supabase.getClient()
        .from('cache_index')
        .delete()
        .eq('cache_key', key)

      console.log(`Cache invalidated for key: ${key}`)
    } catch (error) {
      console.error('Cache invalidation error:', error)
    }
  }

  // Clear all cache
  async clear(): Promise<void> {
    try {
      // Clear memory cache
      this.memoryCache.clear()

      // Clear database cache
      await supabase.getClient()
        .from('cache_index')
        .delete()
        .neq('id', 0) // Delete all rows

      console.log('All cache cleared')
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }

  // Get cache statistics
  async getStats(): Promise<{
    memorySize: number
    databaseSize: number
    hitRatio: number
    topKeys: Array<{ key: string; hits: number }>
  }> {
    try {
      const memorySize = this.memoryCache.size

      const { data: dbData, error } = await (supabase.getClient() as any)
        .from('cache_index')
        .select('cache_key, hit_count')
        .order('hit_count', { ascending: false })
        .limit(10)

      if (error) {
        throw error
      }

      const databaseSize = dbData?.length || 0
      const totalHits = dbData?.reduce((sum: number, item: any) => sum + item.hit_count, 0) || 0
      const hitRatio = totalHits > 0 ? totalHits / (totalHits + databaseSize) : 0

      const topKeys = dbData?.map((item: any) => ({
        key: item.cache_key,
        hits: item.hit_count
      })) || []

      return {
        memorySize,
        databaseSize,
        hitRatio,
        topKeys
      }
    } catch (error) {
      console.error('Cache stats error:', error)
      return {
        memorySize: this.memoryCache.size,
        databaseSize: 0,
        hitRatio: 0,
        topKeys: []
      }
    }
  }

  // Cleanup expired entries
  async cleanup(): Promise<void> {
    try {
      // Cleanup memory cache
      this.cleanupMemoryCache()

      // Cleanup database cache
      await supabase.getClient()
        .from('cache_index')
        .delete()
        .lt('expires_at', new Date().toISOString())

      console.log('Cache cleanup completed')
    } catch (error) {
      console.error('Cache cleanup error:', error)
    }
  }

  // Memory cache helpers
  private setMemoryCache(key: string, value: any, ttlMs: number, tags: string[]): void {
    // Remove oldest entries if we're at capacity
    if (this.memoryCache.size >= this.maxMemorySize) {
      const oldestKey = this.memoryCache.keys().next().value
      if (oldestKey) {
        this.memoryCache.delete(oldestKey)
      }
    }

    this.memoryCache.set(key, {
      key,
      data: value,
      expires: Date.now() + Math.min(ttlMs, this.memoryTTL),
      tags,
      createdAt: Date.now(),
      hitCount: 0
    })
  }

  private cleanupMemoryCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expires <= now) {
        this.memoryCache.delete(key)
      }
    }
  }

  private getResourceType(key: string): string {
    if (key.startsWith('products:')) return 'product'
    if (key.startsWith('orders:')) return 'order'
    if (key.startsWith('cart:')) return 'cart'
    if (key.startsWith('search:')) return 'search'
    if (key.startsWith('customers:')) return 'customer'
    if (key.startsWith('categories:')) return 'category'
    if (key.startsWith('tags:')) return 'tag'
    if (key.startsWith('system:')) return 'system'
    return 'other'
  }

  private async updateCacheStats(key: string): Promise<void> {
    try {
      await (supabase.getClient() as any)
        .from('cache_index')
        .update({ 
          hit_count: (supabase.getClient() as any).raw('hit_count + 1'),
          accessed_at: new Date().toISOString()
        })
        .eq('cache_key', key)
    } catch (error) {
      // Ignore stats update errors
    }
  }

  // Utility method to wrap function calls with caching
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number,
    tags: string[] = []
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Execute function and cache result
    const result = await fn()
    await this.set(key, result, ttl, tags)
    
    return result
  }

  // Batch operations
  async getMany<T = any>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>()
    
    // Try memory cache first
    const memoryHits = new Set<string>()
    for (const key of keys) {
      const memoryResult = this.memoryCache.get(key)
      if (memoryResult && memoryResult.expires > Date.now()) {
        results.set(key, memoryResult.data as T)
        memoryHits.add(key)
      }
    }

    // Get remaining keys from database
    const remainingKeys = keys.filter(key => !memoryHits.has(key))
    if (remainingKeys.length > 0) {
      try {
        const { data, error } = await (supabase.getClient() as any)
          .from('cache_index')
          .select('cache_key, data, expires_at, tags')
          .in('cache_key', remainingKeys)
          .gt('expires_at', new Date().toISOString())

        if (!error && data) {
          for (const item of data) {
            results.set(item.cache_key, item.data as T)
            // Store in memory cache
            this.setMemoryCache(
              item.cache_key, 
              item.data, 
              Math.min(this.memoryTTL, new Date(item.expires_at).getTime() - Date.now()),
              item.tags || []
            )
          }
        }
      } catch (error) {
        console.error('Batch cache get error:', error)
      }
    }

    // Set null for keys not found
    for (const key of keys) {
      if (!results.has(key)) {
        results.set(key, null)
      }
    }

    return results
  }

  // Preload cache with data
  async preload(entries: Array<{ key: string; value: any; ttl: number; tags?: string[] }>): Promise<void> {
    try {
      const cacheEntries = entries.map(entry => ({
        cache_key: entry.key,
        resource_type: this.getResourceType(entry.key),
        tags: entry.tags || [],
        data: entry.value,
        expires_at: new Date(Date.now() + entry.ttl * 1000).toISOString(),
        hit_count: 0,
        accessed_at: new Date().toISOString()
      }))

      // Batch insert to database
      await (supabase.getClient() as any)
        .from('cache_index')
        .upsert(cacheEntries)

      // Add to memory cache
      for (const entry of entries) {
        this.setMemoryCache(entry.key, entry.value, entry.ttl * 1000, entry.tags || [])
      }

      console.log(`Preloaded ${entries.length} cache entries`)
    } catch (error) {
      console.error('Cache preload error:', error)
    }
  }
}

// Create and export singleton instance
export const cacheService = new CacheService()

// Export cache invalidation helper
export async function invalidateCacheOnWebhook(topic: string, resourceId: number): Promise<void> {
  const tagsToInvalidate: string[] = []
  
  switch (topic) {
    case 'product.created':
    case 'product.updated':
      tagsToInvalidate.push(
        `product:${resourceId}`,
        'products:list',
        'search:results',
        'search:suggestions'
      )
      break
      
    case 'product.deleted':
      tagsToInvalidate.push(
        `product:${resourceId}`,
        'products:list',
        'search:results'
      )
      break
      
    case 'order.created':
    case 'order.updated':
      tagsToInvalidate.push(
        `order:${resourceId}`,
        'orders:list'
      )
      break
      
    case 'order.deleted':
      tagsToInvalidate.push(
        `order:${resourceId}`,
        'orders:list'
      )
      break

    default:
      console.log(`Unhandled webhook topic for cache invalidation: ${topic}`)
  }
  
  if (tagsToInvalidate.length > 0) {
    await cacheService.invalidateByTags(tagsToInvalidate)
  }
}
