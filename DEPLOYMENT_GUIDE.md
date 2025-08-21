# 🚀 Complete Deployment Guide: Optica BFF to DigitalOcean

## Overview

This guide will walk you through deploying your Optica BFF (Backend-for-Frontend) application to DigitalOcean using **Coolify** - a modern, self-hosted alternative to Vercel/Netlify that's perfect for Node.js applications.

## Why Coolify?

- ✅ **Perfect for Node.js/TypeScript** applications
- ✅ **Docker-based deployment** with zero configuration
- ✅ **Built-in PostgreSQL** and Redis support
- ✅ **Automatic SSL certificates** (Let's Encrypt)
- ✅ **GitHub integration** with auto-deployments
- ✅ **Environment management** and secrets
- ✅ **Monitoring and logs** built-in
- ✅ **Cost-effective** compared to managed services

---

## 📋 Prerequisites

### Required Accounts & Tools
- [ ] DigitalOcean account
- [ ] GitHub account with your repository
- [ ] Domain name (recommended)
- [ ] Local SSH key

### Required Files in Your Repository
- [ ] `package.json` ✅ (Already exists)
- [ ] `Dockerfile` (We'll create this)
- [ ] `docker-compose.yml` (We'll create this)
- [ ] `.env.example` ✅ (Already exists)
- [ ] Database migration files

---

## 🏗️ Step 1: Prepare Your Repository

### 1.1 Create Dockerfile

We'll create an optimized Dockerfile for your Node.js/TypeScript application:

```dockerfile
# Use Node.js 20 LTS (Alpine for smaller size)
FROM node:20-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production --ignore-scripts

# Build stage
FROM base AS build
RUN npm ci --include=dev
COPY . .
RUN npm run build

# Production stage
FROM base AS production

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership and switch to non-root user
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
```

### 1.2 Create Docker Compose for Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/optica_bff
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: optica_bff
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 1.3 Create .dockerignore

```bash
# .dockerignore
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.local
.env.development
.env.production
.nyc_output
coverage
.coverage
.cache
dist
.DS_Store
*.log
logs
```

### 1.4 Update package.json Scripts

Add production-ready scripts to your package.json:

```json
{
  "scripts": {
    "build": "prisma generate && tsc",
    "start": "prisma migrate deploy && node dist/index.js",
    "start:dev": "tsx watch src/index.ts",
    "postinstall": "prisma generate",
    "docker:build": "docker build -t optica-bff .",
    "docker:run": "docker run -p 3000:3000 optica-bff"
  }
}
```

---

## 🌊 Step 2: Set Up DigitalOcean Droplet

### 2.1 Create a Droplet

1. **Log into DigitalOcean Console**
2. **Create a new Droplet:**
   - **Image:** Ubuntu 22.04 LTS
   - **Plan:** Basic Plan
   - **CPU Options:** 
     - **Development:** 2 GB RAM / 1 vCPU ($12/month)
     - **Production:** 4 GB RAM / 2 vCPUs ($24/month)
     - **High-Traffic:** 8 GB RAM / 4 vCPUs ($48/month)
   - **Choose Region:** Closest to your users
   - **Authentication:** SSH Keys (upload your public key)
   - **Hostname:** `optica-bff-server`

3. **Optional: Add Firewall Rules**
   - SSH (22)
   - HTTP (80)
   - HTTPS (443)
   - Custom (3000) for direct app access

### 2.2 Initial Server Setup

SSH into your server:

```bash
ssh root@your-server-ip
```

Update the system:

```bash
# Update system packages
apt update && apt upgrade -y

# Install essential packages
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Create a non-root user
adduser deployer
usermod -aG sudo deployer

# Setup SSH for deployer user
mkdir -p /home/deployer/.ssh
cp ~/.ssh/authorized_keys /home/deployer/.ssh/
chown -R deployer:deployer /home/deployer/.ssh
chmod 700 /home/deployer/.ssh
chmod 600 /home/deployer/.ssh/authorized_keys
```

### 2.3 Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Add deployer to docker group
usermod -aG docker deployer

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Start Docker service
systemctl start docker
systemctl enable docker
```

### 2.4 Setup Firewall (UFW)

```bash
# Configure firewall
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw allow 3000
ufw --force enable
```

---

## 🔄 Step 3: Install and Configure Coolify

### 3.1 Install Coolify

Switch to deployer user and install Coolify:

```bash
# Switch to deployer user
su - deployer

# Install Coolify
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

### 3.2 Access Coolify Dashboard

1. **Open browser and go to:** `http://your-server-ip:8000`
2. **Complete initial setup:**
   - Create admin account
   - Set domain (optional)
   - Configure basic settings

### 3.3 Configure Coolify

1. **Add GitHub Integration:**
   - Go to `Settings > Source`
   - Add GitHub as source
   - Connect your GitHub account
   - Grant repository access

2. **Setup Domain (Recommended):**
   - Point your domain to your server IP
   - In Coolify: `Settings > Configuration`
   - Set your domain: `coolify.yourdomain.com`
   - Enable automatic SSL

---

## 📦 Step 4: Deploy Your Application

### 4.1 Create New Project in Coolify

1. **Create Project:**
   - Click "New Project"
   - Name: `optica-bff`
   - Description: `Optica Backend-for-Frontend Application`

2. **Add Application:**
   - Click "New Resource" > "Application"
   - Choose "Public Repository" or connect your GitHub
   - Repository: `https://github.com/yourusername/optica-app`
   - Branch: `main`
   - Build Pack: `nixpacks` (auto-detects Node.js)

### 4.2 Configure Environment Variables

In Coolify Application Settings > Environment Variables:

```bash
# Production Environment Variables
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database (Coolify will provide these)
DATABASE_URL=postgresql://postgres:password@postgres:5432/optica_bff

# Redis (Coolify will provide these)
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=
REDIS_DB=0

# WordPress Integration
WP_GRAPHQL_ENDPOINT=https://your-wordpress-site.com/graphql
WP_BASE_URL=https://your-wordpress-site.com
WOO_CONSUMER_KEY=ck_your_key_here
WOO_CONSUMER_SECRET=cs_your_secret_here
WOO_STORE_API_URL=https://your-wordpress-site.com/wp-json/wc/store/v1

# Security
JWT_SECRET=your-super-secure-jwt-secret-256-bits
CORS_ORIGIN=https://your-frontend-domain.com,https://your-admin-domain.com

# Performance
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000
CACHE_TTL_PRODUCTS=300
CACHE_TTL_PRODUCT_DETAIL=600
REQUEST_TIMEOUT_MS=15000

# Image Processing
IMAGE_QUALITY=85
IMAGE_MAX_WIDTH=2048
IMAGE_MAX_HEIGHT=1536
```

### 4.3 Add Database Services

1. **Add PostgreSQL:**
   - In project: "New Resource" > "Database" > "PostgreSQL"
   - Name: `optica-postgres`
   - Version: `15`
   - Database: `optica_bff`
   - Username: `postgres`
   - Password: Generate strong password

2. **Add Redis:**
   - In project: "New Resource" > "Database" > "Redis"
   - Name: `optica-redis`
   - Version: `7`
   - Password: Optional (recommended for production)

### 4.4 Configure Application Settings

1. **Build Settings:**
   - Build Command: `npm run build`
   - Start Command: `npm start`
   - Install Command: `npm ci`

2. **Port Configuration:**
   - Port: `3000`
   - Enable Health Check: `/health`

3. **Domain Configuration:**
   - Add domain: `api.yourdomain.com`
   - Enable SSL (automatic with Let's Encrypt)

---

## 🗄️ Step 5: Database Setup

### 5.1 Run Database Migrations

Once your application is deployed, access the container to run migrations:

```bash
# SSH into your server
ssh deployer@your-server-ip

# Access the application container
docker exec -it optica-bff-app bash

# Run Prisma migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Optional: Seed database
npm run sync:initial
```

### 5.2 Database Backup Strategy

Create automated backup script:

```bash
# Create backup script
sudo nano /home/deployer/scripts/backup-db.sh
```

```bash
#!/bin/bash
# Database backup script

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/deployer/backups"
mkdir -p $BACKUP_DIR

# PostgreSQL backup
docker exec optica-postgres pg_dump -U postgres optica_bff > $BACKUP_DIR/optica_db_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "optica_db_*.sql" -mtime +7 -delete

# Upload to DigitalOcean Spaces (optional)
# s3cmd put $BACKUP_DIR/optica_db_$DATE.sql s3://your-backup-bucket/
```

```bash
# Make script executable
chmod +x /home/deployer/scripts/backup-db.sh

# Add to crontab for daily backups
crontab -e
# Add line: 0 2 * * * /home/deployer/scripts/backup-db.sh
```

---

## 🔐 Step 6: Security Hardening

### 6.1 Configure SSL/TLS

Coolify automatically handles SSL certificates, but verify:

1. **Check SSL Status** in Coolify dashboard
2. **Force HTTPS redirect** in application settings
3. **Update CORS_ORIGIN** to use HTTPS URLs

### 6.2 Server Security

```bash
# Configure fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Secure SSH
sudo nano /etc/ssh/sshd_config
```

Update SSH config:
```bash
# Disable root login
PermitRootLogin no

# Change default port (optional)
Port 2222

# Disable password authentication
PasswordAuthentication no
PubkeyAuthentication yes
```

```bash
# Restart SSH
sudo systemctl restart ssh

# Update firewall if you changed SSH port
sudo ufw allow 2222
sudo ufw delete allow 22
```

### 6.3 Application Security

Add security headers to your Hono application:

```typescript
// src/middleware/security.ts
import { helmet } from 'hono/helmet'

export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
})
```

---

## 📊 Step 7: Monitoring & Logging

### 7.1 Application Monitoring

Coolify provides built-in monitoring, but let's enhance it:

1. **Coolify Dashboard:**
   - Resource usage graphs
   - Application logs
   - Health check status

2. **Custom Health Endpoint:**
   Already implemented in your `/health` route

3. **Prometheus Metrics:**
   Your app already exports metrics at `/metrics`

### 7.2 Log Management

Configure structured logging:

```typescript
// src/utils/logger.ts - Enhanced for production
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(process.env.NODE_ENV === 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: false
      }
    }
  })
})
```

### 7.3 Uptime Monitoring

Set up external monitoring:

1. **UptimeRobot** (Free)
2. **Pingdom** (Paid)
3. **Custom monitoring** with your health endpoint

---

## 🚀 Step 8: Domain & DNS Configuration

### 8.1 DNS Setup

Point your domains to your server:

```bash
# Main API domain
api.yourdomain.com    A    your-server-ip

# Optional: Admin dashboard
admin.yourdomain.com  A    your-server-ip

# Optional: Coolify dashboard
coolify.yourdomain.com A   your-server-ip
```

### 8.2 Configure Domains in Coolify

1. **Application Domain:**
   - Go to your application settings
   - Add domain: `api.yourdomain.com`
   - Enable "Force HTTPS redirect"

2. **Coolify Dashboard Domain:**
   - Settings > Configuration
   - Set domain: `coolify.yourdomain.com`

---

## 🔄 Step 9: CI/CD Setup

### 9.1 GitHub Actions (Alternative)

If you prefer GitHub Actions over Coolify's built-in CI/CD:

```yaml
# .github/workflows/deploy.yml
name: Deploy to DigitalOcean

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Coolify
        uses: andrasbacsai/coolify-action@v1
        with:
          webhook: ${{ secrets.COOLIFY_WEBHOOK }}
```

### 9.2 Automatic Deployments

Coolify automatically deploys when you push to your main branch. Configure webhook in repository settings.

---

## 📈 Step 10: Performance Optimization

### 10.1 Server Optimization

```bash
# Optimize server for Node.js
echo 'vm.swappiness=10' >> /etc/sysctl.conf
echo 'fs.file-max=65536' >> /etc/sysctl.conf

# Apply changes
sysctl -p
```

### 10.2 Application Performance

1. **Enable compression** in your Hono app
2. **Configure Redis caching** properly
3. **Optimize database queries** with proper indexes
4. **Enable HTTP/2** (automatic with Coolify + SSL)

### 10.3 CDN Setup (Optional)

For static assets and global performance:

1. **DigitalOcean Spaces** + CDN
2. **Cloudflare** (free plan available)
3. **Configure in your app** to serve assets from CDN

---

## 🧪 Step 11: Testing the Deployment

### 11.1 Health Checks

```bash
# Test API endpoints
curl https://api.yourdomain.com/health
curl https://api.yourdomain.com/products
curl https://api.yourdomain.com/metrics

# Test WebSocket connections (if applicable)
# Test database connectivity
```

### 11.2 Load Testing

```bash
# Install Apache Bench
sudo apt install apache2-utils

# Basic load test
ab -n 1000 -c 10 https://api.yourdomain.com/health

# Or use k6 for advanced testing
curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz | tar -xz
sudo cp k6-v0.47.0-linux-amd64/k6 /usr/local/bin/
```

### 11.3 Security Testing

```bash
# SSL/TLS test
curl -I https://api.yourdomain.com

# Headers check
curl -I https://api.yourdomain.com/health

# Security scan
nmap -sS -O your-server-ip
```

---

## 🚨 Step 12: Troubleshooting

### 12.1 Common Issues

**Application won't start:**
```bash
# Check logs in Coolify dashboard or
docker logs optica-bff-app

# Common fixes:
# 1. Check environment variables
# 2. Verify database connection
# 3. Check port configuration
```

**Database connection issues:**
```bash
# Test database connection
docker exec -it optica-postgres psql -U postgres -d optica_bff

# Check if database exists
\l

# Check tables
\dt
```

**Redis connection issues:**
```bash
# Test Redis connection
docker exec -it optica-redis redis-cli ping

# Should return: PONG
```

### 12.2 Debug Mode

Enable debug logging:
```bash
# In Coolify environment variables
LOG_LEVEL=debug
DEBUG=true
```

### 12.3 Rollback Strategy

```bash
# Rollback to previous deployment in Coolify
# Or manually via Docker
docker image ls
docker run -d previous-image-tag
```

---

## 💰 Cost Optimization

### 12.1 Resource Right-Sizing

**Development Environment:**
- Droplet: $12/month (2GB RAM)
- Bandwidth: Usually included
- **Total: ~$12-15/month**

**Production Environment:**
- Droplet: $24-48/month (4-8GB RAM)
- Load Balancer: $12/month (if needed)
- Spaces: $5/month (if using CDN)
- **Total: ~$30-65/month**

### 12.2 Cost-Saving Tips

1. **Use reserved instances** for long-term projects
2. **Enable monitoring** to avoid over-provisioning
3. **Set up alerts** for resource usage
4. **Regular cleanup** of old Docker images
5. **Optimize database** with proper indexing

---

## 📝 Maintenance Checklist

### Daily
- [ ] Check application status in Coolify
- [ ] Review error logs
- [ ] Monitor resource usage

### Weekly
- [ ] Review security logs
- [ ] Check backup status
- [ ] Update dependencies (if needed)
- [ ] Performance review

### Monthly
- [ ] Security updates
- [ ] Database optimization
- [ ] Cost review
- [ ] Backup testing

---

## 🎯 Go-Live Checklist

Before going live with your production deployment:

### Technical Readiness
- [ ] All tests passing
- [ ] Health checks working
- [ ] Database migrations applied
- [ ] SSL certificates active
- [ ] Monitoring configured
- [ ] Backups working
- [ ] Performance benchmarks met

### Security Checklist
- [ ] Environment variables secured
- [ ] Server hardened
- [ ] Firewall configured
- [ ] SSL/TLS configured
- [ ] Security headers implemented
- [ ] Rate limiting active

### Documentation
- [ ] API documentation updated
- [ ] Deployment process documented
- [ ] Rollback procedures defined
- [ ] Contact information updated

---

## 🆘 Support & Resources

### Documentation
- [Coolify Documentation](https://coolify.io/docs)
- [DigitalOcean Tutorials](https://docs.digitalocean.com/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

### Community
- [Coolify Discord](https://discord.gg/coolify)
- [DigitalOcean Community](https://www.digitalocean.com/community)

### Monitoring Tools
- [UptimeRobot](https://uptimerobot.com/) - Free uptime monitoring
- [New Relic](https://newrelic.com/) - Application performance monitoring
- [Sentry](https://sentry.io/) - Error tracking

---

## 🎉 Conclusion

Your Optica BFF application is now deployed and running on DigitalOcean with Coolify! This setup provides:

✅ **Automatic deployments** from GitHub
✅ **SSL certificates** and security
✅ **Database and Redis** managed services
✅ **Monitoring and logging**
✅ **Scalable infrastructure**
✅ **Cost-effective hosting**

The total setup time should be **2-4 hours** for a complete production deployment.

**Next Steps:**
1. Set up your WordPress instance (if not already done)
2. Configure the WordPress plugin we created earlier
3. Test the complete integration
4. Monitor performance and optimize as needed

**Need help?** Check the troubleshooting section or reach out to the community resources listed above.

Happy deploying! 🚀
