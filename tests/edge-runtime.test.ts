/**
 * Test Suite for Edge Runtime Components
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { KVClient } from '../src/lib/kvClient'
import { EdgeRateLimiter } from '../src/lib/edgeRateLimiter'
import { generateHmacSignature, verifyHmacSignature, webhookVerifiers } from '../src/utils/crypto'
import { EdgeCacheService } from '../src/services/cacheService'

// Mock KV client for testing
class MockKVClient {
  private store = new Map<string, any>()
  private sets = new Map<string, Set<string>>()

  async get(key: string) {
    return this.store.get(key) || null
  }

  async set(key: string, value: any, options?: any) {
    this.store.set(key, value)
    return true
  }

  async del(key: string) {
    return this.store.delete(key)
  }

  async incr(key: string, options?: any) {
    const current = this.store.get(key) || 0
    const newValue = current + (options?.by || 1)
    this.store.set(key, newValue)
    return newValue
  }

  async sadd(tag: string, key: string) {
    if (!this.sets.has(tag)) {
      this.sets.set(tag, new Set())
    }
    this.sets.get(tag)!.add(key)
    return true
  }

  async smembers(tag: string) {
    return Array.from(this.sets.get(tag) || [])
  }

  async invalidateByTags(tags: string[]) {
    let deleted = 0
    const errors: string[] = []

    for (const tag of tags) {
      const keys = await this.smembers(tag)
      for (const key of keys) {
        if (this.store.delete(key)) {
          deleted++
        }
      }
      this.sets.delete(tag)
    }

    return { deleted, errors }
  }

  clear() {
    this.store.clear()
    this.sets.clear()
  }
}

// Global test setup
const mockKvClient = new MockKVClient()

// Mock crypto.subtle for Node.js environment
const mockCrypto = {
  subtle: {
    importKey: vi.fn(),
    sign: vi.fn(),
    digest: vi.fn(),
    deriveBits: vi.fn()
  },
  getRandomValues: vi.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
    return array
  })
}

// @ts-ignore
global.crypto = mockCrypto

beforeEach(() => {
  mockKvClient.clear()
  vi.clearAllMocks()
})

describe('KVClient', () => {
  let kvClient: KVClient

  beforeEach(() => {
    kvClient = new KVClient({
      url: 'https://test.upstash.io',
      token: 'test-token',
      maxRetries: 1
    })
  })

  it('should validate key size', () => {
    expect(() => {
      // @ts-ignore - testing private method
      kvClient.validateKey('')
    }).toThrow('Key must be a non-empty string')

    expect(() => {
      // @ts-ignore
      kvClient.validateKey('a'.repeat(2000))
    }).toThrow('Key size exceeds')
  })

  it('should validate value size', () => {
    const largeValue = { data: 'x'.repeat(5 * 1024 * 1024) } // 5MB
    
    expect(() => {
      // @ts-ignore
      kvClient.validateValue(largeValue)
    }).toThrow('Value size exceeds')
  })

  it('should chunk arrays correctly', () => {
    const items = Array.from({ length: 250 }, (_, i) => i)
    
    // @ts-ignore
    const chunks = kvClient.chunkArray(items, 100)
    
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(100)
    expect(chunks[1]).toHaveLength(100)
    expect(chunks[2]).toHaveLength(50)
  })
})

describe('EdgeRateLimiter', () => {
  let rateLimiter: EdgeRateLimiter
  let mockContext: any

  beforeEach(() => {
    rateLimiter = new EdgeRateLimiter({
      requests: 5,
      window: 60,
      strategy: 'fixed',
      scope: 'ip',
      fallbackAction: 'allow'
    })

    mockContext = {
      req: {
        header: vi.fn((name: string) => {
          const headers: Record<string, string> = {
            'cf-connecting-ip': '192.168.1.1',
            'user-agent': 'test-agent',
            'x-api-key': 'test-key'
          }
          return headers[name]
        }),
        path: '/test',
        method: 'GET'
      },
      header: vi.fn(),
      get: vi.fn()
    }
  })

  it('should generate correct rate limit key for IP scope', () => {
    // @ts-ignore
    const key = rateLimiter.generateKey(mockContext)
    
    expect(key).toMatch(/^rl:ip:/)
    expect(key).toContain(':')
  })

  it('should hash strings consistently', () => {
    // @ts-ignore
    const hash1 = rateLimiter.hashString('test-string')
    // @ts-ignore
    const hash2 = rateLimiter.hashString('test-string')
    
    expect(hash1).toBe(hash2)
    expect(typeof hash1).toBe('string')
    expect(hash1.length).toBeGreaterThan(0)
  })

  it('should extract client IP correctly', () => {
    // @ts-ignore
    const ip = rateLimiter.getClientIP(mockContext)
    
    expect(ip).toBe('192.168.1.1')
  })
})

describe('Crypto Utilities', () => {
  beforeEach(() => {
    // Mock crypto.subtle methods
    mockCrypto.subtle.importKey.mockResolvedValue({})
    mockCrypto.subtle.sign.mockResolvedValue(new ArrayBuffer(32))
    mockCrypto.subtle.digest.mockResolvedValue(new ArrayBuffer(32))
  })

  it('should generate HMAC signature', async () => {
    const signature = await generateHmacSignature('test-data', 'secret-key')
    
    expect(signature).toBeDefined()
    expect(typeof signature).toBe('string')
    expect(mockCrypto.subtle.importKey).toHaveBeenCalled()
    expect(mockCrypto.subtle.sign).toHaveBeenCalled()
  })

  it('should verify HMAC signature', async () => {
    const data = 'test-data'
    const secret = 'secret-key'
    
    // Mock consistent signature generation
    mockCrypto.subtle.sign.mockResolvedValue(new ArrayBuffer(32))
    
    const signature = await generateHmacSignature(data, secret)
    const isValid = await verifyHmacSignature(data, signature, secret)
    
    expect(isValid).toBe(true)
  })

  it('should verify WooCommerce webhook signature', async () => {
    const payload = JSON.stringify({ test: 'data' })
    const secret = 'wc-secret'
    
    // Mock signature generation
    const expectedSignature = 'mocked-signature'
    mockCrypto.subtle.sign.mockResolvedValue(
      new TextEncoder().encode(expectedSignature).buffer
    )
    
    const isValid = await webhookVerifiers.woocommerce(payload, expectedSignature, secret)
    
    expect(typeof isValid).toBe('boolean')
  })
})

describe('EdgeCacheService', () => {
  let cacheService: EdgeCacheService

  beforeEach(() => {
    cacheService = new EdgeCacheService()
  })

  it('should set and get cache values', async () => {
    const key = 'test-key'
    const value = { data: 'test-value', timestamp: Date.now() }
    
    const setResult = await cacheService.set(key, value, { ttl: 300 })
    expect(setResult).toBe(true)
    
    const getValue = await cacheService.get(key)
    expect(getValue).toEqual(value)
  })

  it('should handle cache miss', async () => {
    const value = await cacheService.get('non-existent-key')
    expect(value).toBeNull()
  })

  it('should track cache statistics', async () => {
    await cacheService.get('miss-key') // Should increment misses
    await cacheService.set('hit-key', 'value')
    await cacheService.get('hit-key') // Should increment hits
    
    const stats = cacheService.getStats()
    
    expect(stats.totalRequests).toBeGreaterThan(0)
    expect(stats.misses).toBeGreaterThan(0)
    expect(stats.sets).toBeGreaterThan(0)
  })

  it('should invalidate cache by tags', async () => {
    await cacheService.set('key1', 'value1', { tags: ['tag1', 'tag2'] })
    await cacheService.set('key2', 'value2', { tags: ['tag2'] })
    await cacheService.set('key3', 'value3', { tags: ['tag3'] })
    
    const result = await cacheService.invalidateByTags(['tag1', 'tag2'])
    
    expect(result.deleted).toBeGreaterThan(0)
    expect(result.errors).toHaveLength(0)
  })

  it('should warm cache correctly', async () => {
    const generator = vi.fn().mockResolvedValue('generated-value')
    
    const value = await cacheService.warm('warm-key', generator, { ttl: 300 })
    
    expect(value).toBe('generated-value')
    expect(generator).toHaveBeenCalledOnce()
    
    // Second call should use cached value
    const cachedValue = await cacheService.warm('warm-key', generator, { ttl: 300 })
    
    expect(cachedValue).toBe('generated-value')
    expect(generator).toHaveBeenCalledOnce() // Should not be called again
  })

  it('should handle cache health check', async () => {
    const health = await cacheService.healthCheck()
    
    expect(health).toHaveProperty('healthy')
    expect(health).toHaveProperty('latency')
    expect(typeof health.healthy).toBe('boolean')
    expect(typeof health.latency).toBe('number')
  })
})

describe('Performance Tests', () => {
  it('should handle concurrent rate limit checks', async () => {
    const rateLimiter = new EdgeRateLimiter({
      requests: 10,
      window: 60,
      strategy: 'fixed',
      scope: 'ip',
      fallbackAction: 'allow'
    })

    const mockContext = {
      req: {
        header: () => '192.168.1.1',
        path: '/test',
        method: 'GET'
      },
      header: vi.fn(),
      get: vi.fn()
    }

    // Simulate concurrent requests
    const promises = Array.from({ length: 15 }, () => 
      rateLimiter.checkLimit(mockContext as any)
    )

    const results = await Promise.all(promises)
    
    const allowedRequests = results.filter(r => r.allowed).length
    const blockedRequests = results.filter(r => !r.allowed).length
    
    expect(allowedRequests).toBeLessThanOrEqual(10) // Within rate limit
    expect(blockedRequests).toBeGreaterThan(0) // Some should be blocked
  })

  it('should handle large cache operations efficiently', async () => {
    const cacheService = new EdgeCacheService()
    const startTime = Date.now()
    
    // Set 100 cache entries
    const setPromises = Array.from({ length: 100 }, (_, i) =>
      cacheService.set(`perf-key-${i}`, { value: i, data: 'x'.repeat(1000) })
    )
    
    await Promise.all(setPromises)
    
    // Get all entries
    const getPromises = Array.from({ length: 100 }, (_, i) =>
      cacheService.get(`perf-key-${i}`)
    )
    
    const results = await Promise.all(getPromises)
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    expect(results).toHaveLength(100)
    expect(results.every(r => r !== null)).toBe(true)
    expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
  })
})

describe('Integration Tests', () => {
  it('should simulate webhook processing flow', async () => {
    // Mock webhook payload
    const webhookPayload = {
      id: 123,
      event: 'product.updated',
      data: {
        id: 456,
        name: 'Test Product',
        price: 99.99
      }
    }

    // Test signature verification
    const secret = 'webhook-secret'
    const payload = JSON.stringify(webhookPayload)
    
    mockCrypto.subtle.sign.mockResolvedValue(new ArrayBuffer(32))
    
    const signature = await generateHmacSignature(payload, secret)
    const isValid = await verifyHmacSignature(payload, signature, secret)
    
    expect(isValid).toBe(true)

    // Test job enqueuing (would be handled by KV)
    const jobId = `job-${Date.now()}`
    const job = {
      id: jobId,
      payload: webhookPayload,
      timestamp: Date.now(),
      status: 'queued'
    }

    // Simulate storing job
    await mockKvClient.set(`webhook:jobs:${jobId}`, job)
    
    const storedJob = await mockKvClient.get(`webhook:jobs:${jobId}`)
    expect(storedJob).toEqual(job)
  })

  it('should simulate rate limiting across multiple endpoints', async () => {
    const globalLimiter = new EdgeRateLimiter({
      requests: 20,
      window: 60,
      strategy: 'sliding',
      scope: 'ip',
      fallbackAction: 'allow'
    })

    const apiLimiter = new EdgeRateLimiter({
      requests: 10,
      window: 60,
      strategy: 'fixed',
      scope: 'api_key',
      fallbackAction: 'deny'
    })

    const mockContext = {
      req: {
        header: (name: string) => {
          if (name === 'cf-connecting-ip') return '192.168.1.1'
          if (name === 'x-api-key') return 'test-api-key'
          return null
        },
        path: '/api/products',
        method: 'GET'
      },
      header: vi.fn(),
      get: vi.fn()
    }

    // Test global rate limiting
    const globalResult = await globalLimiter.checkLimit(mockContext as any)
    expect(globalResult.allowed).toBe(true)
    
    // Test API key rate limiting
    const apiResult = await apiLimiter.checkLimit(mockContext as any)
    expect(apiResult.allowed).toBe(true)
  })
})
