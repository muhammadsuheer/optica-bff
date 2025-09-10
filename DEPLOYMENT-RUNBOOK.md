# 🚀 **Optia BFF - Production Deployment Runbook**

## **From Clone to Production in 10 Steps**

### **Prerequisites**
- Node.js 18+ installed
- Vercel CLI installed (`npm i -g vercel`)
- Supabase project set up
- Upstash Redis database created
- WordPress/WooCommerce site with REST API enabled

---

## **Step 1: Clone and Install**

```bash
git clone https://github.com/your-org/optia-bff.git
cd optia-bff
npm ci
```

**✅ Verification:**
```bash
npm run type-check
# Should complete without errors
```

---

## **Step 2: Environment Setup**

```bash
cp .env.example .env
```

**Edit `.env` with your credentials:**
- WordPress/WooCommerce API keys
- Supabase URL and keys
- Upstash Redis URL and token
- Generate secure JWT secret (32+ chars)
- Set CORS origins for your domains

**✅ Verification:**
```bash
npm run dev
# Should start without environment validation errors
```

---

## **Step 3: Database Schema Setup**

**In Supabase SQL Editor, run:**
```sql
-- Create products table
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wc_id INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  regular_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  sale_price DECIMAL(10,2),
  stock_quantity INTEGER,
  stock_status TEXT DEFAULT 'instock',
  manage_stock BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'publish',
  featured BOOLEAN DEFAULT false,
  categories JSONB DEFAULT '[]',
  images JSONB DEFAULT '[]',
  attributes JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow public read access to published products
CREATE POLICY "Public products are viewable by everyone" ON products
  FOR SELECT USING (status = 'publish');

-- Additional tables: orders, carts, etc. (see migrations folder)
```

**✅ Verification:**
```bash
curl http://localhost:3000/health
# Should return healthy status
```

---

## **Step 4: Edge Runtime Compliance Check**

```bash
npm run verify:edge
```

**Expected output:**
```
✅ Edge Runtime Compliance Check Passed
✅ No Node.js-only imports detected
✅ All dependencies are Edge-compatible
```

**Fix any violations before proceeding.**

---

## **Step 5: Build and Test**

```bash
npm run build
npm run test:unit
npm run lint
```

**All commands should pass without errors.**

**Test key endpoints:**
```bash
# Start dev server
npm run dev

# Test in another terminal
curl http://localhost:3000/health
curl http://localhost:3000/v1/catalog/products?per_page=5
```

---

## **Step 6: Vercel Project Setup**

```bash
vercel login
vercel --confirm
```

**Follow prompts:**
- Link to existing project or create new
- Set framework to "Other"
- Keep default settings

---

## **Step 7: Environment Variables in Vercel**

**In Vercel Dashboard > Project > Settings > Environment Variables, add:**

```bash
# Copy from your .env file
NODE_ENV=production
WP_BASE_URL=https://your-wordpress-site.com
WC_CONSUMER_KEY=ck_...
WC_CONSUMER_SECRET=cs_...
WC_WEBHOOK_SECRET=your_webhook_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
JWT_SECRET=your_jwt_secret_32_chars_minimum
API_KEYS=frontend_key,admin_key,mobile_key
CORS_ORIGINS=https://your-frontend.vercel.app,https://your-admin.vercel.app
```

**✅ Verification:**
Check that all required variables are set in Vercel dashboard.

---

## **Step 8: Deploy to Production**

```bash
vercel --prod
```

**Expected output:**
```
✅ Production deployment successful
🔗 https://optia-bff-your-team.vercel.app
```

---

## **Step 9: Post-Deployment Verification**

**Test production endpoints:**
```bash
export API_URL="https://optia-bff-your-team.vercel.app"

# Health check
curl $API_URL/health

# Catalog endpoints
curl $API_URL/v1/catalog/products?per_page=5
curl $API_URL/v1/catalog/categories

# Check headers
curl -I $API_URL/v1/catalog/products
# Should see: X-Trace-Id, Cache-Control, etc.
```

**✅ All endpoints should return 200 with proper headers.**

---

## **Step 10: WordPress Webhook Setup**

**In WordPress Admin > WooCommerce > Settings > Advanced > Webhooks:**

1. **Create Product Update Webhook:**
   - Name: "Optia BFF Product Sync"
   - Status: Active
   - Topic: Product updated
   - Delivery URL: `https://your-bff.vercel.app/v1/webhooks/wordpress`
   - Secret: (your WC_WEBHOOK_SECRET)
   - API Version: WP REST API Integration v3

2. **Test webhook:**
   - Update any product in WooCommerce
   - Check Vercel logs for webhook processing

**✅ Verification:**
```bash
# Check webhook logs in Vercel dashboard
# Should see successful webhook processing
```

---

## **🎯 Acceptance Checklist**

### **Security ✅**
- [ ] No service role key exposed to client
- [ ] RLS policies active on all tables
- [ ] CORS properly configured
- [ ] Rate limiting functional
- [ ] Webhook signatures verified

### **Edge Compatibility ✅**
- [ ] No Node.js-only modules
- [ ] All config via Vercel env vars
- [ ] Web Standard APIs only
- [ ] Edge Runtime compliance verified

### **Performance ✅**
- [ ] Cache hit rates > 80% for catalog
- [ ] Response times < 200ms for cached requests
- [ ] Stampede protection working
- [ ] Idempotent endpoints tested

### **Reliability ✅**
- [ ] Health checks passing
- [ ] Error responses properly formatted
- [ ] Retries and backoff implemented
- [ ] Circuit breakers functional

### **Observability ✅**
- [ ] Trace IDs in all responses
- [ ] Structured logging active
- [ ] Metrics endpoints accessible
- [ ] Error rates monitored

---

## **🔧 Troubleshooting**

### **Common Issues:**

**1. Environment validation failed:**
```bash
# Check Vercel env vars match your .env
vercel env ls
```

**2. Supabase connection errors:**
```bash
# Verify RLS policies and keys
curl -H "Authorization: Bearer YOUR_ANON_KEY" \
  "https://your-project.supabase.co/rest/v1/products?select=id&limit=1"
```

**3. WordPress API errors:**
```bash
# Test WooCommerce API directly
curl -u "CONSUMER_KEY:CONSUMER_SECRET" \
  "https://your-wp-site.com/wp-json/wc/v3/products?per_page=1"
```

**4. Cache not working:**
```bash
# Check Upstash Redis connection
curl -H "Authorization: Bearer YOUR_REDIS_TOKEN" \
  "https://your-redis.upstash.io/ping"
```

---

## **📊 Monitoring Setup**

**Add these to your monitoring dashboard:**

1. **Response Time Metrics:**
   - P95 response time < 500ms
   - P99 response time < 1000ms

2. **Error Rate Metrics:**
   - 4xx errors < 5%
   - 5xx errors < 1%

3. **Cache Metrics:**
   - Hit rate > 80%
   - Miss rate < 20%

4. **Business Metrics:**
   - Product sync success rate > 99%
   - Webhook processing success rate > 95%

---

## **🚀 You're Live!**

Your Optia BFF is now production-ready with:
- ✅ **100% Edge Runtime compatibility**
- ✅ **Sub-200ms cached response times**
- ✅ **Automatic failover and retries**
- ✅ **Comprehensive observability**
- ✅ **Enterprise-grade security**

**Next Steps:**
1. Set up monitoring alerts
2. Configure auto-scaling rules
3. Implement A/B testing
4. Add performance budgets
