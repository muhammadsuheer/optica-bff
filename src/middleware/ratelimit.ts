/**
 * Rate Limiting Middleware
 * 
 * Token bucket rate limiting using Upstash Redis with
 * configurable limits per route and user type.
 */

import type { Context, Next } from 'hono'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { env } from '../config/env'
import { rateLimitError } from '../lib/errors'
import { logger } from '../observability/logger'

// =======================
// Redis Client
// =======================

let redis: Redis | null = null

function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN
    })
  }
  return redis
}

// =======================
// Rate Limit Configurations
// =======================

interface RateLimitConfig {
  requests: number
  window: string // e.g., '1m', '1h', '1d'
  identifier?: (c: Context) => string
  skipIf?: (c: Context) => boolean
  message?: string
}

const defaultConfigs: Record<string, RateLimitConfig> = {
  // Global rate limit
  global: {
    requests: env.RATE_LIMIT_QPS * env.RATE_LIMIT_WINDOW,
    window: `${env.RATE_LIMIT_WINDOW}s`,
    message: 'Too many requests from this IP'
  },
  
  // Authentication endpoints
  auth: {
    requests: 5,
    window: '1m',
    message: 'Too many authentication attempts'
  },
  
  // Search endpoints
  search: {
    requests: 30,
    window: '1m',
    message: 'Search rate limit exceeded'
  },
  
  // Cart/order mutations
  mutations: {
    requests: 20,
    window: '1m',
    message: 'Too many mutations, please slow down'
  },
  
  // Admin endpoints
  admin: {
    requests: 100,
    window: '1h',
    identifier: (c) => `admin:${c.get('userId') || 'anonymous'}`,
    message: 'Admin rate limit exceeded'
  },
  
  // Webhook endpoints
  webhooks: {
    requests: 1000,
    window: '1h',
    identifier: (c) => `webhook:${c.req.header('x-forwarded-for') || 'unknown'}`,
    message: 'Webhook rate limit exceeded'
  }
}

// =======================
// Rate Limiter Instances
// =======================

const rateLimiters = new Map<string, Ratelimit>()

function getRateLimiter(config: RateLimitConfig): Ratelimit {
  const key = `${config.requests}:${config.window}`
  
  if (!rateLimiters.has(key)) {
    const limiter = new Ratelimit({
      redis: getRedisClient(),
      limiter: Ratelimit.tokenBucket(config.requests, config.window, config.requests),
      analytics: true,
      prefix: 'rl'
    })
    
    rateLimiters.set(key, limiter)
  }
  
  return rateLimiters.get(key)!
}

// =======================
// Identifier Functions
// =======================

/**
 * Get rate limit identifier for a request
 */
function getIdentifier(c: Context, config: RateLimitConfig): string {
  if (config.identifier) {
    return config.identifier(c)
  }
  
  // Default: use IP address
  const ip = c.req.header('x-forwarded-for') || 
            c.req.header('x-real-ip') || 
            c.req.header('cf-connecting-ip') ||
            'unknown'
  
  return ip.split(',')[0].trim()
}

/**
 * Check if rate limiting should be skipped
 */
function shouldSkip(c: Context, config: RateLimitConfig): boolean {
  if (config.skipIf) {
    return config.skipIf(c)
  }
  
  // Skip for health checks and monitoring
  const path = c.req.path
  if (path === '/health' || path.startsWith('/metrics')) {
    return true
  }
  
  return false
}

// =======================
// Middleware Functions
// =======================

/**
 * Generic rate limiting middleware
 */
