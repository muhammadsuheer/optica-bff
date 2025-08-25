import type { MiddlewareHandler } from 'hono';
import { CacheService } from '../services/cacheService.js';
import { envConfig } from '../config/env.js';
import type { ApiResponse } from '../types/index.js';
import { createHash } from 'crypto';
import { Counter } from 'prom-client';
import { logger } from '../utils/logger.js';

/**
 * Performance-optimized global rate limiter configuration
 * Pre-computed values and optimized data structures for sub-millisecond performance
 */
export const GLOBAL_RATE_LIMITS = {
  // General API endpoints
  general: {
    requests: envConfig.performance.RATE_LIMIT_MAX_REQUESTS ?? 100,
    window: envConfig.performance.RATE_LIMIT_WINDOW_MS ?? 60000,
    identifier: 'ip' as const,
  },
  
  // Authentication endpoints (more restrictive)
  auth: {
    requests: 5,
    window: 60000, // 1 minute
    identifier: 'ip' as const,
  },
  
  // Cart operations (moderate restrictions)
  cart: {
    requests: 30,
    window: 60000, // 1 minute
    identifier: 'user' as const,
  },
  
  // Product browsing (less restrictive)
  products: {
    requests: 200,
    window: 60000, // 1 minute
    identifier: 'ip' as const,
  },
  
  // Health checks (very permissive)
  health: {
    requests: 1000,
    window: 60000, // 1 minute
    identifier: 'ip' as const,
  },
  
  // Search operations (moderate restrictions due to DB load)
  search: {
    requests: 50,
    window: 60000, // 1 minute
    identifier: 'ip' as const,
  },
} as const;

export type RateLimitCategory = keyof typeof GLOBAL_RATE_LIMITS;

// Pre-allocated response objects to avoid object creation overhead
const RATE_LIMIT_RESPONSE_TEMPLATE: ApiResponse<null> = {
  success: false,
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: '',
  },
};

// Cache for IP identifiers to reduce string operations
const identifierCache = new Map<string, string>();
const IDENTIFIER_CACHE_MAX = 10000;

/**
 * High-performance global rate limiter with sub-millisecond optimizations
 * Uses Redis pipeline operations and aggressive caching for maximum throughput
 */
export class GlobalRateLimiter {
  private readonly prefix = 'rl:'; // Shorter prefix for better Redis memory usage
  private readonly headerCache = new Map<RateLimitCategory, Record<string, string>>();

  constructor(private cacheService: CacheService) {
    // Pre-compute static headers for each category
    this.precomputeHeaders();
  }

  /**
   * Pre-compute static headers to avoid string operations at runtime
   */
  private precomputeHeaders() {
    for (const [category, config] of Object.entries(GLOBAL_RATE_LIMITS)) {
      this.headerCache.set(category as RateLimitCategory, {
        'X-RateLimit-Limit': config.requests.toString(),
        'X-RateLimit-Window': config.window.toString(),
        'X-RateLimit-Category': category,
      });
    }
  }

