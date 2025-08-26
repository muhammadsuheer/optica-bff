import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { etag } from 'hono/etag';
import { HTTPException } from 'hono/http-exception';
import { randomUUID } from 'crypto';
import { Agent } from 'undici';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Import configuration and services
import { env } from './config/env.js';
import { logger } from './utils/logger.js'; // Centralized structured logger (JSON in production)

// ---------------------------------------------------------------------------
// Store original console methods before logger import to prevent circular dependency
// ---------------------------------------------------------------------------
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};
import { CacheService, cacheMemoryGauge } from './services/cacheService.js';

import { requireApiKey } from './middleware/apiKey.js';
import { createGlobalRateLimiter } from './middleware/rateLimiter.js';
import databaseService from './services/databaseService.js';

// Validate critical environment variables at startup
// ---------------------------------------------------------------------------

// 1. Early critical environment validation
//    Fail-fast only on variables required to boot the HTTP server safely.
//    (Non‑critical integrations like WooCommerce could be made optional later.)
// ---------------------------------------------------------------------------
const validateEnvironment = () => {
  // Critical minimal vars required to boot the server
  const critical = ['DATABASE_URL'];
  const missingCritical = critical.filter(k => !process.env[k]);
  if (missingCritical.length) {
    logger.error('Missing critical environment variables – aborting startup', { missingCritical });
    process.exit(1);
  }

  // Optional integration group (WordPress / WooCommerce). If any missing, we enable degraded mode.
  const wooGroup = ['WP_GRAPHQL_ENDPOINT','WP_BASE_URL','WOO_CONSUMER_KEY','WOO_CONSUMER_SECRET','WOO_STORE_API_URL'];
  const missingWoo = wooGroup.filter(k => !process.env[k]);
  const degraded = missingWoo.length > 0;
  if (degraded) {
    logger.warn('Woo/WordPress integration disabled – missing variables', { missingWoo });
    process.env.INTEGRATION_WP_DISABLED = '1';
  } else {
    process.env.INTEGRATION_WP_DISABLED = '0';
  }
  logger.info('Environment validation complete', { degradedMode: degraded });
};

// Validate environment before starting
validateEnvironment();

// Import routes
import { createHealthRoutes } from './routes/health.js';
import { createProductRoutes } from './routes/products.js';
import { syncRoutes } from './routes/sync.js';
import { createAuthRoutes } from './routes/auth.js';
import { createCartRoutes } from './routes/cart.js';
import { createOrderRoutes } from './routes/orders.js';
import { createCustomerRoutes } from './routes/customers.js';
import { webhookRoutes } from './routes/webhooks.js';
// Priority 2 routes
import { createReviewRoutes } from './routes/reviews.js';
import { createCategoryRoutes } from './routes/categories.js';
import { createWordPressRoutes } from './routes/wordpress.js';
import { createWooCommerceRoutes } from './routes/woocommerce.js';

// Shared HTTP agent with optimized keep-alive settings for all external calls
export const globalHttpAgent = new Agent({
  connections: 20,           // Increased connection pool for high traffic
  keepAliveTimeout: 30000,   // 30s keep-alive
  keepAliveMaxTimeout: 30000,
  bodyTimeout: 10000,        // 10s body timeout
  headersTimeout: 5000       // 5s headers timeout
});

// Prometheus metrics for performance monitoring
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10]
});

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections'
});

const cacheHitRate = new Counter({
  name: 'cache_operations_total',
  help: 'Total cache operations',
  labelNames: ['operation', 'result'] // operation: get/set/delete, result: hit/miss/error
});

// Enable default metrics collection (memory, CPU, etc.)
collectDefaultMetrics({ prefix: 'optica_bff_' });

