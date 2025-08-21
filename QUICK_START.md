# 🚀 Quick Start Deployment Guide

## Pre-Deployment Checklist

### 1. Repository Preparation ✅
- [x] Dockerfile created
- [x] docker-compose.yml configured
- [x] .dockerignore added
- [x] GitHub Actions workflow set up
- [x] Environment variables template created
- [x] Database initialization script ready
- [x] Package.json updated with production scripts

### 2. DigitalOcean Account Setup
- [ ] DigitalOcean account created
- [ ] SSH key generated and uploaded
- [ ] Domain name configured (optional but recommended)

### 3. Repository Setup
- [ ] Code pushed to GitHub
- [ ] Repository is public or you have access tokens ready
- [ ] All environment variables identified

---

## 🏃‍♂️ Quick Deployment Steps

### Step 1: Create DigitalOcean Droplet (5 minutes)
1. **Log into DigitalOcean**
2. **Create Droplet:**
   - Image: Ubuntu 22.04 LTS
   - Plan: Basic ($12/month for dev, $24/month for production)
   - Region: Choose closest to your users
   - Authentication: SSH Keys
   - Hostname: `optica-bff-server`

### Step 2: Initial Server Setup (10 minutes)
```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Download and run setup script
curl -fsSL https://raw.githubusercontent.com/yourusername/optica-app/main/scripts/setup-server.sh | bash

# Reboot server
reboot
```

### Step 3: Access Coolify (2 minutes) ✅ COMPLETED
1. **Open browser:** `http://YOUR_SERVER_IP:8000`
2. **Complete setup wizard:**
   - Create admin account
   - Set domain (optional)
   - Basic configuration

**✅ You are here! Coolify is now installed and accessible.**

### Step 4: Deploy Application (15 minutes)
1. **Create new project in Coolify:**
   - Name: `optica-bff`
   - Description: `Optica Backend-for-Frontend`

2. **Add application:**
   - Type: Public Repository
   - Repository: `https://github.com/yourusername/optica-app`
   - Branch: `main`
   - Build pack: `nixpacks` (auto-detects Node.js)

3. **Add PostgreSQL database:**
   - Name: `optica-postgres`
   - Version: `15`
   - Database: `optica_bff`

4. **Add Redis database:**
   - Name: `optica-redis`
   - Version: `7`

5. **Configure environment variables** (see section below)

6. **Set domain:** `api.yourdomain.com` (optional)

7. **Deploy!** 🚀

---

## 🔐 Environment Variables Configuration

Copy these into Coolify's environment variables section:

```bash
# Core Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database (Coolify provides these automatically)
DATABASE_URL=postgresql://postgres:password@postgres:5432/optica_bff

# Redis (Coolify provides these automatically)
REDIS_URL=redis://redis:6379

# WordPress Integration (CONFIGURE THESE)
WP_GRAPHQL_ENDPOINT=https://your-wordpress-site.com/graphql
WP_BASE_URL=https://your-wordpress-site.com
WOO_CONSUMER_KEY=ck_your_key_here
WOO_CONSUMER_SECRET=cs_your_secret_here
WOO_STORE_API_URL=https://your-wordpress-site.com/wp-json/wc/store/v1

# Security (GENERATE STRONG VALUES)
JWT_SECRET=your-super-secure-256-bit-secret-key
CORS_ORIGIN=https://your-frontend-domain.com

# Performance Tuning
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

---

## 🧪 Testing Your Deployment

### Health Check
```bash
curl https://api.yourdomain.com/health
```

### API Endpoints
```bash
# Products endpoint
curl https://api.yourdomain.com/products

# Metrics endpoint
curl https://api.yourdomain.com/metrics

# GraphQL test (if implemented)
curl -X POST https://api.yourdomain.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ health }"}'
```

### Performance Test
```bash
# Basic load test
ab -n 100 -c 10 https://api.yourdomain.com/health
```

---

## 🔧 Post-Deployment Configuration

### 1. WordPress Setup
1. Install the Optica BFF Integration plugin (created earlier)
2. Configure WooCommerce API keys
3. Set up webhooks
4. Test integration

### 2. SSL Certificate
- Coolify automatically handles SSL with Let's Encrypt
- Verify SSL is working: `https://your-domain.com`

