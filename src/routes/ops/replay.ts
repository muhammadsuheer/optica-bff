/**
 * Operations Replay Routes
 * 
 * Provides admin endpoints for replaying failed jobs from DLQ.
 */

import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import { logger } from '../../observability/logger'
import { errorJson } from '../../lib/errors'
import databaseService, { supabaseClient } from '../../services/databaseService'
import { apiKey } from '../../middleware/apiKey'

const replay = new Hono()

// =======================
// Middleware
// =======================

// Require admin API key
replay.use('*', apiKey({ allowedKeyTypes: ['admin'] }))

// =======================
// Request Schemas
// =======================

const replaySchema = z.object({
  id: z.coerce.number().int().positive()
})

// =======================
// Routes
// =======================

/**
 * POST /ops/replay/:id - Replay failed job from DLQ
 */
replay.post('/:id', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    // Parse and validate ID
    const id = parseInt(c.req.param('id'))
    if (isNaN(id)) {
      return errorJson(c, 'INVALID_ID', 'Invalid DLQ record ID', 400, {
        traceId,
        id: c.req.param('id')
      })
    }
    
    // Replay the DLQ record
    const result = await databaseService.dlq.getById(id)
    
    if (!result.success) {
      return errorJson(c, 'REPLAY_FAILED', result.error || 'Failed to replay job', 500, {
        traceId,
        id
      })
    }
    
    const latencyMs = Date.now() - startTime
    
    logger.info('DLQ record replayed', {
      traceId,
      id,
      topic: result.record?.topic,
      retryCount: result.record?.retry_count,
      latencyMs
    })
    
    return c.json({
      message: 'Job replayed successfully',
      record: result.record
    })
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    logger.error('DLQ replay error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      id: c.req.param('id'),
      latencyMs})
    
    return errorJson(c, 'REPLAY_ERROR', 'Internal server error', 500, {
      traceId
    })
  }
})

/**
 * GET /ops/replay/stats - Get DLQ statistics
 */
replay.get('/stats', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    const stats = await databaseService.getDLQStats()
    
    const latencyMs = Date.now() - startTime
    
    logger.info('DLQ stats retrieved', {
      traceId,
      total: (stats as any)?.total || 0,
      latencyMs
    })
    
    return c.json({
      stats,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    logger.error('DLQ stats error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      latencyMs})
    
    return errorJson(c, 'DLQ_STATS_ERROR', 'Failed to get DLQ statistics', 500, {
      traceId
    })
  }
})

/**
 * GET /ops/replay/topic/:topic - Get DLQ records by topic
 */
replay.get('/topic/:topic', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    const topic = c.req.param('topic')
    const limit = parseInt(c.req.query('limit') || '100')
    
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return errorJson(c, 'INVALID_LIMIT', 'Invalid limit parameter', 400, {
        traceId,
        limit: c.req.query('limit')
      })
    }
    
    const records = await databaseService.getDLQByTopic(topic, limit)
    
    const latencyMs = Date.now() - startTime
    
    logger.info('DLQ records by topic retrieved', {
      traceId,
      topic,
      count: records.length,
      latencyMs
    })
    
    return c.json({
      topic,
      records,
      count: records.length
    })
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    logger.error('DLQ records by topic error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      topic: c.req.param('topic'),
      latencyMs})
    
    return errorJson(c, 'DLQ_RECORDS_ERROR', 'Failed to get DLQ records', 500, {
      traceId
    })
  }
})

/**
 * POST /ops/replay/cleanup - Clean up old DLQ records
 */
replay.post('/cleanup', async (c) => {
  const startTime = Date.now()
  const traceId = ((c as any).get('traceId') as string) || 'unknown'
  
  try {
    const body = await c.req.json()
    const daysOld = body.daysOld || 30
    
    if (typeof daysOld !== 'number' || daysOld < 1 || daysOld > 365) {
      return errorJson(c, 'INVALID_DAYS', 'Invalid days parameter', 400, {
        traceId,
        daysOld
      })
    }
    
    const deletedCount = await databaseService.dlq.delete(parseInt(daysOld.toString()))
    
    const latencyMs = Date.now() - startTime
    
    logger.info('DLQ cleanup completed', {
      traceId,
      deletedCount,
      daysOld,
      latencyMs
    })
    
    return c.json({
      message: 'DLQ cleanup completed',
      deletedCount,
      daysOld
    })
    
  } catch (error) {
    const latencyMs = Date.now() - startTime
    
    logger.error('DLQ cleanup error', error instanceof Error ? error : new Error('Unknown error'), {traceId,
      latencyMs})
    
    return errorJson(c, 'DLQ_CLEANUP_ERROR', 'Failed to cleanup DLQ records', 500, {
      traceId
    })
  }
})

export default replay