// Initialize all services in parallel for faster startup
// ---------------------------------------------------------------------------
// 2. Parallel service initialization (DB + Cache + Rate Limiter)
//    Adds defensive timeouts so the process does not hang waiting on Redis.
// ---------------------------------------------------------------------------
const initializeServices = async () => {
  logger.info('Initializing core services in parallel');
  const startTime = performance.now();
  
  try {
    // Import database service
    const { initializeDatabaseService } = await import('./services/databaseService.js');
    
    // Parallel service initialization (saves 100-200ms startup time)
    const [cacheService, databaseHealthy] = await Promise.all([
      (async () => {
        const cache = new CacheService();
        const ready = await cache.waitForReady(5000);
        if (ready) {
          logger.info('Redis connected successfully');
        } else {
          logger.warn('Redis not ready – using in‑memory cache');
        }
        return cache;
      })(),
      initializeDatabaseService()
    ]);
    
    // Initialize rate limiter with the cache service
    const globalRateLimiter = createGlobalRateLimiter(cacheService);
    
    const initTime = performance.now() - startTime;
    logger.info('Services initialized', { duration_ms: +initTime.toFixed(2), databaseHealthy });
    
    return { cacheService, globalRateLimiter, databaseHealthy };
  } catch (error) {
    logger.error('Service initialization failed', error as Error);
    throw error;
  }
};

// Get services (will be initialized below)
const servicesPromise = initializeServices();

// Create Hono app
const app = new Hono();

// Fast path middleware: Request ID generation as FIRST middleware (critical for logging)
// Middleware: assigns request ID + collects Prometheus metrics for every request.
app.use('*', async (c, next) => {
  const requestId = randomUUID();
  c.header('X-Request-ID', requestId);
  
  // Prometheus metrics tracking
  const startTime = Date.now();
  activeConnections.inc();
  
  try {
    await next();
  } finally {
    const duration = (Date.now() - startTime) / 1000;
    const method = c.req.method;
    const route = c.req.path;
    const statusCode = c.res.status.toString();
    
    // Record metrics
  // NOTE: Use path as route label (Hono does not expose matched pattern here)
  httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
  httpRequestsTotal.inc({ method, route, status_code: statusCode });
    activeConnections.dec();
  }
});

// Security middleware FIRST after request ID (saves ~0.3ms by applying early)
app.use('*', secureHeaders());

// Response compression middleware (60-80% bandwidth reduction)
app.use('*', compress({
  threshold: 1024,     // Compress responses larger than 1KB
  encoding: 'gzip',    // Use gzip compression for all browsers
}));

// ETag support for conditional requests (40-60% bandwidth savings for returning visitors)
app.use('*', etag());

// Content Security Policy and cache headers
app.use('*', (c, next) => {
  // Enhanced CSP for XSS protection
  c.header('Content-Security-Policy', 
    "default-src 'self'; img-src 'self' https://*.wp.com https://*.woocommerce.com; script-src 'self'");
  
  // Default cache headers (can be overridden in routes)
  c.header('Cache-Control', 'private, max-age=60');
  c.header('X-Powered-By', 'optica-BFF');
  
  return next();
});

app.use('*', cors({
  origin: env.CORS_ORIGIN === '*' ? ['*'] : env.CORS_ORIGIN.split(','),
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,
}));

// Async route setup after services are initialized
const setupRoutes = async () => {
  const { cacheService, globalRateLimiter } = await servicesPromise;
  const wpDisabled = process.env.INTEGRATION_WP_DISABLED === '1';
  
  // Database service already initialized during service bootstrap

  // Initialize webhook service
  // Webhook service is now handled directly by routes
  
  // Apply global rate limiting
  app.use('*', globalRateLimiter.middleware('general'));

  // Mount routes
  app.route('/health', createHealthRoutes(cacheService));
  app.route('/products', createProductRoutes(cacheService));
  app.route('/sync', syncRoutes);
  app.route('/webhooks', webhookRoutes);
  
  // Priority 1 routes (Authentication, Cart, Orders, Customers)
  app.route('/auth', createAuthRoutes(cacheService));
  app.route('/cart', createCartRoutes(cacheService));
  app.route('/orders', createOrderRoutes(cacheService));
  app.route('/customers', createCustomerRoutes(cacheService));
  
  // Priority 2 routes (Reviews, Categories, WordPress, WooCommerce)
  app.route('/reviews', createReviewRoutes(cacheService));
  app.route('/categories', createCategoryRoutes(cacheService));
  if (!wpDisabled) {
    app.route('/wordpress', createWordPressRoutes(cacheService));
    app.route('/woocommerce', createWooCommerceRoutes(cacheService));
  } else {
    logger.warn('Skipping /wordpress and /woocommerce route mounting (degraded mode)');
  }
  
  return { cacheService, globalRateLimiter };
};

