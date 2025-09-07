# Optia BFF - Production-Grade WooCommerce Backend for Frontend

A high-performance, production-ready Backend for Frontend (BFF) built with Hono.js and Supabase that connects WordPress WooCommerce with modern frontend applications. This BFF provides optimized caching, real-time synchronization, and secure API access for Next.js and React Native applications while maintaining WooCommerce as the source of truth for e-commerce operations.

## Table of Contents

- [Project Summary](#project-summary)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Environment Setup](#environment-setup)
- [Database Schema](#database-schema)
- [API Routes](#api-routes)
- [Caching Strategy](#caching-strategy)
- [Webhook Handling](#webhook-handling)
- [Real-time Updates](#real-time-updates)
- [Optimistic UI Support](#optimistic-ui-support)
- [Authentication & Security](#authentication--security)
- [WooCommerce API Key Management](#woocommerce-api-key-management)
- [Rate Limiting](#rate-limiting)
- [Deployment](#deployment)
- [Testing](#testing)
- [Monitoring](#monitoring)
- [Scaling Strategies](#scaling-strategies)
- [Fallback Plans](#fallback-plans)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Project Summary

The Optia BFF serves as an intelligent caching and optimization layer between WooCommerce and frontend applications. It leverages Hono.js for edge-first performance, Supabase for real-time data synchronization and caching, and maintains WooCommerce as the authoritative source for products, orders, and payments. The system provides sub-100ms response times through aggressive caching while ensuring data consistency via webhooks and background synchronization.

**Key Features:**
- ⚡ Sub-100ms API responses via multi-layer caching
- 🔄 Real-time data synchronization with WebSocket support
- 🛡️ Enterprise-grade security with API key management
- 📱 Optimistic UI support for mobile and web apps
- 🚀 Edge-first deployment on Vercel/Netlify/Supabase
- 🔧 Automatic cache invalidation via WooCommerce webhooks
- 📊 Built-in monitoring and observability
- 🎯 100% TypeScript with full type safety

## Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Frontend      │    │   CDN/Edge   │    │   Hono.js BFF   │
│  (Next.js/RN)   │◄──►│   Cache      │◄──►│   (Vercel)      │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                                          │
         │                                          ▼
         │              ┌──────────────┐    ┌─────────────────┐
         └──────────────►│   Realtime   │    │   Supabase      │
                        │   WebSocket  │◄──►│   (Cache DB)    │
                        └──────────────┘    └─────────────────┘
                                                    │
                                                    ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│  WordPress      │    │   Webhooks   │    │   Background    │
│  WooCommerce    │◄──►│   Queue      │◄──►│   Sync Jobs     │
│  (Source)       │    │              │    │                 │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

**Data Flow:**
1. **Frontend Request** → CDN/Edge Cache → Hono.js BFF → Supabase Cache → Response
2. **WooCommerce Update** → Webhook → BFF → Supabase Update → Cache Invalidation → Realtime Broadcast
3. **Optimistic Update** → Frontend → BFF → Background WooCommerce Sync → Confirmation/Rollback

## Project Structure

```
optia-bff/
├── src/
│   ├── routes/
│   │   ├── products.ts          # Product CRUD operations
│   │   ├── orders.ts            # Order management
│   │   ├── cart.ts              # Cart operations with optimistic updates
│   │   ├── webhooks.ts          # WooCommerce webhook handlers
│   │   ├── auth.ts              # Authentication endpoints
│   │   ├── realtime.ts          # WebSocket/SSE endpoints
│   │   └── admin.ts             # Admin operations
│   ├── middleware/
│   │   ├── auth.ts              # API key authentication
│   │   ├── cors.ts              # CORS configuration
│   │   ├── cache.ts             # Caching middleware
│   │   ├── rateLimit.ts         # Rate limiting
│   │   └── validation.ts        # Input validation
│   ├── services/
│   │   ├── woocommerce.ts       # WooCommerce API client
│   │   ├── supabase.ts          # Supabase client
│   │   ├── cache.ts             # Multi-layer cache service
│   │   ├── realtime.ts          # Real-time broadcast service
│   │   ├── sync.ts              # Background sync jobs
│   │   └── queue.ts             # Job queue management
│   ├── types/
│   │   ├── product.ts           # Product type definitions
│   │   ├── order.ts             # Order type definitions
│   │   ├── cart.ts              # Cart type definitions
│   │   └── api.ts               # API response types
│   ├── utils/
│   │   ├── validation.ts        # Zod schemas
│   │   ├── pagination.ts        # Cursor pagination
│   │   ├── crypto.ts            # Encryption utilities
│   │   └── errors.ts            # Error handling
│   └── index.ts                 # Main application entry
├── supabase/
│   ├── migrations/              # Database migrations
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_indexes.sql
│   │   └── 003_realtime_setup.sql
│   ├── functions/               # Edge functions
│   │   └── sync-products/
│   └── config.toml              # Supabase configuration
├── tests/
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   ├── e2e/                     # End-to-end tests
│   └── load/                    # Load testing scripts
├── .github/workflows/           # CI/CD pipelines
│   ├── deploy.yml
│   ├── test.yml
│   └── security.yml
├── docs/                        # Additional documentation
├── scripts/                     # Deployment and utility scripts
├── vercel.json                  # Vercel configuration
├── netlify.toml                 # Netlify configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Environment Setup

### Prerequisites

- Node.js 18+ or Bun
- PostgreSQL (via Supabase)
- WordPress with WooCommerce installed
- Vercel/Netlify account (for deployment)

### Environment Variables

Create a `.env` file in the project root:

```bash
# WooCommerce API Configuration
WC_API_URL=https://yourstore.com/wp-json/wc/v3
WC_CONSUMER_KEY_READ=ck_readonly_key_here
WC_CONSUMER_SECRET_READ=cs_readonly_secret_here
WC_CONSUMER_KEY_WRITE=ck_readwrite_key_here
WC_CONSUMER_SECRET_WRITE=cs_readwrite_secret_here
WC_WEBHOOK_SECRET=your_webhook_secret_here

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here
SUPABASE_JWT_SECRET=your_jwt_secret_here

# BFF API Configuration
BFF_API_KEY_FRONTEND=your_frontend_api_key
BFF_API_KEY_ADMIN=your_admin_api_key
BFF_API_KEY_MOBILE=your_mobile_api_key

# Cache Configuration
CACHE_TTL_PRODUCTS=3600
CACHE_TTL_SEARCH=1800
CACHE_TTL_CATEGORIES=7200

# Rate Limiting
RATE_LIMIT_REQUESTS=1000
RATE_LIMIT_WINDOW=3600

# Monitoring
SENTRY_DSN=your_sentry_dsn
LOG_LEVEL=info

# Environment
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourfrontend.com
```

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/optia-bff.git
cd optia-bff

# Install dependencies
npm install
# or
bun install

# Start Supabase local development
npx supabase start

# Run database migrations
npx supabase db push

# Seed sample data (optional)
npm run seed:products -- --count 1000

# Start development server
npm run dev
# or
bun dev

# The BFF will be available at http://localhost:3000
```

### Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run start           # Start production server

# Database
npm run db:migrate      # Run migrations
npm run db:seed         # Seed sample data
npm run db:reset        # Reset database

# Testing
npm test                # Run unit tests
npm run test:integration # Run integration tests
npm run test:e2e        # Run end-to-end tests
npm run test:load       # Run load tests

# Code Quality
npm run lint            # ESLint
npm run type-check      # TypeScript check
npm run format          # Prettier formatting
```

## Database Schema

### Products Table

```sql
CREATE TABLE products (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  wc_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  price DECIMAL(10,2),
  regular_price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'publish',
  stock_quantity INTEGER,
  stock_status VARCHAR(20) DEFAULT 'instock',
  manage_stock BOOLEAN DEFAULT false,
  categories JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  images JSONB DEFAULT '[]',
  attributes JSONB DEFAULT '[]',
  variations JSONB DEFAULT '[]',
  meta_data JSONB DEFAULT '{}',
  search_vector tsvector,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_products_wc_id ON products(wc_id);
CREATE INDEX idx_products_status ON products(status) WHERE status = 'publish';
CREATE INDEX idx_products_stock_status ON products(stock_status);
CREATE INDEX idx_products_categories ON products USING GIN(categories);
CREATE INDEX idx_products_search ON products USING GIN(search_vector);
CREATE INDEX idx_products_updated_at ON products(updated_at);
CREATE INDEX idx_products_price ON products(price) WHERE price > 0;

-- Full-text search trigger
CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.name, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.short_description, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_search_vector_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_product_search_vector();
```

### Product Variants Table

```sql
CREATE TABLE product_variants (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  wc_id INTEGER UNIQUE NOT NULL,
  parent_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  parent_wc_id INTEGER NOT NULL,
  sku VARCHAR(100),
  price DECIMAL(10,2),
  regular_price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  stock_quantity INTEGER DEFAULT 0,
  stock_status VARCHAR(20) DEFAULT 'instock',
  manage_stock BOOLEAN DEFAULT false,
  attributes JSONB DEFAULT '{}',
  image JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_variants_parent_id ON product_variants(parent_id);
CREATE INDEX idx_variants_wc_id ON product_variants(wc_id);
CREATE INDEX idx_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_variants_stock_status ON product_variants(stock_status);
```

### Orders Table

```sql
CREATE TABLE orders (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  wc_id INTEGER UNIQUE NOT NULL,
  order_key VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  tax_total DECIMAL(10,2) DEFAULT 0,
  shipping_total DECIMAL(10,2) DEFAULT 0,
  customer_id INTEGER,
  customer_note TEXT,
  billing JSONB NOT NULL,
  shipping JSONB NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]',
  shipping_lines JSONB DEFAULT '[]',
  tax_lines JSONB DEFAULT '[]',
  fee_lines JSONB DEFAULT '[]',
  coupon_lines JSONB DEFAULT '[]',
  payment_method VARCHAR(100),
  payment_method_title VARCHAR(255),
  transaction_id VARCHAR(255),
  date_created TIMESTAMPTZ NOT NULL,
  date_modified TIMESTAMPTZ NOT NULL,
  date_completed TIMESTAMPTZ,
  date_paid TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_wc_id ON orders(wc_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_date_created ON orders(date_created);
CREATE INDEX idx_orders_date_modified ON orders(date_modified);
CREATE INDEX idx_orders_total ON orders(total);
```

### Cart Table (for optimistic updates)

```sql
CREATE TABLE carts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER,
  items JSONB NOT NULL DEFAULT '[]',
  totals JSONB NOT NULL DEFAULT '{}',
  coupons JSONB DEFAULT '[]',
  shipping JSONB DEFAULT '{}',
  billing JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_carts_session_id ON carts(session_id);
CREATE INDEX idx_carts_user_id ON carts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_carts_status ON carts(status);
CREATE INDEX idx_carts_expires_at ON carts(expires_at);
```

### Webhooks Log Table

```sql
CREATE TABLE webhooks_log (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  webhook_id VARCHAR(100),
  topic VARCHAR(100) NOT NULL,
  resource VARCHAR(50) NOT NULL,
  resource_id INTEGER NOT NULL,
  event VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  signature VARCHAR(255),
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_processed ON webhooks_log(processed);
CREATE INDEX idx_webhooks_topic ON webhooks_log(topic);
CREATE INDEX idx_webhooks_created_at ON webhooks_log(created_at);
CREATE INDEX idx_webhooks_resource ON webhooks_log(resource, resource_id);
```

### Cache Index Table

```sql
CREATE TABLE cache_index (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_ids INTEGER[] DEFAULT '{}',
  tags VARCHAR(100)[] DEFAULT '{}',
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  hit_count INTEGER DEFAULT 0
);

CREATE INDEX idx_cache_key ON cache_index(cache_key);
CREATE INDEX idx_cache_expires ON cache_index(expires_at);
CREATE INDEX idx_cache_tags ON cache_index USING GIN(tags);
CREATE INDEX idx_cache_resource_type ON cache_index(resource_type);
```

### API Keys Table

```sql
CREATE TABLE api_keys (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]',
  rate_limit INTEGER DEFAULT 1000,
  rate_window INTEGER DEFAULT 3600,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX idx_api_keys_expires ON api_keys(expires_at) WHERE expires_at IS NOT NULL;
```

### Realtime Subscriptions Table

```sql
CREATE TABLE realtime_subscriptions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  session_id VARCHAR(255) NOT NULL,
  user_id INTEGER,
  channel VARCHAR(100) NOT NULL,
  events VARCHAR(50)[] NOT NULL DEFAULT '{}',
  filters JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_ping TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_realtime_session ON realtime_subscriptions(session_id);
CREATE INDEX idx_realtime_channel ON realtime_subscriptions(channel);
CREATE INDEX idx_realtime_active ON realtime_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX idx_realtime_last_ping ON realtime_subscriptions(last_ping);
```

## API Routes

### Products API

| Method | Path | Auth | Description | Cache TTL |
|--------|------|------|-------------|-----------|
| GET | `/api/v1/products` | API Key | List products with pagination | 1h |
| GET | `/api/v1/products/{id}` | API Key | Get product details | 2h |
| GET | `/api/v1/products/{id}/variants` | API Key | Get product variants | 2h |
| GET | `/api/v1/products/search` | API Key | Search products | 30m |
| POST | `/api/v1/products` | Admin API Key | Create product | - |
| PUT | `/api/v1/products/{id}` | Admin API Key | Update product | - |
| DELETE | `/api/v1/products/{id}` | Admin API Key | Delete product | - |

**List Products Example:**
```bash
curl -X GET "https://api.optia.com/api/v1/products?page=1&per_page=20&category=electronics" \
  -H "X-API-Key: your_frontend_api_key"
```

**Response:**
```json
{
  "data": [
    {
      "id": 123,
      "wc_id": 123,
      "name": "Wireless Headphones",
      "slug": "wireless-headphones",
      "price": "99.99",
      "regular_price": "129.99",
      "sale_price": "99.99",
      "stock_status": "instock",
      "stock_quantity": 50,
      "images": [
        {
          "src": "https://store.com/wp-content/uploads/headphones.jpg",
          "alt": "Wireless Headphones"
        }
      ],
      "categories": [
        {
          "id": 15,
          "name": "Electronics",
          "slug": "electronics"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNC0wMS0xNVQxMDowMDowMFoifQ=="
  },
  "cache_status": "hit",
  "response_time_ms": 45
}
```

### Orders API

| Method | Path | Auth | Description | Cache TTL |
|--------|------|------|-------------|-----------|
| GET | `/api/v1/orders` | API Key | List orders | 5m |
| GET | `/api/v1/orders/{id}` | API Key | Get order details | 10m |
| POST | `/api/v1/orders` | API Key | Create order | - |
| PUT | `/api/v1/orders/{id}` | API Key | Update order | - |
| POST | `/api/v1/orders/{id}/notes` | API Key | Add order note | - |
| GET | `/api/v1/orders/{id}/status` | API Key | Get order status | 1m |

**Create Order Example:**
```bash
curl -X POST "https://api.optia.com/api/v1/orders" \
  -H "X-API-Key: your_frontend_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "billing": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    },
    "line_items": [
      {
        "product_id": 123,
        "quantity": 2,
        "price": "99.99"
      }
    ],
    "payment_method": "payfast",
    "set_paid": false
  }'
```

### Cart API (Optimistic Updates)

| Method | Path | Auth | Description | Cache TTL |
|--------|------|------|-------------|-----------|
| GET | `/api/v1/cart/{session_id}` | API Key | Get cart contents | 5m |
| POST | `/api/v1/cart/{session_id}/items` | API Key | Add item to cart | - |
| PUT | `/api/v1/cart/{session_id}/items/{item_id}` | API Key | Update cart item | - |
| DELETE | `/api/v1/cart/{session_id}/items/{item_id}` | API Key | Remove cart item | - |
| POST | `/api/v1/cart/{session_id}/sync` | API Key | Sync with WooCommerce | - |
| DELETE | `/api/v1/cart/{session_id}` | API Key | Clear cart | - |

**Add to Cart with Optimistic Update:**
```bash
curl -X POST "https://api.optia.com/api/v1/cart/sess_123/items" \
  -H "X-API-Key: your_frontend_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 123,
    "quantity": 1,
    "variation_id": null,
    "optimistic": true
  }'
```

**Response:**
```json
{
  "success": true,
  "optimistic": true,
  "data": {
    "item_id": "temp_456",
    "product_id": 123,
    "quantity": 1,
    "price": "99.99",
    "total": "99.99",
    "status": "pending_sync"
  },
  "cart_totals": {
    "subtotal": "199.98",
    "tax": "20.00",
    "shipping": "10.00",
    "total": "229.98"
  },
  "sync_job_id": "job_789"
}
```

### Search API

| Method | Path | Auth | Description | Cache TTL |
|--------|------|------|-------------|-----------|
| GET | `/api/v1/search` | API Key | Search products | 30m |
| GET | `/api/v1/search/suggestions` | API Key | Get search suggestions | 1h |
| GET | `/api/v1/search/filters` | API Key | Get available filters | 2h |

**Search Example:**
```bash
curl -X GET "https://api.optia.com/api/v1/search?q=wireless+headphones&filters=%7B%22category%22%3A%22electronics%22%2C%22price_min%22%3A50%2C%22price_max%22%3A200%7D" \
  -H "X-API-Key: your_frontend_api_key"
```

### Webhooks API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/webhooks/woocommerce` | Signature | WooCommerce webhook receiver |
| GET | `/api/v1/webhooks/logs` | Admin API Key | Get webhook logs |
| POST | `/api/v1/webhooks/retry/{id}` | Admin API Key | Retry failed webhook |

### Real-time API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/realtime/subscribe` | API Key | WebSocket connection |
| POST | `/api/v1/realtime/broadcast` | Admin API Key | Broadcast message |
| GET | `/api/v1/realtime/channels` | Admin API Key | List active channels |

**WebSocket Connection:**
```javascript
const ws = new WebSocket('wss://api.optia.com/api/v1/realtime/subscribe', [], {
  headers: {
    'X-API-Key': 'your_frontend_api_key'
  }
});

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

// Subscribe to channels
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'products',
  events: ['product.updated', 'product.stock_changed']
}));
```

### Admin API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/admin/stats` | Admin API Key | Get system statistics |
| POST | `/api/v1/admin/sync` | Admin API Key | Trigger manual sync |
| GET | `/api/v1/admin/cache/stats` | Admin API Key | Cache statistics |
| DELETE | `/api/v1/admin/cache` | Admin API Key | Clear cache |
| GET | `/api/v1/admin/health` | Admin API Key | Detailed health check |

## Caching Strategy

### Multi-Layer Cache Architecture

The BFF implements a sophisticated 4-layer caching system:

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   CDN/Edge  │──▶│   Memory    │──▶│  Supabase   │──▶│ WooCommerce │
│   Cache     │   │   Cache     │   │   Cache     │   │   Source    │
│  (Vercel)   │   │  (Runtime)  │   │ (Database)  │   │             │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
     30s-1h           5-30m           1h-24h           Source of Truth
```

### Cache Key Strategy

```typescript
const CACHE_KEYS = {
  // Product caching
  PRODUCT_LIST: (filters: string, page: number) => 
    `products:list:${btoa(filters)}:${page}`,
  PRODUCT_DETAIL: (id: number) => 
    `products:detail:${id}`,
  PRODUCT_VARIANTS: (id: number) => 
    `products:${id}:variants`,
  
  // Search caching
  SEARCH_RESULTS: (query: string, filters: string) => 
    `search:${btoa(query)}:${btoa(filters)}`,
  SEARCH_SUGGESTIONS: (query: string) => 
    `search:suggestions:${btoa(query)}`,
  
  // Cart caching
  CART_CONTENTS: (sessionId: string) => 
    `cart:${sessionId}`,
  CART_TOTALS: (sessionId: string) => 
    `cart:${sessionId}:totals`,
  
  // Order caching
  ORDER_DETAIL: (id: number) => 
    `orders:detail:${id}`,
  ORDER_STATUS: (id: number) => 
    `orders:${id}:status`
}
```

### Cache TTL Configuration

```typescript
const CACHE_TTL = {
  // Products - long TTL due to infrequent changes
  PRODUCT_LIST: 3600,      // 1 hour
  PRODUCT_DETAIL: 7200,    // 2 hours
  PRODUCT_SEARCH: 1800,    // 30 minutes
  
  // Orders - shorter TTL due to frequent status changes
  ORDER_LIST: 300,         // 5 minutes
  ORDER_DETAIL: 600,       // 10 minutes
  ORDER_STATUS: 60,        // 1 minute
  
  // Cart - very short TTL for real-time experience
  CART_CONTENTS: 300,      // 5 minutes
  CART_TOTALS: 300,        // 5 minutes
  
  // Search - moderate TTL
  SEARCH_RESULTS: 1800,    // 30 minutes
  SEARCH_SUGGESTIONS: 3600 // 1 hour
}
```

### Cache Implementation

```typescript
// src/services/cache.ts
export class CacheService {
  private memoryCache = new Map<string, { data: any; expires: number }>()
  
  async get(key: string): Promise<any> {
    // 1. Check memory cache first (fastest)
    const memoryResult = this.memoryCache.get(key)
    if (memoryResult && memoryResult.expires > Date.now()) {
      return memoryResult.data
    }
    
    // 2. Check Supabase cache
    const { data } = await supabase
      .from('cache_index')
      .select('data, expires_at')
      .eq('cache_key', key)
      .gt('expires_at', new Date().toISOString())
      .single()
    
    if (data) {
      // Store in memory for next request
      this.memoryCache.set(key, {
        data: data.data,
        expires: Date.now() + 300000 // 5 minutes in memory
      })
      
      // Update access stats
      await this.updateCacheStats(key)
      
      return data.data
    }
    
    return null
  }
  
  async set(key: string, value: any, ttl: number, tags: string[] = []) {
    const expiresAt = new Date(Date.now() + ttl * 1000)
    
    // Store in memory
    this.memoryCache.set(key, {
      data: value,
      expires: Date.now() + Math.min(ttl * 1000, 300000) // Max 5min in memory
    })
    
    // Store in Supabase
    await supabase
      .from('cache_index')
      .upsert({
        cache_key: key,
        resource_type: this.getResourceType(key),
        tags,
        data: value,
        expires_at: expiresAt.toISOString(),
        hit_count: 0
      })
  }
  
  async invalidateByTags(tags: string[]) {
    // Clear memory cache (simple approach - clear all)
    this.memoryCache.clear()
    
    // Delete from Supabase by tags
    await supabase
      .from('cache_index')
      .delete()
      .overlaps('tags', tags)
    
    // Purge CDN cache if available
    if (process.env.CDN_PURGE_URL) {
      await this.purgeCDNCache(tags)
    }
  }
  
  private async purgeCDNCache(tags: string[]) {
    try {
      await fetch(process.env.CDN_PURGE_URL!, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CDN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tags })
      })
    } catch (error) {
      console.error('CDN purge failed:', error)
    }
  }
}
```

### Cache Invalidation Strategy

```typescript
// Webhook-triggered cache invalidation
export async function invalidateCacheOnWebhook(topic: string, resourceId: number) {
  const tagsToInvalidate: string[] = []
  
  switch (topic) {
    case 'product.created':
    case 'product.updated':
      tagsToInvalidate.push(
        `product:${resourceId}`,
        'products:list',
        'search:results',
        'search:suggestions'
      )
      break
      
    case 'product.deleted':
      tagsToInvalidate.push(
        `product:${resourceId}`,
        'products:list',
        'search:results'
      )
      break
      
    case 'order.updated':
      tagsToInvalidate.push(
        `order:${resourceId}`,
        'orders:list'
      )
      
      // If order status changed to completed, invalidate product stock
      const order = await getOrderFromWebhook(resourceId)
      if (order.status === 'completed') {
        order.line_items.forEach(item => {
          tagsToInvalidate.push(`product:${item.product_id}`)
        })
      }
      break
  }
  
  await cacheService.invalidateByTags(tagsToInvalidate)
}
```

## Webhook Handling

### WooCommerce Webhook Configuration

Configure these webhooks in your WooCommerce admin:

```
Product Created:    https://api.optia.com/api/v1/webhooks/woocommerce
Product Updated:    https://api.optia.com/api/v1/webhooks/woocommerce
Product Deleted:    https://api.optia.com/api/v1/webhooks/woocommerce
Product Restored:   https://api.optia.com/api/v1/webhooks/woocommerce

Order Created:      https://api.optia.com/api/v1/webhooks/woocommerce
Order Updated:      https://api.optia.com/api/v1/webhooks/woocommerce
Order Deleted:      https://api.optia.com/api/v1/webhooks/woocommerce

Customer Created:   https://api.optia.com/api/v1/webhooks/woocommerce
Customer Updated:   https://api.optia.com/api/v1/webhooks/woocommerce
Customer Deleted:   https://api.optia.com/api/v1/webhooks/woocommerce
```

### Webhook Security & Verification

```typescript
// src/routes/webhooks.ts
import crypto from 'crypto'
import { Hono } from 'hono'

const webhooks = new Hono()

// Webhook signature verification middleware
const verifyWebhookSignature = async (c: Context, next: Next) => {
  const signature = c.req.header('x-wc-webhook-signature')
  const body = await c.req.text()
  
  if (!signature) {
    console.warn('Missing webhook signature')
    return c.text('Missing signature', 401)
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WC_WEBHOOK_SECRET!)
    .update(body, 'utf8')
    .digest('base64')
  
  if (signature !== expectedSignature) {
    console.warn('Invalid webhook signature', { 
      received: signature, 
      expected: expectedSignature,
      body: body.substring(0, 100) + '...'
    })
    return c.text('Invalid signature', 401)
  }
  
  c.set('webhookBody', JSON.parse(body))
  await next()
}

// Main webhook handler
webhooks.post('/woocommerce', verifyWebhookSignature, async (c) => {
  const data = c.get('webhookBody')
  const deliveryId = c.req.header('x-wc-webhook-delivery-id')
  const topic = c.req.header('x-wc-webhook-topic')
  const source = c.req.header('x-wc-webhook-source')
  
  try {
    // Log webhook for debugging and idempotency
    const { error: logError } = await supabase
      .from('webhooks_log')
      .insert({
        webhook_id: deliveryId,
        topic: topic || 'unknown',
        resource: getResourceFromTopic(topic),
        resource_id: data.id,
        event: getEventFromTopic(topic),
        payload: data,
        signature: c.req.header('x-wc-webhook-signature')
      })
    
    if (logError) {
      console.error('Failed to log webhook:', logError)
    }
    
    // Check for duplicate webhook (idempotency)
    if (deliveryId) {
      const { data: existing } = await supabase
        .from('webhooks_log')
        .select('processed')
        .eq('webhook_id', deliveryId)
        .eq('processed', true)
        .single()
      
      if (existing) {
        console.log('Webhook already processed:', deliveryId)
        return c.text('Already processed', 200)
      }
    }
    
    // Process webhook based on topic
    await processWebhook(topic, data)
    
    // Mark as processed
    if (deliveryId) {
      await supabase
        .from('webhooks_log')
        .update({ 
          processed: true, 
          processed_at: new Date().toISOString() 
        })
        .eq('webhook_id', deliveryId)
    }
    
    console.log(`Webhook processed successfully: ${topic} for resource ${data.id}`)
    return c.text('OK', 200)
    
  } catch (error) {
    console.error('Webhook processing failed:', error)
    
    // Update retry count
    if (deliveryId) {
      await supabase
        .from('webhooks_log')
        .update({ 
          retry_count: supabase.raw('COALESCE(retry_count, 0) + 1'),
          error_message: error.message
        })
        .eq('webhook_id', deliveryId)
    }
    
    return c.text('Processing failed', 500)
  }
})

async function processWebhook(topic: string, data: any) {
  const [resource, event] = topic.split('.')
  
  switch (topic) {
    case 'product.created':
    case 'product.updated':
      await syncProductFromWebhook(data)
      await invalidateCacheOnWebhook(topic, data.id)
      await broadcastRealTimeUpdate('products', {
        type: event,
        product: data
      })
      break
      
    case 'product.deleted':
      await deleteProductFromCache(data.id)
      await invalidateCacheOnWebhook(topic, data.id)
      await broadcastRealTimeUpdate('products', {
        type: 'deleted',
        product_id: data.id
      })
      break
      
    case 'order.created':
    case 'order.updated':
      await syncOrderFromWebhook(data)
      await invalidateCacheOnWebhook(topic, data.id)
      await broadcastRealTimeUpdate('orders', {
        type: event,
        order: data
      })
      break
      
    default:
      console.log(`Unhandled webhook topic: ${topic}`)
  }
}
```

### Webhook Retry Logic

```typescript
// Background job for retrying failed webhooks
export async function retryFailedWebhooks() {
  const { data: failedWebhooks } = await supabase
    .from('webhooks_log')
    .select('*')
    .eq('processed', false)
    .lt('retry_count', 3)
    .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // 5 minutes ago
  
  for (const webhook of failedWebhooks || []) {
    try {
      console.log(`Retrying webhook: ${webhook.topic} for resource ${webhook.resource_id}`)
      
      await processWebhook(webhook.topic, webhook.payload)
      
      await supabase
        .from('webhooks_log')
        .update({ 
          processed: true, 
          processed_at: new Date().toISOString(),
          error_message: null
        })
        .eq('id', webhook.id)
        
      console.log(`Webhook retry successful: ${webhook.id}`)
        
    } catch (error) {
      console.error(`Webhook retry failed: ${webhook.id}`, error)
      
      await supabase
        .from('webhooks_log')
        .update({ 
          retry_count: webhook.retry_count + 1,
          error_message: error.message
        })
        .eq('id', webhook.id)
    }
  }
}

// Run retry job every 5 minutes
setInterval(retryFailedWebhooks, 5 * 60 * 1000)
```

### Webhook Payload Examples

**Product Updated Webhook:**
```json
{
  "id": 123,
  "name": "Wireless Headphones - Updated",
  "slug": "wireless-headphones",
  "status": "publish",
  "price": "89.99",
  "regular_price": "129.99",
  "sale_price": "89.99",
  "stock_quantity": 45,
  "stock_status": "instock",
  "manage_stock": true,
  "categories": [
    {
      "id": 15,
      "name": "Electronics",
      "slug": "electronics"
    }
  ],
  "images": [...],
  "date_created": "2024-01-15T10:00:00",
  "date_modified": "2024-01-15T14:30:00"
}
```

**Order Status Changed Webhook:**
```json
{
  "id": 456,
  "status": "processing",
  "currency": "USD",
  "total": "199.98",
  "line_items": [
    {
      "id": 789,
      "product_id": 123,
      "quantity": 2,
      "total": "179.98"
    }
  ],
  "billing": {...},
  "shipping": {...},
  "date_created": "2024-01-15T15:00:00",
  "date_modified": "2024-01-15T15:05:00",
  "date_paid": "2024-01-15T15:05:00"
}
```

## Real-time Updates

### Supabase Realtime Integration

The BFF leverages Supabase Realtime for instant updates across all connected clients:

```typescript
// src/services/realtime.ts
import { createClient } from '@supabase/supabase-js'

export class RealtimeService {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
  
  private channels = new Map<string, any>()
  
  // Broadcast product updates to all subscribed clients
  async broadcastProductUpdate(productId: number, data: any) {
    const channel = this.getChannel('products')
    
    await channel.send({
      type: 'broadcast',
      event: 'product_updated',
      payload: {
        product_id: productId,
        data,
        timestamp: new Date().toISOString()
      }
    })
  }
  
  // Broadcast order updates
  async broadcastOrderUpdate(orderId: number, status: string, data: any) {
    const channel = this.getChannel('orders')
    
    await channel.send({
      type: 'broadcast',
      event: 'order_updated',
      payload: {
        order_id: orderId,
        status,
        data,
        timestamp: new Date().toISOString()
      }
    })
  }
  
  // Broadcast cart updates for specific session
  async broadcastCartUpdate(sessionId: string, data: any) {
    const channel = this.getChannel(`cart:${sessionId}`)
    
    await channel.send({
      type: 'broadcast',
      event: 'cart_updated',
      payload: {
        session_id: sessionId,
        data,
        timestamp: new Date().toISOString()
      }
    })
  }
  
  // Broadcast stock changes
  async broadcastStockChange(productId: number, stockQuantity: number) {
    const channel = this.getChannel('inventory')
    
    await channel.send({
      type: 'broadcast',
      event: 'stock_changed',
      payload: {
        product_id: productId,
        stock_quantity: stockQuantity,
        timestamp: new Date().toISOString()
      }
    })
  }
  
  private getChannel(channelName: string) {
    if (!this.channels.has(channelName)) {
      const channel = this.supabase.channel(channelName)
      this.channels.set(channelName, channel)
    }
    return this.channels.get(channelName)
  }
}

export const realtimeService = new RealtimeService()
```

### WebSocket Connection Handler

```typescript
// src/routes/realtime.ts
import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/cloudflare-workers'

const realtime = new Hono()

// WebSocket upgrade endpoint
realtime.get('/subscribe', upgradeWebSocket((c) => {
  const apiKey = c.req.header('X-API-Key')
  
  return {
    onOpen: (event, ws) => {
      console.log('WebSocket connection opened')
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        timestamp: new Date().toISOString()
      }))
    },
    
    onMessage: async (event, ws) => {
      try {
        const message = JSON.parse(event.data as string)
        
        switch (message.type) {
          case 'subscribe':
            await handleSubscribe(ws, message, apiKey)
            break
            
          case 'unsubscribe':
            await handleUnsubscribe(ws, message, apiKey)
            break
            
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }))
            break
            
          default:
            ws.send(JSON.stringify({ 
              type: 'error', 
              message: 'Unknown message type',
              timestamp: new Date().toISOString()
            }))
        }
      } catch (error) {
        console.error('WebSocket message error:', error)
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Invalid message format',
          timestamp: new Date().toISOString()
        }))
      }
    },
    
    onClose: (event, ws) => {
      console.log('WebSocket connection closed')
      // Clean up subscriptions
    },
    
    onError: (event, ws) => {
      console.error('WebSocket error:', event)
    }
  }
}))

async function handleSubscribe(ws: WebSocket, message: any, apiKey: string) {
  const { channel, events, filters } = message
  
  // Validate API key permissions
  const hasPermission = await validateChannelPermission(apiKey, channel)
  if (!hasPermission) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Insufficient permissions for channel',
      channel
    }))
    return
  }
  
  // Store subscription in database
  await supabase
    .from('realtime_subscriptions')
    .insert({
      session_id: generateSessionId(),
      channel,
      events: events || [],
      filters: filters || {},
      is_active: true
    })
  
  ws.send(JSON.stringify({
    type: 'subscribed',
    channel,
    events,
    timestamp: new Date().toISOString()
  }))
}
```

### Frontend Integration Examples

**Next.js Real-time Hook:**
```typescript
// hooks/useRealtime.ts
import { useEffect, useRef, useState } from 'react'

interface RealtimeOptions {
  apiKey: string
  channels: string[]
  events?: string[]
  onMessage?: (message: any) => void
  onError?: (error: Error) => void
}

export function useRealtime(options: RealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  
  useEffect(() => {
    connect()
    
    return () => {
      disconnect()
    }
  }, [])
  
  const connect = () => {
    const ws = new WebSocket('wss://api.optia.com/api/v1/realtime/subscribe', [], {
      headers: {
        'X-API-Key': options.apiKey
      }
    })
    
    ws.onopen = () => {
      console.log('Real-time connection established')
      setIsConnected(true)
      
      // Subscribe to channels
      options.channels.forEach(channel => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel,
          events: options.events || []
        }))
      })
    }
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      setLastMessage(message)
      options.onMessage?.(message)
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      options.onError?.(new Error('WebSocket connection error'))
    }
    
    ws.onclose = () => {
      console.log('WebSocket connection closed')
      setIsConnected(false)
      
      // Attempt reconnection after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 5000)
    }
    
    wsRef.current = ws
  }
  
  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    setIsConnected(false)
  }
  
  return {
    isConnected,
    lastMessage,
    disconnect
  }
}

