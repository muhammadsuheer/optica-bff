import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { productService } from '../services/productService';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { apiKey } from '../middleware/apiKey';
import { requireAuth, requireRole } from '../middleware/auth';
import { wooCommerceService } from '../services/wooCommerceService';
import { circuitBreakers } from '../middleware/circuitBreaker';
import { upstashCache } from '../lib/upstashClient';
// Create products router
const products = new Hono();
// Apply middleware
products.use('*', apiKey({ allowedKeyTypes: ['frontend', 'admin', 'mobile'] }));
// Apply CORS specifically for products API
products.use('*', cors({
    origin: config.cors.origins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: config.cors.credentials,
}));
/**
 * GET /products/stream - Stream large product lists
 */
products.get('/stream', async (c) => {
    const { search, category, limit = 1000 } = c.req.query();
    const encoder = new TextEncoder();
    let count = 0;
    const stream = new ReadableStream({
        async start(controller) {
            try {
                // Stream products in chunks of 50
                for (let page = 1; page * 50 <= Number(limit); page++) {
                    const products = await circuitBreakers.woocommerce.execute(() => wooCommerceService.getProducts({
                        page,
                        per_page: 50,
                        search,
                        category
                    }));
                    if (products.length === 0)
                        break;
                    for (const product of products) {
                        controller.enqueue(encoder.encode(JSON.stringify(product) + '\n'));
                        count++;
                    }
                    // Yield control to prevent blocking
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
                controller.close();
                logger.info('Product stream completed', { count });
            }
            catch (error) {
                logger.error('Product stream error', { error });
                controller.error(error);
            }
        }
    });
    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'public, max-age=300',
            'X-Stream-Count': count.toString()
        }
    });
});
/**
 * GET /products
 * Get products with pagination, filtering, and search
 */
products.get('/', async (c) => {
    try {
        const query = c.req.query();
        const options = {
            page: parseInt(query.page || '1'),
            limit: Math.min(parseInt(query.limit || '20'), 100), // Max 100 per page
            status: query.status || 'publish',
            search: query.search,
            orderBy: query.orderBy || 'created_at',
            orderDirection: query.orderDirection || 'desc'
        };
        const result = await productService.getProducts(options);
        if (!result) {
            return c.json({
                success: false,
                error: 'Service error',
                message: 'Failed to fetch products'
            }, 500);
        }
        return c.json({
            success: true,
            data: result.data,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages
            },
            meta: {
                count: result.data.length,
                hasNext: result.hasNext,
                hasPrev: result.hasPrev
            }
        });
    }
    catch (error) {
        logger.error('Error fetching products', { error });
        return c.json({
            success: false,
            error: 'Internal Server Error',
            message: config.nodeEnv === 'development' ? error.message : 'Failed to fetch products'
        }, 500);
    }
});
/**
 * GET /products/popular
 * Get popular/featured products
 */
products.get('/popular', async (c) => {
    try {
        const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50); // Max 50
        const result = await productService.getPopularProducts(limit);
        return c.json({
            success: true,
            data: result,
            meta: {
                count: result.length,
                limit
            }
        });
    }
    catch (error) {
        logger.error('Error fetching popular products', { error });
        return c.json({
            success: false,
            error: 'Internal Server Error',
            message: config.nodeEnv === 'development' ? error.message : 'Failed to fetch popular products'
        }, 500);
    }
});
/**
 * GET /products/search
 * Search products by query
 */
products.get('/search', async (c) => {
    try {
        const query = c.req.query('q');
        const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
        if (!query || query.trim().length < 2) {
            return c.json({
                success: false,
                error: 'Invalid Query',
                message: 'Search query must be at least 2 characters long'
            }, 400);
        }
        const result = await productService.searchProducts(query.trim(), limit);
        return c.json({
            success: true,
            data: result,
            meta: {
                query: query.trim(),
                count: result.length,
                limit
            }
        });
    }
    catch (error) {
        logger.error('Error searching products', { error });
        return c.json({
            success: false,
            error: 'Internal Server Error',
            message: config.nodeEnv === 'development' ? error.message : 'Failed to search products'
        }, 500);
    }
});
/**
 * GET /products/:id
 * Get a single product by ID
 */
products.get('/:id', async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        if (isNaN(id) || id <= 0) {
            return c.json({
                success: false,
                error: 'Invalid ID',
                message: 'Product ID must be a positive number'
            }, 400);
        }
        const product = await productService.getProduct(id);
        if (!product) {
            return c.json({
                success: false,
                error: 'Not Found',
                message: 'Product not found'
            }, 404);
        }
        return c.json({
            success: true,
            data: product
        });
    }
    catch (error) {
        logger.error('Error fetching product', { error, id: c.req.param('id') });
        return c.json({
            success: false,
            error: 'Internal Server Error',
            message: config.nodeEnv === 'development' ? error.message : 'Failed to fetch product'
        }, 500);
    }
});
/**
 * GET /products/wc/:wcId
 * Get a single product by WooCommerce ID
 */
products.get('/wc/:wcId', async (c) => {
    try {
        const wcId = parseInt(c.req.param('wcId'));
        if (isNaN(wcId) || wcId <= 0) {
            return c.json({
                success: false,
                error: 'Invalid WC ID',
                message: 'WooCommerce ID must be a positive number'
            }, 400);
        }
        const product = await productService.getProductByWcId(wcId);
        if (!product) {
            return c.json({
                success: false,
                error: 'Not Found',
                message: 'Product not found'
            }, 404);
        }
        return c.json({
            success: true,
            data: product
        });
    }
    catch (error) {
        logger.error('Error fetching product by WC ID', { error, wcId: c.req.param('wcId') });
        return c.json({
            success: false,
            error: 'Internal Server Error',
            message: config.nodeEnv === 'development' ? error.message : 'Failed to fetch product'
        }, 500);
    }
});
/**
 * POST /products
 * Create or update a product (Admin only)
 */