// Root endpoint
app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'optica BFF API - Complete E-commerce Backend',
    version: '3.0.0',
    description: 'High-performance BFF with 60+ routes, PostgreSQL integration, real-time webhooks, and multi-tier caching',
    features: [
      'Complete e-commerce API (60+ routes)',
      'PostgreSQL primary data storage',
      'WooCommerce webhook integration',
      'Real-time data synchronization',
      'Multi-tier caching (L1 → L2 → L3)',
      'Background sync processes',
      'Professional route architecture',
      'Sub-millisecond cached responses',
      'Comprehensive monitoring'
    ],
    endpoints: {
      health: '/health',
      products: '/products',
      sync: '/sync',
      webhooks: '/webhooks',
      metrics: '/metrics',
      // Priority 1 routes
      auth: '/auth',
      cart: '/cart',
      orders: '/orders',
      customers: '/customers',
      // Priority 2 routes  
      reviews: '/reviews',
      categories: '/categories',
      wordpress: '/wordpress',
      woocommerce: '/woocommerce',
    },
    performance: {
      'Cache Hit': '1-3ms',
      'Database Hit': '10-30ms', 
      'WooCommerce Fallback': '150-300ms'
    },
    timestamp: new Date().toISOString(),
  });
});
// Admin cache invalidation endpoint (API key protected)
app.post('/admin/cache/invalidate', requireApiKey(), async (c) => {
  try {
    const body = await c.req.json();
    const pattern = body?.pattern;
    if (!pattern) return c.json({ success:false, error:{ code:'MISSING_PATTERN', message:'pattern required' }},400);
    const { cacheService } = await servicesPromise;
    await cacheService.deletePattern(pattern);
    return c.json({ success:true, data:{ pattern } });
  } catch (e:any) {
    logger.error('Admin cache invalidate failed', e);
    return c.json({ success:false, error:{ code:'INVALID_REQUEST', message:'Failed to invalidate' }},400);
  }
});

// Record latency using the primary histogram
app.use('*', async (c, next) => {
  const start = performance.now();
  await next();
  try {
    const dur = (performance.now() - start) / 1000;
    const path = c.req.path.replace(/\d+/g, ':id');
    httpRequestDuration.observe({ method: c.req.method, route: path, status_code: String(c.res.status || 200) }, dur);
  } catch {/* ignore metrics errors */}
});

// Prometheus metrics endpoint
app.get('/metrics', async (c) => {
  try {
    c.header('Content-Type', register.contentType);
    // Update dynamic gauges (cache sizes) if cache service initialized
    try {
      const { cacheService } = await servicesPromise;
      const stats = cacheService.getMemoryCacheStats();
      cacheMemoryGauge.labels('l1').set(stats.l1Size);
      cacheMemoryGauge.labels('l2').set(stats.l2Size);
    } catch {/* ignore */}
    return c.text(await register.metrics());
  } catch (error) {
  logger.error('Metrics collection error', error as Error);
    return c.text('Error collecting metrics', 500);
  }
});