// Usage in component
function ProductList() {
  const [products, setProducts] = useState([])
  
  useRealtime({
    apiKey: process.env.NEXT_PUBLIC_BFF_API_KEY!,
    channels: ['products', 'inventory'],
    events: ['product_updated', 'stock_changed'],
    onMessage: (message) => {
      switch (message.event) {
        case 'product_updated':
          // Update specific product in list
          setProducts(prev => prev.map(p => 
            p.id === message.payload.product_id 
              ? { ...p, ...message.payload.data }
              : p
          ))
          break
          
        case 'stock_changed':
          // Update stock quantity
          setProducts(prev => prev.map(p =>
            p.id === message.payload.product_id
              ? { ...p, stock_quantity: message.payload.stock_quantity }
              : p
          ))
          break
      }
    }
  })
  
  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
```

**React Native Real-time Integration:**
```typescript
// services/RealtimeService.ts
import { io, Socket } from 'socket.io-client'

class RealtimeService {
  private socket: Socket | null = null
  private listeners = new Map<string, Function[]>()
  
  connect(apiKey: string) {
    this.socket = io('wss://api.optia.com', {
      auth: {
        token: apiKey
      },
      transports: ['websocket']
    })
    
    this.socket.on('connect', () => {
      console.log('Connected to real-time service')
    })
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from real-time service')
    })
    
    this.socket.on('product_updated', (data) => {
      this.emit('product_updated', data)
    })
    
    this.socket.on('stock_changed', (data) => {
      this.emit('stock_changed', data)
    })
  }
  
  subscribe(channel: string, events: string[] = []) {
    if (this.socket) {
      this.socket.emit('subscribe', { channel, events })
    }
  }
  
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }
  
  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event) || []
    callbacks.forEach(callback => callback(data))
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }
}

