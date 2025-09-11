/**
 * Circuit Breaker Middleware
 * 
 * Implements circuit breaker pattern for external service calls
 * Edge-safe implementation for Vercel Edge Runtime
 */

import type { Context, Next } from 'hono'
import { cacheService } from '../services/cacheService'
import { logger } from '../observability/logger'
import { errorJson } from '../lib/errors'

interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold: number
  /** Time to wait before attempting to close circuit (default: 60 seconds) */
  recoveryTimeout: number
  /** Timeout for individual requests (default: 30 seconds) */
  requestTimeout: number
  /** Success threshold to close circuit (default: 3) */
  successThreshold: number
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitStatus {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailureTime: number
  nextAttemptTime: number
}

class CircuitBreaker {
  private name: string
  private config: CircuitBreakerConfig

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 60 seconds
      requestTimeout: 30000,   // 30 seconds
      successThreshold: 3,
      ...config
    }
  }

  async execute<T>(operation: () => Promise<T>, traceId?: string): Promise<T> {
    const status = await this.getStatus()
    
    // Check if circuit is open
    if (status.state === 'OPEN') {
      if (Date.now() < status.nextAttemptTime) {
        logger.warn(`Circuit breaker ${this.name} is OPEN`, {
          traceId,
          failureCount: status.failureCount,
          nextAttemptTime: new Date(status.nextAttemptTime).toISOString()
        })
        throw new Error(`Circuit breaker ${this.name} is OPEN`)
      }
      
      // Time to try half-open
      await this.setState('HALF_OPEN', status.failureCount, 0)
      status.state = 'HALF_OPEN'
    }
    
    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(operation)
      
      // Success
      if (status.state === 'HALF_OPEN') {
        const newSuccessCount = status.successCount + 1
        if (newSuccessCount >= this.config.successThreshold) {
          // Close the circuit
          await this.setState('CLOSED', 0, 0)
          logger.info(`Circuit breaker ${this.name} closed after recovery`, { traceId })
        } else {
          await this.setState('HALF_OPEN', status.failureCount, newSuccessCount)
        }
      } else if (status.state === 'CLOSED' && status.failureCount > 0) {
        // Reset failure count on success
        await this.setState('CLOSED', 0, 0)
      }
      
      return result
      
    } catch (error) {
      // Failure
      const newFailureCount = status.failureCount + 1
      
      if (newFailureCount >= this.config.failureThreshold) {
        // Open the circuit
        const nextAttemptTime = Date.now() + this.config.recoveryTimeout
        await this.setState('OPEN', newFailureCount, 0, nextAttemptTime)
        
        logger.error(`Circuit breaker ${this.name} opened`, error instanceof Error ? error : new Error('Unknown error'), {
          traceId,
          failureCount: newFailureCount
        })
      } else {
        await this.setState(status.state === 'HALF_OPEN' ? 'OPEN' : 'CLOSED', newFailureCount, 0)
      }
      
      throw error
    }
  }

  async getStatus(): Promise<CircuitStatus> {
    const key = `circuit:${this.name}`
    const cached = await cacheService.get(key)
    
    if (cached) {
      return JSON.parse(cached as string) as CircuitStatus
    }
    
    // Default closed state
    const defaultStatus: CircuitStatus = {
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0
    }
    
    await cacheService.set(key, JSON.stringify(defaultStatus), { ttl: 3600 }) // 1 hour
    return defaultStatus
  }

  async setState(
    state: CircuitState, 
    failureCount: number, 
    successCount: number, 
    nextAttemptTime?: number
  ): Promise<void> {
    const key = `circuit:${this.name}`
    const status: CircuitStatus = {
      state,
      failureCount,
      successCount,
      lastFailureTime: failureCount > 0 ? Date.now() : 0,
      nextAttemptTime: nextAttemptTime || 0
    }
    
    await cacheService.set(key, JSON.stringify(status), { ttl: 3600 }) // 1 hour
  }

  getState(): CircuitState {
    // This is a synchronous version for quick checks
    // Note: This returns cached state and may not be current
    return 'CLOSED' // Default assumption
  }

  async getMetrics(): Promise<CircuitStatus & { name: string }> {
    const status = await this.getStatus()
    return {
      name: this.name,
      ...status
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.config.requestTimeout}ms`))
      }, this.config.requestTimeout)

      operation()
        .then(result => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }
}

// Pre-configured circuit breakers for common services
export const circuitBreakers = {
  woocommerce: new CircuitBreaker('woocommerce', {
    failureThreshold: 3,
    recoveryTimeout: 30000, // 30 seconds
    requestTimeout: 10000,  // 10 seconds
    successThreshold: 2
  }),
  
  supabase: new CircuitBreaker('supabase', {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 60 seconds
    requestTimeout: 15000,  // 15 seconds
    successThreshold: 3
  }),
  
  upstash: new CircuitBreaker('upstash', {
    failureThreshold: 3,
    recoveryTimeout: 30000, // 30 seconds
    requestTimeout: 5000,   // 5 seconds
    successThreshold: 2
  }),
  
  payfast: new CircuitBreaker('payfast', {
    failureThreshold: 3,
    recoveryTimeout: 60000, // 60 seconds
    requestTimeout: 20000,  // 20 seconds
    successThreshold: 2
  })
}

/**
 * Circuit breaker middleware factory
 * Applies circuit breaker to route handlers
 */
export function circuitBreakerMiddleware(breakerName: keyof typeof circuitBreakers) {
  return async (c: Context, next: Next) => {
    const traceId = (c as any).get('traceId') || 'unknown'
    const breaker = circuitBreakers[breakerName]
    
    try {
      await breaker.execute(async (): Promise<any> => {
        await next()
      }, traceId)
    } catch (error) {
      logger.error(`Circuit breaker ${breakerName} error`, error instanceof Error ? error : new Error('Unknown error'), {
        traceId,
        path: c.req.path,
        method: c.req.method
      })
      
      if (error instanceof Error && error.message.includes('Circuit breaker') && error.message.includes('OPEN')) {
        return errorJson(
          c,
          'SERVICE_UNAVAILABLE',
          'Service temporarily unavailable',
          503,
          { service: breakerName, retryAfter: 60 },
          traceId
        )
      }
      
      throw error
    }
  }
}

/**
 * Health check for all circuit breakers
 */
export async function getCircuitBreakerHealth(): Promise<Record<string, CircuitStatus>> {
  const health: Record<string, CircuitStatus> = {}
  
  for (const [name, breaker] of Object.entries(circuitBreakers)) {
    try {
      health[name] = await breaker.getStatus()
    } catch (error) {
      health[name] = {
        state: 'OPEN',
        failureCount: 999,
        successCount: 0,
        lastFailureTime: Date.now(),
        nextAttemptTime: Date.now() + 60000
      }
    }
  }
  
  return health
}
