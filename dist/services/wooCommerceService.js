/**
 * WooCommerce Service - Edge Runtime Compatible
 *
 * Features:
 * - WooCommerce API integration
 * - Product synchronization
 * - Order management
 * - Customer management
 * - Webhook handling
 */
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { cacheService, CACHE_TTL, CACHE_TAGS } from './cacheService';
class WooCommerceService {
    baseUrl;
    consumerKey;
    consumerSecret;
    constructor() {
        this.baseUrl = config.woocommerce.apiUrl;
        this.consumerKey = config.woocommerce.consumerKey;
        this.consumerSecret = config.woocommerce.consumerSecret;
    }
    /**
     * Make authenticated request to WooCommerce API
     */
    async makeRequest(endpoint, options = {}) {
        try {
            const url = new URL(endpoint, this.baseUrl);
            // Add authentication
            url.searchParams.set('consumer_key', this.consumerKey);
            url.searchParams.set('consumer_secret', this.consumerSecret);
            const response = await fetch(url.toString(), {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Optia-BFF/1.0.0',
                    ...options.headers
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return data;
        }
        catch (error) {
            logger.error('WooCommerce API request failed', {
                endpoint,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return null;
        }
    }
    /**
     * Get products from WooCommerce
     */
    async getProducts(params = {}) {
        try {
            const { page = 1, per_page = 20, search, status = 'publish', featured, category, orderby = 'date', order = 'desc' } = params;
            // Generate cache key
            const cacheKey = `wc:products:${JSON.stringify(params)}`;
            // Try to get from cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                logger.debug('WooCommerce products cache hit', { params });
                return cached;
            }
            // Build query parameters
            const queryParams = new URLSearchParams({
                page: page.toString(),
                per_page: per_page.toString(),
                status,
                orderby,
                order
            });
            if (search)
                queryParams.set('search', search);
            if (featured !== undefined)
                queryParams.set('featured', featured.toString());
            if (category)
                queryParams.set('category', category);
            const products = await this.makeRequest(`/wp-json/wc/v3/products?${queryParams.toString()}`);
            if (!products) {
                return [];
            }
            // Cache the result
            await cacheService.set(cacheKey, products, {
                ttl: CACHE_TTL.PRODUCTS.LIST,
                tags: [CACHE_TAGS.PRODUCTS, 'woocommerce']
            });
            logger.info('WooCommerce products fetched', {
                count: products.length,
                params
            });
            return products;
        }
        catch (error) {
            logger.error('Error fetching WooCommerce products', { error, params });
            return [];
        }
    }
    /**
     * Get a single product from WooCommerce
     */
    async getProduct(id) {
        try {
            // Generate cache key
            const cacheKey = `wc:product:${id}`;
            // Try to get from cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                logger.debug('WooCommerce product cache hit', { id });
                return cached;
            }
            const product = await this.makeRequest(`/wp-json/wc/v3/products/${id}`);
            if (!product) {
                return null;
            }
            // Cache the result
            await cacheService.set(cacheKey, product, {
                ttl: CACHE_TTL.PRODUCTS.SINGLE,
                tags: [CACHE_TAGS.PRODUCTS, 'woocommerce']
            });
            logger.debug('WooCommerce product fetched', { id });
            return product;
        }
        catch (error) {
            logger.error('Error fetching WooCommerce product', { error, id });
            return null;
        }
    }
    /**
     * Get orders from WooCommerce
     */
    async getOrders(params = {}) {
        try {
            const { page = 1, per_page = 20, status, customer, orderby = 'date', order = 'desc' } = params;
            // Generate cache key
            const cacheKey = `wc:orders:${JSON.stringify(params)}`;
            // Try to get from cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                logger.debug('WooCommerce orders cache hit', { params });
                return cached;
            }
            // Build query parameters
            const queryParams = new URLSearchParams({
                page: page.toString(),
                per_page: per_page.toString(),
                orderby,
                order
            });
            if (status)
                queryParams.set('status', status);
            if (customer)
                queryParams.set('customer', customer.toString());
            const orders = await this.makeRequest(`/wp-json/wc/v3/orders?${queryParams.toString()}`);
            if (!orders) {
                return [];
            }
            // Cache the result
            await cacheService.set(cacheKey, orders, {
                ttl: CACHE_TTL.ORDERS.LIST,
                tags: [CACHE_TAGS.ORDERS, 'woocommerce']
            });
            logger.info('WooCommerce orders fetched', {
                count: orders.length,
                params
            });
            return orders;
        }
        catch (error) {
            logger.error('Error fetching WooCommerce orders', { error, params });
            return [];
        }
    }
    /**
     * Get a single order from WooCommerce
     */
    async getOrder(id) {
        try {
            // Generate cache key
            const cacheKey = `wc:order:${id}`;
            // Try to get from cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                logger.debug('WooCommerce order cache hit', { id });
                return cached;
            }
            const order = await this.makeRequest(`/wp-json/wc/v3/orders/${id}`);
            if (!order) {
                return null;
            }
            // Cache the result
            await cacheService.set(cacheKey, order, {
                ttl: CACHE_TTL.ORDERS.SINGLE,
                tags: [CACHE_TAGS.ORDERS, 'woocommerce']
            });
            logger.debug('WooCommerce order fetched', { id });
            return order;
        }
        catch (error) {
            logger.error('Error fetching WooCommerce order', { error, id });
            return null;
        }
    }
    /**
     * Update order status
     */
    async updateOrderStatus(id, status) {
        try {
            const order = await this.makeRequest(`/wp-json/wc/v3/orders/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            if (order) {
                // Invalidate order cache
                await cacheService.del(`wc:order:${id}`);
                await cacheService.invalidateByTags([CACHE_TAGS.ORDERS]);
                logger.info('WooCommerce order status updated', { id, status });
            }
            return order;
        }
        catch (error) {
            logger.error('Error updating WooCommerce order status', { error, id, status });
            return null;
        }
    }
    /**
     * Sync product from WooCommerce to local database
     */
    async syncProduct(wcProduct) {
        try {
            // Transform WooCommerce product to local format
            const localProduct = {
                wc_id: wcProduct.id,
                name: wcProduct.name,
                slug: wcProduct.slug,
                description: wcProduct.description,
                short_description: wcProduct.short_description,
                price: parseFloat(wcProduct.price) || 0,
                regular_price: parseFloat(wcProduct.regular_price) || 0,
                sale_price: wcProduct.sale_price ? parseFloat(wcProduct.sale_price) : null,
                status: wcProduct.status,
                featured: wcProduct.featured,
                images: wcProduct.images.map(img => img.src),
                categories: wcProduct.categories.map(cat => cat.name),
                tags: wcProduct.tags.map(tag => tag.name),
                attributes: wcProduct.attributes.reduce((acc, attr) => {
                    acc[attr.name] = attr.options;
                    return acc;
                }, {}),
                stock_status: wcProduct.stock_status,
                stock_quantity: wcProduct.stock_quantity,
                weight: wcProduct.weight ? parseFloat(wcProduct.weight) : null,
                dimensions: {
                    length: wcProduct.dimensions.length ? parseFloat(wcProduct.dimensions.length) : null,
                    width: wcProduct.dimensions.width ? parseFloat(wcProduct.dimensions.width) : null,
                    height: wcProduct.dimensions.height ? parseFloat(wcProduct.dimensions.height) : null
                },
                created_at: wcProduct.date_created,
                updated_at: wcProduct.date_modified
            };
            // Import databaseService to upsert the product
            const { productService } = await import('./productService');
            const result = await productService.upsertProduct(localProduct);
            if (result) {
                logger.info('Product synced from WooCommerce', {
                    wc_id: wcProduct.id,
                    local_id: result.id
                });
                return true;
            }
            return false;
        }
        catch (error) {
            logger.error('Error syncing product from WooCommerce', {
                error,
                wc_id: wcProduct.id
            });
            return false;
        }
    }
    /**
     * Sync multiple products from WooCommerce
     */
    async syncProducts(wcProducts) {
        let synced = 0;
        let failed = 0;
        for (const wcProduct of wcProducts) {
            const success = await this.syncProduct(wcProduct);
            if (success) {
                synced++;
            }
            else {
                failed++;
            }
        }
        logger.info('Products sync completed', { synced, failed, total: wcProducts.length });
        return { synced, failed };
    }
    /**
     * Health check
     */
    async healthCheck() {
        const startTime = Date.now();
        try {
            // Test API connectivity
            const products = await this.makeRequest('/wp-json/wc/v3/products?per_page=1');
            const latency = Date.now() - startTime;
            return {
                healthy: products !== null,
                latency
            };
        }
        catch (error) {
            return {
                healthy: false,
                latency: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}
// Export singleton instance
export const wooCommerceService = new WooCommerceService();
// Export class for testing
export { WooCommerceService };
//# sourceMappingURL=wooCommerceService.js.map