### 3. Database Migration
```bash
# Access application container
docker exec -it optica-bff-app bash

# Run migrations
npx prisma migrate deploy

# Optional: Seed initial data
npm run sync:initial
```

### 4. Monitoring Setup
- Check Coolify dashboard for resource usage
- Set up external monitoring (UptimeRobot, Pingdom)
- Configure alerts

---

## 🚨 Troubleshooting

### Application Won't Start
```bash
# Check logs in Coolify dashboard or:
docker logs optica-bff-app

# Common issues:
# 1. Environment variables missing
# 2. Database connection failed
# 3. Port already in use
```

### Database Connection Issues
```bash
# Test database connection
docker exec -it optica-postgres psql -U postgres -d optica_bff

# Check if database exists
\l

# Verify tables
\dt
```

### Performance Issues
```bash
# Check resource usage
docker stats

# Check application metrics
curl https://api.yourdomain.com/metrics

# View detailed logs
docker logs optica-bff-app --tail 100
```

---

## 📊 Monitoring Commands

### System Status
```bash
# System information
~/scripts/system-info.sh

# Container status
docker ps

# Application logs
docker logs optica-bff-app -f

# Resource usage
htop
```

### Database Monitoring
```bash
# Database size
docker exec optica-postgres psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('optica_bff'));"

# Active connections
docker exec optica-postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Slow queries
docker exec optica-postgres psql -U postgres -c "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

---

## 🔄 Backup & Recovery

### Manual Backup
```bash
~/scripts/backup-db.sh
```

### Restore from Backup
```bash
# Copy backup to server
scp backup.sql.gz deployer@your-server:/tmp/

# Restore database
gunzip /tmp/backup.sql.gz
docker exec -i optica-postgres psql -U postgres -d optica_bff < /tmp/backup.sql
```

---

## 📈 Scaling Considerations

### Vertical Scaling (Upgrade Droplet)
1. **In DigitalOcean Console:**
   - Resize droplet
   - Choose larger plan
   - Reboot when ready

### Horizontal Scaling
1. **Load Balancer Setup:**
   - Add DigitalOcean Load Balancer
   - Configure health checks
   - Add multiple droplets

2. **Database Scaling:**
   - Use DigitalOcean Managed Database
   - Configure read replicas
   - Update DATABASE_URL

---

## 💰 Cost Estimates

### Development Environment
- **Droplet:** $12/month (2GB RAM, 1 vCPU)
- **Bandwidth:** Included (1TB)
- **Backups:** $1.20/month (optional)
- **Total:** ~$13-15/month

### Production Environment
- **Droplet:** $24-48/month (4-8GB RAM)
- **Load Balancer:** $12/month (if needed)
- **Managed Database:** $15-60/month (optional)
- **Spaces + CDN:** $5/month (if needed)
- **Total:** ~$30-125/month

---

## 🎯 Success Metrics

### Performance Targets
- **Health check response:** <50ms
- **API responses (cached):** <5ms
- **API responses (fresh):** <150ms
- **Database queries:** <10ms average
- **Memory usage:** <80% of allocated
- **CPU usage:** <70% average

### Uptime Targets
- **Development:** 95%+
- **Production:** 99.9%+
- **Recovery time:** <5 minutes

---

## 📞 Next Steps After Deployment

1. **🔗 Connect WordPress**
   - Install Optica BFF Integration plugin
   - Configure API keys and webhooks
   - Test data synchronization

2. **📱 Frontend Integration**
   - Update frontend API endpoints
   - Test authentication flow
   - Verify CORS configuration

3. **📊 Monitoring Setup**
   - Configure external uptime monitoring
   - Set up error tracking (Sentry)
   - Create performance dashboards

4. **🔒 Security Hardening**
   - Review security headers
   - Configure rate limiting
   - Set up intrusion detection

5. **📈 Performance Optimization**
   - Analyze slow queries
   - Optimize caching strategies
   - Configure CDN for assets

---

**🎉 Congratulations!** Your Optica BFF is now deployed and ready for production use!

**Need help?** Check the main deployment guide or create an issue in the repository.
