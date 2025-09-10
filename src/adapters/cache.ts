/**
 * Upstash Cache Adapter - Production-Ready KV Store
 * 
 * Features:
 * - Stampede protection (single-flight locks)
 * - Structured key naming
 * - TTL management
 * - Invalidation strategies
 * - Edge Runtime compatible
 */

import { Redis } from '@upstash/redis'
import { env } from '../config/env'
import { logger } from '../utils/logger'

// =======================
// Types
// =======================

interface CacheOptions {
  ttl?: number
  tags?: string[]
  namespace?: string
}

interface StampedeProtection {
  key: string
  promise: Promise<any>
  timestamp: number
}

// =======================
// Redis Client
// =======================

let redis: Redis | null = null

/**
 * Get Redis client (lazy initialization)
 */
function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
      retry: {
        retries: 3,
        backoff: (retryCount) => Math.exp(retryCount) * 50
      }
    })
    
    logger.debug('Upstash Redis client initialized')
  }
  
  return redis
}

// =======================
// Key Management
// =======================

/**
 * Generate structured cache key
 */
export function generateKey(
  domain: string,
  resource: string,
  identifier?: string,
  version = 'v1'
): string {
  const parts = [domain, version, resource]
  if (identifier) {
    parts.push(identifier)
  }
  return parts.join(':')
}

/**
 * Generate cache key hash for complex filters
 */
export function hashFilters(filters: Record<string, any>): string {
  const sorted = Object.keys(filters)
    .sort()
    .reduce((acc, key) => {
      acc[key] = filters[key]
      return acc
    }, {} as Record<string, any>)
  
  return btoa(JSON.stringify(sorted)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)
}

// =======================
// Stampede Protection
// =======================

const inflightRequests = new Map<string, StampedeProtection>()

/**
 * Single-flight cache loader with stampede protection
 */
async function withStampedeProtection<T>(
  key: string,
  loader: () => Promise<T>,
  ttl: number
): Promise<T> {
  // Check if request is already in flight
  const existing = inflightRequests.get(key)
  if (existing) {
    // If the existing request is recent, wait for it
    if (Date.now() - existing.timestamp < env.CACHE_STAMPEDE_TTL * 1000) {
      logger.debug('Using in-flight request', { key })
      return existing.promise
    } else {
      // Clean up stale request
      inflightRequests.delete(key)
    }
  }
  
  // Create new in-flight request
  const promise = loader()
  inflightRequests.set(key, {
    key,
    promise,
    timestamp: Date.now()
  })
  
  try {
    const result = await promise
    
    // Cache the result
    await set(key, result, ttl)
    
    return result
  } finally {
    // Clean up in-flight request
    inflightRequests.delete(key)
  }
}

// =======================
// Core Cache Operations
// =======================

/**
 * Get value from cache
 */
export async function get<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient()
    const value = await client.get(key)
    
    if (value === null) {
      logger.debug('Cache miss', { key })
      return null
    }
    
    logger.debug('Cache hit', { key })
    return value as T
  } catch (error) {
    logger.error('Cache get failed', { error, key })
    return null // Graceful degradation
  }
}

/**
 * Set value in cache
 */
export async function set<T>(
  key: string,
  value: T,
  ttl: number = env.CACHE_TTL_SECONDS
): Promise<void> {
  try {
    const client = getRedisClient()
    
    if (ttl > 0) {
      await client.setex(key, ttl, JSON.stringify(value))
    } else {
      await client.set(key, JSON.stringify(value))
    }
    
    logger.debug('Cache set', { key, ttl })
  } catch (error) {
    logger.error('Cache set failed', { error, key })
    // Don't throw - caching is not critical
  }
}

/**
 * Delete value from cache
 */
export async function del(key: string): Promise<void> {
  try {
    const client = getRedisClient()
    await client.del(key)
    
    logger.debug('Cache delete', { key })
  } catch (error) {
    logger.error('Cache delete failed', { error, key })
    // Don't throw - cache invalidation failures shouldn't break the app
  }
}

/**
 * Delete multiple keys by pattern
 */
export async function delPattern(pattern: string): Promise<number> {
  try {
    const client = getRedisClient()
    
    // Use SCAN to find keys matching pattern
    const keys: string[] = []
    let cursor = 0
    
    do {
      const result = await client.scan(cursor, { match: pattern, count: 100 })
      cursor = result[0]
      keys.push(...result[1])
    } while (cursor !== 0)
    
    if (keys.length > 0) {
      await client.del(...keys)
      logger.debug('Cache pattern delete', { pattern, count: keys.length })
    }
    
    return keys.length
  } catch (error) {
    logger.error('Cache pattern delete failed', { error, pattern })
    return 0
  }
}

// =======================
// High-Level Cache Helpers
// =======================

/**
 * Get or set cache value with loader function
 */
