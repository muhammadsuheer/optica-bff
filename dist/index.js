/**
 * Optia BFF (Backend for Frontend) - Edge Runtime Compatible
 * Built with HonoJS for Vercel Edge Functions
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger as honoLogger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
// Import configuration and utilities
import { config } from './config/env';
import { logger } from './utils/logger';
// Import routes
import authRoutes from './routes/auth';
import healthRoutes from './routes/health';
import productsRoutes from './routes/products';
import cartRoutes from './routes/cart';
import ordersRoutes from './routes/orders';
import customersRoutes from './routes/customers';
import woocommerceRoutes from './routes/woocommerce';
import syncRoutes from './routes/sync';
import webhookRoutes from './routes/edgeWebhooks';
import metricsRoutes from './routes/metrics';
// Import middleware
import { apiKeyRateLimit } from './middleware/rateLimiter';
import { performanceMonitoring } from './middleware/performance';
import { requestDeduplication } from './middleware/deduplication';
// Environment validation is handled in edgeEnv.ts at startup
// Initialize Hono app
const app = new Hono();
// Global middleware - order matters!
app.use('*', performanceMonitoring());
app.use('*', requestDeduplication());
app.use('*', honoLogger((message) => {
    logger.info(message);
}));
app.use('*', secureHeaders({
    contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", config.supabase.url, "https://*.supabase.co"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
    },
    crossOriginEmbedderPolicy: false, // Disable for Edge compatibility
}));
app.use('*', cors({
    origin: config.cors.origins,
    allowHeaders: [
        'Content-Type',
        'Authorization',
        'X-API-Key',
        'X-Session-ID',
        'X-Cart-Session',
        'X-Requested-With'
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    exposeHeaders: [
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
        'X-Total-Count',
        'X-Response-Time',
        'X-Dedup-Hit-Rate'
    ],
    credentials: config.cors.credentials,
    maxAge: config.cors.maxAge,
}));
// Global rate limiting
app.use('*', apiKeyRateLimit({
    requests: config.rateLimiting.requests,
    window: config.rateLimiting.window
}));
// Health check routes (no API key required)
app.route('/health', healthRoutes);
// API routes with authentication
app.route('/api/auth', authRoutes);
app.route('/api/products', productsRoutes);
app.route('/api/cart', cartRoutes);
app.route('/api/orders', ordersRoutes);
app.route('/api/customers', customersRoutes);
app.route('/api/woocommerce', woocommerceRoutes);
app.route('/api/sync', syncRoutes);
app.route('/api/webhooks', webhookRoutes);
app.route('/api/metrics', metricsRoutes);
// Root endpoint
app.get('/', (c) => {
    return c.json({
        name: 'Optia BFF',
        version: '1.0.0',
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/health',
            auth: '/api/auth',
            products: '/api/products',
            cart: '/api/cart'
        }
    });
});
// API documentation endpoint
app.get('/api', (c) => {
    return c.json({
        name: 'Optia BFF API',
        version: '1.0.0',
        documentation: {
            auth: {
                signup: 'POST /api/auth/signup',
                signin: 'POST /api/auth/signin',
                signout: 'POST /api/auth/signout',
                user: 'GET /api/auth/user',
                refresh: 'POST /api/auth/refresh'
            },
            products: {
                list: 'GET /api/products',
                detail: 'GET /api/products/:id',
                search: 'GET /api/products/search',
                categories: 'GET /api/products/categories',
                stream: 'GET /api/products/stream',
                popular: 'GET /api/products/popular'
            },
            cart: {
                get: 'GET /api/cart',
                add: 'POST /api/cart/items',
                update: 'PUT /api/cart/items/:itemId',
                remove: 'DELETE /api/cart/items/:itemId',
                clear: 'DELETE /api/cart',
                totals: 'GET /api/cart/totals'
            },
            metrics: {
                performance: 'GET /api/metrics/performance',
                cache: 'GET /api/metrics/cache',
                circuitBreakers: 'GET /api/metrics/circuit-breakers'
            }
        },
        authentication: {
            apiKey: 'Required for all API endpoints via X-API-Key header',
            jwt: 'Required for protected endpoints via Authorization: Bearer <token> header'
        }
    });
});
// Performance metrics are available via /api/metrics routes
// Global error handler
app.onError((err, c) => {
    if (err instanceof HTTPException) {
        logger.warn('HTTP Exception', {
            status: err.status,
            message: err.message,
            path: c.req.path,
            method: c.req.method
        });
        return c.json({
            error: err.message,
            status: err.status,
            timestamp: new Date().toISOString()
        }, err.status);
    }
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: c.req.path,
        method: c.req.method
    });
    return c.json({
        error: 'Internal Server Error',
        status: 500,
        timestamp: new Date().toISOString()
    }, 500);
});
// 404 handler
app.notFound((c) => {
    logger.warn('Route not found', {
        path: c.req.path,
        method: c.req.method,
        userAgent: c.req.header('user-agent')
    });
    return c.json({
        error: 'Not Found',
        message: `Route ${c.req.method} ${c.req.path} not found`,
        status: 404,
        timestamp: new Date().toISOString()
    }, 404);
});
// Startup logging
logger.info('Optia BFF starting', {
    name: 'Optia BFF',
    version: '1.0.0',
    environment: config.nodeEnv,
    runtime: 'edge'
});
// Export for Vercel Edge Functions
export default app;
//# sourceMappingURL=index.js.map