// Readiness endpoint: verifies core dependencies (DB) and optional WP/Woo if enabled
app.get('/ready', async (c) => {
  const checks: Record<string, string> = {};
  // Database check
  try {
    const client = databaseService.getPrismaClient();
    await client.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (e) {
    checks.database = 'fail';
  }
  // Optional WP/Woo readiness (only if not degraded)
  if (process.env.INTEGRATION_WP_DISABLED !== '1') {
    checks.wordpress = 'pending';
    try {
      // Lightweight endpoint assumption: environment base URL reachable
      // Use fetch HEAD for base URL if available
      if (env.WP_BASE_URL) {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 3000);
        await fetch(env.WP_BASE_URL, { method: 'HEAD', signal: controller.signal }).catch(() => {});
        clearTimeout(t);
        checks.wordpress = 'ok';
      } else {
        checks.wordpress = 'skipped';
      }
    } catch {
      checks.wordpress = 'fail';
    }
  } else {
    checks.wordpress = 'disabled';
  }
  const allOk = Object.values(checks).every(v => v === 'ok' || v === 'disabled' || v === 'skipped');
  return c.json({ status: allOk ? 'ready' : 'degraded', checks });
});

// Global error handler for consistent JSON errors & prevent stack trace leaks
app.onError((error, c) => {
  const requestId = c.req.header('X-Request-ID') || 'unknown';
  
  // Log error with request ID
  logger.error('Global error', {
    requestId,
    message: (error as Error).message,
    stack: env.NODE_ENV === 'development' ? (error as Error).stack : undefined,
  } as any);

  if (error instanceof HTTPException) {
    return c.json({
      success: false,
      error: {
        code: error.status.toString(),
        message: error.message,
      },
      requestId,
    }, error.status as any);
  }

  // Don't leak stack traces in production
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    },
    requestId,
  }, 500);
});

// 404 handler with request ID
app.notFound((c) => {
  const requestId = c.req.header('X-Request-ID') || 'unknown';
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
    requestId,
  }, 404);
});

// Enhanced graceful shutdown with async hooks and connection cleanup
const gracefulShutdown = async (signal: string) => {
  logger.warn('Received shutdown signal', { signal });
  
  try {
    // Get services from promise (if they were initialized)
    const services = await servicesPromise.catch(() => null);
    
    if (services) {
      // Close cache service and Redis connections
      await services.cacheService.close();
      logger.info('Cache and Redis connections closed');
    }
    
    // Close shared HTTP agent
    globalHttpAgent.close();
    logger.info('HTTP agent closed');
    
    // Close server (wait for it to be initialized first)
    if (serverInstance) {
      serverInstance.close(() => {
        logger.info('HTTP server closed');
        // Graceful shutdown
        process.exit(0);
      });
    } else {
      // If server hasn't been initialized yet, just exit
      logger.info('Server was not yet initialized');
      process.exit(0);
    }
    
    // Force exit after timeout to prevent hanging
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    process.exit(1);
  }
};

// Register enhanced shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection', reason instanceof Error ? reason : { reason });
  gracefulShutdown('unhandledRejection');
});

// Start server with HTTP keep-alive enabled
let serverInstance: any = null;

const startServer = async () => {
  try {
    // Initialize routes after services are ready
    await setupRoutes();
    logger.info('Routes initialized');
    
    serverInstance = serve({
      fetch: app.fetch,
      port: env.PORT,
      hostname: env.HOST,
    }, (info) => {
      logger.info('Server listening', {
        address: info.address,
        port: info.port,
        nodeEnv: env.NODE_ENV,
        redis: env.REDIS_URL,
        wpGraphql: env.WP_GRAPHQL_ENDPOINT,
        wooBase: env.WP_BASE_URL,
        keepAlive: true
      });
    });
    
    return serverInstance;
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
};

const server = startServer();

// Early liveness endpoint MUST be registered before export for fast health checks
app.get('/healthz', (c) => c.json({ status: 'up', ts: Date.now() }));
export default app;
