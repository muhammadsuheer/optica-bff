# Optica BFF (Production)

Lean Backend-for-Frontend for WooCommerce + WordPress with PostgreSQL, Redis caching and Hono.
## 1. Runtime Requirements
| Component | Version |
|----------|---------|
| Node.js  | 20+ (current build uses 22 via Nixpacks) |
| PostgreSQL | 15+ |
| Redis (optional) | 7+ |
## 2. Required Environment Variables
Critical:
```
DATABASE_URL=postgres://user:pass@host:5432/db
JWT_SECRET=your-long-random-secret
```
Optional (enable WP/Woo routes; if missing they are skipped):
```
WP_GRAPHQL_ENDPOINT=https://example.com/graphql
WP_BASE_URL=https://example.com
WOO_CONSUMER_KEY=ck_xxx
WOO_CONSUMER_SECRET=cs_xxx
WOO_STORE_API_URL=https://example.com/wp-json/wc/store/v1
```
Performance / Misc (defaults shown):
```
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
CACHE_TTL_PRODUCTS=60
CACHE_TTL_PRODUCT_DETAIL=60
REQUEST_TIMEOUT_MS=10000
```

## Minimal Project Structure
```
src/            # Application code
prisma/         # Schema & migrations
__tests__/      # Jest tests
Dockerfile      # Production image build
package.json    # Scripts & dependencies
README.md       # This file
```

## 🔧 Configuration

### Environment Variables
```bash
# Core
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# WordPress Integration
WP_GRAPHQL_ENDPOINT=https://site.com/graphql
WOO_CONSUMER_KEY=ck_your_key
WOO_CONSUMER_SECRET=cs_your_secret

# Caching
REDIS_URL=redis://localhost:6379
CACHE_TTL_PRODUCTS=300

# Security
JWT_SECRET=your-256-bit-secret
CORS_ORIGIN=https://your-domain.com
```

Reference: see `.env.example` / `.env.production` templates.

## 🔌 API Documentation

### Core Endpoints
- `GET /health` - Health check with dependency status
- `GET /metrics` - Prometheus metrics
- `GET /products` - Product listing with caching
- `GET /products/:id` - Product details
- `POST /webhooks/*` - WooCommerce webhook handlers

### Performance Targets
- **Health checks:** <50ms
- **Cached responses:** <5ms
- **Fresh data:** <150ms
- **Database queries:** <10ms average

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Performance tests
npm run test:performance

# Load testing
ab -n 1000 -c 10 http://localhost:3000/health
```

## Deploy
Build & run (local):
```
npm ci
npm run build
npm start          # runs prisma migrate deploy then launches
```
Docker:
```
docker build -t optica-bff .
docker run --env-file .env -p 3000:3000 optica-bff
```

Coolify / Nixpacks:
- Build command: npm run build
- Start command: npm start
- Healthcheck endpoint: /healthz (fast liveness). Add readiness (optional) /metrics or implement /ready if you need downstream checks.
- Ensure DATABASE_URL and JWT_SECRET set. If WordPress vars omitted, degraded mode disables WP/Woo routes automatically.

Migrations:
- `start` script already executes `prisma migrate deploy` (idempotent). If platform handles migrations separately, use `start:nomigrate`.

## 🚨 Monitoring & Alerts

### Built-in Monitoring
- **Application metrics** via Prometheus
- **Health checks** with dependency validation
- **Performance tracking** with custom histograms
- **Error tracking** with structured logging

### External Monitoring
- **[UptimeRobot](https://uptimerobot.com/)** - Free uptime monitoring
- **[Sentry](https://sentry.io/)** - Error tracking
- **[New Relic](https://newrelic.com/)** - APM monitoring

## 🔒 Security

### Implemented Features
- ✅ **JWT authentication** with refresh tokens
- ✅ **Rate limiting** (1000 req/min default)
- ✅ **Request validation** with Zod schemas
- ✅ **Security headers** via Helmet.js
- ✅ **CORS protection** with origin validation
- ✅ **SQL injection protection** via Prisma
- ✅ **XSS protection** with content sanitization

### Security Checklist
- [ ] Change default JWT secret
- [ ] Configure CORS origins
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Enable fail2ban (server level)
- [ ] Set up intrusion detection

## WordPress Integration Basics
Requires WooCommerce + WPGraphQL (+ WPGraphQL WooCommerce). Provide the env vars listed above. If missing, related routes are skipped (degraded mode).

## 📈 Performance Optimization

### Caching Strategy
- **L1 (Memory):** Hot data, <1ms access
- **L2 (LRU):** Recently accessed, <2ms access  
- **L3 (Redis):** Shared cache, <5ms access
- **SWR Pattern:** Stale-while-revalidate for optimal UX

### Database Optimization
- **Connection pooling** with configurable limits
- **Query optimization** with explain analysis
- **Index management** for WordPress tables
- **Read replicas** support for scaling

### Image Handling
Offloaded to origin (plugin / CDN). No local Sharp processing in this build.

## Development
```
npm ci
npm run dev
npm test
npm run lint:fix
```

## 📄 License

MIT (or Proprietary – adjust as needed).

## Support
Open an issue on GitHub for bugs or questions.