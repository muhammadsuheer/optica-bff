-- Supabase Products Table Schema
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  wc_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  price DECIMAL(10,2),
  regular_price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  status TEXT DEFAULT 'publish',
  featured BOOLEAN DEFAULT false,
  stock_quantity INTEGER,
  stock_status TEXT DEFAULT 'instock',
  manage_stock BOOLEAN DEFAULT false,
  categories JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  images JSONB DEFAULT '[]',
  attributes JSONB DEFAULT '{}',
  variations JSONB DEFAULT '[]',
  meta_data JSONB DEFAULT '{}',
  search_vector TSVECTOR,
  date_modified_woo TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_wc_id ON products(wc_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts(session_id);
CREATE INDEX IF NOT EXISTS idx_carts_expires_at ON carts(expires_at);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_name ON analytics_metrics(name);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_timestamp ON analytics_metrics(timestamp);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON products
  FOR SELECT USING (status = 'publish');

-- Allow service role full access
CREATE POLICY "Allow service role full access" ON products
  FOR ALL USING (auth.role() = 'service_role');

-- =======================
-- Additional Tables
-- =======================

-- Product variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id BIGSERIAL PRIMARY KEY,
  wc_id INTEGER UNIQUE NOT NULL,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  price DECIMAL(10,2),
  regular_price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  stock_quantity INTEGER,
  stock_status TEXT DEFAULT 'instock',
  attributes JSONB DEFAULT '{}',
  images JSONB DEFAULT '[]',
  date_modified_woo TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);

-- Product images table
CREATE TABLE IF NOT EXISTS product_images (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  variant_id BIGINT REFERENCES product_variants(id) ON DELETE CASCADE,
  wc_id INTEGER,
  src TEXT NOT NULL,
  alt TEXT,
  name TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  wc_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  parent_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  count INTEGER DEFAULT 0,
  date_modified_woo TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ
);

-- Product categories pivot table
CREATE TABLE IF NOT EXISTS product_categories (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  category_id BIGINT REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, category_id)
);

-- Processed events table
CREATE TABLE IF NOT EXISTS processed_events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,
  topic TEXT NOT NULL,
  src_ts TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB,
  INDEX idx_processed_events_topic (topic),
  INDEX idx_processed_events_src_ts (src_ts)
);

-- Sync checkpoints table
CREATE TABLE IF NOT EXISTS sync_checkpoints (
  resource_type TEXT PRIMARY KEY,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_processed_id INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DLQ table
CREATE TABLE IF NOT EXISTS dlq (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT UNIQUE NOT NULL,
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  INDEX idx_dlq_topic (topic),
  INDEX idx_dlq_created_at (created_at)
);

-- Slug history table (optional)
CREATE TABLE IF NOT EXISTS slug_history (
  id BIGSERIAL PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  old_slug TEXT NOT NULL,
  new_slug TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_slug_history_entity (entity, entity_id)
);

-- =======================
-- Indexes
-- =======================

-- Product variants indexes
CREATE INDEX IF NOT EXISTS idx_product_variants_wc_id ON product_variants(wc_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_date_modified ON product_variants(date_modified_woo);

-- Product images indexes
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_variant_id ON product_images(variant_id);

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_wc_id ON categories(wc_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_date_modified ON categories(date_modified_woo);

-- Product categories indexes
CREATE INDEX IF NOT EXISTS idx_product_categories_product_id ON product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category_id ON product_categories(category_id);

-- =======================
-- RLS Policies
-- =======================

-- Enable RLS on all tables
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE dlq ENABLE ROW LEVEL SECURITY;
ALTER TABLE slug_history ENABLE ROW LEVEL SECURITY;

-- Public read access for published content
CREATE POLICY "Allow public read access" ON product_variants
  FOR SELECT USING (NOT is_deleted);

CREATE POLICY "Allow public read access" ON product_images
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access" ON categories
  FOR SELECT USING (NOT is_deleted);

CREATE POLICY "Allow public read access" ON product_categories
  FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Allow service role full access" ON product_variants
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON product_images
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON categories
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON product_categories
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON processed_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON sync_checkpoints
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON dlq
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON slug_history
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON carts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON analytics_metrics
  FOR ALL USING (auth.role() = 'service_role');

-- Additional tables and improvements

-- Carts table
CREATE TABLE IF NOT EXISTS carts (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  customer_id BIGINT,
  items JSONB DEFAULT '[]',
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_total NUMERIC(12,2) DEFAULT 0,
  shipping_total NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'ZAR',
  status TEXT DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics/Metrics table
CREATE TABLE IF NOT EXISTS analytics_metrics (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  value NUMERIC(12,4) NOT NULL,
  tags JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table (if not exists)
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  wc_id INTEGER UNIQUE NOT NULL,
  status TEXT NOT NULL,
  currency TEXT NOT NULL,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  customer_id BIGINT,
  billing_address JSONB,
  shipping_address JSONB,
  payment_method TEXT,
  payment_method_title TEXT,
  transaction_id TEXT,
  date_modified_woo TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ
);

-- Customers table (if not exists)
CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  wc_id INTEGER UNIQUE NOT NULL,
  email TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  date_modified_woo TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ
);

-- Search vector maintenance
CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('english',
      coalesce(NEW.name,'') || ' ' ||
      coalesce(NEW.description,'') || ' ' ||
      coalesce(NEW.short_description,'')
    );
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_search_vector ON products;
CREATE TRIGGER trg_products_search_vector
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_product_search_vector();

-- updated_at maintenance
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_products_updated_at') THEN
    CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_orders_updated_at') THEN
    CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_customers_updated_at') THEN
    CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- Additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_date_modified_woo ON products(date_modified_woo);
CREATE INDEX IF NOT EXISTS idx_orders_wc_id ON orders(wc_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_date_modified_woo ON orders(date_modified_woo);
CREATE INDEX IF NOT EXISTS idx_customers_wc_id ON customers(wc_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_date_modified_woo ON customers(date_modified_woo);

-- Add constraints
ALTER TABLE products ADD CONSTRAINT IF NOT EXISTS chk_price_nonneg CHECK (price >= 0);
ALTER TABLE products ADD CONSTRAINT IF NOT EXISTS chk_stock_nonneg CHECK (stock_quantity >= 0);
ALTER TABLE orders ADD CONSTRAINT IF NOT EXISTS chk_order_total_nonneg CHECK (total >= 0);

-- RLS policies for new tables
CREATE POLICY "Allow public read access" ON orders
  FOR SELECT USING (NOT is_deleted);

CREATE POLICY "Allow public read access" ON customers
  FOR SELECT USING (NOT is_deleted);

CREATE POLICY "Allow service role full access" ON orders
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON customers
  FOR ALL USING (auth.role() = 'service_role');