export async function withCache<T>(
  key: string,
  loader: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const {
    ttl = env.CACHE_TTL_SECONDS,
    namespace = ''
  } = options
  
  const fullKey = namespace ? `${namespace}:${key}` : key
  
  // Try to get from cache first
  const cached = await get<T>(fullKey)
  if (cached !== null) {
    return cached
  }
  
  // Use stampede protection if enabled
  if (env.ENABLE_CACHE_STAMPEDE_PROTECTION) {
    return withStampedeProtection(fullKey, loader, ttl)
  }
  
  // Fallback to simple cache-and-return
  const result = await loader()
  await set(fullKey, result, ttl)
  return result
}

/**
 * Memoize function with cache
 */
export function memoize<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  options: CacheOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    const key = keyGenerator(...args)
    return withCache(key, () => fn(...args), options)
  }) as T
}

// =======================
// Domain-Specific Cache Helpers
// =======================

/**
 * Product cache helpers
 */
export const productCache = {
  /**
   * Cache single product
   */
  async getProduct(id: string): Promise<any | null> {
    const key = generateKey('catalog', 'product', id)
    return get(key)
  },

  async setProduct(id: string, product: any, ttl = 3600): Promise<void> {
    const key = generateKey('catalog', 'product', id)
    await set(key, product, ttl)
  },

  /**
   * Cache product list with filters
   */
  async getProductList(filters: Record<string, any>): Promise<any | null> {
    const filtersHash = hashFilters(filters)
    const key = generateKey('catalog', 'products', filtersHash)
    return get(key)
  },

  async setProductList(filters: Record<string, any>, products: any, ttl = 300): Promise<void> {
    const filtersHash = hashFilters(filters)
    const key = generateKey('catalog', 'products', filtersHash)
    await set(key, products, ttl)
  },

  /**
   * Invalidate product caches
   */
  async invalidateProduct(id: string): Promise<void> {
    // Invalidate single product
    const productKey = generateKey('catalog', 'product', id)
    await del(productKey)
    
    // Invalidate all product lists (they might contain this product)
    const listPattern = generateKey('catalog', 'products', '*')
    await delPattern(listPattern)
  },

  async invalidateAll(): Promise<number> {
    const pattern = generateKey('catalog', '*')
    return delPattern(pattern)
  }
}

/**
 * Cart cache helpers
 */
export const cartCache = {
  async getCart(sessionId: string): Promise<any | null> {
    const key = generateKey('commerce', 'cart', sessionId)
    return get(key)
  },

  async setCart(sessionId: string, cart: any, ttl = 1800): Promise<void> {
    const key = generateKey('commerce', 'cart', sessionId)
    await set(key, cart, ttl)
  },

  async deleteCart(sessionId: string): Promise<void> {
    const key = generateKey('commerce', 'cart', sessionId)
    await del(key)
  }
}

// =======================
// Health Check
// =======================

/**
 * Check cache health
 */
export async function healthCheck(): Promise<{ 
  healthy: boolean
  latency?: number
  error?: string
  stats?: any
}> {
  try {
    const start = Date.now()
    const client = getRedisClient()
    
    // Test basic operations
    const testKey = 'health:check'
    const testValue = { timestamp: Date.now() }
    
    await client.set(testKey, JSON.stringify(testValue))
    const retrieved = await client.get(testKey)
    await client.del(testKey)
    
    const latency = Date.now() - start
    
    if (!retrieved) {
      return { healthy: false, error: 'Failed to retrieve test value' }
    }
    
    // Get basic stats if available
    let stats = {}
    try {
      stats = await client.info()
    } catch {
      // Stats not critical for health check
    }
    
    return { healthy: true, latency, stats }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// =======================
// Version Management
// =======================

/**
 * Get current list version for cache invalidation
 */
export async function getListVersion(namespace: string = 'catalog'): Promise<string> {
  const versionKey = `${namespace}:v1:version`
  const version = await get<string>(versionKey)
  return version || '1'
}

/**
 * Bump list version to invalidate all cached lists
 */
export async function bumpListVersion(namespace: string = 'catalog'): Promise<string> {
  const versionKey = `${namespace}:v1:version`
  const newVersion = Date.now().toString()
  await set(versionKey, newVersion, 86400) // 24 hours
  
  logger.info('Cache version bumped', {
    namespace,
    version: newVersion,
    key: versionKey
  })
  
  return newVersion
}

/**
 * Generate versioned cache key
 */
export function generateVersionedKey(
  domain: string,
  resource: string,
  identifier?: string,
  version?: string
): string {
  const parts = [domain, 'v1', resource]
  if (identifier) {
    parts.push(identifier)
  }
  if (version) {
    parts.push(`v${version}`)
  }
  return parts.join(':')
}

// =======================
// Exports
// =======================

export {
  get,
  set,
  del,
  delPattern,
  withCache,
  memoize,
  generateKey,
  hashFilters,
  getListVersion,
  bumpListVersion,
  generateVersionedKey,
  productCache,
  cartCache
}
