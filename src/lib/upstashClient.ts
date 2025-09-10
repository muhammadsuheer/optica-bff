/**
 * Official Upstash Redis Client for Edge Runtime
 * Replaces custom KV client for better performance and reliability
 */

import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { env } from '../config/env'
import { logger } from '../utils/logger'

// Initialize Redis client
export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})

// Rate limiters using official client
export const rateLimiters = {
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '1h'),
    analytics: true,
  }),
  
  user: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '5m'),
    analytics: true,
  }),
  
  ip: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, '15m'),
    analytics: true,
  }),
  
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '15m'),
    analytics: true,
  })
}

// Enhanced cache service using official client
export class UpstashCacheService {
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await redis.get<T>(key)
      if (result) {
        logger.debug('Cache hit (Upstash)', { key })
      }
      return result
    } catch (error) {
      logger.error('Cache get error', { key, error })
      return null
    }
  }

  async set<T>(key: string, value: T, ttl: number = 3600): Promise<boolean> {
    try {
      await redis.setex(key, ttl, JSON.stringify(value))
      logger.debug('Cache set (Upstash)', { key, ttl })
      return true
    } catch (error) {
      logger.error('Cache set error', { key, error })
      return false
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await redis.del(key)
      return result > 0
    } catch (error) {
      logger.error('Cache delete error', { key, error })
      return false
    }
  }

  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length === 0) return 0
      
      const result = await redis.del(...keys)
      logger.info('Cache pattern invalidation', { pattern, deleted: result })
      return result
    } catch (error) {
      logger.error('Cache invalidation error', { pattern, error })
      return 0
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = Date.now()
    
    try {
      await redis.ping()
      const latency = Date.now() - startTime
      return { healthy: true, latency }
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

export const upstashCache = new UpstashCacheService()
