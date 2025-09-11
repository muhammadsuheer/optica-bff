/**
 * QStash Client - Edge Runtime Compatible
 * 
 * Minimal QStash client for background job processing with deduplication support.
 */

import { logger } from '../observability/logger'
import { config } from '../config/env'

// =======================
// Types
// =======================

export interface QStashJob {
  id: string
  topic: string
  payload: any
  deduplicationId?: string
  delay?: number
  retries?: number
}

export interface QStashResponse {
  messageId: string
  success: boolean
  error?: string
}

// =======================
// QStash Client Class
// =======================

class QStashClient {
  private apiUrl: string
  private token: string
  
  constructor() {
    this.apiUrl = config.qstash?.apiUrl || 'https://qstash.upstash.io'
    this.token = config.qstash?.token || 'default-token'
  }
  
  /**
   * Enqueue a job to QStash
   */
  async enqueue(job: QStashJob): Promise<QStashResponse> {
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
      
      // Add deduplication header if provided
      if (job.deduplicationId) {
        headers['Upstash-Deduplication-ID'] = job.deduplicationId
      }
      
      // Add delay header if provided
      if (job.delay) {
        headers['Upstash-Delay'] = `${job.delay}s`
      }
      
      // Add retries header if provided
      if (job.retries) {
        headers['Upstash-Retries'] = job.retries.toString()
      }
      
      const response = await fetch(`${this.apiUrl}/publish/${job.topic}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(job.payload)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`QStash API error: ${response.status} ${errorText}`)
      }
      
      const result = await response.json()
      
      logger.info('QStash job enqueued', {
        messageId: result.messageId,
        topic: job.topic,
        deduplicationId: job.deduplicationId
      })
      
      return {
        messageId: result.messageId,
        success: true
      }
      
    } catch (error) {
      logger.error('QStash job enqueue failed', error instanceof Error ? error : new Error('Unknown error'), {topic: job.topic})
      
      return {
        messageId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Enqueue webhook job with deduplication
   */
  async enqueueWebhook(
    source: string,
    event: string,
    payload: any,
    deliveryId?: string
  ): Promise<QStashResponse> {
    const deduplicationId = deliveryId ? `${source}:${event}:${deliveryId}` : undefined
    
    return this.enqueue({
      id: crypto.randomUUID(),
      topic: `webhook.${source}.${event}`,
      payload: {
        source,
        event,
        payload,
        deliveryId,
        timestamp: Date.now()
      },
      deduplicationId,
      retries: 3
    })
  }
  
  /**
   * Enqueue reconciliation job
   */
  async enqueueReconciliation(
    resourceType: string,
    lastSyncAt: string,
    lastProcessedId?: number
  ): Promise<QStashResponse> {
    return this.enqueue({
      id: crypto.randomUUID(),
      topic: 'reconciliation.sync',
      payload: {
        resourceType,
        lastSyncAt,
        lastProcessedId,
        timestamp: Date.now()
      },
      retries: 5
    })
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      })
      
      const latency = Date.now() - startTime
      
      return {
        healthy: response.ok,
        latency
      }
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Export singleton instance
export const qstashClient = new QStashClient()

// Export class for testing
// Exports handled above
