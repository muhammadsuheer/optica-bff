-- Initial database setup for Optica BFF
-- This script runs automatically when PostgreSQL container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create optimized indexes for WordPress tables (will be created by Prisma migrations)
-- These are additional performance indexes beyond what Prisma creates

-- Optimize wp_posts queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_type_status_date 
ON wp_posts(post_type, post_status, post_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_name_type 
ON wp_posts(post_name, post_type) WHERE post_status = 'publish';

-- Optimize wp_postmeta queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_postmeta_key_value 
ON wp_postmeta(meta_key, meta_value(50));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_postmeta_post_key 
ON wp_postmeta(post_id, meta_key);

-- Optimize wp_terms and taxonomy queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_terms_slug_name 
ON wp_terms(slug, name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_term_taxonomy_parent 
ON wp_term_taxonomy(taxonomy, parent, term_id);

-- Optimize wp_term_relationships
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_term_relationships_object 
ON wp_term_relationships(object_id, term_taxonomy_id);

-- WooCommerce specific optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wc_product_meta_sku 
ON wp_wc_product_meta_lookup(sku) WHERE sku IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wc_product_meta_stock 
ON wp_wc_product_meta_lookup(stock_quantity, stock_status);

-- Full-text search indexes for products
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_fulltext 
ON wp_posts USING gin(to_tsvector('english', post_title || ' ' || post_content)) 
WHERE post_type = 'product' AND post_status = 'publish';

-- User and session optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_login_email 
ON wp_users(user_login, user_email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usermeta_user_key 
ON wp_usermeta(user_id, meta_key);

-- BFF specific tables (these will be created by your application)
-- Materialized view refresh function
CREATE OR REPLACE FUNCTION refresh_product_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- This function will be called by triggers to refresh materialized views
    -- Implementation depends on your specific caching strategy
    NOTIFY product_cache_refresh;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Performance monitoring
CREATE TABLE IF NOT EXISTS query_performance_log (
    id SERIAL PRIMARY KEY,
    query_type VARCHAR(50),
    execution_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create a function to log slow queries
CREATE OR REPLACE FUNCTION log_slow_query(query_type TEXT, exec_time INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO query_performance_log (query_type, execution_time_ms)
    VALUES (query_type, exec_time);
END;
$$ LANGUAGE plpgsql;

-- Set optimal PostgreSQL parameters for this workload
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.7;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Enable query performance tracking
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create a view for monitoring BFF performance
CREATE OR REPLACE VIEW bff_performance_summary AS
SELECT 
    query_type,
    COUNT(*) as query_count,
    AVG(execution_time_ms) as avg_time_ms,
    MAX(execution_time_ms) as max_time_ms,
    MIN(execution_time_ms) as min_time_ms
FROM query_performance_log 
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
GROUP BY query_type
ORDER BY avg_time_ms DESC;
