/**
 * Official Upstash Redis Client for Edge Runtime
 * 
 * Features:
 * - Official @upstash/redis HTTP client
 * - Edge-safe operations with automatic retries
 * - Tag-based cache invalidation
 * - Rate limiting with @upstash/ratelimit
 */

import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { env } from '../config/env'
import { logger } from '../utils/logger'

// Initialize Redis client
export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
  retry: {
    retries: 3,
    backoff: (retryCount) => Math.exp(retryCount) * 50
  }
})

// Rate limiters for different scopes
export const rateLimiters = {
  // API key rate limiting: 1000 requests per hour
  apiKey: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '1 h'),
    analytics: true,
    prefix: 'rl:api_key'
  }),

  // IP rate limiting: 200 requests per 15 minutes
  ip: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, '15 m'),
    analytics: true,
    prefix: 'rl:ip'
  }),

  // User rate limiting: 100 requests per 5 minutes
  user: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '5 m'),
    analytics: true,
    prefix: 'rl:user'
  }),

  // Auth endpoint rate limiting: 10 requests per 15 minutes
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '15 m'),
    analytics: true,
    prefix: 'rl:auth'
  }),

  // Search rate limiting: 30 requests per minute
  search: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
    prefix: 'rl:search'
  }),

  // Heavy operations: 5 requests per 5 minutes
  heavy: new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(5, '5 m'),
    analytics: true,
    prefix: 'rl:heavy'
  })
}

// Enhanced cache service with official Upstash client
export class UpstashCacheService {
  private redis: Redis

  constructor() {
    this.redis = redis
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key)
      if (value === null) return null
      
      logger.debug('Cache hit', { key })
      return value as T
    } catch (error) {
      logger.error('Cache get error', { key, error })
      return null
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T = any>(
    key: string, 
    value: T, 
    options: { ttl?: number; tags?: string[] } = {}
  ): Promise<boolean> {
    try {
      const { ttl = 3600, tags = [] } = options

      // Set the main value
      if (ttl > 0) {
        await this.redis.setex(key, ttl, JSON.stringify(value))
      } else {
        await this.redis.set(key, JSON.stringify(value))
      }

      // Add to tag sets for invalidation
      if (tags.length > 0) {
        const pipeline = this.redis.pipeline()
        for (const tag of tags) {
          pipeline.sadd(`tag:${tag}`, key)
          if (ttl > 0) {
            pipeline.expire(`tag:${tag}`, ttl + 300) // Tag expires 5 minutes after content
          }
        }
        await pipeline.exec()
      }

      logger.debug('Cache set', { key, ttl, tags })
      return true
    } catch (error) {
      logger.error('Cache set error', { key, error })
      return false
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key)
      logger.debug('Cache delete', { key, deleted: result })
      return result > 0
    } catch (error) {
      logger.error('Cache delete error', { key, error })
      return false
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<{ deleted: number; errors: string[] }> {
    const result = { deleted: 0, errors: [] as string[] }

    try {
      const pipeline = this.redis.pipeline()
      
      for (const tag of tags) {
        const tagKey = `tag:${tag}`
        
        // Get all keys for this tag
        const keys = await this.redis.smembers(tagKey)
        
        if (keys.length > 0) {
          // Delete all keys
          for (const key of keys) {
            pipeline.del(key)
          }
          
          // Delete the tag set
          pipeline.del(tagKey)
          result.deleted += keys.length
        }
      }

      await pipeline.exec()
      logger.info('Cache invalidation completed', { tags, deleted: result.deleted })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(errorMsg)
      logger.error('Cache invalidation error', { tags, error })
    }

    return result
  }

  /**
   * Cached query wrapper
   */
  async cachedQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(`query:${queryKey}`)
    if (cached !== null) {
      return cached
    }

    // Execute query and cache result
    const result = await queryFn()
    await this.set(`query:${queryKey}`, result, { ttl })
    return result
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const start = Date.now()
    
    try {
      await this.redis.ping()
      const latency = Date.now() - start
      return { healthy: true, latency }
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    info: Record<string, any>
    memory: { used: number; peak: number }
  }> {
    try {
      const [info, memory] = await Promise.all([
        this.redis.info(),
        this.redis.memory('usage')
      ])

      return {
        info: typeof info === 'string' ? { raw: info } : info,
        memory: {
          used: Array.isArray(memory) ? memory[1] || 0 : 0,
          peak: Array.isArray(memory) ? memory[3] || 0 : 0
        }
      }
    } catch (error) {
      logger.error('Failed to get Redis stats', { error })
      return {
        info: {},
        memory: { used: 0, peak: 0 }
      }
    }
  }
}

// Export singleton instance
export const upstashCache = new UpstashCacheService()

// Export types
export type { Redis }