export const realtimeService = new RealtimeService()
```

### Polling Fallback Strategy

```typescript
// src/services/pollingFallback.ts
export class PollingFallbackService {
  private intervals = new Map<string, NodeJS.Timeout>()
  private apiKey: string
  
  constructor(apiKey: string) {
    this.apiKey = apiKey
  }
  
  // Start polling for product updates
  startProductPolling(productIds: number[], callback: (updates: any[]) => void) {
    const intervalId = setInterval(async () => {
      try {
        const updates = await this.checkForProductUpdates(productIds)
        if (updates.length > 0) {
          callback(updates)
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 30000) // Poll every 30 seconds
    
    this.intervals.set('products', intervalId)
  }
  
  // Start polling for order status
  startOrderPolling(orderId: number, callback: (status: string) => void) {
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/orders/${orderId}/status`, {
          headers: { 'X-API-Key': this.apiKey }
        })
        const data = await response.json()
        callback(data.status)
      } catch (error) {
        console.error('Order polling error:', error)
      }
    }, 10000) // Poll every 10 seconds
    
    this.intervals.set(`order:${orderId}`, intervalId)
  }
  
  private async checkForProductUpdates(productIds: number[]) {
    const response = await fetch('/api/v1/products/updates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify({
        product_ids: productIds,
        since: new Date(Date.now() - 30000).toISOString() // Last 30 seconds
      })
    })
    
    return response.json()
  }
  
  stopPolling(key: string) {
    const intervalId = this.intervals.get(key)
    if (intervalId) {
      clearInterval(intervalId)
      this.intervals.delete(key)
    }
  }
  
  stopAllPolling() {
    for (const [key] of this.intervals) {
      this.stopPolling(key)
    }
  }
}
```

## Optimistic UI Support

### Cart Optimistic Updates

```typescript
// src/routes/cart.ts
import { Hono } from 'hono'

const cart = new Hono()

// Add item to cart with optimistic update
cart.post('/:sessionId/items', async (c) => {
  const sessionId = c.req.param('sessionId')
  const { product_id, quantity, variation_id, optimistic } = await c.req.json()
  
  if (optimistic) {
    // Return immediate optimistic response
    const optimisticResponse = await createOptimisticCartItem({
      product_id,
      quantity,
      variation_id,
      session_id: sessionId
    })
    
    // Queue background sync job
    await queueCartSyncJob(sessionId, {
      action: 'add_item',
      product_id,
      quantity,
      variation_id
    })
    
    return c.json({
      success: true,
      optimistic: true,
      data: optimisticResponse.item,
      cart_totals: optimisticResponse.totals,
      sync_job_id: optimisticResponse.syncJobId
    })
  }
  
  // Non-optimistic: wait for WooCommerce response
  const result = await addItemToWooCommerceCart(sessionId, {
    product_id,
    quantity,
    variation_id
  })
  
  // Update local cache
  await updateCartCache(sessionId, result)
  
  return c.json({
    success: true,
    optimistic: false,
    data: result
  })
})

async function createOptimisticCartItem(itemData: any) {
  // Get product details from cache
  const product = await getProductFromCache(itemData.product_id)
  
  if (!product) {
    throw new Error('Product not found')
  }
  
  // Generate temporary item ID
  const tempItemId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const optimisticItem = {
    item_id: tempItemId,
    product_id: itemData.product_id,
    variation_id: itemData.variation_id,
    quantity: itemData.quantity,
    name: product.name,
    price: parseFloat(product.price),
    total: parseFloat(product.price) * itemData.quantity,
    status: 'pending_sync',
    image: product.images?.[0]?.src || null
  }
  
  // Update local cart
  const { data: existingCart } = await supabase
    .from('carts')
    .select('*')
    .eq('session_id', itemData.session_id)
    .single()
  
  const currentItems = existingCart?.items || []
  const updatedItems = [...currentItems, optimisticItem]
  
  const newTotals = calculateCartTotals(updatedItems)
  
  // Save optimistic cart state
  await supabase
    .from('carts')
    .upsert({
      session_id: itemData.session_id,
      items: updatedItems,
      totals: newTotals,
      status: 'pending_sync',
      updated_at: new Date().toISOString()
    })
  
  // Generate sync job ID
  const syncJobId = await queueCartSyncJob(itemData.session_id, {
    action: 'add_item',
    ...itemData
  })
  
  return {
    item: optimisticItem,
    totals: newTotals,
    syncJobId
  }
}
```

### Order Optimistic Updates

```typescript
// Optimistic order creation
export async function createOrderOptimistically(orderData: any) {
  // Generate temporary order ID
  const tempOrderId = `temp_${Date.now()}`
  
  const optimisticOrder = {
    id: tempOrderId,
    status: 'pending',
    total: orderData.total,
    currency: orderData.currency,
    line_items: orderData.line_items,
    billing: orderData.billing,
    shipping: orderData.shipping,
    payment_method: orderData.payment_method,
    created_at: new Date().toISOString(),
    optimistic: true
  }
  
  // Store optimistic order
  await supabase
    .from('orders')
    .insert({
      wc_id: 0, // Temporary
      order_key: tempOrderId,
      status: 'pending',
      currency: orderData.currency,
      total: parseFloat(orderData.total),
      subtotal: parseFloat(orderData.subtotal || orderData.total),
      customer_id: orderData.customer_id,
      billing: orderData.billing,
      shipping: orderData.shipping,
      line_items: orderData.line_items,
      payment_method: orderData.payment_method,
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString()
    })
  
  // Queue background job to create real order
  const syncJobId = await queueOrderCreationJob(tempOrderId, orderData)
  
  return {
    order: optimisticOrder,
    sync_job_id: syncJobId
  }
}

// Background job to sync with WooCommerce
export async function syncOrderWithWooCommerce(tempOrderId: string, orderData: any) {
  try {
    // Create order in WooCommerce
    const wooOrder = await wcClient.createOrder(orderData)
    
    // Update local order with real WooCommerce ID
    await supabase
      .from('orders')
      .update({
        wc_id: wooOrder.id,
        order_key: wooOrder.order_key,
        status: wooOrder.status,
        transaction_id: wooOrder.transaction_id,
        date_created: wooOrder.date_created,
        date_modified: wooOrder.date_modified
      })
      .eq('order_key', tempOrderId)
    
    // Broadcast success to connected clients
    await realtimeService.broadcastOrderUpdate(wooOrder.id, wooOrder.status, {
      type: 'sync_success',
      temp_id: tempOrderId,
      real_id: wooOrder.id
    })
    
    console.log(`Order sync successful: ${tempOrderId} -> ${wooOrder.id}`)
    
  } catch (error) {
    console.error('Order sync failed:', error)
    
    // Mark order as failed and broadcast rollback
    await supabase
      .from('orders')
      .update({
        status: 'failed',
        error_message: error.message
      })
      .eq('order_key', tempOrderId)
    
    await realtimeService.broadcastOrderUpdate(0, 'failed', {
      type: 'sync_failed',
      temp_id: tempOrderId,
      error: error.message
    })
  }
}
```

### Frontend Optimistic UI Patterns

**React Hook for Optimistic Updates:**
```typescript
// hooks/useOptimisticCart.ts
import { useState, useCallback } from 'react'

export function useOptimisticCart(sessionId: string) {
  const [cart, setCart] = useState(null)
  const [pendingItems, setPendingItems] = useState(new Set())
  
  const addItemOptimistically = useCallback(async (item: CartItem) => {
    const tempId = `temp_${Date.now()}`
    
    // Optimistic update
    setCart(prevCart => ({
      ...prevCart,
      items: [...(prevCart?.items || []), { ...item, id: tempId, status: 'pending' }]
    }))
    
    setPendingItems(prev => new Set([...prev, tempId]))
    
    try {
      // API call with optimistic flag
      const response = await fetch(`/api/v1/cart/${sessionId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.REACT_APP_BFF_API_KEY
        },
        body: JSON.stringify({ ...item, optimistic: true })
      })
      
      const result = await response.json()
      
      if (result.success) {
        // Replace temp item with real item
        setCart(prevCart => ({
          ...prevCart,
          items: prevCart.items.map(i => 
            i.id === tempId ? { ...result.data, status: 'synced' } : i
          ),
          totals: result.cart_totals
        }))
      } else {
        throw new Error(result.message)
      }
      
    } catch (error) {
      // Rollback optimistic update
      setCart(prevCart => ({
        ...prevCart,
        items: prevCart.items.filter(i => i.id !== tempId)
      }))
      
      throw error
    } finally {
      setPendingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(tempId)
        return newSet
      })
    }
  }, [sessionId])
  
  return {
    cart,
    pendingItems,
    addItemOptimistically
  }
}
```

## Authentication & Security

### API Key Authentication

The BFF uses a secure API key system for authentication:

```typescript
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import crypto from 'crypto'
import { supabase } from '../services/supabase'

