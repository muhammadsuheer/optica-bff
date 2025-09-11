/**
 * Migration Management Routes - Vercel Edge Compatible
 * 
 * Provides endpoints to check migration status and get migration SQL
 */

import { Hono } from 'hono'
import { checkMigrationStatus } from '../../services/migrationService'
import { logger } from '../../observability/logger'

const app = new Hono()

/**
 * GET /ops/migrations/status
 * Check migration status
 */
app.get('/status', async (c) => {
  try {
    const status = await checkMigrationStatus()
    
    return c.json({
      success: true,
      data: status
    })
  } catch (error) {
    logger.error('Failed to check migration status', error instanceof Error ? error : new Error('Unknown error'))
    return c.json({
      success: false,
      error: 'Failed to check migration status'
    }, 500)
  }
})

/**
 * GET /ops/migrations/sql/:migrationId
 * Get migration SQL content
 */
app.get('/sql/:migrationId', async (c) => {
  const migrationId = c.req.param('migrationId')
  
  const migrations = {
    '000': {
      id: '000',
      name: 'create_migrations_table',
      sql: `-- Create migrations tracking table
CREATE TABLE IF NOT EXISTS migrations (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exec_sql function for running migrations
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;`
    },
    '001': {
      id: '001',
      name: 'performance_indexes',
      sql: `-- Performance indexes for Optia BFF
-- Run with CONCURRENTLY to avoid blocking

-- Products table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_wc_id 
ON products(wc_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_status 
ON products(status) 
WHERE status IN ('publish', 'draft', 'private');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_featured 
ON products(featured) 
WHERE featured = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_created_at 
ON products(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search 
ON products USING GIN(search_vector) 
WHERE search_vector IS NOT NULL;

-- Orders table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_id 
ON orders(customer_id) 
WHERE customer_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status 
ON orders(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_date_created 
ON orders(date_created DESC);

-- Carts table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_carts_session_id 
ON carts(session_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_carts_user_id 
ON carts(user_id) 
WHERE user_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_carts_expires_at 
ON carts(expires_at) 
WHERE expires_at > NOW();

-- Cache index table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_index_expires_at 
ON cache_index(expires_at) 
WHERE expires_at > NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cache_index_tags 
ON cache_index USING GIN(tags);

-- Webhooks log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhooks_log_processed 
ON webhooks_log(processed, created_at) 
WHERE processed = false;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhooks_log_topic 
ON webhooks_log(topic, created_at DESC);

-- Rate limits indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limits_client_endpoint 
ON rate_limits(client_id, endpoint, created_at DESC);`
    }
  }

  const migration = migrations[migrationId as keyof typeof migrations]
  
  if (!migration) {
    return c.json({
      success: false,
      error: 'Migration not found'
    }, 404)
  }

  return c.json({
    success: true,
    data: migration
  })
})

export default app