export function rateLimit(configName: string = 'global') {
  return async (c: Context, next: Next) => {
    const config = defaultConfigs[configName]
    if (!config) {
      logger.warn('Unknown rate limit config', { configName })
      return next()
    }
    
    // Check if we should skip rate limiting
    if (shouldSkip(c, config)) {
      return next()
    }
    
    const identifier = getIdentifier(c, config)
    const rateLimiter = getRateLimiter(config)
    
    try {
      const result = await rateLimiter.limit(identifier)
      
      // Add rate limit headers
      c.header('X-RateLimit-Limit', config.requests.toString())
      c.header('X-RateLimit-Remaining', result.remaining.toString())
      c.header('X-RateLimit-Reset', result.reset.toString())
      
      if (!result.success) {
        logger.warn('Rate limit exceeded', {
          identifier,
          config: configName,
          limit: config.requests,
          window: config.window,
          traceId: c.get('traceId')
        })
        
        // Add retry-after header
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)
        c.header('Retry-After', retryAfter.toString())
        
        throw rateLimitError(config.message, {
          identifier,
          limit: config.requests,
          window: config.window,
          retryAfter
        })
      }
      
      // Log successful rate limit check (debug only)
      if (env.LOG_LEVEL === 'debug') {
        logger.debug('Rate limit check passed', {
          identifier,
          config: configName,
          remaining: result.remaining,
          reset: result.reset
        })
      }
      
    } catch (error) {
      // If rate limiting fails, log but don't block the request
      if (error.message?.includes('rate limit')) {
        throw error
      }
      
      logger.error('Rate limiting error', {
        error: error instanceof Error ? error.message : String(error),
        identifier,
        config: configName
      })
    }
    
    await next()
  }
}

/**
 * Global rate limiting middleware (applied to all routes)
 */
export function rateLimitMiddleware() {
  return rateLimit('global')
}

/**
 * Authentication rate limiting
 */
export function authRateLimit() {
  return rateLimit('auth')
}

/**
 * Search rate limiting
 */
export function searchRateLimit() {
  return rateLimit('search')
}

/**
 * Mutation rate limiting
 */
export function mutationRateLimit() {
  return rateLimit('mutations')
}

/**
 * Admin rate limiting
 */
export function adminRateLimit() {
  return rateLimit('admin')
}

/**
 * Webhook rate limiting
 */
export function webhookRateLimit() {
  return rateLimit('webhooks')
}

// =======================
// Custom Rate Limiting
// =======================

/**
 * Create custom rate limiter
 */
export function customRateLimit(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    if (shouldSkip(c, config)) {
      return next()
    }
    
    const identifier = getIdentifier(c, config)
    const rateLimiter = getRateLimiter(config)
    
    try {
      const result = await rateLimiter.limit(identifier)
      
      c.header('X-RateLimit-Limit', config.requests.toString())
      c.header('X-RateLimit-Remaining', result.remaining.toString())
      c.header('X-RateLimit-Reset', result.reset.toString())
      
      if (!result.success) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)
        c.header('Retry-After', retryAfter.toString())
        
        throw rateLimitError(config.message || 'Rate limit exceeded', {
          identifier,
          limit: config.requests,
          window: config.window,
          retryAfter
        })
      }
    } catch (error) {
      if (error.message?.includes('rate limit')) {
        throw error
      }
      
      logger.error('Custom rate limiting error', { error, identifier })
    }
    
    await next()
  }
}

// =======================
// Health Check
// =======================

/**
 * Check rate limiting health
 */
export async function rateLimitHealthCheck(): Promise<{
  healthy: boolean
  error?: string
  stats?: any
}> {
  try {
    const redis = getRedisClient()
    
    // Test basic Redis connectivity
    const testKey = 'health:ratelimit'
    await redis.set(testKey, 'test')
    const result = await redis.get(testKey)
    await redis.del(testKey)
    
    if (result !== 'test') {
      return { healthy: false, error: 'Redis connectivity test failed' }
    }
    
    return { healthy: true }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// =======================
// Exports
// =======================

export {
  rateLimit,
  rateLimitMiddleware,
  authRateLimit,
  searchRateLimit,
  mutationRateLimit,
  adminRateLimit,
  webhookRateLimit,
  customRateLimit,
  type RateLimitConfig
}
