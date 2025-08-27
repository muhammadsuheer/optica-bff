-- Supabase PostgreSQL Extensions Setup
-- Run this in Supabase SQL Editor after creating your project

-- Enable UUID extension for better primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable trigram extension for full-text search on products
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enable query performance monitoring
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Enable PostGIS for location-based features (optional)
-- CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create indexes for better performance
-- Product search index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_trgm 
ON cached_products USING gin (name gin_trgm_ops);

-- Category search index  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_name_trgm 
ON cached_categories USING gin (name gin_trgm_ops);

-- Performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cached_products_status_expires 
ON cached_products (status, expires_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_events_processed_created 
ON webhook_events (processed, created_at);

-- Comments for documentation
COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation functions';
COMMENT ON EXTENSION "pg_trgm" IS 'Trigram matching for full-text search';
COMMENT ON EXTENSION "pg_stat_statements" IS 'Query performance monitoring';
