/**
 * Cache Service - Tag-based Invalidation with Bulk Mode
 * 
 * Provides read-through caching with tag-based invalidation and bulk mode coalescing.
 * Optimized for Edge Runtime with Upstash Redis.
 * 
 * USAGE:
 * - Use this service (cache.ts) for high-level cache operations with tags and bulk mode
 * - Use baseCacheService (cacheService.ts) for low-level KV operations
 * - This service wraps the base service with advanced features like single-flight protection
 */

import { logger } from '../observability/logger'
import { cacheService as baseCacheService } from './cacheService'
import { config } from '../config/env'

// =======================
// Types
// =======================

export interface CacheOptions {
  ttl: number
  tags?: string[]
}

export interface BulkModeState {
  active: boolean
  tags: Set<string>
  startTime: number
}

// =======================
// Constants
// =======================

const BULK_MODE_THRESHOLD = config.cache?.bulkModeThreshold || 10 // events
const BULK_MODE_WINDOW = config.cache?.bulkModeWindow || 5000 // 5 seconds
const TAG_PREFIX = 'tag:'
const BULK_TAGS_KEY = 'bulk:tags'

// =======================
// Cache Service Class
// =======================

class TaggedCacheService {
  private bulkMode: BulkModeState = {
    active: false,
    tags: new Set(),
    startTime: 0
  }
  
