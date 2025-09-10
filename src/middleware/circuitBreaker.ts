/**
 * Circuit Breaker Pattern for Edge Runtime
 * Prevents cascade failures from external services
 */

import { logger } from '../utils/logger'

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeout: number
  monitoringPeriod: number
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failures = 0
  private lastFailureTime = 0
  private lastSuccessTime = 0
  
  constructor(
    private name: string,
    private config: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 10000  // 10 seconds
    }
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = 'HALF_OPEN'
        logger.info('Circuit breaker half-open', { name: this.name })
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`)
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    this.lastSuccessTime = Date.now()
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED'
      logger.info('Circuit breaker closed', { name: this.name })
    }
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN'
      logger.warn('Circuit breaker opened', { 
        name: this.name, 
        failures: this.failures 
      })
    }
  }

  getState(): CircuitState {
    return this.state
  }

  getMetrics() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime
    }
  }
}

// Predefined circuit breakers
export const circuitBreakers = {
  woocommerce: new CircuitBreaker('woocommerce', {
    failureThreshold: 5,
    recoveryTimeout: 30000,
    monitoringPeriod: 10000
  }),
  
  supabase: new CircuitBreaker('supabase', {
    failureThreshold: 3,
    recoveryTimeout: 60000,
    monitoringPeriod: 10000
  })
}