products.post('/', requireAuth(), requireRole(['admin', 'service_role']), async (c) => {
    try {
        const body = await c.req.json();
        // Basic validation
        if (!body.wc_id || !body.name || !body.slug) {
            return c.json({
                success: false,
                error: 'Validation Error',
                message: 'Missing required fields: wc_id, name, slug'
            }, 400);
        }
        const product = await productService.upsertProduct(body);
        if (!product) {
            return c.json({
                success: false,
                error: 'Service Error',
                message: 'Failed to create/update product'
            }, 500);
        }
        return c.json({
            success: true,
            data: product,
            message: 'Product created/updated successfully'
        }, 201);
    }
    catch (error) {
        logger.error('Error creating/updating product', { error });
        return c.json({
            success: false,
            error: 'Internal Server Error',
            message: config.nodeEnv === 'development' ? error.message : 'Failed to create/update product'
        }, 500);
    }
});
/**
 * POST /products/bulk
 * Bulk create/update products (Admin only)
 */
products.post('/bulk', requireAuth(), requireRole(['admin', 'service_role']), async (c) => {
    try {
        const body = await c.req.json();
        if (!Array.isArray(body) || body.length === 0) {
            return c.json({
                success: false,
                error: 'Validation Error',
                message: 'Body must be a non-empty array of products'
            }, 400);
        }
        if (body.length > 100) {
            return c.json({
                success: false,
                error: 'Validation Error',
                message: 'Maximum 100 products per bulk operation'
            }, 400);
        }
        const products = await productService.bulkUpsertProducts(body);
        if (!products || products.length === 0) {
            return c.json({
                success: false,
                error: 'Service Error',
                message: 'Failed to bulk create/update products'
            }, 500);
        }
        return c.json({
            success: true,
            data: products,
            meta: {
                created: products.length,
                requested: body.length
            },
            message: `Successfully processed ${products.length} products`
        });
    }
    catch (error) {
        logger.error('Error bulk creating/updating products', { error });
        return c.json({
            success: false,
            error: 'Internal Server Error',
            message: config.nodeEnv === 'development' ? error.message : 'Failed to bulk create/update products'
        }, 500);
    }
});
/**
 * DELETE /products/:id
 * Delete a product (Admin only)
 */
products.delete('/:id', requireAuth(), requireRole(['admin', 'service_role']), async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        if (isNaN(id) || id <= 0) {
            return c.json({
                success: false,
                error: 'Invalid ID',
                message: 'Product ID must be a positive number'
            }, 400);
        }
        const success = await productService.deleteProduct(id);
        if (!success) {
            return c.json({
                success: false,
                error: 'Service Error',
                message: 'Failed to delete product'
            }, 500);
        }
        return c.json({
            success: true,
            message: 'Product deleted successfully'
        });
    }
    catch (error) {
        logger.error('Error deleting product', { error, id: c.req.param('id') });
        return c.json({
            success: false,
            error: 'Internal Server Error',
            message: config.nodeEnv === 'development' ? error.message : 'Failed to delete product'
        }, 500);
    }
});
// Health check for products service
products.get('/health', async (c) => {
    try {
        const healthCheck = await productService.healthCheck();
        return c.json({
            success: healthCheck.healthy,
            service: 'products',
            healthy: healthCheck.healthy,
            latency: healthCheck.latency,
            error: healthCheck.error,
            timestamp: new Date().toISOString()
        }, healthCheck.healthy ? 200 : 503);
    }
    catch (error) {
        logger.error('Products health check failed', { error });
        return c.json({
            success: false,
            service: 'products',
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        }, 500);
    }
});
/**
 * GET /products/stream - Stream all products (NDJSON)
 */
products.get('/stream', async (c) => {
    try {
        const batchSize = parseInt(c.req.query('batch_size') || '50');
        const delayMs = parseInt(c.req.query('delay_ms') || '0');
        logger.info('Starting product stream', { batchSize, delayMs });
        // Simple implementation - get products with circuit breaker
        const products = await circuitBreakers.woocommerce.execute(async () => {
            return await productService.getProducts({
                page: 1,
                per_page: batchSize,
                status: 'publish'
            });
        });
        // Return JSON response
        return c.json(products, 200, {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json'
        });
    }
    catch (error) {
        logger.error('Product streaming error', { error });
        throw new HTTPException(500, { message: 'Failed to stream products' });
    }
});
/**
 * GET /products/popular - Get popular products with smart caching
 */
products.get('/popular', async (c) => {
    try {
        const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
        const cacheKey = `products:popular:${limit}`;
        // Try cache first
        const cached = await upstashCache.get(cacheKey);
        if (cached) {
            logger.debug('Popular products cache hit');
            return c.json({
                products: cached,
                cached: true,
                timestamp: new Date().toISOString()
            });
        }
        // Fetch popular products with circuit breaker
        const products = await circuitBreakers.woocommerce.execute(async () => {
            return await productService.getPopularProducts(limit);
        });
        // Cache for 2 hours
        await upstashCache.set(cacheKey, products, 7200);
        logger.info('Popular products fetched', { count: products.length });
        return c.json({
            products,
            cached: false,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger.error('Popular products error', { error });
        throw new HTTPException(500, { message: 'Failed to fetch popular products' });
    }
});
export default products;
//# sourceMappingURL=products.js.map