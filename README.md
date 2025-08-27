# 🔮 Optia BFF API - Complete Production Documentation

A high-performance Backend-for-Frontend (BFF) API designed for optical/eyewear e-commerce, built with Node.js, TypeScript, Hono, Prisma, and PostgreSQL. Seamlessly integrates with WordPress/WooCommerce to provide a modern API layer for optical products, prescriptions, and e-commerce operations.

## 📋 Table of Contents

- [🚀 Quick Start](#-quick-start)
- [🏗️ Architecture Overview](#️-architecture-overview)
- [📁 Project Structure](#-project-structure)
- [⚙️ Configuration](#️-configuration)
- [🔌 API Documentation](#-api-documentation)
- [🚀 Deployment](#-deployment)
- [🧪 Testing](#-testing)
- [📊 Monitoring](#-monitoring)
- [🔒 Security](#-security)
- [🌟 Features](#-features)

---

## 🚀 Quick Start

### Prerequisites

| Component | Version | Required |
|-----------|---------|----------|
| Node.js | 20+ | ✅ |
| PostgreSQL | 15+ | ✅ |
| Redis | 7+ | Optional |
| WordPress | Latest | Optional |
| WooCommerce | Latest | Optional |

### Installation

```bash
# Clone and install
git clone <your-repo>
cd optia-app
npm ci

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Database setup (separate from app deployment)
npm run migrate

# Generate Prisma client
npx prisma generate

# Start development
npm run dev

# Or production build
npm run build
npm start
```

---

## 🏗️ Architecture Overview

### Core Technologies
- **Framework**: Hono.js (Ultra-fast web framework)
- **Runtime**: Node.js 20+ with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Multi-tier (Memory + Redis)
- **Monitoring**: Prometheus metrics + OpenTelemetry
- **Security**: JWT auth, rate limiting, input validation

### Architecture Patterns
- **BFF Pattern**: Backend-for-Frontend optimized for optical e-commerce
- **Layered Architecture**: Routes → Services → Database
- **Cache-Aside Pattern**: Multi-tier caching with SWR
- **Circuit Breaker**: Graceful degradation for external services
- **Event-Driven**: Webhook handling for real-time sync

---

## 📁 Project Structure

```
optia-app/
├── 🚀 Core Application
│   ├── src/
│   │   ├── index.ts                 # Application entry point & server setup
│   │   ├── config/
│   │   │   └── env.ts              # Environment configuration & validation
│   │   ├── lib/
│   │   │   └── db.ts               # Prisma database client setup
│   │   └── types/
│   │       └── index.ts            # TypeScript type definitions
│   │
│   ├── 🛡️ Security & Middleware
│   │   ├── middleware/
│   │   │   ├── apiKey.ts           # API key validation middleware
│   │   │   ├── auth.ts             # JWT authentication middleware
│   │   │   ├── rateLimiter.ts      # Rate limiting protection
│   │   │   └── validateRequest.ts   # Request validation with Zod
│   │
│   ├── 🔌 API Routes
│   │   ├── routes/
│   │   │   ├── health.ts           # Health checks & system status
│   │   │   ├── auth.ts             # Authentication & JWT management
│   │   │   ├── products.ts         # Product catalog & search
│   │   │   ├── categories.ts       # Product categorization
│   │   │   ├── cart.ts             # Shopping cart operations
│   │   │   ├── orders.ts           # Order management
│   │   │   ├── customers.ts        # Customer data & profiles
│   │   │   ├── reviews.ts          # Product reviews & ratings
│   │   │   ├── sync.ts             # Data synchronization with WooCommerce
│   │   │   ├── webhooks.ts         # Webhook event handling
│   │   │   ├── wordpress.ts        # WordPress content integration
│   │   │   └── woocommerce.ts      # WooCommerce e-commerce integration
│   │
│   ├── 🔧 Business Services
│   │   ├── services/
│   │   │   ├── cacheService.ts     # Multi-tier caching (L1/L2/Redis)
│   │   │   ├── databaseService.ts  # Database operations & queries
│   │   │   ├── productService.ts   # Product business logic
│   │   │   ├── syncService.ts      # Data synchronization engine
│   │   │   ├── transformationService.ts # Data transformation utilities
│   │   │   ├── webhookService.ts   # Webhook processing & validation
│   │   │   ├── wooCommerceService.ts # WooCommerce business logic
│   │   │   ├── wooRestApiClient.ts # WooCommerce REST API client
│   │   │   ├── wooStoreApiClient.ts # WooCommerce Store API client
│   │   │   └── wpGraphqlClient.ts  # WordPress GraphQL client
│   │
│   ├── 🛠️ Utilities
│   │   ├── utils/
│   │   │   ├── logger.ts           # Structured logging with Winston
│   │   │   ├── cacheKey.ts         # Cache key generation utilities
│   │   │   └── sanitizeHtml.ts     # HTML/URL sanitization
│   │
│   ├── 📊 Observability
│   │   └── observability/
│   │       └── tracing.ts          # OpenTelemetry distributed tracing
│   │
│   └── 🧪 Testing
│       └── __tests__/
│           ├── auth.test.ts        # Authentication tests
│           ├── authRefresh.test.ts # JWT refresh token tests
│           ├── products.test.ts    # Product API tests
│           ├── health.test.ts      # Health check tests
│           ├── cacheKey.test.ts    # Cache utilities tests
│           ├── rateLimiter.test.ts # Rate limiting tests
│           ├── validateRequest.test.ts # Request validation tests
│           └── adminInvalidate.test.ts # Cache invalidation tests
│
├── 🗄️ Database
│   └── prisma/
│       └── schema.prisma           # Complete PostgreSQL schema (60+ tables)
│
├── 🐳 Deployment
│   ├── Dockerfile                 # Multi-stage production Docker build
│   ├── docker-compose.yml         # Local development setup
│   ├── coolify.json              # Coolify deployment configuration
│   └── scripts/
│       └── start-production.sh    # Production startup script
│
├── ⚙️ Configuration
│   ├── package.json              # Dependencies & scripts
│   ├── tsconfig.json             # TypeScript configuration
│   ├── eslint.config.js          # ESLint rules & formatting
│   ├── jest.config.json          # Jest testing configuration
│   ├── jest.setup.js             # Test environment setup
│   └── .env.example              # Environment variables template
│
└── 📚 Documentation
    └── README.md                 # This comprehensive guide
```

---

## ⚙️ Configuration

### Required Environment Variables

```bash
# 🔗 Database (Required)
DATABASE_URL=postgresql://user:password@host:5432/optia_app?schema=public

# 🔐 Security (Required)
JWT_SECRET=your-256-bit-secret-key
API_KEY=your-api-key-for-admin-endpoints

# 🌐 Server Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
```

### WordPress/WooCommerce Integration (Optional)

```bash
# 📝 WordPress
WP_BASE_URL=https://your-wordpress-site.com
WP_GRAPHQL_ENDPOINT=https://your-wordpress-site.com/graphql

# 🛒 WooCommerce
WOO_CONSUMER_KEY=ck_your_consumer_key_here
WOO_CONSUMER_SECRET=cs_your_consumer_secret_here
WOO_STORE_API_URL=https://your-site.com/wp-json/wc/store/v1

# 🔗 Webhooks
WOO_WEBHOOK_SECRET=wh_your_webhook_secret
```

### Performance & Caching (Optional)

```bash
# 📦 Redis Caching
REDIS_URL=redis://localhost:6379

# ⏱️ Cache TTL (seconds)
CACHE_TTL_PRODUCTS=300
CACHE_TTL_PRODUCT_DETAIL=600
CACHE_TTL_CATEGORIES=900

# 🛡️ Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

# 🔗 External Requests
REQUEST_TIMEOUT_MS=10000
PGPOOLSIZE=10

# 🌐 CORS
CORS_ORIGIN=https://your-frontend-domain.com
```

### Degraded Mode
If WordPress/WooCommerce variables are missing, the service runs in **degraded mode**:
- ✅ Core product/database endpoints remain functional
- ❌ `/wordpress` and `/woocommerce` routes are disabled
- 📊 Health checks report `wordpress=disabled`
- 🔄 Automatic fallback ensures high availability

---

## 🔌 API Documentation

### 🏥 Health & System

| Endpoint | Method | Purpose | Response Time |
|----------|--------|---------|---------------|
| `/health` | GET | Basic health check | <10ms |
| `/health/live` | GET | Kubernetes liveness probe | <5ms |
| `/health/ready` | GET | Kubernetes readiness probe | <50ms |
| `/metrics` | GET | Prometheus metrics | <20ms |

### 🔐 Authentication

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/auth/login` | POST | User authentication | ❌ |
| `/auth/refresh` | POST | Token refresh | ✅ |
| `/auth/logout` | POST | User logout | ✅ |
| `/auth/validate` | GET | Token validation | ✅ |

### 🛍️ E-commerce Core

| Endpoint | Method | Purpose | Cache TTL |
|----------|--------|---------|-----------|
| `/products` | GET | Product listing | 300s |
| `/products/:id` | GET | Product details | 600s |
| `/products/search` | GET | Product search | 180s |
| `/categories` | GET | Category tree | 900s |
| `/categories/:id` | GET | Category details | 600s |

### 🛒 Shopping Experience

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/cart` | GET/POST/PUT/DELETE | Cart management | ✅ |
| `/orders` | GET/POST | Order operations | ✅ |
| `/customers/:id` | GET/PUT | Customer profiles | ✅ |
| `/reviews` | GET/POST | Product reviews | ✅ |

### 🔄 Data Synchronization

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/sync/products` | POST | Sync products from WooCommerce | 🔑 API Key |
| `/sync/categories` | POST | Sync categories | 🔑 API Key |
| `/sync/status` | GET | Check sync status | 🔑 API Key |
| `/sync/full` | POST | Full data synchronization | 🔑 API Key |

### 🔗 Webhooks

| Endpoint | Method | Purpose | Security |
|----------|--------|---------|----------|
| `/webhooks/woocommerce` | POST | WooCommerce events | HMAC SHA256 |
| `/webhooks/wordpress` | POST | WordPress events | HMAC SHA256 |

### 📊 Performance Targets

| Operation Type | Target Response Time | SLA |
|----------------|---------------------|-----|
| Health checks | <50ms | 99.9% |
| Cached responses | <5ms | 99.5% |
| Fresh data queries | <150ms | 99% |
| Database operations | <10ms avg | 95% |

---

## 🚀 Deployment

### 🐳 Docker Deployment

```bash
# Build production image
docker build -t optia-bff .

# Run with environment
docker run --env-file .env -p 3000:3000 optia-bff
```

### ☁️ Coolify Deployment (Enterprise)

1. **Create New Service** in Coolify
2. **Set Build Configuration**:
   ```yaml
   Build Command: npm run build
   Start Command: npm start  # Uses enterprise deployment
   Port: 3000
   Health Check: /health/live
   ```
3. **Configure Environment Variables** (see Configuration section)
4. **Deploy** - App starts immediately (no database blocking)

### 🔄 Enterprise Database Migration Pipeline

```bash
# Separate migration deployment (recommended)
npm run migrate  # Run in CI/CD or manually

# Legacy approach (not recommended for production)
npm run migrate:deploy  # Direct Prisma migration

# Manual migration
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### 📋 Production Checklist

#### Pre-Deployment
- [ ] PostgreSQL database created
- [ ] Environment variables configured
- [ ] SSL certificates configured
- [ ] Domain DNS configured
- [ ] WooCommerce API keys generated
- [ ] Webhook secrets configured

#### Post-Deployment Verification
- [ ] Health checks passing (`/health`)
- [ ] Database connectivity (`/health/ready`)
- [ ] Metrics endpoint accessible (`/metrics`)
- [ ] Authentication working (`/auth/login`)
- [ ] Product data syncing (`/sync/status`)
- [ ] Webhooks receiving events

#### Monitoring Setup
- [ ] Prometheus metrics collection
- [ ] Log aggregation configured
- [ ] Error tracking (Sentry) integrated
- [ ] Uptime monitoring enabled
- [ ] Performance dashboards created

---

## 🧪 Testing

### Test Coverage

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage

# Specific test suites
npm run test:unit      # Unit tests only
npm run test:integration  # Integration tests only
```

### Test Structure

| Test Suite | Purpose | Coverage |
|------------|---------|----------|
| `auth.test.ts` | Authentication flows | JWT, refresh, validation |
| `products.test.ts` | Product operations | CRUD, search, caching |
| `health.test.ts` | Health monitoring | Liveness, readiness, metrics |
| `cacheKey.test.ts` | Cache utilities | Key generation, invalidation |
| `rateLimiter.test.ts` | Rate limiting | Throttling, quotas |
| `validateRequest.test.ts` | Input validation | Zod schemas, sanitization |

### Performance Testing

```bash
# Load testing with Apache Bench
ab -n 1000 -c 10 http://localhost:3000/health

# Stress testing products endpoint
ab -n 5000 -c 50 http://localhost:3000/products

# Monitoring during tests
watch -n 1 'curl -s http://localhost:3000/metrics | grep -E "(http_requests|cache_hits)"'
```

---

## 📊 Monitoring

### 📈 Metrics Exposed

#### Application Metrics
```prometheus
# HTTP Request metrics
http_requests_total{method, status, route}
http_request_duration_seconds{method, route}

# Cache Performance
cache_hits_total{tier="l1|l2|redis"}
cache_misses_total{tier}
cache_evictions_total{tier}
cache_memory_usage_bytes{tier}

# Rate Limiting
rate_limiter_rejections_total{category}
rate_limiter_requests_total{category}

# Database
db_connections_active
db_query_duration_seconds{operation}
```

#### Business Metrics
```prometheus
# E-commerce
products_synchronized_total
orders_processed_total
cart_operations_total{operation}

# Webhooks
webhook_events_received_total{source}
webhook_processing_duration_seconds
```

### 🔍 Health Checks

| Endpoint | Type | Checks | Use Case |
|----------|------|--------|----------|
| `/health/live` | Liveness | Server responsive | Kubernetes liveness probe |
| `/health/ready` | Readiness | DB + Redis + WP connectivity | Load balancer health |
| `/health` | Detailed | All dependencies + metrics | Comprehensive monitoring |

### 📊 Observability Stack

#### Logs
- **Format**: Structured JSON with Winston
- **Levels**: error, warn, info, debug
- **Context**: Request ID, user ID, operation
- **Aggregation**: ELK Stack / Grafana Loki

#### Traces (Optional)
- **OpenTelemetry** integration
- **Spans**: HTTP requests, database queries, external calls
- **Export**: Jaeger / Zipkin / Grafana Tempo

#### Alerting
```yaml
# Sample Prometheus alerts
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
  
- alert: CacheHitRateLow
  expr: rate(cache_hits_total[5m]) / rate(cache_requests_total[5m]) < 0.8
  
- alert: DatabaseConnectionsHigh
  expr: db_connections_active > 50
```

---

## 🔒 Security

### 🛡️ Security Features

#### Authentication & Authorization
- ✅ **JWT Authentication** with RS256 signing
- ✅ **Refresh Token Rotation** for enhanced security
- ✅ **API Key Protection** for admin endpoints
- ✅ **Role-based Access Control** (RBAC)

#### Input Validation & Sanitization
- ✅ **Zod Schema Validation** for all inputs
- ✅ **HTML Sanitization** with DOMPurify
- ✅ **SQL Injection Protection** via Prisma ORM
- ✅ **XSS Prevention** with content sanitization

#### Network Security
- ✅ **Rate Limiting** (1000 req/min default)
- ✅ **CORS Protection** with origin validation
- ✅ **Security Headers** via Helmet.js
- ✅ **Request Size Limits** to prevent DoS

#### Data Protection
- ✅ **Environment Variable Encryption**
- ✅ **Sensitive Data Masking** in logs
- ✅ **Database Connection Encryption**
- ✅ **HTTPS Enforcement** in production

### 🔐 Security Configuration

```bash
# JWT Configuration
JWT_SECRET=your-256-bit-secret  # Use: openssl rand -hex 32
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# API Security
API_KEY=your-api-key-here  # Use: openssl rand -hex 32
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=60000

# Webhook Security
WOO_WEBHOOK_SECRET=your-webhook-secret
WEBHOOK_SIGNATURE_TOLERANCE=300  # 5 minutes
```

### 🛡️ Security Hardening Checklist

#### Application Level
- [ ] Change all default secrets
- [ ] Configure CORS origins restrictively
- [ ] Enable request logging for audit
- [ ] Set up error monitoring (Sentry)
- [ ] Configure rate limiting per endpoint
- [ ] Validate all webhook signatures

#### Infrastructure Level
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Enable fail2ban (server level)
- [ ] Set up intrusion detection
- [ ] Configure log rotation
- [ ] Enable automated security updates

#### Database Level
- [ ] Use connection encryption
- [ ] Configure database firewall
- [ ] Set up read-only replicas
- [ ] Enable query logging
- [ ] Regular security audits
- [ ] Backup encryption

---

## 🌟 Features

### 🛍️ E-commerce Features

#### Product Management
- ✨ **Rich Product Catalog** with images, variations, and specifications
- 🔍 **Advanced Search** with filters, sorting, and pagination
- 📂 **Category Hierarchy** with nested categorization
- 💰 **Dynamic Pricing** with currency support
- 📊 **Inventory Tracking** with stock management
- 🏷️ **Product Attributes** for optical specifications

#### Shopping Experience
- 🛒 **Persistent Shopping Cart** with session management
- 💳 **Order Management** with status tracking
- 👤 **Customer Profiles** with order history
- ⭐ **Product Reviews** with ratings and feedback
- 📧 **Email Notifications** for order updates
- 📱 **Mobile-Optimized** responsive design

### 🔧 Technical Features

#### Performance
- ⚡ **Multi-Tier Caching** (L1 Memory + L2 LRU + L3 Redis)
- 🔄 **Stale-While-Revalidate** pattern for optimal UX
- 📊 **Connection Pooling** with configurable limits
- 🚀 **HTTP/2 Support** for improved performance
- 📦 **Response Compression** with gzip/brotli
- 🔍 **Query Optimization** with explain analysis

#### Reliability
- 🔄 **Graceful Degradation** when external services fail
- ♻️ **Automatic Retry Logic** with exponential backoff
- 🔧 **Circuit Breaker Pattern** for external API calls
- 💾 **Data Consistency** with transaction management
- 🔄 **Background Job Processing** with ActionScheduler
- 📈 **Horizontal Scaling** support

#### Integration
- 🔗 **WordPress Integration** via REST API and GraphQL
- 🛒 **WooCommerce Sync** with real-time webhooks
- 📡 **Webhook Processing** with signature validation
- 🔄 **Bidirectional Sync** for data consistency
- 📊 **Event-Driven Architecture** for real-time updates
- 🔌 **Plugin Ecosystem** support

### 🏥 Optical Industry Specific

#### Product Features
- 👓 **Lens Types Management** (single vision, progressive, bifocal)
- 🌈 **Lens Coatings** (anti-reflective, UV protection, blue light)
- 📏 **Lens Thickness Options** with pricing tiers
- 🎨 **Tints & Colors** with customization options
- 📋 **Prescription Management** with validation
- 🔍 **Frame Specifications** (size, material, brand)

#### Business Logic
- 💰 **Dynamic Pricing** based on lens options and coatings
- 📊 **Inventory Sync** for optical products
- 🔄 **Real-time Updates** from WooCommerce
- 📈 **Analytics Integration** for business insights
- 🛡️ **HIPAA Compliance** considerations for prescription data
- 📱 **Multi-channel Support** (web, mobile, in-store)

---

## 🤝 Contributing

### Development Setup

```bash
# Fork and clone the repository
git clone <your-fork>
cd optia-app

# Install dependencies
npm ci

# Set up development environment
cp .env.example .env.local
# Edit .env.local with your local settings

# Start development server
npm run dev

# Run tests
npm test

# Check code quality
npm run lint
npm run type-check
```

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration with custom rules
- **Prettier**: Automatic code formatting
- **Husky**: Pre-commit hooks for quality gates
- **Conventional Commits**: Standardized commit messages

### Pull Request Process

1. Create feature branch from `main`
2. Implement changes with tests
3. Ensure all tests pass
4. Update documentation if needed
5. Submit PR with clear description
6. Address review feedback
7. Merge after approval

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🆘 Support & Contact

- **Issues**: [GitHub Issues](https://github.com/your-org/optia-app/issues)
- **Documentation**: [Wiki](https://github.com/your-org/optia-app/wiki)
- **Security**: security@your-domain.com
- **General**: support@your-domain.com

---

*Built with ❤️ for the optical industry*