  /**
   * Get or set cached value with tags
   */
  async getOrSetJson<T>(
    key: string,
    ttl: number,
    loader: () => Promise<T>,
    tags: string[] = []
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await baseCacheService.get<T>(key)
      if (cached !== null) {
        logger.debug('Cache hit', { key })
        return cached
      }
      
      // Load data
      const data = await loader()
      
      // Cache the data
      await this.setWithTags(key, data, { ttl, tags })
      
      logger.debug('Cache miss, data loaded and cached', { key })
      return data
      
    } catch (error) {
      logger.error('Cache getOrSetJson error', error instanceof Error ? error : new Error('Unknown error'), {key})
      
      // Fallback to loader on cache error
      return loader()
    }
  }
  
  /**
   * Set value with tags
   */
  async setWithTags<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    try {
      // Set the main value
      await baseCacheService.set(key, value, { ttl: options.ttl })
      
      // Bind key to tags
      if (options.tags && options.tags.length > 0) {
        await this.bindKeyToTags(key, options.tags)
      }
      
    } catch (error) {
      logger.error('Cache setWithTags error', error instanceof Error ? error : new Error('Unknown error'), {key})
    }
  }
  
  /**
   * Bind key to tags
   */
  async bindKeyToTags(key: string, tags: string[]): Promise<void> {
    try {
      const pipeline = []
      
      for (const tag of tags) {
        const tagKey = `${TAG_PREFIX}${tag}`
        pipeline.push(baseCacheService.sadd(tagKey, key))
      }
      
      await Promise.all(pipeline)
      
    } catch (error) {
      logger.error('Cache bindKeyToTags error', error instanceof Error ? error : new Error('Unknown error'), {key,
        tags})
    }
  }
  
  /**
   * Invalidate tags
   */
  async invalidateTags(tags: string[]): Promise<void> {
    try {
      // Check if we should enter bulk mode
      if (this.shouldEnterBulkMode()) {
        await this.enterBulkMode(tags)
        return
      }
      
      // Immediate invalidation
      await this.performInvalidation(tags)
      
    } catch (error) {
      logger.error('Cache invalidateTags error', error instanceof Error ? error : new Error('Unknown error'), {tags})
    }
  }
  
  /**
   * Check if we should enter bulk mode
   */
  private shouldEnterBulkMode(): boolean {
    const now = Date.now()
    
    // If bulk mode is already active, continue
    if (this.bulkMode.active) {
      return true
    }
    
    // Check if we've had many invalidations recently
    const timeSinceStart = now - this.bulkMode.startTime
    if (timeSinceStart < BULK_MODE_WINDOW) {
      return true
    }
    
    return false
  }
  
  /**
   * Enter bulk mode
   */
  private async enterBulkMode(tags: string[]): Promise<void> {
    if (!this.bulkMode.active) {
      this.bulkMode.active = true
      this.bulkMode.startTime = Date.now()
      
      logger.info('Cache bulk mode activated', {
        tags: tags.length
      })
    }
    
    // Add tags to bulk set
    for (const tag of tags) {
      this.bulkMode.tags.add(tag)
    }
    
    // Store in Redis for persistence across requests
    await baseCacheService.sadd(BULK_TAGS_KEY, ...tags)
  }
  
  /**
   * Flush bulk mode
   */
  async flushBulkMode(): Promise<void> {
    if (!this.bulkMode.active) {
      return
    }
    
    try {
      // Get all tags from Redis
      const allTags = await baseCacheService.smembers(BULK_TAGS_KEY)
      
      if (allTags.length > 0) {
        // Perform bulk invalidation
        await this.performInvalidation(allTags)
        
        // Rebuild hot lists
        await this.rebuildHotLists()
        
        logger.info('Cache bulk mode flushed', {
          tags: allTags.length
        })
      }
      
      // Clear bulk mode state
      this.bulkMode.active = false
      this.bulkMode.tags.clear()
      this.bulkMode.startTime = 0
      
      // Clear Redis bulk tags
      await baseCacheService.del(BULK_TAGS_KEY)
      
    } catch (error) {
      logger.error('Cache bulk mode flush error', error instanceof Error ? error : new Error('Unknown error'))
    }
  }
  
  /**
   * Perform tag invalidation
   */
  private async performInvalidation(tags: string[]): Promise<void> {
    const pipeline = []
    
    for (const tag of tags) {
      const tagKey = `${TAG_PREFIX}${tag}`
      
      // Get all keys bound to this tag
      const keys = await baseCacheService.smembers(tagKey)
      
      if (keys.length > 0) {
        // Delete all keys
        pipeline.push(baseCacheService.del(...keys))
        
        // Clear the tag set
        pipeline.push(baseCacheService.del(tagKey))
      }
    }
    
    await Promise.all(pipeline)
    
    logger.info('Cache tags invalidated', {
      tags: tags.length
    })
  }
  
  /**
   * Rebuild hot lists
   */
  private async rebuildHotLists(): Promise<void> {
    try {
      // This is a placeholder for rebuilding frequently accessed lists
      // In a real implementation, you might rebuild:
      // - Popular products
      // - Featured categories
      // - Recent orders
      // - etc.
      
      logger.info('Cache hot lists rebuilt')
      
    } catch (error) {
      logger.error('Cache hot lists rebuild error', error instanceof Error ? error : new Error('Unknown error'))
    }
  }
  
  /**
   * Single flight protection
   */
  async singleFlight<T>(
    key: string,
    ttl: number,
    loader: () => Promise<T>
  ): Promise<T> {
    const lockKey = `lock:${key}`
    const lockTtl = Math.min(ttl, 30) // Max 30 seconds lock
    
    try {
      // Try to acquire lock
      const lockAcquired = await baseCacheService.set(lockKey, '1', { 
        ttl: lockTtl,
        nx: true // Only set if not exists
      })
      
      if (lockAcquired) {
        // We got the lock, load data
        const data = await loader()
        
        // Cache the data
        await baseCacheService.set(key, data, { ttl })
        
        // Release lock
        await baseCacheService.del(lockKey)
        
        return data
      } else {
        // Wait for other process to finish
        let attempts = 0
        const maxAttempts = 10
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100))
          
          const cached = await baseCacheService.get<T>(key)
          if (cached !== null) {
            return cached
          }
          
          attempts++
        }
        
        // Fallback to loader if we can't get cached data
        return loader()
      }
      
    } catch (error) {
      logger.error('Cache singleFlight error', error instanceof Error ? error : new Error('Unknown error'), {key})
      
      // Fallback to loader on error
      return loader()
    }
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    bulkModeActive: boolean
    bulkTagsCount: number
    bulkModeDuration: number
  }> {
    const bulkTags = await baseCacheService.smembers(BULK_TAGS_KEY)
    
    return {
      bulkModeActive: this.bulkMode.active,
      bulkTagsCount: bulkTags.length,
      bulkModeDuration: this.bulkMode.active ? Date.now() - this.bulkMode.startTime : 0
    }
  }
}

// Export singleton instance
export const taggedCacheService = new TaggedCacheService()

// Export class for testing
// Exports handled above

// Re-export base cache service for convenience
// Exports handled above from './cacheService'
