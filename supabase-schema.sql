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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_wc_id ON products(wc_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN(search_vector);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON products
  FOR SELECT USING (status = 'publish');

-- Allow service role full access
CREATE POLICY "Allow service role full access" ON products
  FOR ALL USING (auth.role() = 'service_role');
