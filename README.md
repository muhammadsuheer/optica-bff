# 🔍 Optica BFF - High-Performance Backend-for-Frontend

[![Deploy to DigitalOcean](https://img.shields.io/badge/Deploy%20to-DigitalOcean-0080FF?style=for-the-badge&logo=digitalocean)](./QUICK_START.md)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)

A high-performance Backend-for-Frontend (BFF) built with Node.js/Hono.js that serves as an optimized intermediary layer between frontend applications and WordPress/WooCommerce backends. Specialized for lens/optics e-commerce with advanced product cataloging, real-time inventory management, and enterprise-grade caching.

## 🚀 Quick Start

### Option 1: One-Click Deployment (Recommended)
```bash
# 1. Create DigitalOcean droplet
# 2. SSH into server and run:
curl -fsSL https://raw.githubusercontent.com/yourusername/optica-app/main/scripts/setup-server.sh | bash

# 3. Access Coolify at http://your-server-ip:8000
# 4. Follow the deployment guide
```

### Option 2: Local Development
```bash
# Clone repository
git clone https://github.com/yourusername/optica-app.git
cd optica-app

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Or with Docker
docker-compose up --build
```

📖 **[Complete Deployment Guide](./DEPLOYMENT_GUIDE.md)** | 🏃‍♂️ **[Quick Start Guide](./QUICK_START.md)**

## ✨ Key Features

### 🏎️ Performance
- **Sub-millisecond API responses** through multi-tier caching (L0/L1/L2/L3)
- **95% faster** than direct WordPress queries
- **HTTP/2 support** with automatic compression
- **Connection pooling** for databases and Redis

### 🔄 Real-Time Synchronization
- **WordPress ↔ PostgreSQL mirroring** with conflict resolution
- **Real-time webhooks** for instant data updates
- **ETL processes** for bulk data synchronization
- **Change detection** with SHA256 hashing

### 🛡️ Enterprise Security
- **JWT authentication** with role-based access
- **Rate limiting** with Redis-backed sliding windows
- **Request validation** with Zod schemas
- **Security headers** via Helmet.js
- **CORS protection** with configurable origins

### 📊 Monitoring & Observability
- **Prometheus metrics** at `/metrics` endpoint
- **Health checks** with dependency validation
- **Structured logging** with correlation IDs
- **Performance tracking** with custom histograms

### 🏗️ Architecture
- **Multi-tier service architecture** for different performance needs
- **Microservice-ready** with Docker containerization
- **Horizontal scaling** support
- **Graceful degradation** with fallback strategies

## 🏗️ Architecture Overview

```mermaid
flowchart TB
    Frontend[Frontend Apps] --> BFF[Optica BFF]
    BFF --> Cache[Redis Cache L3]
    BFF --> DB[(PostgreSQL)]
    BFF --> WP[WordPress/WooCommerce]
    
    WP --> Webhooks[Webhooks]
    Webhooks --> BFF
    
    subgraph "Caching Layers"
        L1[L1: Memory]
        L2[L2: LRU Cache]
        L3[L3: Redis]
    end
    
    BFF --> L1
    L1 --> L2
    L2 --> L3
```

## 🛠️ Tech Stack

### Core Framework
- **[Hono.js](https://hono.dev/)** - Ultra-fast web framework
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development
- **[Node.js 20+](https://nodejs.org/)** - Runtime environment

### Database & Caching
- **[PostgreSQL 15+](https://www.postgresql.org/)** - Primary database
- **[Prisma](https://www.prisma.io/)** - Database ORM with migrations
- **[Redis](https://redis.io/)** - Caching and session storage

### Integration
- **[WooCommerce REST API](https://woocommerce.github.io/woocommerce-rest-api-docs/)** - E-commerce data
- **[WordPress GraphQL](https://www.wpgraphql.com/)** - Content queries
- **[Sharp](https://sharp.pixelplumbing.com/)** - Image processing

### DevOps & Deployment
- **[Docker](https://www.docker.com/)** - Containerization
- **[Coolify](https://coolify.io/)** - Self-hosted deployment platform
- **[GitHub Actions](https://github.com/features/actions)** - CI/CD pipeline

## 📁 Project Structure

```
optica-app/
├── 📁 src/                          # Source code
│   ├── 🏠 index.ts                  # Development server
│   ├── 🚀 productionServer.ts       # Production server
│   ├── 📁 config/                   # Configuration management
│   ├── 📁 services/                 # Business logic layer
│   ├── 📁 routes/                   # API endpoints
│   ├── 📁 middleware/               # HTTP middleware
│   ├── 📁 utils/                    # Shared utilities
│   └── 📁 types/                    # TypeScript definitions
├── 📁 prisma/                       # Database schema & migrations
├── 📁 scripts/                      # Deployment & maintenance
├── 📁 __tests__/                    # Test suite
├── 🐳 Dockerfile                    # Container configuration
├── 🔧 docker-compose.yml            # Local development setup
└── 📚 docs/                         # Documentation
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

📖 **[Complete Configuration Reference](./.env.production)**

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

## 📦 Deployment Options

### 🌊 DigitalOcean + Coolify (Recommended)
- **Cost:** $12-48/month
- **Setup time:** 15 minutes
- **Features:** Auto-SSL, monitoring, backups
- **Scaling:** Vertical and horizontal

### 🐳 Docker Compose
```bash
docker-compose up -d
```

### ☁️ Cloud Platforms
- **Vercel** - Serverless deployment
- **Railway** - Container platform
- **Render** - Managed containers
- **AWS/GCP/Azure** - Full cloud platforms

📖 **[Deployment Comparison Guide](./docs/deployment-comparison.md)**

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

## 🔄 WordPress Integration

### Required WordPress Setup
1. **Install required plugins:**
   - WooCommerce
   - WPGraphQL
   - WPGraphQL for WooCommerce

2. **Configure API access:**
   - Generate WooCommerce API keys
   - Set up webhooks for real-time sync
   - Configure GraphQL endpoints

3. **Install Optica BFF Integration plugin** (included)
   - Automated health checks
   - One-click configuration
   - WordPress-native admin interface

📖 **[WordPress Setup Guide](./docs/wordpress-setup.md)**

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

### Image Processing
- **On-demand resizing** with Sharp
- **Format optimization** (WebP, AVIF)
- **CDN integration** ready
- **Lazy loading** support

## 🤝 Contributing

### Development Setup
```bash
# Clone and setup
git clone https://github.com/yourusername/optica-app.git
cd optica-app
npm install

# Start development
npm run dev

# Run tests
npm test

# Lint and format
npm run lint:fix
npm run format
```

### Code Standards
- **TypeScript strict mode** enabled
- **ESLint + Prettier** for code quality
- **Conventional commits** for clear history
- **Test coverage** >80% required
- **Performance budgets** enforced

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🆘 Support

### Documentation
- 📖 **[Deployment Guide](./DEPLOYMENT_GUIDE.md)**
- 🏃‍♂️ **[Quick Start](./QUICK_START.md)**
- 🏗️ **[Architecture Details](./ARCHITECTURE.md)**
- 🔌 **[API Reference](./docs/api-reference.md)**

### Community
- 💬 **[GitHub Discussions](https://github.com/yourusername/optica-app/discussions)**
- 🐛 **[Issue Tracker](https://github.com/yourusername/optica-app/issues)**
- 📧 **[Email Support](mailto:support@yourdomain.com)**

### Resources
- **[Coolify Documentation](https://coolify.io/docs)**
- **[DigitalOcean Tutorials](https://docs.digitalocean.com/)**
- **[Hono.js Guide](https://hono.dev/getting-started/basic)**

---

**🎯 Ready to deploy?** Start with the **[Quick Start Guide](./QUICK_START.md)** for a 15-minute deployment!

**🏗️ Want to understand the architecture?** Check out the **[Complete Architecture Guide](./ARCHITECTURE.md)**.

**💬 Need help?** Join our **[community discussions](https://github.com/yourusername/optica-app/discussions)** or create an **[issue](https://github.com/yourusername/optica-app/issues)**.