export interface ApiKeyData {
  id: string
  name: string
  permissions: string[]
  rateLimit: number
  rateWindow: number
}

export const apiKeyAuth = createMiddleware<{
  Variables: {
    apiKey: ApiKeyData
  }
}>(async (c, next) => {
  const apiKey = c.req.header('X-API-Key')
  
  if (!apiKey) {
    return c.json({ 
      success: false,
      error: 'API key required',
      code: 'MISSING_API_KEY'
    }, 401)
  }
  
  // Hash the provided key for lookup
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')
  
  // Look up key in database
  const { data: keyData, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single()
  
  if (error || !keyData) {
    console.warn('Invalid API key attempt:', { keyHash: keyHash.substring(0, 8) + '...' })
    return c.json({ 
      success: false,
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    }, 401)
  }
  
  // Check expiration
  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    return c.json({ 
      success: false,
      error: 'API key expired',
      code: 'EXPIRED_API_KEY'
    }, 401)
  }
  
  // Update usage statistics
  await supabase
    .from('api_keys')
    .update({ 
      last_used_at: new Date().toISOString(),
      usage_count: supabase.raw('usage_count + 1')
    })
    .eq('id', keyData.id)
  
  c.set('apiKey', {
    id: keyData.id,
    name: keyData.name,
    permissions: keyData.permissions,
    rateLimit: keyData.rate_limit,
    rateWindow: keyData.rate_window
  })
  
  await next()
})