  /**
   * Create ultra-fast rate limiting middleware for a specific category
   * Optimized for sub-millisecond performance with aggressive caching
   */
  middleware(category: RateLimitCategory): MiddlewareHandler {
    const config = GLOBAL_RATE_LIMITS[category];
    const headers = this.headerCache.get(category)!;
    const limitStr = headers['X-RateLimit-Limit'];
    const windowStr = headers['X-RateLimit-Window'];
    
    // Pre-allocated response for this category
    const rateLimitResponse: ApiResponse<null> = {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Limit: ${config.requests} per ${config.window / 1000}s`,
      },
    };

    return async (c, next) => {
      try {
        // Fast identifier extraction with caching
        const identifier = this.getIdentifierFast(c, config.identifier);
        const key = `${this.prefix}${category}:${identifier}`;

        // Single Redis operation for check and increment
        const [current, newCount] = await this.checkAndIncrement(key, config.window, config.requests);
        
        // Set static headers (pre-computed)
        c.header('X-RateLimit-Limit', limitStr);
        c.header('X-RateLimit-Window', windowStr);
        c.header('X-RateLimit-Category', category);

        if (current >= config.requests) {
          // Rate limit exceeded - use pre-allocated response
          c.header('X-RateLimit-Remaining', '0');
          c.header('X-RateLimit-Reset', new Date(Date.now() + config.window).toISOString());
          rateLimitRejects.inc({ category });
          logger.warn('rate_limit_exceeded', { category, identifier, limit: config.requests });
          return c.json(rateLimitResponse, 429);
        }

        // Set remaining header (fast calculation)
        c.header('X-RateLimit-Remaining', (config.requests - newCount).toString());
        
        await next();
      } catch (error) {
        // Fail open - allow request on error for maximum availability
        rateLimitErrors.inc({ category });
        logger.error('rate_limiter_error', error as Error, { category });
        await next();
      }
    };
  }

  /**
   * Ultra-fast check and increment in single Redis operation
   * Uses Lua script for atomic operations and better performance
   */
  private async checkAndIncrement(key: string, windowMs: number, limit: number): Promise<[number, number]> {
    try {
      const redis = (this.cacheService as any).redis;
      
      // Lua script for atomic check and increment
      const luaScript = `
        local key = KEYS[1]
        local window = tonumber(ARGV[1])
        local limit = tonumber(ARGV[2])
        
        local current = redis.call('GET', key)
        if current == false then
          current = 0
        else
          current = tonumber(current)
        end
        
        if current >= limit then
          return {current, current}
        end
        
        local new_count = redis.call('INCR', key)
        if new_count == 1 then
          redis.call('PEXPIRE', key, window)
        end
        
        return {current, new_count}
      `;
      
      const result = await redis.eval(luaScript, 1, key, windowMs, limit);
      return result as [number, number];
    } catch (error) {
      // Fallback to separate operations
      const current = await this.cacheService.get<number>(key) || 0;
      if (current >= limit) {
        return [current, current];
      }
      
      const newCount = await this.incrementWithExpiry(key, windowMs);
      return [current, newCount];
    }
  }

  /**
   * High-performance identifier extraction with aggressive caching
   */
  private getIdentifierFast(c: any, type: 'ip' | 'user'): string {
    if (type === 'user') {
      // Fast JWT token hashing for user identification
      const authHeader = c.req.header('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        
        // Check cache first
        let identifier = identifierCache.get(token);
        if (identifier) {
          return identifier;
        }
        
        // Create hash and cache it
        identifier = createHash('sha256').update(token).digest('hex').slice(0, 16);
        
        // Manage cache size
        if (identifierCache.size >= IDENTIFIER_CACHE_MAX) {
          // Clear half the cache when full (simple LRU approximation)
          const entries = Array.from(identifierCache.entries());
          identifierCache.clear();
          for (let i = entries.length / 2; i < entries.length; i++) {
            identifierCache.set(entries[i][0], entries[i][1]);
          }
        }
        
        identifierCache.set(token, identifier);
        return identifier;
      }
    }
    
    // Fast IP extraction with header priority optimization
    return c.req.header('x-forwarded-for') || 
           c.req.header('x-real-ip') || 
           c.req.header('cf-connecting-ip') || 
           'unknown';
  }

  /**
   * Optimized custom rate limiting check with reduced allocations
   */
  async checkCustomLimit(
    identifier: string,
    requests: number,
    windowMs: number,
    category: string = 'custom'
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    try {
      const key = `${this.prefix}${category}:${identifier}`;
      const [current, newCount] = await this.checkAndIncrement(key, windowMs, requests);
      
      if (current >= requests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + windowMs),
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, requests - newCount),
        resetAt: new Date(Date.now() + windowMs),
      };
    } catch (error) {
      // Fail open on error
      return {
        allowed: true,
        remaining: requests,
        resetAt: new Date(Date.now() + windowMs),
      };
    }
  }

  /**
   * Optimized atomic increment with expiry using Redis pipeline
   */
  private async incrementWithExpiry(key: string, windowMs: number): Promise<number> {
    try {
      const redis = (this.cacheService as any).redis;
      const pipeline = redis.pipeline();
      
      pipeline.incr(key);
      pipeline.pexpire(key, windowMs);
      
      const results = await pipeline.exec();
      return results[0][1] as number;
    } catch (error) {
      // Fallback to cache service
      const current = await this.cacheService.get<number>(key) || 0;
      const newValue = current + 1;
      await this.cacheService.set(key, newValue, Math.ceil(windowMs / 1000));
      return newValue;
    }
  }

  /**
   * Fast rate limit status check with minimal allocations
   */
  async getStatus(category: RateLimitCategory, identifier: string): Promise<{
    current: number;
    limit: number;
    remaining: number;
    window: number;
  }> {
    try {
      const config = GLOBAL_RATE_LIMITS[category];
      const key = `${this.prefix}${category}:${identifier}`;
      const current = await this.cacheService.get<number>(key) || 0;

      return {
        current,
        limit: config.requests,
        remaining: Math.max(0, config.requests - current),
        window: config.window,
      };
    } catch (error) {
      const config = GLOBAL_RATE_LIMITS[category];
      return {
        current: 0,
        limit: config.requests,
        remaining: config.requests,
        window: config.window,
      };
    }
  }

  /**
   * Optimized limit clearing
   */
  async clearLimit(category: RateLimitCategory, identifier: string): Promise<void> {
    try {
      const key = `${this.prefix}${category}:${identifier}`;
      await this.cacheService.delete(key);
    } catch (error) {
      // Silent fail for admin operations
    }
  }
}

/**
 * Factory function to create rate limiter instance
 */
export function createGlobalRateLimiter(cacheService: CacheService): GlobalRateLimiter {
  return new GlobalRateLimiter(cacheService);
}

/**
 * Convenience middleware factories for common use cases
 */
export const rateLimitMiddleware = {
  general: (cacheService: CacheService) => createGlobalRateLimiter(cacheService).middleware('general'),
  auth: (cacheService: CacheService) => createGlobalRateLimiter(cacheService).middleware('auth'),
  cart: (cacheService: CacheService) => createGlobalRateLimiter(cacheService).middleware('cart'),
  products: (cacheService: CacheService) => createGlobalRateLimiter(cacheService).middleware('products'),
  health: (cacheService: CacheService) => createGlobalRateLimiter(cacheService).middleware('health'),
  search: (cacheService: CacheService) => createGlobalRateLimiter(cacheService).middleware('search'),
};

// Prometheus metrics for rate limiter
export const rateLimitRejects = new Counter({
  name: 'rate_limiter_rejections_total',
  help: 'Total rate limiter rejections by category',
  labelNames: ['category'] as const,
});
export const rateLimitErrors = new Counter({
  name: 'rate_limiter_errors_total',
  help: 'Rate limiter internal errors by category',
  labelNames: ['category'] as const,
});
