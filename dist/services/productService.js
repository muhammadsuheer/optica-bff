/**
 * Product Service - Edge Runtime Compatible
 *
 * Features:
 * - Product CRUD operations
 * - Search and filtering
 * - Caching integration
 * - WooCommerce synchronization
 */
import { cacheService, CACHE_KEYS, CACHE_TTL, CACHE_TAGS } from './cacheService';
import databaseService from './databaseService';
import { logger } from '../utils/logger';
class ProductService {
    /**
     * Get products with filtering and pagination
     */
    async getProducts(filters = {}) {
        try {
            const { page = 1, limit = 20, status = 'publish', search, orderBy = 'created_at', orderDirection = 'desc' } = filters;
            // Generate cache key
            const cacheKey = CACHE_KEYS.PRODUCTS.LIST(filters, page);
            // Try to get from cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                logger.debug('Products cache hit', { filters, page });
                return cached;
            }
            // Get from database
            const result = await databaseService.getProducts({
                page,
                limit,
                status,
                search,
                orderBy,
                orderDirection
            });
            if (!result) {
                return null;
            }
            const response = {
                data: result.data,
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit),
                hasNext: page * limit < result.total,
                hasPrev: page > 1
            };
            // Cache the result
            await cacheService.set(cacheKey, response, {
                ttl: CACHE_TTL.PRODUCTS.LIST,
                tags: [CACHE_TAGS.PRODUCTS, CACHE_TAGS.PRODUCT_LIST]
            });
            logger.info('Products fetched', {
                count: result.data.length,
                total: result.total,
                page,
                filters
            });
            return response;
        }
        catch (error) {
            logger.error('Error fetching products', { error, filters });
            return null;
        }
    }
    /**
     * Get a single product by ID
     */
    async getProduct(id) {
        try {
            // Generate cache key
            const cacheKey = CACHE_KEYS.PRODUCTS.SINGLE(id);
            // Try to get from cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                logger.debug('Product cache hit', { id });
                return cached;
            }
            // Get from database
            const product = await databaseService.getProduct(id);
            if (!product) {
                return null;
            }
            // Cache the result
            await cacheService.set(cacheKey, product, {
                ttl: CACHE_TTL.PRODUCTS.SINGLE,
                tags: [CACHE_TAGS.PRODUCTS]
            });
            logger.debug('Product fetched', { id });
            return product;
        }
        catch (error) {
            logger.error('Error fetching product', { error, id });
            return null;
        }
    }
    /**
     * Get a single product by WooCommerce ID
     */
    async getProductByWcId(wcId) {
        try {
            // Generate cache key
            const cacheKey = `products:wc:${wcId}`;
            // Try to get from cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                logger.debug('Product by WC ID cache hit', { wcId });
                return cached;
            }
            // Get from database
            const product = await databaseService.products.getByWcId(wcId);
            if (!product) {
                return null;
            }
            // Cache the result
            await cacheService.set(cacheKey, product, {
                ttl: CACHE_TTL.PRODUCTS.SINGLE,
                tags: [CACHE_TAGS.PRODUCTS]
            });
            logger.debug('Product by WC ID fetched', { wcId });
            return product;
        }
        catch (error) {
            logger.error('Error fetching product by WC ID', { error, wcId });
            return null;
        }
    }
    /**
     * Search products
     */
    async searchProducts(query, limit = 20) {
        try {
            if (!query || query.trim().length < 2) {
                return [];
            }
            const trimmedQuery = query.trim();
            // Generate cache key
            const cacheKey = CACHE_KEYS.PRODUCTS.SEARCH(trimmedQuery, limit);
            // Try to get from cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                logger.debug('Product search cache hit', { query: trimmedQuery });
                return cached;
            }
            // Search in database
            const products = await databaseService.searchProducts(trimmedQuery, limit);
            if (!products) {
                return [];
            }
            // Cache the result
            await cacheService.set(cacheKey, products, {
                ttl: CACHE_TTL.PRODUCTS.SEARCH,
                tags: [CACHE_TAGS.PRODUCTS, CACHE_TAGS.PRODUCT_SEARCH]
            });
            logger.info('Products searched', { query: trimmedQuery, count: products.length });
            return products;
        }
        catch (error) {
            logger.error('Error searching products', { error, query });
            return [];
        }
    }
    /**
     * Get popular/featured products
     */
    async getPopularProducts(limit = 20) {
        try {
            // Generate cache key
            const cacheKey = CACHE_KEYS.PRODUCTS.POPULAR(limit);
            // Try to get from cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                logger.debug('Popular products cache hit', { limit });
                return cached;
            }
            // Get from database
            const products = await databaseService.products.getPopular(limit);
            if (!products) {
                return [];
            }
            // Cache the result
            await cacheService.set(cacheKey, products, {
                ttl: CACHE_TTL.PRODUCTS.POPULAR,
                tags: [CACHE_TAGS.PRODUCTS]
            });
            logger.info('Popular products fetched', { count: products.length });
            return products;
        }
        catch (error) {
            logger.error('Error fetching popular products', { error, limit });
            return [];
        }
    }
    /**
     * Create or update a product
     */
    async upsertProduct(product) {
        try {
            const result = await databaseService.createProduct(product);
            if (!result) {
                return null;
            }
            // Invalidate related caches
            await this.invalidateProductCaches();
            logger.info('Product upserted', { id: result.id, wc_id: result.wc_id });
            return result;
        }
        catch (error) {
            logger.error('Error upserting product', { error, product });
            return null;
        }
    }
    /**
     * Bulk upsert products
     */
    async bulkUpsertProducts(products) {
        try {
            const result = await databaseService.products.bulkUpsert(products);
            if (!result) {
                return [];
            }
            // Invalidate related caches
            await this.invalidateProductCaches();
            logger.info('Products bulk upserted', { count: result.length });
            return result;
        }
        catch (error) {
            logger.error('Error bulk upserting products', { error, count: products.length });
            return [];
        }
    }
    /**
     * Delete a product
     */
    async deleteProduct(id) {
        try {
            const success = await databaseService.deleteProduct(id);
            if (success) {
                // Invalidate related caches
                await this.invalidateProductCaches();
                logger.info('Product deleted', { id });
            }
            return success;
        }
        catch (error) {
            logger.error('Error deleting product', { error, id });
            return false;
        }
    }
    /**
     * Get product categories
     */
    async getCategories() {
        try {
            // Generate cache key
            const cacheKey = CACHE_KEYS.PRODUCTS.CATEGORIES();
            // Try to get from cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                logger.debug('Categories cache hit');
                return cached;
            }
            // Get from database (this would need to be implemented in databaseService)
            // For now, return empty array
            const categories = [];
            // Cache the result
            await cacheService.set(cacheKey, categories, {
                ttl: CACHE_TTL.PRODUCTS.CATEGORIES,
                tags: [CACHE_TAGS.PRODUCTS]
            });
            logger.debug('Categories fetched', { count: categories.length });
            return categories;
        }
        catch (error) {
            logger.error('Error fetching categories', { error });
            return [];
        }
    }
    /**
     * Invalidate product-related caches
     */
    async invalidateProductCaches() {
        try {
            await cacheService.invalidateByTags([
                CACHE_TAGS.PRODUCTS,
                CACHE_TAGS.PRODUCT_LIST,
                CACHE_TAGS.PRODUCT_SEARCH
            ]);
            logger.debug('Product caches invalidated');
        }
        catch (error) {
            logger.error('Error invalidating product caches', { error });
        }
    }
    /**
     * Health check
     */
    async healthCheck() {
        const startTime = Date.now();
        try {
            // Test database connectivity
            const testProduct = await databaseService.getProduct(1);
            const latency = Date.now() - startTime;
            return {
                healthy: true,
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
export const productService = new ProductService();
// Export class for testing
export { ProductService };
//# sourceMappingURL=productService.js.map