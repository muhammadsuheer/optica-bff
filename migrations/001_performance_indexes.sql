-- Performance indexes for Optia BFF
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
ON rate_limits(client_id, endpoint, created_at DESC);

-- Rollback commands (if needed)
-- DROP INDEX CONCURRENTLY IF EXISTS idx_products_wc_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_products_status;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_products_featured;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_products_created_at;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_products_search;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_orders_customer_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_orders_status;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_orders_date_created;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_carts_session_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_carts_user_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_carts_expires_at;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_cache_index_expires_at;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_cache_index_tags;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_webhooks_log_processed;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_webhooks_log_topic;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_rate_limits_client_endpoint;