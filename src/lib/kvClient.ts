/**
 * Vercel KV (Upstash Redis) Client for Edge Runtime
 * 
 * Features:
 * - JSON serialization with 4MB limit enforcement
 * - Exponential backoff for transient errors
 * - Tag-based invalidation system
 * - Bulk operations for performance
 * - TypeScript type safety
 */

import { logger } from '../observability/logger'
import { env } from '../config/env'

// KV Client Configuration
interface KVConfig {
  url: string
  token: string
  readOnlyToken?: string
  maxRetries: number
  baseDelay: number
  maxDelay: number
  timeout: number
}

// KV Operation Options
interface KVSetOptions {
  ttl?: number  // seconds
  nx?: boolean  // only set if not exists
  xx?: boolean  // only set if exists
}

interface KVIncrOptions {
  ttl?: number
  by?: number
}

// Response types
interface KVResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

interface BulkSetItem {
  key: string
  value: any
  ttl?: number
}

// Size limits for Edge Runtime
const MAX_VALUE_SIZE = 4 * 1024 * 1024 // 4MB
const MAX_KEY_SIZE = 1024 // 1KB
const MAX_BULK_SIZE = 100 // operations per bulk request

class KVClient {
  private config: KVConfig
  private baseUrl: string

  constructor(customConfig: Partial<KVConfig> = {}) {
    this.config = {
      url: (globalThis as any).KV_REST_API_URL || 'https://example.upstash.io',
      token: (globalThis as any).KV_REST_API_TOKEN || 'token',
      readOnlyToken: (globalThis as any).KV_REST_API_READ_ONLY_TOKEN,
      maxRetries: 3,
      baseDelay: 100, // ms
      maxDelay: 2000, // ms
      timeout: 5000,  // ms
      ...customConfig
    }

    if (!this.config.url || !this.config.token) {
      throw new Error('KV_REST_API_URL and KV_REST_API_TOKEN are required')
    }

    this.baseUrl = this.config.url.replace(/\/$/, '')
  }

