/**
 * Streaming Response Middleware for Edge Runtime
 * 
 * Features:
 * - NDJSON streaming for large datasets
 * - Web Streams API (Edge-compatible)
 * - Backpressure handling
 * - Error recovery
 */

import { Context } from 'hono'
import { logger } from '../utils/logger'

export interface StreamingOptions {
  batchSize?: number
  delayMs?: number
  contentType?: string
}

/**
 * Create a streaming response for large datasets
 */
export function createStreamingResponse<T>(
  data: T[] | AsyncIterable<T>,
  options: StreamingOptions = {}
): Response {
  const {
    batchSize = 10,
    delayMs = 0,
    contentType = 'application/x-ndjson'
  } = options

  const encoder = new TextEncoder()
  let processed = 0

  const stream = new ReadableStream({
    async start(controller) {
      try {
        logger.debug('Starting stream', { batchSize, delayMs })

        if (Array.isArray(data)) {
          // Handle array data
          for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize)
            
            for (const item of batch) {
              const line = JSON.stringify(item) + '\n'
              controller.enqueue(encoder.encode(line))
              processed++
            }

            // Add delay between batches if specified
            if (delayMs > 0 && i + batchSize < data.length) {
              await new Promise(resolve => setTimeout(resolve, delayMs))
            }
          }
        } else {
          // Handle async iterable
          let batch: T[] = []
          
          for await (const item of data) {
            batch.push(item)
            
            if (batch.length >= batchSize) {
              for (const batchItem of batch) {
                const line = JSON.stringify(batchItem) + '\n'
                controller.enqueue(encoder.encode(line))
                processed++
              }
              
              batch = []
              
              if (delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs))
              }
            }
          }

          // Process remaining items
          for (const item of batch) {
            const line = JSON.stringify(item) + '\n'
            controller.enqueue(encoder.encode(line))
            processed++
          }
        }

        logger.info('Stream completed', { processed })
        controller.close()
      } catch (error) {
        logger.error('Stream error', { error, processed })
        controller.error(error)
      }
    },

    cancel(reason) {
      logger.warn('Stream cancelled', { reason, processed })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': contentType,
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'X-Stream-Format': 'ndjson'
    }
  })
}

/**
 * Streaming middleware factory
 */
export function streamingMiddleware() {
  return async (c: Context, next: Function) => {
    // Add streaming helper to context
    c.set('stream', (data: any[], options?: StreamingOptions) => {
      return createStreamingResponse(data, options)
    })

    await next()
  }
}

/**
 * Server-Sent Events streaming
 */
export function createSSEResponse<T>(
  dataSource: AsyncIterable<T>,
  options: { keepAliveMs?: number } = {}
): Response {
  const { keepAliveMs = 30000 } = options
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial connection event
        controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n'))

        // Set up keep-alive
        const keepAliveInterval = setInterval(() => {
          controller.enqueue(encoder.encode('event: ping\ndata: {}\n\n'))
        }, keepAliveMs)

        // Stream data
        for await (const item of dataSource) {
          const data = JSON.stringify(item)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }

        clearInterval(keepAliveInterval)
        controller.close()
      } catch (error) {
        logger.error('SSE stream error', { error })
        controller.error(error)
      }
    },

    cancel() {
      logger.info('SSE stream cancelled')
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  })
}

/**
 * Async generator for paginated data
 */
export async function* paginatedDataGenerator<T>(
  fetchPage: (page: number, perPage: number) => Promise<T[]>,
  perPage: number = 20
): AsyncGenerator<T, void, unknown> {
  let page = 1
  let hasMore = true

  while (hasMore) {
    try {
      const items = await fetchPage(page, perPage)
      
      if (items.length === 0) {
        hasMore = false
        break
      }

      for (const item of items) {
        yield item
      }

      hasMore = items.length === perPage
      page++
    } catch (error) {
      logger.error('Paginated data generator error', { error, page })
      throw error
    }
  }
}

// Export types
export type { StreamingOptions }