// Permission-based authorization
export const requirePermission = (...permissions: string[]) => {
  return createMiddleware(async (c, next) => {
    const apiKey = c.get('apiKey')
    
    if (!apiKey) {
      return c.json({ 
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      }, 401)
    }
    
    // Check if user has admin permission (bypasses all checks)
    if (apiKey.permissions.includes('admin')) {
      await next()
      return
    }
    
    // Check specific permissions
    const hasPermission = permissions.some(permission => 
      apiKey.permissions.includes(permission)
    )
    
    if (!hasPermission) {
      return c.json({ 
        success: false,
        error: `Insufficient permissions. Required: ${permissions.join(' OR ')}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      }, 403)
    }
    
    await next()
  })
}

// Role-based access control
export const requireRole = (role: string) => {
  return requirePermission(`role:${role}`)
}
```

### JWT Integration (Optional)

For user sessions, the BFF can integrate with Supabase Auth:

```typescript
// src/middleware/jwt.ts
import { jwt } from 'hono/jwt'
import { createMiddleware } from 'hono/factory'

// JWT middleware for user sessions
export const jwtAuth = jwt({
  secret: process.env.SUPABASE_JWT_SECRET!,
  cookie: 'sb-access-token'
})

// Combined API key + JWT auth
export const hybridAuth = createMiddleware(async (c, next) => {
  const apiKey = c.req.header('X-API-Key')
  const authHeader = c.req.header('Authorization')
  
  if (apiKey) {
    // Use API key authentication
    return apiKeyAuth(c, next)
  } else if (authHeader?.startsWith('Bearer ')) {
    // Use JWT authentication
    return jwtAuth(c, next)
  } else {
    return c.json({ 
      success: false,
      error: 'Authentication required (API key or JWT)',
      code: 'AUTH_REQUIRED'
    }, 401)
  }
})

// User context from JWT
export const getUserFromJWT = createMiddleware(async (c, next) => {
  const payload = c.get('jwtPayload')
  
  if (payload) {
    // Get user data from Supabase
    const { data: user } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', payload.sub)
      .single()
    
    c.set('user', user)
  }
  
  await next()
})
```

### Input Validation & Sanitization

```typescript
// src/middleware/validation.ts
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import DOMPurify from 'isomorphic-dompurify'

// Common validation schemas
export const schemas = {
  pagination: z.object({
    page: z.string().transform(Number).pipe(z.number().min(1).max(1000)).default('1'),
    per_page: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('20'),
    cursor: z.string().optional()
  }),
  
  productQuery: z.object({
    search: z.string().max(100).optional(),
    category: z.string().regex(/^[a-z0-9-]+$/).optional(),
    status: z.enum(['publish', 'draft', 'private']).default('publish'),
    price_min: z.string().transform(Number).pipe(z.number().min(0)).optional(),
    price_max: z.string().transform(Number).pipe(z.number().min(0)).optional(),
    in_stock: z.string().transform(Boolean).optional()
  }),
  
  orderCreate: z.object({
    billing: z.object({
      first_name: z.string().min(1).max(50),
      last_name: z.string().min(1).max(50),
      email: z.string().email(),
      phone: z.string().max(20).optional(),
      address_1: z.string().max(100),
      address_2: z.string().max(100).optional(),
      city: z.string().max(50),
      state: z.string().max(50),
      postcode: z.string().max(20),
      country: z.string().length(2)
    }),
    line_items: z.array(z.object({
      product_id: z.number().positive(),
      variation_id: z.number().positive().optional(),
      quantity: z.number().min(1).max(100)
    })).min(1).max(50),
    payment_method: z.string().max(50),
    customer_note: z.string().max(500).optional()
  })
}

// Sanitization middleware
export const sanitizeInput = createMiddleware(async (c, next) => {
  const contentType = c.req.header('content-type')
  
  if (contentType?.includes('application/json')) {
    const body = await c.req.json()
    const sanitizedBody = sanitizeObject(body)
    
    // Replace request body with sanitized version
    c.req = new Request(c.req.url, {
      ...c.req,
      body: JSON.stringify(sanitizedBody)
    })
  }
  
  await next()
})

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return DOMPurify.sanitize(obj, { ALLOWED_TAGS: [] }) // Strip all HTML
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject)
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value)
    }
    return sanitized
  }
  
  return obj
}
```

### Security Headers & CORS

```typescript
// src/middleware/security.ts
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { createMiddleware } from 'hono/factory'

// CORS configuration
export const corsMiddleware = cors({
  origin: (origin) => {
    // Allow requests from specific domains
    const allowedOrigins = [
      'https://yourfrontend.com',
      'https://yourmobile.app',
      'https://admin.yoursite.com'
    ]
    
    // Allow localhost in development
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000', 'http://localhost:3001')
    }
    
    return allowedOrigins.includes(origin) ? origin : false
  },
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
  maxAge: 86400 // 24 hours
})

// Security headers
export const securityHeaders = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.optia.com", "wss://api.optia.com"],
    fontSrc: ["'self'", "https:"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"]
  },
  crossOriginEmbedderPolicy: false, // Required for some edge environments
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'cross-origin',
  referrerPolicy: 'strict-origin-when-cross-origin'
})

// Request ID middleware
export const requestId = createMiddleware(async (c, next) => {
  const requestId = c.req.header('X-Request-ID') || crypto.randomUUID()
  c.set('requestId', requestId)
  c.header('X-Request-ID', requestId)
  await next()
})

// HTTPS redirect in production
export const httpsRedirect = createMiddleware(async (c, next) => {
  if (process.env.NODE_ENV === 'production') {
    const proto = c.req.header('x-forwarded-proto')
    if (proto && proto !== 'https') {
      const httpsUrl = c.req.url.replace('http://', 'https://')
      return c.redirect(httpsUrl, 301)
    }
  }
  await next()
})
```

## WooCommerce API Key Management

### Dual Key Strategy

The BFF uses separate read-only and read-write WooCommerce API keys for security:

```typescript
// src/services/woocommerce.ts
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api'

export class WooCommerceClient {
  private readOnlyClient: WooCommerceRestApi
  private readWriteClient: WooCommerceRestApi
  private lastKeyRotation: Date

  constructor() {
    this.readOnlyClient = this.createClient('read')
    this.readWriteClient = this.createClient('write')
    this.lastKeyRotation = new Date()
  }

  private createClient(type: 'read' | 'write'): WooCommerceRestApi {
    const keyVar = type === 'read' ? 'WC_CONSUMER_KEY_READ' : 'WC_CONSUMER_KEY_WRITE'
    const secretVar = type === 'read' ? 'WC_CONSUMER_SECRET_READ' : 'WC_CONSUMER_SECRET_WRITE'

    return new WooCommerceRestApi({
      url: process.env.WC_API_URL!,
      consumerKey: process.env[keyVar]!,
      consumerSecret: process.env[secretVar]!,
      version: 'wc/v3',
      queryStringAuth: true, // For HTTPS
      timeout: 30000,
      axiosConfig: {
        headers: {
          'User-Agent': 'Optia-BFF/1.0.0'
        }
      }
    })
  }

  // Read operations (use read-only key)
  async getProducts(params: any = {}) {
    return this.executeWithRetry(() => this.readOnlyClient.get('products', params))
  }

  async getProduct(id: number) {
    return this.executeWithRetry(() => this.readOnlyClient.get(`products/${id}`))
  }

  async getOrders(params: any = {}) {
    return this.executeWithRetry(() => this.readOnlyClient.get('orders', params))
  }

  async getOrder(id: number) {
    return this.executeWithRetry(() => this.readOnlyClient.get(`orders/${id}`))
  }

  async getCustomers(params: any = {}) {
    return this.executeWithRetry(() => this.readOnlyClient.get('customers', params))
  }

  // Write operations (use read-write key)
  async createOrder(orderData: any) {
    return this.executeWithRetry(() => this.readWriteClient.post('orders', orderData))
  }

  async updateOrder(id: number, orderData: any) {
    return this.executeWithRetry(() => this.readWriteClient.put(`orders/${id}`, orderData))
  }

  async updateProduct(id: number, productData: any) {
    return this.executeWithRetry(() => this.readWriteClient.put(`products/${id}`, productData))
  }

  async updateProductStock(id: number, stockData: any) {
    return this.executeWithRetry(() => 
      this.readWriteClient.put(`products/${id}`, {
        stock_quantity: stockData.stock_quantity,
        manage_stock: stockData.manage_stock,
        stock_status: stockData.stock_status
      })
    )
  }

  async createCustomer(customerData: any) {
    return this.executeWithRetry(() => this.readWriteClient.post('customers', customerData))
  }

  // Retry logic with exponential backoff
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on authentication errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw error
        }
        
        // Don't retry on client errors (4xx except auth)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          throw error
        }
        
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
          console.warn(`WooCommerce API attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError!
  }

  // Key rotation functionality
  async rotateKeys(newKeys: {
    readKey: string
    readSecret: string
    writeKey: string
    writeSecret: string
  }) {
    // Test new keys before switching
    const testReadClient = new WooCommerceRestApi({
      url: process.env.WC_API_URL!,
      consumerKey: newKeys.readKey,
      consumerSecret: newKeys.readSecret,
      version: 'wc/v3'
    })

    const testWriteClient = new WooCommerceRestApi({
      url: process.env.WC_API_URL!,
      consumerKey: newKeys.writeKey,
      consumerSecret: newKeys.writeSecret,
      version: 'wc/v3'
    })

    try {
      // Test read key
      await testReadClient.get('products', { per_page: 1 })
      
      // Test write key (create a test customer and delete it)
      const testCustomer = await testWriteClient.post('customers', {
        email: `test-${Date.now()}@example.com`,
        first_name: 'Test',
        last_name: 'User'
      })
      await testWriteClient.delete(`customers/${testCustomer.data.id}`, { force: true })

      // If tests pass, update clients
      this.readOnlyClient = testReadClient
      this.readWriteClient = testWriteClient
      this.lastKeyRotation = new Date()

      console.log('WooCommerce API keys rotated successfully')
      
      // Update environment variables (if using a secret manager)
      await this.updateSecrets(newKeys)

    } catch (error) {
      console.error('Key rotation failed:', error)
      throw new Error(`Key rotation failed: ${error.message}`)
    }
  }

  private async updateSecrets(keys: any) {
    // Implementation depends on your secret management system
    // This could be AWS Secrets Manager, Azure Key Vault, etc.
    console.log('Keys would be updated in secret manager here')
  }

  // Health check for API connectivity
  async healthCheck(): Promise<{ status: string; latency: number; error?: string }> {
    const startTime = Date.now()
    
    try {
      await this.readOnlyClient.get('', { _fields: 'name' }) // Get store info
      const latency = Date.now() - startTime
      
      return { status: 'healthy', latency }
    } catch (error) {
      const latency = Date.now() - startTime
      
      return { 
        status: 'unhealthy', 
        latency, 
        error: error.message 
      }
    }
  }
}

export const wcClient = new WooCommerceClient()
```

### API Key Security Best Practices

```typescript
// src/utils/keyManagement.ts
import crypto from 'crypto'

export class ApiKeyManager {
  // Generate secure API key
  static generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  // Hash API key for storage
  static hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex')
  }

  // Validate key strength
  static validateKeyStrength(key: string): boolean {
    return key.length >= 32 && /^[a-f0-9]+$/.test(key)
  }

  // Create API key with permissions
  static async createApiKey(data: {
    name: string
    permissions: string[]
    rateLimit?: number
    expiresAt?: Date
  }) {
    const apiKey = this.generateApiKey()
    const keyHash = this.hashApiKey(apiKey)

    const { error } = await supabase
      .from('api_keys')
      .insert({
        key_hash: keyHash,
        name: data.name,
        permissions: data.permissions,
        rate_limit: data.rateLimit || 1000,
        rate_window: 3600, // 1 hour
        expires_at: data.expiresAt?.toISOString()
      })

    if (error) {
      throw error
    }

    return {
      key: apiKey, // Only returned once!
      hash: keyHash,
      name: data.name
    }
  }

  // Revoke API key
  static async revokeApiKey(keyHash: string) {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('key_hash', keyHash)

    if (error) {
      throw error
    }
  }

  // Rotate API key
  static async rotateApiKey(oldKeyHash: string) {
    const { data: oldKey } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', oldKeyHash)
      .single()

    if (!oldKey) {
      throw new Error('API key not found')
    }

    // Create new key with same permissions
    const newKeyData = await this.createApiKey({
      name: `${oldKey.name} (rotated)`,
      permissions: oldKey.permissions,
      rateLimit: oldKey.rate_limit,
      expiresAt: oldKey.expires_at ? new Date(oldKey.expires_at) : undefined
    })

    // Deactivate old key
    await this.revokeApiKey(oldKeyHash)

    return newKeyData
  }
}
```

### Environment-based Key Management

```typescript
// src/config/keys.ts
export class KeyConfig {
  private static instance: KeyConfig
  private keys: Map<string, string> = new Map()

  private constructor() {
    this.loadKeys()
  }

  static getInstance(): KeyConfig {
    if (!KeyConfig.instance) {
      KeyConfig.instance = new KeyConfig()
    }
    return KeyConfig.instance
  }

  private loadKeys() {
    // Load from environment variables
    const envKeys = {
      'wc.read.key': process.env.WC_CONSUMER_KEY_READ,
      'wc.read.secret': process.env.WC_CONSUMER_SECRET_READ,
      'wc.write.key': process.env.WC_CONSUMER_KEY_WRITE,
      'wc.write.secret': process.env.WC_CONSUMER_SECRET_WRITE,
      'webhook.secret': process.env.WC_WEBHOOK_SECRET,
      'supabase.service': process.env.SUPABASE_SERVICE_KEY,
      'jwt.secret': process.env.SUPABASE_JWT_SECRET
    }

    for (const [key, value] of Object.entries(envKeys)) {
      if (value) {
        this.keys.set(key, value)
      }
    }
  }

  getKey(key: string): string {
    const value = this.keys.get(key)
    if (!value) {
      throw new Error(`Key not found: ${key}`)
    }
    return value
  }

  updateKey(key: string, value: string) {
    this.keys.set(key, value)
  }

  // Validate all required keys are present
  validateKeys(): { valid: boolean; missing: string[] } {
    const requiredKeys = [
      'wc.read.key',
      'wc.read.secret',
      'wc.write.key',
      'wc.write.secret',
      'webhook.secret',
      'supabase.service'
    ]

    const missing = requiredKeys.filter(key => !this.keys.has(key))
    
    return {
      valid: missing.length === 0,
      missing
    }
  }
}

export const keyConfig = KeyConfig.getInstance()
```

## Rate Limiting

### Distributed Rate Limiting Implementation

```typescript
// src/middleware/rateLimit.ts
import { createMiddleware } from 'hono/factory'
import { supabase } from '../services/supabase'

interface RateLimitConfig {
  requests: number
  window: number // seconds
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (c: Context) => string
}

export const rateLimit = (config: RateLimitConfig) => {
  return createMiddleware(async (c, next) => {
    const apiKey = c.get('apiKey')
    
    // Generate rate limit key
    const key = config.keyGenerator 
      ? config.keyGenerator(c)
      : apiKey?.id || c.req.header('x-forwarded-for') || 'anonymous'
    
    // Get rate limit settings (use API key limits if available)
    const limit = apiKey?.rateLimit || config.requests
    const window = apiKey?.rateWindow || config.window
    
    const now = Math.floor(Date.now() / 1000)
    const windowStart = now - window
    
    // Clean up old rate limit entries
    await supabase
      .from('rate_limits')
      .delete()
      .lt('created_at', new Date(windowStart * 1000).toISOString())
    
    // Count requests in current window
    const { data: requests, error } = await supabase
      .from('rate_limits')
      .select('count(*)')
      .eq('client_id', key)
      .gte('created_at', new Date(windowStart * 1000).toISOString())
      .single()
    
    if (error && error.code !== 'PGRST116') { // Not found is OK
      console.error('Rate limit check failed:', error)
      // Fail open - allow request if we can't check rate limit
      await next()
      return
    }
    
    const requestCount = requests?.count || 0
    
    if (requestCount >= limit) {
      const resetTime = now + window
      
      c.header('X-RateLimit-Limit', limit.toString())
      c.header('X-RateLimit-Remaining', '0')
      c.header('X-RateLimit-Reset', resetTime.toString())
      c.header('Retry-After', window.toString())
      
      return c.json({
        success: false,
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        limit,
        window,
        retry_after: window
      }, 429)
    }
    
    // Process request
    await next()
    
    // Log request (unless configured to skip)
    const shouldLog = !(
      (config.skipSuccessfulRequests && c.res.status < 400) ||
      (config.skipFailedRequests && c.res.status >= 400)
    )
    
    if (shouldLog) {
      await supabase
        .from('rate_limits')
        .insert({
          client_id: key,
          endpoint: c.req.path,
          method: c.req.method,
          status_code: c.res.status,
          user_agent: c.req.header('user-agent'),
          ip_address: c.req.header('x-forwarded-for')
        })
    }
    
    // Set rate limit headers
    c.header('X-RateLimit-Limit', limit.toString())
    c.header('X-RateLimit-Remaining', Math.max(0, limit - requestCount - 1).toString())
  })
}

// Preset rate limiting configurations
export const rateLimitPresets = {
  // Strict limits for unauthenticated requests
  public: rateLimit({
    requests: 100,
    window: 3600, // 1 hour
    skipSuccessfulRequests: false
  }),
  
  // More generous limits for authenticated API keys
  authenticated: rateLimit({
    requests: 1000,
    window: 3600, // 1 hour
    skipSuccessfulRequests: true
  }),
  
  // Very strict limits for expensive operations
  expensive: rateLimit({
    requests: 10,
    window: 600, // 10 minutes
    skipSuccessfulRequests: false
  }),
  
  // Per-IP rate limiting for webhooks
  webhook: rateLimit({
    requests: 1000,
    window: 3600,
    keyGenerator: (c) => `webhook:${c.req.header('x-forwarded-for')}`
  })
}

// Create rate limit table
/*
CREATE TABLE rate_limits (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  client_id VARCHAR(255) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_client_created ON rate_limits(client_id, created_at);
CREATE INDEX idx_rate_limits_cleanup ON rate_limits(created_at);
*/
```

### Advanced Rate Limiting Features

```typescript
// src/services/rateLimitService.ts
export class RateLimitService {
  // Sliding window rate limiter
  async checkSlidingWindow(
    key: string, 
    limit: number, 
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now()
    const windowStart = now - windowMs
    
    // Get requests in sliding window
    const { data: requests } = await supabase
      .from('rate_limits')
      .select('created_at')
      .eq('client_id', key)
      .gte('created_at', new Date(windowStart).toISOString())
      .order('created_at', { ascending: false })
    
    const requestCount = requests?.length || 0
    const allowed = requestCount < limit
    const remaining = Math.max(0, limit - requestCount)
    
    // Calculate reset time (when oldest request in window expires)
    let resetTime = now + windowMs
    if (requests && requests.length > 0) {
      const oldestRequest = new Date(requests[requests.length - 1].created_at).getTime()
      resetTime = oldestRequest + windowMs
    }
    
    return { allowed, remaining, resetTime }
  }
  
  // Token bucket rate limiter
  async checkTokenBucket(
    key: string, 
    capacity: number, 
    refillRate: number, 
    tokensRequested: number = 1
  ): Promise<{ allowed: boolean; tokensRemaining: number }> {
    const now = Date.now()
    
    // Get or create bucket
    let { data: bucket } = await supabase
      .from('token_buckets')
      .select('*')
      .eq('key', key)
      .single()
    
    if (!bucket) {
      // Create new bucket
      bucket = {
        key,
        tokens: capacity,
        last_refill: now,
        capacity,
        refill_rate: refillRate
      }
      
      await supabase
        .from('token_buckets')
        .insert(bucket)
    } else {
      // Refill tokens based on time elapsed
      const timeSinceRefill = now - new Date(bucket.last_refill).getTime()
      const tokensToAdd = Math.floor((timeSinceRefill / 1000) * refillRate)
      
      if (tokensToAdd > 0) {
        bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd)
        bucket.last_refill = now
        
        await supabase
          .from('token_buckets')
          .update({
            tokens: bucket.tokens,
            last_refill: new Date(now).toISOString()
          })
          .eq('key', key)
      }
    }
    
    const allowed = bucket.tokens >= tokensRequested
    
    if (allowed) {
      // Consume tokens
      bucket.tokens -= tokensRequested
      
      await supabase
        .from('token_buckets')
        .update({ tokens: bucket.tokens })
        .eq('key', key)
    }
    
    return { allowed, tokensRemaining: bucket.tokens }
  }
  
  // Adaptive rate limiting based on system load
  async getAdaptiveLimit(baseLimit: number): Promise<number> {
    // Check system metrics
    const { data: metrics } = await supabase
      .from('system_metrics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (!metrics) {
      return baseLimit
    }
    
    // Reduce limits if system is under stress
    const cpuUsage = metrics.cpu_usage || 0
    const memoryUsage = metrics.memory_usage || 0
    const errorRate = metrics.error_rate || 0
    
    let multiplier = 1.0
    
    if (cpuUsage > 80 || memoryUsage > 80 || errorRate > 0.05) {
      multiplier = 0.5 // Reduce limits by 50%
    } else if (cpuUsage > 60 || memoryUsage > 60 || errorRate > 0.02) {
      multiplier = 0.75 // Reduce limits by 25%
    }
    
    return Math.floor(baseLimit * multiplier)
  }
}

export const rateLimitService = new RateLimitService()
```

## Deployment

### Vercel Deployment

**Configuration Files:**

```json
// vercel.json
{
  "functions": {
    "src/index.ts": {
      "runtime": "nodejs20.x",
      "memory": 1024,
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/src/index.ts"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  "regions": ["iad1", "sfo1", "fra1", "sin1"],
  "crons": [
    {
      "path": "/api/v1/admin/cleanup",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/v1/admin/sync",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

```typescript
// src/index.ts - Vercel adapter
import { Hono } from 'hono'
import { handle } from '@hono/node-server/vercel'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

// Import routes
import { productsRouter } from './routes/products'
import { ordersRouter } from './routes/orders'
import { cartRouter } from './routes/cart'
import { webhooksRouter } from './routes/webhooks'
import { realtimeRouter } from './routes/realtime'
import { adminRouter } from './routes/admin'

// Import middleware
import { corsMiddleware, securityHeaders, requestId } from './middleware/security'
import { rateLimitPresets } from './middleware/rateLimit'

const app = new Hono()

// Global middleware
app.use('*', requestId)
app.use('*', logger())
app.use('*', corsMiddleware)
app.use('*', securityHeaders)

// Rate limiting
app.use('/api/v1/*', rateLimitPresets.authenticated)
app.use('/api/v1/webhooks/*', rateLimitPresets.webhook)

// Routes
app.route('/api/v1/products', productsRouter)
app.route('/api/v1/orders', ordersRouter)
app.route('/api/v1/cart', cartRouter)
app.route('/api/v1/webhooks', webhooksRouter)
app.route('/api/v1/realtime', realtimeRouter)
app.route('/api/v1/admin', adminRouter)

// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  })
})

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    available_endpoints: [
      '/api/v1/products',
      '/api/v1/orders', 
      '/api/v1/cart',
      '/api/health'
    ]
  }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  
  return c.json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    request_id: c.get('requestId')
  }, 500)
})

export default handle(app)
```

**Deployment Steps:**

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Set environment variables
vercel env add WC_API_URL
vercel env add WC_CONSUMER_KEY_READ
vercel env add WC_CONSUMER_SECRET_READ
# ... add all environment variables

# Custom domain setup
vercel domains add api.optia.com
vercel domains verify api.optia.com
```

### Netlify Deployment

**Configuration Files:**

```toml
# netlify.toml
[build]
  command = "npm run build"
  functions = "netlify/functions"
  publish = "dist"

[functions]
  node_bundler = "esbuild"
  directory = "src"
  included_files = ["src/**/*.ts"]

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/index/:splat"
  status = 200

[[headers]]
  for = "/api/*"
  [headers.values]
    Cache-Control = "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400"
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"

[context.production.environment]
  NODE_ENV = "production"

[context.deploy-preview.environment]
  NODE_ENV = "development"
```

```typescript
// netlify/functions/index.ts
import { Hono } from 'hono'
import { handle } from '@hono/node-server/netlify'

// Import your app
import { app } from '../../src/app'

export const handler = handle(app)
```

### Supabase Edge Functions

**Configuration:**

```toml
# supabase/config.toml
[functions.optia-bff]
verify_jwt = false
import_map = "./import_map.json"

[functions.optia-bff.env]
WC_API_URL = "env"
WC_CONSUMER_KEY_READ = "env"
WC_CONSUMER_SECRET_READ = "env"
```

```typescript
// supabase/functions/optia-bff/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

const app = new Hono()

app.use('*', cors({
  origin: ['https://yourfrontend.com'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}))

app.use('*', logger())

// Import routes
// ... your routes here

Deno.serve(app.fetch)
```

**Deploy Commands:**

```bash
# Deploy to Supabase
supabase functions deploy optia-bff --project-ref your-project-ref

# Set secrets
supabase secrets set WC_API_URL=https://yourstore.com/wp-json/wc/v3
supabase secrets set WC_CONSUMER_KEY_READ=your_read_key
# ... set all secrets

# Invoke function
supabase functions invoke optia-bff --project-ref your-project-ref
```

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy Optia BFF

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npm run type-check
      
      - name: Lint
        run: npm run lint
      
      - name: Run unit tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          WC_API_URL: ${{ secrets.WC_API_URL_TEST }}
          WC_CONSUMER_KEY_READ: ${{ secrets.WC_CONSUMER_KEY_READ_TEST }}
          WC_CONSUMER_SECRET_READ: ${{ secrets.WC_CONSUMER_SECRET_READ_TEST }}

  deploy-preview:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel Preview
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          github-comment: true

  deploy-production:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel Production
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
      
      - name: Deploy to Supabase (Backup)
        run: |
          npm install -g supabase
          supabase functions deploy optia-bff --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run security audit
        run: npm audit --audit-level moderate
      
      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
```

## Testing

### Unit Testing

```typescript
// tests/unit/products.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { testClient } from 'hono/testing'
import { productsRouter } from '../../src/routes/products'

// Mock dependencies
vi.mock('../../src/services/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: { id: 1, name: 'Test Product', price: '29.99' },
            error: null
          }))
        })),
        range: vi.fn(() => Promise.resolve({
          data: [{ id: 1, name: 'Test Product' }],
          error: null,
          count: 1
        }))
      }))
    }))
  }
}))

vi.mock('../../src/services/cache', () => ({
  cacheService: {
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve()),
    invalidateByTags: vi.fn(() => Promise.resolve())
  }
}))

describe('Products API', () => {
  let client: ReturnType<typeof testClient>

  beforeEach(() => {
    client = testClient(productsRouter)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /products', () => {
    it('should return products with pagination', async () => {
      const res = await client.index.$get({
        query: { page: '1', per_page: '20' }
      })

      expect(res.status).toBe(200)
      
      const data = await res.json()
      expect(data).toHaveProperty('data')
      expect(data).toHaveProperty('pagination')
      expect(Array.isArray(data.data)).toBe(true)
    })

    it('should handle search query', async () => {
      const res = await client.index.$get({
        query: { search: 'test product' }
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data).toBeDefined()
    })

    it('should validate pagination parameters', async () => {
      const res = await client.index.$get({
        query: { page: '-1', per_page: '1000' }
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
    })
  })

  describe('GET /products/:id', () => {
    it('should return product by ID', async () => {
      const res = await client[':id'].$get({
        param: { id: '1' }
      })

      expect(res.status).toBe(200)
      
      const data = await res.json()
      expect(data.data).toHaveProperty('id', 1)
      expect(data.data).toHaveProperty('name', 'Test Product')
    })

    it('should return 404 for non-existent product', async () => {
      // Mock error response
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Not found' } })
          })
        })
      }))

      const res = await client[':id'].$get({
        param: { id: '999' }
      })

      expect(res.status).toBe(404)
    })

    it('should validate ID parameter', async () => {
      const res = await client[':id'].$get({
        param: { id: 'invalid' }
      })

      expect(res.status).toBe(400)
    })
  })
})
```

### Integration Testing

```typescript
// tests/integration/api.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { testClient } from 'hono/testing'
import { createClient } from '@supabase/supabase-js'
import { app } from '../../src/index'

const supabaseTest = createClient(
  process.env.SUPABASE_TEST_URL!,
  process.env.SUPABASE_TEST_ANON_KEY!
)

describe('API Integration Tests', () => {
  let client: ReturnType<typeof testClient>
  let testApiKey: string

  beforeAll(async () => {
    client = testClient(app)
    
    // Create test API key
    const { data } = await supabaseTest
      .from('api_keys')
      .insert({
        key_hash: 'test_hash_123',
        name: 'Test API Key',
        permissions: ['products:read', 'orders:read'],
        rate_limit: 1000,
        is_active: true
      })
      .select()
      .single()
    
    testApiKey = 'test_key_123'
  })

  afterAll(async () => {
    // Cleanup test data
    await supabaseTest.from('api_keys').delete().eq('name', 'Test API Key')
    await supabaseTest.from('products').delete().neq('id', 0)
  })

  beforeEach(async () => {
    // Reset test data
    await supabaseTest.from('products').delete().neq('id', 0)
  })

  describe('Products API Integration', () => {
    it('should create, read, update, and delete products', async () => {
      // Create test product
      await supabaseTest
        .from('products')
        .insert({
          wc_id: 123,
          name: 'Integration Test Product',
          slug: 'integration-test-product',
          price: 29.99,
          status: 'publish'
        })

      // Test GET /products
      const listRes = await client.api.v1.products.$get(
        {},
        { headers: { 'X-API-Key': testApiKey } }
      )
      
      expect(listRes.status).toBe(200)
      const listData = await listRes.json()
      expect(listData.data).toHaveLength(1)
      expect(listData.data[0].name).toBe('Integration Test Product')

      // Test GET /products/:id
      const detailRes = await client.api.v1.products[':id'].$get(
        { param: { id: '123' } },
        { headers: { 'X-API-Key': testApiKey } }
      )
      
      expect(detailRes.status).toBe(200)
      const detailData = await detailRes.json()
      expect(detailData.data.wc_id).toBe(123)
    })

    it('should handle authentication correctly', async () => {
      // Test without API key
      const res1 = await client.api.v1.products.$get()
      expect(res1.status).toBe(401)

      // Test with invalid API key
      const res2 = await client.api.v1.products.$get(
        {},
        { headers: { 'X-API-Key': 'invalid_key' } }
      )
      expect(res2.status).toBe(401)

      // Test with valid API key
      const res3 = await client.api.v1.products.$get(
        {},
        { headers: { 'X-API-Key': testApiKey } }
      )
      expect(res3.status).toBe(200)
    })

    it('should handle rate limiting', async () => {
      // Make multiple requests quickly
      const promises = Array.from({ length: 10 }, () =>
        client.api.v1.products.$get(
          {},
          { headers: { 'X-API-Key': testApiKey } }
        )
      )

      const results = await Promise.all(promises)
      
      // All should succeed as we're within rate limit
      results.forEach(res => {
        expect(res.status).toBe(200)
      })

      // Check rate limit headers
      const lastResponse = results[results.length - 1]
      expect(lastResponse.headers.get('X-RateLimit-Limit')).toBeTruthy()
      expect(lastResponse.headers.get('X-RateLimit-Remaining')).toBeTruthy()
    })
  })

  describe('Webhook Integration', () => {
    it('should process product webhook correctly', async () => {
      const webhookPayload = {
        id: 456,
        name: 'Webhook Test Product',
        slug: 'webhook-test-product',
        status: 'publish',
        price: '39.99'
      }

      const signature = generateWebhookSignature(JSON.stringify(webhookPayload))

      const res = await client.api.v1.webhooks.woocommerce.$post(
        { json: webhookPayload },
        {
          headers: {
            'X-WC-Webhook-Signature': signature,
            'X-WC-Webhook-Topic': 'product.created',
            'X-WC-Webhook-Delivery-ID': 'test_delivery_123'
          }
        }
      )

      expect(res.status).toBe(200)

      // Verify product was synced to database
      const { data } = await supabaseTest
        .from('products')
        .select('*')
        .eq('wc_id', 456)
        .single()

      expect(data).toBeTruthy()
      expect(data.name).toBe('Webhook Test Product')
    })
  })
})

function generateWebhookSignature(payload: string): string {
  const crypto = require('crypto')
  return crypto
    .createHmac('sha256', process.env.WC_WEBHOOK_SECRET!)
    .update(payload)
    .digest('base64')
}
```

### End-to-End Testing

```typescript
// tests/e2e/user-flow.test.ts
import { test, expect } from '@playwright/test'

test.describe('E2E User Flows', () => {
  test('complete shopping flow', async ({ page, request }) => {
    // 1. Browse products
    const productsResponse = await request.get('/api/v1/products', {
      headers: { 'X-API-Key': process.env.TEST_API_KEY! }
    })
    expect(productsResponse.ok()).toBeTruthy()
    
    const products = await productsResponse.json()
    expect(products.data.length).toBeGreaterThan(0)
    
    const testProduct = products.data[0]

    // 2. Add to cart
    const cartResponse = await request.post(`/api/v1/cart/test_session/items`, {
      headers: { 
        'X-API-Key': process.env.TEST_API_KEY!,
        'Content-Type': 'application/json'
      },
      data: {
        product_id: testProduct.wc_id,
        quantity: 2,
        optimistic: true
      }
    })
    expect(cartResponse.ok()).toBeTruthy()
    
    const cartData = await cartResponse.json()
    expect(cartData.success).toBe(true)
    expect(cartData.optimistic).toBe(true)

    // 3. Get cart contents
    const getCartResponse = await request.get('/api/v1/cart/test_session', {
      headers: { 'X-API-Key': process.env.TEST_API_KEY! }
    })
    expect(getCartResponse.ok()).toBeTruthy()
    
    const cart = await getCartResponse.json()
    expect(cart.data.items.length).toBe(1)

    // 4. Create order
    const orderResponse = await request.post('/api/v1/orders', {
      headers: {
        'X-API-Key': process.env.TEST_API_KEY!,
        'Content-Type': 'application/json'
      },
      data: {
        billing: {
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
          address_1: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postcode: '12345',
          country: 'US'
        },
        line_items: [
          {
            product_id: testProduct.wc_id,
            quantity: 2
          }
        ],
        payment_method: 'payfast'
      }
    })
    expect(orderResponse.ok()).toBeTruthy()
    
    const order = await orderResponse.json()
    expect(order.success).toBe(true)
    expect(order.data.status).toBe('pending')
  })

  test('real-time updates flow', async ({ page }) => {
    // Navigate to test page with WebSocket connection
    await page.goto('/test-realtime')

    // Wait for WebSocket connection
    await page.waitForFunction(() => window.wsConnected === true)

    // Trigger a product update via API
    await page.request.post('/api/v1/admin/sync', {
      headers: { 'X-API-Key': process.env.TEST_ADMIN_API_KEY! }
    })

    // Wait for real-time update
    await page.waitForFunction(() => window.lastRealtimeMessage !== null)

    const message = await page.evaluate(() => window.lastRealtimeMessage)
    expect(message.event).toBe('product_updated')
  })
})
```

### Load Testing

```javascript
// tests/load/api-load.js (k6 script)
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

const errorRate = new Rate('errors')

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users  
    { duration: '2m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 200 },   // Stay at 200 users
    { duration: '5m', target: 500 },   // Ramp up to 500 users
    { duration: '10m', target: 500 },  // Stay at 500 users
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% under 500ms, 99% under 1s
    http_req_failed: ['rate<0.1'],                   // Error rate under 10%
    errors: ['rate<0.1'],                           // Custom error rate under 10%
  }
}

const BASE_URL = 'https://api.optia.com'
const API_KEY = __ENV.LOAD_TEST_API_KEY

export default function () {
  const headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  }

  // Test product listing (most common operation)
  let response = http.get(`${BASE_URL}/api/v1/products?page=1&per_page=20`, { headers })
  
  const success = check(response, {
    'products list status is 200': (r) => r.status === 200,
    'products list response time < 500ms': (r) => r.timings.duration < 500,
    'products list has data': (r) => {
      try {
        const data = JSON.parse(r.body)
        return data.success === true && Array.isArray(data.data)
      } catch {
        return false
      }
    }
  })

  if (!success) {
    errorRate.add(1)
  }

  // Test product detail (second most common)
  if (Math.random() < 0.7) { // 70% of users view product details
    const productId = Math.floor(Math.random() * 1000) + 1
    response = http.get(`${BASE_URL}/api/v1/products/${productId}`, { headers })
    
    check(response, {
      'product detail response time < 200ms': (r) => r.timings.duration < 200,
      'product detail status is 200 or 404': (r) => r.status === 200 || r.status === 404
    })
  }

  // Test search (moderate usage)
  if (Math.random() < 0.3) { // 30% of users search
    const searchTerms = ['wireless', 'phone', 'laptop', 'headphones', 'watch']
    const term = searchTerms[Math.floor(Math.random() * searchTerms.length)]
    
    response = http.get(`${BASE_URL}/api/v1/search?q=${term}`, { headers })
    
    check(response, {
      'search response time < 800ms': (r) => r.timings.duration < 800,
      'search status is 200': (r) => r.status === 200
    })
  }

  // Test cart operations (lower usage but important)
  if (Math.random() < 0.1) { // 10% of users interact with cart
    const sessionId = `load_test_${__VU}_${__ITER}`
    
    // Add to cart
    response = http.post(`${BASE_URL}/api/v1/cart/${sessionId}/items`, 
      JSON.stringify({
        product_id: Math.floor(Math.random() * 100) + 1,
        quantity: Math.floor(Math.random() * 3) + 1,
        optimistic: true
      }), 
      { headers }
    )
    
    check(response, {
      'add to cart response time < 300ms': (r) => r.timings.duration < 300,
      'add to cart status is 200': (r) => r.status === 200
    })

    // Get cart
    response = http.get(`${BASE_URL}/api/v1/cart/${sessionId}`, { headers })
    
    check(response, {
      'get cart response time < 200ms': (r) => r.timings.duration < 200,
      'get cart status is 200': (r) => r.status === 200
    })
  }

  // Realistic user behavior - pause between requests
  sleep(Math.random() * 2 + 1) // 1-3 seconds
}

// Spike testing scenario
export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true })
  }
}
```

## Monitoring

### Application Performance Monitoring

```typescript
// src/services/monitoring.ts
import { createClient } from '@supabase/supabase-js'

export class MonitoringService {
  private metrics: Map<string, number[]> = new Map()
  
  // Collect performance metrics
  async recordMetric(name: string, value: number, tags: Record<string, string> = {}) {
    const timestamp = Date.now()
    
    // Store in memory for aggregation
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(value)
    
    // Store in database for persistence
    await supabase
      .from('metrics')
      .insert({
        name,
        value,
        tags,
        timestamp: new Date(timestamp).toISOString()
      })
  }
  
  // Record request metrics
  async recordRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    cacheHit: boolean = false
  ) {
    await Promise.all([
      this.recordMetric('http_requests_total', 1, { method, path, status: statusCode.toString() }),
      this.recordMetric('http_request_duration_ms', duration, { method, path }),
      this.recordMetric('cache_hits_total', cacheHit ? 1 : 0, { path }),
      this.recordMetric('cache_misses_total', cacheHit ? 0 : 1, { path })
    ])
  }
  
  // Record business metrics
  async recordBusinessMetric(metric: string, value: number, metadata?: any) {
    await this.recordMetric(`business_${metric}`, value, metadata)
  }
  
  // Get metric aggregations
  async getMetricStats(name: string, timeRange: string = '1h'): Promise<{
    count: number
    avg: number
    min: number
    max: number
    p95: number
    p99: number
  }> {
    const values = this.metrics.get(name) || []
    
    if (values.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p95: 0, p99: 0 }
    }
    
    const sorted = [...values].sort((a, b) => a - b)
    const count = values.length
    const sum = values.reduce((a, b) => a + b, 0)
    
    return {
      count,
      avg: sum / count,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)]
    }
  }
  
  // Health check with detailed metrics
  async getHealthMetrics(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    metrics: Record<string, any>
    timestamp: string
  }> {
    const timestamp = new Date().toISOString()
    
    try {
      // Check database connectivity
      const dbStart = Date.now()
      await supabase.from('products').select('count(*)').limit(1).single()
      const dbLatency = Date.now() - dbStart
      
      // Check WooCommerce connectivity
      const wcStart = Date.now()
      const wcHealth = await wcClient.healthCheck()
      const wcLatency = Date.now() - wcStart
      
      // Get recent error rates
      const errorRate = await this.getRecentErrorRate()
      
      // Get cache hit ratio
      const cacheStats = await this.getCacheStats()
      
      // Determine overall health
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      
      if (dbLatency > 1000 || wcLatency > 2000 || errorRate > 0.05) {
        status = 'unhealthy'
      } else if (dbLatency > 500 || wcLatency > 1000 || errorRate > 0.02 || cacheStats.hitRatio < 0.7) {
        status = 'degraded'
      }
      
      return {
        status,
        metrics: {
          database: {
            status: dbLatency < 1000 ? 'healthy' : 'unhealthy',
            latency: dbLatency
          },
          woocommerce: {
            status: wcHealth.status,
            latency: wcHealth.latency,
            error: wcHealth.error
          },
          error_rate: errorRate,
          cache: cacheStats,
          memory_usage: process.memoryUsage(),
          uptime: process.uptime()
        },
        timestamp
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        metrics: { error: error.message },
        timestamp
      }
    }
  }
  
  private async getRecentErrorRate(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const { data: metrics } = await supabase
      .from('metrics')
      .select('name, value')
      .eq('name', 'http_requests_total')
      .gte('timestamp', oneHourAgo)
    
    if (!metrics || metrics.length === 0) return 0
    
    const totalRequests = metrics.reduce((sum, m) => sum + m.value, 0)
    const errorRequests = metrics
      .filter(m => m.tags?.status >= 400)
      .reduce((sum, m) => sum + m.value, 0)
    
    return totalRequests > 0 ? errorRequests / totalRequests : 0
  }
  
  private async getCacheStats(): Promise<{ hitRatio: number; hits: number; misses: number }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const { data: cacheMetrics } = await supabase
      .from('metrics')
      .select('name, value')
      .in('name', ['cache_hits_total', 'cache_misses_total'])
      .gte('timestamp', oneHourAgo)
    
    const hits = cacheMetrics
      ?.filter(m => m.name === 'cache_hits_total')
      .reduce((sum, m) => sum + m.value, 0) || 0
    
    const misses = cacheMetrics
      ?.filter(m => m.name === 'cache_misses_total')
      .reduce((sum, m) => sum + m.value, 0) || 0
    
    const total = hits + misses
    const hitRatio = total > 0 ? hits / total : 0
    
    return { hitRatio, hits, misses }
  }
}

export const monitoring = new MonitoringService()
```

### Request Monitoring Middleware

```typescript
// src/middleware/monitoring.ts
import { createMiddleware } from 'hono/factory'
import { monitoring } from '../services/monitoring'

export const monitoringMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now()
  const method = c.req.method
  const path = c.req.path
  const requestId = c.get('requestId')
  
  // Log request start
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Request started',
    request_id: requestId,
    method,
    path,
    user_agent: c.req.header('user-agent'),
    ip: c.req.header('x-forwarded-for')
  }))
  
  try {
    await next()
  } catch (error) {
    // Log error
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: 'Request failed',
      request_id: requestId,
      method,
      path,
      error: error.message,
      stack: error.stack
    }))
    
    // Record error metric
    await monitoring.recordMetric('errors_total', 1, {
      method,
      path,
      error_type: error.constructor.name
    })
    
    throw error
  } finally {
    const duration = Date.now() - start
    const status = c.res.status
    const cacheHit = c.res.headers.get('X-Cache-Status') === 'hit'
    
    // Log request completion
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Request completed',
      request_id: requestId,
      method,
      path,
      status,
      duration,
      cache_hit: cacheHit
    }))
    
    // Record metrics
    await monitoring.recordRequest(method, path, status, duration, cacheHit)
  }
})
```

### Dashboard & Alerting

```typescript
// src/routes/admin.ts - Monitoring dashboard endpoints
import { Hono } from 'hono'
import { monitoring } from '../services/monitoring'

const admin = new Hono()

// Real-time metrics dashboard
admin.get('/metrics/dashboard', async (c) => {
  const timeRange = c.req.query('range') || '1h'
  
  const [
    healthMetrics,
    requestStats,
    errorStats,
    cacheStats,
    businessStats
  ] = await Promise.all([
    monitoring.getHealthMetrics(),
    monitoring.getMetricStats('http_request_duration_ms', timeRange),
    monitoring.getMetricStats('errors_total', timeRange),
    monitoring.getCacheStats(),
    monitoring.getMetricStats('business_orders_total', timeRange)
  ])
  
  return c.json({
    health: healthMetrics,
    performance: {
      request_duration: requestStats,
      error_rate: errorStats,
      cache_performance: cacheStats
    },
    business: {
      orders: businessStats
    },
    timestamp: new Date().toISOString()
  })
})

// Metrics for Prometheus scraping
admin.get('/metrics/prometheus', async (c) => {
  const metrics = await generatePrometheusMetrics()
  
  c.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  return c.text(metrics)
})

async function generatePrometheusMetrics(): Promise<string> {
  const requestStats = await monitoring.getMetricStats('http_request_duration_ms')
  const errorStats = await monitoring.getMetricStats('errors_total')
  const cacheStats = await monitoring.getCacheStats()
  
  return `
# HELP http_requests_duration_seconds HTTP request duration in seconds
# TYPE http_requests_duration_seconds histogram
http_requests_duration_seconds_sum ${requestStats.avg * requestStats.count / 1000}
http_requests_duration_seconds_count ${requestStats.count}

# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total ${requestStats.count}

# HELP http_errors_total Total HTTP errors
# TYPE http_errors_total counter
http_errors_total ${errorStats.count}

# HELP cache_hit_ratio Cache hit ratio
# TYPE cache_hit_ratio gauge
cache_hit_ratio ${cacheStats.hitRatio}

# HELP cache_hits_total Total cache hits
# TYPE cache_hits_total counter
cache_hits_total ${cacheStats.hits}

# HELP cache_misses_total Total cache misses
# TYPE cache_misses_total counter
cache_misses_total ${cacheStats.misses}
  `.trim()
}

export { admin as adminRouter }
```

## Scaling Strategies

### Horizontal Scaling

```typescript
// Multi-region deployment configuration
const REGIONS = {
  'us-east-1': {
    name: 'US East',
    supabaseUrl: process.env.SUPABASE_US_EAST_URL,
    priority: 1
  },
  'eu-west-1': {
    name: 'EU West', 
    supabaseUrl: process.env.SUPABASE_EU_WEST_URL,
    priority: 2
  },
  'ap-southeast-1': {
    name: 'Asia Pacific',
    supabaseUrl: process.env.SUPABASE_AP_SOUTHEAST_URL,
    priority: 3
  }
}

// Regional failover logic
export class RegionalSupabaseClient {
  private clients: Map<string, SupabaseClient> = new Map()
  private currentRegion: string
  
  constructor() {
    // Initialize clients for all regions
    Object.entries(REGIONS).forEach(([region, config]) => {
      this.clients.set(region, createClient(config.supabaseUrl, process.env.SUPABASE_ANON_KEY!))
    })
    
    this.currentRegion = this.detectClosestRegion()
  }
  
  async query(operation: (client: SupabaseClient) => Promise<any>): Promise<any> {
    const sortedRegions = Object.entries(REGIONS)
      .sort(([,a], [,b]) => a.priority - b.priority)
    
    for (const [region] of sortedRegions) {
      try {
        const client = this.clients.get(region)!
        const result = await operation(client)
        
        // Update current region on success
        if (region !== this.currentRegion) {
          console.log(`Switched to region: ${region}`)
          this.currentRegion = region
        }
        
        return result
      } catch (error) {
        console.warn(`Region ${region} failed:`, error.message)
        
        // Try next region
        continue
      }
    }
    
    throw new Error('All regions failed')
  }
  
  private detectClosestRegion(): string {
    // Simple geo-detection based on CloudFlare headers or similar
    const country = process.env.CF_IPCOUNTRY || 'US'
    
    if (country.startsWith('US') || country.startsWith('CA')) {
      return 'us-east-1'
    } else if (country.startsWith('EU') || country.startsWith('GB')) {
      return 'eu-west-1'  
    } else {
      return 'ap-southeast-1'
    }
  }
}
```

### Database Read Replicas

```typescript
// Read replica configuration
export class DatabaseManager {
  private writeClient: SupabaseClient
  private readReplicas: SupabaseClient[]
  private replicaIndex: number = 0
  
  constructor() {
    this.writeClient = createClient(
      process.env.SUPABASE_WRITE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
    
    this.readReplicas = [
      createClient(process.env.SUPABASE_READ_REPLICA_1!, process.env.SUPABASE_ANON_KEY!),
      createClient(process.env.SUPABASE_READ_REPLICA_2!, process.env.SUPABASE_ANON_KEY!),
      createClient(process.env.SUPABASE_READ_REPLICA_3!, process.env.SUPABASE_ANON_KEY!)
    ].filter(client => client) // Filter out undefined replicas
  }
  
  // Read operations use replicas with round-robin
  async read(operation: (client: SupabaseClient) => Promise<any>): Promise<any> {
    if (this.readReplicas.length === 0) {
      return operation(this.writeClient)
    }
    
    const replica = this.readReplicas[this.replicaIndex]
    this.replicaIndex = (this.replicaIndex + 1) % this.readReplicas.length
    
    try {
      return await operation(replica)
    } catch (error) {
      console.warn('Read replica failed, falling back to primary:', error.message)
      return operation(this.writeClient)
    }
  }
  
  // Write operations always use primary
  async write(operation: (client: SupabaseClient) => Promise<any>): Promise<any> {
    return operation(this.writeClient)
  }
  
  // Health check all replicas
  async checkReplicaHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {}
    
    // Check primary
    try {
      await this.writeClient.from('products').select('count(*)').limit(1).single()
      health.primary = true
    } catch {
      health.primary = false
    }
    
    // Check replicas
    for (let i = 0; i < this.readReplicas.length; i++) {
      try {
        await this.readReplicas[i].from('products').select('count(*)').limit(1).single()
        health[`replica_${i + 1}`] = true
      } catch {
        health[`replica_${i + 1}`] = false
      }
    }
    
    return health
  }
}

export const dbManager = new DatabaseManager()
```

### Auto-scaling Configuration

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: optia-bff
spec:
  replicas: 3
  selector:
    matchLabels:
      app: optia-bff
  template:
    metadata:
      labels:
        app: optia-bff
    spec:
      containers:
      - name: optia-bff
        image: optia/bff:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: optia-bff-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: optia-bff
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
```

### Cost Optimization Strategies

```typescript
// Cost monitoring and optimization
export class CostOptimizer {
  private costLimits = {
    daily: parseFloat(process.env.DAILY_COST_LIMIT || '100'),
    monthly: parseFloat(process.env.MONTHLY_COST_LIMIT || '2000')
  }
  
  private currentCosts = {
    daily: 0,
    monthly: 0
  }
  
  async checkCostLimits(): Promise<{ withinLimits: boolean; actions: string[] }> {
    await this.updateCurrentCosts()
    
    const actions: string[] = []
    let withinLimits = true
    
    // Check daily limits
    if (this.currentCosts.daily > this.costLimits.daily * 0.8) {
      actions.push('REDUCE_CACHE_TTL')
      actions.push('INCREASE_RATE_LIMITS')
      withinLimits = false
    }
    
    if (this.currentCosts.daily > this.costLimits.daily * 0.9) {
      actions.push('DISABLE_NON_ESSENTIAL_FEATURES')
      withinLimits = false
    }
    
    if (this.currentCosts.daily > this.costLimits.daily) {
      actions.push('EMERGENCY_THROTTLING')
      withinLimits = false
    }
    
    return { withinLimits, actions }
  }
  
  async applyCostOptimizations(actions: string[]): Promise<void> {
    for (const action of actions) {
      switch (action) {
        case 'REDUCE_CACHE_TTL':
          await this.reduceCacheTTL()
          break
          
        case 'INCREASE_RATE_LIMITS':
          await this.increaseRateLimits()
          break
          
        case 'DISABLE_NON_ESSENTIAL_FEATURES':
          await this.disableNonEssentialFeatures()
          break
          
        case 'EMERGENCY_THROTTLING':
          await this.enableEmergencyThrottling()
          break
      }
    }
  }
  
  private async updateCurrentCosts(): Promise<void> {
    // Estimate costs based on usage metrics
    const metrics = await monitoring.getMetricStats('http_requests_total', '24h')
    
    // Rough cost calculation (adjust based on your pricing)
    const requestCost = 0.0001 // $0.0001 per request
    const dbCost = 0.01 // $0.01 per 1000 DB operations
    
    this.currentCosts.daily = (metrics.count * requestCost) + (metrics.count * 0.5 * dbCost)
  }
  
  private async reduceCacheTTL(): Promise<void> {
    // Reduce cache TTL to save on storage costs
    await supabase
      .from('cache_index')
      .update({ 
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
      })
      .gt('expires_at', new Date().toISOString())
  }
  
  private async increaseRateLimits(): Promise<void> {
    // Temporarily increase rate limits to reduce requests
    console.log('Increasing rate limits for cost optimization')
  }
  
  private async disableNonEssentialFeatures(): Promise<void> {
    // Disable features like real-time updates, detailed analytics
    console.log('Disabling non-essential features for cost optimization')
  }
  
  private async enableEmergencyThrottling(): Promise<void> {
    // Emergency throttling - reject non-critical requests
    console.log('Emergency throttling enabled')
  }
}

export const costOptimizer = new CostOptimizer()
```

## Fallback Plans

### WooCommerce Failover Strategy

```typescript
// Fallback when WooCommerce is unavailable
export class WooCommerceFallback {
  private isWooCommerceDown: boolean = false
  private lastHealthCheck: Date = new Date()
  
  async handleWooCommerceFailure(operation: string, params: any): Promise<any> {
    switch (operation) {
      case 'getProducts':
        return this.getProductsFromCache(params)
        
      case 'getProduct':
        return this.getProductFromCache(params.id)
        
      case 'createOrder':
        return this.queueOrderForLater(params)
        
      case 'updateStock':
        return this.queueStockUpdateForLater(params)
        
      default:
        throw new Error(`No fallback available for operation: ${operation}`)
    }
  }
  
  private async getProductsFromCache(params: any): Promise<any> {
    console.log('WooCommerce unavailable, serving products from cache')
    
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'publish')
      .range(
        (params.page - 1) * params.per_page,
        params.page * params.per_page - 1
      )
    
    if (error) throw error
    
    return {
      data: products,
      pagination: {
        page: params.page,
        per_page: params.per_page,
        total: products.length,
        from_cache: true,
        warning: 'Data may be stale due to WooCommerce unavailability'
      }
    }
  }
  
  private async getProductFromCache(id: number): Promise<any> {
    console.log(`WooCommerce unavailable, serving product ${id} from cache`)
    
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('wc_id', id)
      .single()
    
    if (error) throw error
    
    return {
      data: product,
      from_cache: true,
      warning: 'Data may be stale due to WooCommerce unavailability'
    }
  }
  
  private async queueOrderForLater(orderData: any): Promise<any> {
    console.log('WooCommerce unavailable, queueing order for later processing')
    
    // Generate temporary order ID
    const tempOrderId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Store order in queue
    await supabase
      .from('order_queue')
      .insert({
        temp_order_id: tempOrderId,
        order_data: orderData,
        status: 'queued',
        created_at: new Date().toISOString(),
        retry_count: 0
      })
    
    // Also store in local orders table for immediate response
    await supabase
      .from('orders')
      .insert({
        wc_id: 0, // Will be updated when processed
        order_key: tempOrderId,
        status: 'pending_wc_creation',
        currency: orderData.currency,
        total: parseFloat(orderData.total),
        subtotal: parseFloat(orderData.subtotal || orderData.total),
        billing: orderData.billing,
        shipping: orderData.shipping,
        line_items: orderData.line_items,
        date_created: new Date().toISOString(),
        date_modified: new Date().toISOString()
      })
    
    return {
      success: true,
      data: {
        id: tempOrderId,
        status: 'queued',
        message: 'Order queued for processing when WooCommerce becomes available',
        estimated_processing_time: '5-15 minutes'
      }
    }
  }
  
  async processQueuedOrders(): Promise<void> {
    if (this.isWooCommerceDown) {
      console.log('WooCommerce still down, skipping queue processing')
      return
    }
    
    const { data: queuedOrders } = await supabase
      .from('order_queue')
      .select('*')
      .eq('status', 'queued')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(10) // Process 10 at a time
    
    for (const queuedOrder of queuedOrders || []) {
      try {
        console.log(`Processing queued order: ${queuedOrder.temp_order_id}`)
        
        // Create order in WooCommerce
        const wcOrder = await wcClient.createOrder(queuedOrder.order_data)
        
        // Update local order with WooCommerce ID
        await supabase
          .from('orders')
          .update({
            wc_id: wcOrder.id,
            order_key: wcOrder.order_key,
            status: wcOrder.status,
            date_created: wcOrder.date_created,
            date_modified: wcOrder.date_modified
          })
          .eq('order_key', queuedOrder.temp_order_id)
        
        // Mark queue item as processed
        await supabase
          .from('order_queue')
          .update({
            status: 'processed',
            wc_order_id: wcOrder.id,
            processed_at: new Date().toISOString()
          })
          .eq('id', queuedOrder.id)
        
        console.log(`Successfully processed queued order: ${queuedOrder.temp_order_id} -> ${wcOrder.id}`)
        
      } catch (error) {
        console.error(`Failed to process queued order ${queuedOrder.temp_order_id}:`, error)
        
        // Increment retry count
        await supabase
          .from('order_queue')
          .update({
            retry_count: queuedOrder.retry_count + 1,
            last_error: error.message,
            last_retry_at: new Date().toISOString()
          })
          .eq('id', queuedOrder.id)
      }
    }
  }
  
  async checkWooCommerceHealth(): Promise<boolean> {
    try {
      const health = await wcClient.healthCheck()
      this.isWooCommerceDown = health.status !== 'healthy'
      this.lastHealthCheck = new Date()
      
      if (!this.isWooCommerceDown) {
        console.log('WooCommerce is healthy, processing queued orders')
        await this.processQueuedOrders()
      }
      
      return !this.isWooCommerceDown
    } catch (error) {
      this.isWooCommerceDown = true
      console.error('WooCommerce health check failed:', error)
      return false
    }
  }
}

export const woocommerceFallback = new WooCommerceFallback()

// Run health checks every 5 minutes
setInterval(() => {
  woocommerceFallback.checkWooCommerceHealth()
}, 5 * 60 * 1000)
```

### Database Failover

```typescript
// Database connection failover
export class DatabaseFailover {
  private connections: SupabaseClient[] = []
  private currentConnectionIndex: number = 0
  private connectionHealth: boolean[] = []
  
  constructor() {
    // Primary connection
    this.connections.push(
      createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
    )
    
    // Backup connections
    if (process.env.SUPABASE_BACKUP_URL) {
      this.connections.push(
        createClient(process.env.SUPABASE_BACKUP_URL, process.env.SUPABASE_SERVICE_KEY!)
      )
    }
    
    if (process.env.SUPABASE_BACKUP_URL_2) {
      this.connections.push(
        createClient(process.env.SUPABASE_BACKUP_URL_2, process.env.SUPABASE_SERVICE_KEY!)
      )
    }
    
    this.connectionHealth = new Array(this.connections.length).fill(true)
    
    // Start health monitoring
    this.startHealthMonitoring()
  }
  
  async executeQuery<T>(operation: (client: SupabaseClient) => Promise<T>): Promise<T> {
    const maxAttempts = this.connections.length
    let lastError: Error
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const connectionIndex = (this.currentConnectionIndex + attempt) % this.connections.length
      const client = this.connections[connectionIndex]
      
      if (!this.connectionHealth[connectionIndex]) {
        console.warn(`Skipping unhealthy connection ${connectionIndex}`)
        continue
      }
      
      try {
        const result = await operation(client)
        
        // Update current connection if we switched
        if (connectionIndex !== this.currentConnectionIndex) {
          console.log(`Switched to database connection ${connectionIndex}`)
          this.currentConnectionIndex = connectionIndex
        }
        
        return result
      } catch (error) {
        lastError = error as Error
        console.error(`Database connection ${connectionIndex} failed:`, error.message)
        
        // Mark connection as unhealthy
        this.connectionHealth[connectionIndex] = false
        
        continue
      }
    }
    
    throw new Error(`All database connections failed. Last error: ${lastError!.message}`)
  }
  
  private startHealthMonitoring(): void {
    setInterval(async () => {
      for (let i = 0; i < this.connections.length; i++) {
        try {
          await this.connections[i].from('products').select('count(*)').limit(1).single()
          
          if (!this.connectionHealth[i]) {
            console.log(`Database connection ${i} recovered`)
          }
          
          this.connectionHealth[i] = true
        } catch (error) {
          if (this.connectionHealth[i]) {
            console.error(`Database connection ${i} became unhealthy:`, error.message)
          }
          
          this.connectionHealth[i] = false
        }
      }
    }, 30000) // Check every 30 seconds
  }
  
  getConnectionStatus(): Array<{ index: number; healthy: boolean; url: string }> {
    return this.connections.map((client, index) => ({
      index,
      healthy: this.connectionHealth[index],
      url: client.supabaseUrl.replace(/\/\/[^@]*@/, '//***@') // Mask credentials
    }))
  }
}

export const dbFailover = new DatabaseFailover()
```

### Emergency Mode

```typescript
// Emergency mode configuration
export class EmergencyMode {
  private isEmergencyMode: boolean = false
  private emergencyStartTime?: Date
  
  async enableEmergencyMode(reason: string): Promise<void> {
    console.error(`EMERGENCY MODE ENABLED: ${reason}`)
    
    this.isEmergencyMode = true
    this.emergencyStartTime = new Date()
    
    // Notify administrators
    await this.notifyAdministrators(reason)
    
    // Reduce system load
    await this.reduceSystemLoad()
    
    // Enable maintenance mode responses
    await this.enableMaintenanceResponses()
  }
  
  async disableEmergencyMode(): Promise<void> {
    console.log('Emergency mode disabled')
    
    this.isEmergencyMode = false
    this.emergencyStartTime = undefined
    
    // Restore normal operations
    await this.restoreNormalOperations()
    
    // Notify administrators
    await this.notifyAdministrators('Emergency mode disabled - normal operations restored')
  }
  
  isInEmergencyMode(): boolean {
    return this.isEmergencyMode
  }
  
  getEmergencyDuration(): number {
    if (!this.isEmergencyMode || !this.emergencyStartTime) {
      return 0
    }
    
    return Date.now() - this.emergencyStartTime.getTime()
  }
  
  private async reduceSystemLoad(): Promise<void> {
    // Disable non-essential features
    // Increase cache TTL
    // Reduce rate limits
    // Disable real-time features
    console.log('Reducing system load for emergency mode')
  }
  
  private async enableMaintenanceResponses(): Promise<void> {
    // Return maintenance mode responses for non-critical endpoints
    console.log('Enabling maintenance mode responses')
  }
  
  private async restoreNormalOperations(): Promise<void> {
    // Re-enable all features
    // Restore normal cache TTL
    // Restore normal rate limits
    console.log('Restoring normal operations')
  }
  
  private async notifyAdministrators(message: string): Promise<void> {
    // Send alerts via Slack, email, SMS, etc.
    console.log(`ADMIN NOTIFICATION: ${message}`)
    
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Optia BFF Alert: ${message}`,
            channel: '#alerts',
            username: 'Optia BFF Monitor'
          })
        })
      } catch (error) {
        console.error('Failed to send Slack notification:', error)
      }
    }
  }
}

export const emergencyMode = new EmergencyMode()

// Emergency mode middleware
export const emergencyModeMiddleware = createMiddleware(async (c, next) => {
  if (emergencyMode.isInEmergencyMode()) {
    // Allow critical endpoints
    const criticalPaths = ['/api/health', '/api/v1/admin']
    const isCritical = criticalPaths.some(path => c.req.path.startsWith(path))
    
    if (!isCritical) {
      return c.json({
        success: false,
        error: 'Service temporarily unavailable',
        message: 'The system is currently in maintenance mode. Please try again later.',
        emergency_mode: true,
        duration_ms: emergencyMode.getEmergencyDuration()
      }, 503)
    }
  }
  
  await next()
})
```

## API Reference

### Complete Endpoint Documentation

#### Products Endpoints

**GET /api/v1/products**
```bash
curl -X GET "https://api.optia.com/api/v1/products" \
  -H "X-API-Key: your_api_key" \
  -H "Accept: application/json"
```

Query Parameters:
- `page` (integer, default: 1): Page number
- `per_page` (integer, default: 20, max: 100): Items per page
- `search` (string): Search term for products
- `category` (string): Filter by category slug
- `status` (enum): publish, draft, private (default: publish)
- `price_min` (number): Minimum price filter
- `price_max` (number): Maximum price filter
- `in_stock` (boolean): Filter by stock availability
- `sort` (enum): name, price, date, popularity (default: date)
- `order` (enum): asc, desc (default: desc)

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "wc_id": 123,
      "name": "Wireless Bluetooth Headphones",
      "slug": "wireless-bluetooth-headphones",
      "description": "High-quality wireless headphones with noise cancellation",
      "short_description": "Premium wireless headphones",
      "price": "129.99",
      "regular_price": "149.99",
      "sale_price": "129.99",
      "status": "publish",
      "stock_quantity": 45,
      "stock_status": "instock",
      "manage_stock": true,
      "categories": [
        {
          "id": 15,
          "name": "Electronics",
          "slug": "electronics"
        },
        {
          "id": 23,
          "name": "Audio",
          "slug": "audio"
        }
      ],
      "tags": ["wireless", "bluetooth", "headphones"],
      "images": [
        {
          "id": 456,
          "src": "https://store.com/wp-content/uploads/headphones-1.jpg",
          "alt": "Wireless Headphones Front View",
          "position": 0
        }
      ],
      "attributes": [
        {
          "name": "Color",
          "options": ["Black", "White", "Blue"]
        },
        {
          "name": "Battery Life",
          "options": ["30 hours"]
        }
      ],
      "variations": [
        {
          "id": 789,
          "attributes": {
            "color": "Black"
          },
          "price": "129.99",
          "stock_quantity": 20
        }
      ],
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false,
    "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNC0wMS0xNVQxNDozMDowMFoifQ=="
  },
  "filters": {
    "applied": {
      "category": "electronics",
      "price_min": 50,
      "in_stock": true
    },
    "available": {
      "categories": [
        { "slug": "electronics", "count": 45 },
        { "slug": "clothing", "count": 32 }
      ],
      "price_ranges": [
        { "min": 0, "max": 50, "count": 12 },
        { "min": 50, "max": 100, "count": 28 }
      ]
    }
  },
  "cache_status": "hit",
  "response_time_ms": 45
}
```

**GET /api/v1/products/{id}**
```bash
curl -X GET "https://api.optia.com/api/v1/products/123" \
  -H "X-API-Key: your_api_key"
```

Response:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "wc_id": 123,
    "name": "Wireless Bluetooth Headphones",
    // ... full product details
    "related_products": [
      {
        "id": 124,
        "name": "Wireless Earbuds",
        "price": "79.99",
        "image": "https://store.com/earbuds.jpg"
      }
    ],
    "cross_sells": [],
    "upsells": [
      {
        "id": 125,
        "name": "Premium Wireless Headphones",
        "price": "199.99"
      }
    ]
  },
  "cache_status": "hit",
  "response_time_ms": 32
}
```

#### Orders Endpoints

**POST /api/v1/orders**
```bash
curl -X POST "https://api.optia.com/api/v1/orders" \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "billing": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone": "+1-555-123-4567",
      "address_1": "123 Main Street",
      "address_2": "Apt 4B",
      "city": "New York",
      "state": "NY",
      "postcode": "10001",
      "country": "US"
    },
    "shipping": {
      "first_name": "John",
      "last_name": "Doe",
      "address_1": "123 Main Street",
      "city": "New York",
      "state": "NY",
      "postcode": "10001",
      "country": "US"
    },
    "line_items": [
      {
        "product_id": 123,
        "variation_id": 789,
        "quantity": 2,
        "price": "129.99"
      }
    ],
    "shipping_lines": [
      {
        "method_id": "flat_rate",
        "method_title": "Standard Shipping",
        "total": "9.99"
      }
    ],
    "coupon_lines": [
      {
        "code": "SAVE10",
        "discount": "25.99"
      }
    ],
    "payment_method": "payfast",
    "payment_method_title": "PayFast",
    "customer_note": "Please deliver after 5 PM",
    "meta_data": [
      {
        "key": "source",
        "value": "mobile_app"
      }
    ]
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "temp_1705234567890_abc123",
    "wc_id": null,
    "status": "pending",
    "currency": "USD",
    "total": "275.97",
    "subtotal": "259.98",
    "tax_total": "15.99",
    "shipping_total": "9.99",
    "discount_total": "25.99",
    "line_items": [
      {
        "id": "temp_item_1",
        "product_id": 123,
        "variation_id": 789,
        "name": "Wireless Bluetooth Headphones - Black",
        "quantity": 2,
        "price": "129.99",
        "total": "259.98",
        "image": "https://store.com/headphones.jpg"
      }
    ],
    "billing": { /* billing details */ },
    "shipping": { /* shipping details */ },
    "payment_method": "payfast",
    "date_created": "2024-01-15T16:30:00Z",
    "optimistic": false,
    "sync_status": "synced"
  },
  "response_time_ms": 234
}
```

#### Cart Endpoints

**POST /api/v1/cart/{session_id}/items**
```bash
curl -X POST "https://api.optia.com/api/v1/cart/session_abc123/items" \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 123,
    "variation_id": 789,
    "quantity": 2,
    "optimistic": true
  }'
```

Response (Optimistic):
```json
{
  "success": true,
  "optimistic": true,
  "data": {
    "item_id": "temp_1705234567890_def456",
    "product_id": 123,
    "variation_id": 789,
    "name": "Wireless Bluetooth Headphones - Black",
    "quantity": 2,
    "price": "129.99",
    "total": "259.98",
    "status": "pending_sync",
    "image": "https://store.com/headphones.jpg"
  },
  "cart_totals": {
    "subtotal": "259.98",
    "tax": "15.99",
    "shipping": "9.99",
    "discount": "0.00",
    "total": "285.96",
    "items_count": 2
  },
  "sync_job_id": "job_1705234567890",
  "response_time_ms": 45
}
```

### Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Validation Error",
  "message": "The provided data is invalid",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "email",
    "issue": "Invalid email format"
  },
  "request_id": "req_1705234567890_xyz789",
  "timestamp": "2024-01-15T16:30:00Z"
}
```

Common HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid API key)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `422` - Unprocessable Entity (business logic error)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
- `502` - Bad Gateway (upstream service error)
- `503` - Service Unavailable (maintenance mode)

## Troubleshooting

### Common Issues

**1. High Response Times**
```bash
# Check cache hit ratio
curl -H "X-API-Key: admin_key" https://api.optia.com/api/v1/admin/cache/stats

# Monitor database performance
curl -H "X-API-Key: admin_key" https://api.optia.com/api/v1/admin/health
```

Solutions:
- Increase cache TTL for stable data
- Add database indexes for slow queries
- Enable connection pooling
- Scale read replicas

**2. Rate Limiting Issues**
```bash
# Check current rate limits
curl -I https://api.optia.com/api/v1/products

# Headers returned:
# X-RateLimit-Limit: 1000
# X-RateLimit-Remaining: 995
# X-RateLimit-Reset: 1705237200
```

Solutions:
- Implement exponential backoff
- Use different API keys for different services
- Cache responses on client side
- Implement request queuing

**3. WooCommerce Sync Issues**
```bash
# Check webhook logs
curl -H "X-API-Key: admin_key" https://api.optia.com/api/v1/webhooks/logs

# Manually trigger sync
curl -X POST -H "X-API-Key: admin_key" https://api.optia.com/api/v1/admin/sync
```

**4. Real-time Connection Problems**
```javascript
// Client-side debugging
const ws = new WebSocket('wss://api.optia.com/api/v1/realtime/subscribe')

ws.onopen = () => console.log('Connected')
ws.onerror = (error) => console.error('WebSocket error:', error)
ws.onclose = (event) => console.log('Disconnected:', event.code, event.reason)
```

### Performance Optimization Checklist

- [ ] Enable CDN caching for static responses
- [ ] Implement database query optimization
- [ ] Use connection pooling
- [ ] Enable gzip compression
- [ ] Optimize image delivery
- [ ] Implement proper cache invalidation
- [ ] Monitor and optimize memory usage
- [ ] Use database read replicas
- [ ] Implement request batching
- [ ] Enable HTTP/2

### Monitoring Dashboard

Access the admin dashboard for real-time monitoring:

```bash
# Get dashboard data
curl -H "X-API-Key: admin_key" https://api.optia.com/api/v1/admin/metrics/dashboard

# Response includes:
# - System health status
# - Performance metrics
# - Error rates
# - Cache statistics
# - Business metrics
```

---

## Conclusion

The Optia BFF provides a comprehensive, production-ready solution for connecting WooCommerce with modern frontend applications. With its robust caching strategy, real-time synchronization, optimistic UI support, and comprehensive monitoring, it ensures optimal performance and reliability for e-commerce applications.

For support and contributions, please visit our [GitHub repository](https://github.com/your-org/optia-bff) or contact our development team.

**Version:** 1.0.0  
**Last Updated:** January 2024  
**License:** MIT