  /**
   * Get a value by key
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      this.validateKey(key)
      
      const response = await this.request('GET', `/get/${encodeURIComponent(key)}`, null, true)
      
      if (!response.success) {
        if (response.error?.includes('not found')) {
          return null
        }
        throw new Error(response.error)
      }

      return response.data as T
    } catch (error) {
      logger.error('KV get error', error instanceof Error ? error : new Error('Unknown error'), {key})
      return null
    }
  }

  /**
   * Set a value with optional TTL
   */
  async set<T = any>(key: string, value: T, options: KVSetOptions = {}): Promise<boolean> {
    try {
      this.validateKey(key)
      this.validateValue(value)

      const serialized = JSON.stringify(value)
      const body: any = { value: serialized }

      if (options.ttl) {
        body.ex = options.ttl // TTL in seconds
      }
      if (options.nx) {
        body.nx = true
      }
      if (options.xx) {
        body.xx = true
      }

      const response = await this.request('POST', '/set', body)
      return response.success
    } catch (error) {
      logger.error('KV set error', error instanceof Error ? error : new Error('Unknown error'), {key})
      return false
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<boolean> {
    try {
      this.validateKey(key)
      
      const response = await this.request('POST', '/del', { keys: [key] })
      return response.success && response.data > 0
    } catch (error) {
      logger.error('KV del error', error instanceof Error ? error : new Error('Unknown error'), {key})
      return false
    }
  }

  /**
   * Atomic increment
   */
  async incr(key: string, options: KVIncrOptions = {}): Promise<number | null> {
    try {
      this.validateKey(key)
      
      const body: any = { key }
      if (options.by !== undefined) {
        body.by = options.by
      }

      const response = await this.request('POST', '/incr', body)
      
      // Set TTL if specified and this is a new key
      if (response.success && options.ttl && response.data === (options.by || 1)) {
        await this.expire(key, options.ttl)
      }

      return response.success ? response.data : null
    } catch (error) {
      logger.error('KV incr error', error instanceof Error ? error : new Error('Unknown error'), {key})
      return null
    }
  }

  /**
   * Atomic decrement
   */
  async decr(key: string, options: KVIncrOptions = {}): Promise<number | null> {
    return this.incr(key, { ...options, by: -(options.by || 1) })
  }

  /**
   * Set expiration time
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      this.validateKey(key)
      
      const response = await this.request('POST', '/expire', { key, seconds: ttl })
      return response.success && response.data === 1
    } catch (error) {
      logger.error('KV expire error', error instanceof Error ? error : new Error('Unknown error'), {key, ttl})
      return false
    }
  }

  /**
   * Get time-to-live for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      this.validateKey(key)
      
      const response = await this.request('POST', '/ttl', { key })
      return response.success ? (response.data || -1) : -1
    } catch (error) {
      logger.error('KV ttl error', error instanceof Error ? error : new Error('Unknown error'), {key})
      return -1
    }
  }

  /**
   * Add key to a tag set (for tag-based invalidation)
   */
  async sadd(tag: string, key: string): Promise<boolean> {
    try {
      const tagKey = `tag:${tag}`
      const response = await this.request('POST', '/sadd', { key: tagKey, members: [key] })
      return response.success
    } catch (error) {
      logger.error('KV sadd error', error instanceof Error ? error : new Error('Unknown error'), {tag, key})
      return false
    }
  }

  /**
   * Get all keys in a tag set
   */
  async smembers(tag: string): Promise<string[]> {
    try {
      const tagKey = `tag:${tag}`
      const response = await this.request('GET', `/smembers/${encodeURIComponent(tagKey)}`, null, true)
      return response.success ? (response.data || []) : []
    } catch (error) {
      logger.error('KV smembers error', error instanceof Error ? error : new Error('Unknown error'), {tag})
      return []
    }
  }

  /**
   * Tag-based cache invalidation
   */
  async invalidateByTags(tags: string[]): Promise<{ deleted: number; errors: string[] }> {
    const result = { deleted: 0, errors: [] as string[] }

    for (const tag of tags) {
      try {
        // Get all keys for this tag
        const keys = await this.smembers(tag)
        
        if (keys.length > 0) {
          // Delete all keys
          const deleted = await this.bulkDel(keys)
          result.deleted += deleted
          
          // Clean up the tag set
          await this.del(`tag:${tag}`)
        }
      } catch (error) {
        result.errors.push(`Tag ${tag}: ${error}`)
        logger.error('Tag invalidation error', error instanceof Error ? error : new Error('Unknown error'), {tag})
      }
    }

    return result
  }

  /**
   * Bulk get operations
   */
  async bulkGet<T = any>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>()
    
    if (keys.length === 0) return result

    // Split into chunks to respect API limits
    const chunks = this.chunkArray(keys, MAX_BULK_SIZE)
    
    for (const chunk of chunks) {
      try {
        const pipeline = chunk.map(key => ['GET', key])
        const response = await this.request('POST', '/pipeline', pipeline)
        
        if (response.success && Array.isArray(response.data)) {
          chunk.forEach((key, index) => {
            const value = response.data[index]
            if (value !== null && value !== undefined) {
              result.set(key, value)
            }
          })
        }
      } catch (error) {
        logger.error('Bulk get error', error instanceof Error ? error : new Error('Unknown error'), {chunk})
      }
    }

    return result
  }

  /**
   * Bulk set operations
   */
  async bulkSet(items: BulkSetItem[]): Promise<number> {
    let successCount = 0
    
    if (items.length === 0) return successCount

    // Split into chunks to respect API limits
    const chunks = this.chunkArray(items, MAX_BULK_SIZE)
    
    for (const chunk of chunks) {
      try {
        const pipeline = chunk.map(item => {
          this.validateKey(item.key)
          this.validateValue(item.value)
          
          const cmd = ['SET', item.key, JSON.stringify(item.value)]
          if (item.ttl) {
            cmd.push('EX', item.ttl.toString())
          }
          return cmd
        })
        
        const response = await this.request('POST', '/pipeline', pipeline)
        
        if (response.success && Array.isArray(response.data)) {
          successCount += response.data.filter(r => r === 'OK').length
        }
      } catch (error) {
        logger.error('Bulk set error', error instanceof Error ? error : new Error('Unknown error'), {chunk: chunk.length})
      }
    }

    return successCount
  }

  /**
   * Bulk delete operations
   */
  async bulkDel(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0

    try {
      const response = await this.request('POST', '/del', { keys })
      return response.success ? (response.data || 0) : 0
    } catch (error) {
      logger.error('Bulk delete error', error instanceof Error ? error : new Error('Unknown error'), {keys: keys.length})
      return 0
    }
  }

  /**
   * Execute Lua script for atomic operations
   */
  async eval(script: string, keys: string[] = [], args: string[] = []): Promise<any> {
    try {
      const response = await this.request('POST', '/eval', {
        script,
        keys,
        args
      })
      return response.success ? response.data : null
    } catch (error) {
      logger.error('Lua script error', error instanceof Error ? error : new Error('Unknown error'), {script})
      return null
    }
  }

  /**
   * Health check - alias for ping
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now()
    try {
      await this.ping()
      return { healthy: true, latency: Date.now() - start }
    } catch {
      return { healthy: false, latency: Date.now() - start }
    }
  }

  /**
   * Health check
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.request('GET', '/ping', null, true)
      return response.success && response.data === 'PONG'
    } catch (error) {
      logger.error('KV ping error', error instanceof Error ? error : new Error('Unknown error'))
      return false
    }
  }

  /**
   * Get connection info
   */
  async info(): Promise<Record<string, any> | null> {
    try {
      const response = await this.request('GET', '/info', null, true)
      return response.success ? response.data : null
    } catch (error) {
      logger.error('KV info error', error instanceof Error ? error : new Error('Unknown error'))
      return null
    }
  }

  // Private helper methods

  private async request(
    method: string, 
    path: string, 
    body?: any, 
    useReadOnly = false
  ): Promise<KVResponse> {
    const token = useReadOnly && this.config.readOnlyToken 
      ? this.config.readOnlyToken 
      : this.config.token

    const url = `${this.baseUrl}${path}`
    
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

        const response = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        return { success: true, data: data.result }

      } catch (error) {
        lastError = error as Error
        
        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          break
        }

        if (attempt < this.config.maxRetries) {
          const delay = Math.min(
            this.config.baseDelay * Math.pow(2, attempt),
            this.config.maxDelay
          )
          await this.sleep(delay)
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Unknown error'
    }
  }

  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Key must be a non-empty string')
    }
    if (key.length > MAX_KEY_SIZE) {
      throw new Error(`Key size exceeds ${MAX_KEY_SIZE} bytes`)
    }
  }

  private validateValue(value: any): void {
    if (value === undefined) {
      throw new Error('Value cannot be undefined')
    }
    
    const serialized = JSON.stringify(value)
    if (serialized.length > MAX_VALUE_SIZE) {
      throw new Error(`Value size exceeds ${MAX_VALUE_SIZE} bytes`)
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const kvClient = new KVClient()

// Export class for testing
// Exports handled above

// Export types
export type { KVConfig, KVSetOptions, KVIncrOptions, KVResponse, BulkSetItem }
