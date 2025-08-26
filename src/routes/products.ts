/**
 * Product Routes - Ultra-High Performance Implementation
 * 
 * Features:
 * - Response caching with intelligent TTL
 * - Parallel request processing where applicable
 * - Pre-compiled validation schemas
 * - Performance monitoring per endpoint
 * - Optimized error handling
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest.js';
import { ProductService } from '../services/productService.js';
import { CacheService } from '../services/cacheService.js';
import { logger } from '../utils/logger.js';
import { CacheKey } from '../utils/cacheKey.js';
import type { ApiResponse, ApiProduct, PreAllocatedErrors } from '../types/index.js';
import { PreAllocatedErrors as Errors } from '../types/index.js';

// Pre-compiled Zod schemas for maximum performance
const productParamsSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
}).strict();

const productQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
  per_page: z.string().regex(/^\d+$/).transform(Number).optional().default(20),
  search: z.string().min(2).optional(),
  categories: z.string().optional().transform(val => val ? val.split(',') : undefined),
  orderby: z.enum(['date', 'title', 'menu_order']).optional().default('date'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
}).strict();

const searchQuerySchema = z.object({
  q: z.string().min(2, 'Search query must be at least 2 characters'),
  page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
  per_page: z.string().regex(/^\d+$/).transform(Number).optional().default(20),
  categories: z.string().optional().transform(val => val ? val.split(',') : undefined),
}).strict();

const bulkQuerySchema = z.object({
  batch_size: z.string().regex(/^\d+$/).transform(Number).optional().default(100),
  max_concurrent: z.string().regex(/^\d+$/).transform(Number).optional().default(8),
  use_cache: z.string().optional().transform(val => val !== 'false').default(true),
}).strict();

// Performance monitoring
const routeStats = {
  productsList: { requests: 0, avgTime: 0, errors: 0 },
  productDetail: { requests: 0, avgTime: 0, errors: 0 },
  productSearch: { requests: 0, avgTime: 0, errors: 0 },
  bulkFetch: { requests: 0, avgTime: 0, errors: 0 },
};

/**
 * Product routes with ultra-high performance optimizations
 */
export function createProductRoutes(cacheService: CacheService): Hono {
  const products = new Hono();
  const productService = new ProductService();

  /**
   * GET /products - Fetch products list with SWR caching and parallel processing
   */
  products.get(
    '/',
    validateRequest({ query: productQuerySchema }),
    async (c) => {
      const startTime = Date.now();
      routeStats.productsList.requests++;
      
      try {
        const query = c.req.query();
        const validatedQuery = productQuerySchema.parse(query);
        
        // Early validation for performance
        if (validatedQuery.page < 1 || validatedQuery.per_page < 1 || validatedQuery.per_page > 100) {
          const response: ApiResponse<ApiProduct[]> = {
            success: false,
            error: {
              code: 'INVALID_PARAMS',
              message: 'Invalid pagination parameters',
            },
          };
          
          c.header('X-Response-Time', `${Date.now() - startTime}ms`);
          return c.json(response, 400);
        }

        // Convert orderby format
        const orderBy = validatedQuery.orderby === 'date' ? 'DATE' : 
                       validatedQuery.orderby === 'title' ? 'TITLE' : 'MENU_ORDER';
        const order = validatedQuery.order.toUpperCase() as 'ASC' | 'DESC';

        // Use ProductService with SWR pattern for ultra-fast responses
        const result = await productService.getProducts({
          page: validatedQuery.page,
          perPage: validatedQuery.per_page,
          search: validatedQuery.search,
          categories: validatedQuery.categories,
          orderBy,
          order,
        });

        // Update performance stats
        const responseTime = Date.now() - startTime;
        routeStats.productsList.avgTime = (routeStats.productsList.avgTime + responseTime) / 2;

        // Enhanced cache headers for CDN optimization
        c.header('X-Response-Time', `${responseTime}ms`);
        c.header('X-Cache-Status', result.data ? 'processed' : 'error');
        c.header('Cache-Control', 'public, max-age=60, s-maxage=300'); // Browser: 1min, CDN: 5min
        c.header('Surrogate-Key', `products-list page-${validatedQuery.page}`); // CDN cache purging
        c.header('Vary', 'Accept-Encoding'); // Vary by compression support
        
        return c.json(result, result.success ? 200 : 500);

      } catch (error) {
        routeStats.productsList.errors++;
        logger.error('Products list route error:', error as Error);
        
        const response: ApiResponse<ApiProduct[]> = {
          success: false,
          error: Errors.INTERNAL_ERROR, // Use pre-allocated error
        };

        const responseTime = Date.now() - startTime;
        c.header('X-Response-Time', `${responseTime}ms`);
        
        return c.json(response, 500);
      }
    }
  );

  /**
   * GET /products/:id - Fetch single product with aggressive caching
   */
  products.get(
    '/:id',
    validateRequest({ params: productParamsSchema }),
    async (c) => {
      const startTime = Date.now();
      routeStats.productDetail.requests++;
      
      try {
        const { id } = c.req.param();
        const productId = parseInt(id);

        if (isNaN(productId) || productId <= 0) {
          const response: ApiResponse<ApiProduct> = {
            success: false,
            error: {
              code: 'INVALID_PRODUCT_ID',
              message: 'Product ID must be a positive number',
            },
          };
          
          c.header('X-Response-Time', `${Date.now() - startTime}ms`);
          return c.json(response, 400);
        }

        // Use ProductService for optimized single product fetch
        const result = await productService.getProduct(productId);

        // Update performance stats
        const responseTime = Date.now() - startTime;
        routeStats.productDetail.avgTime = (routeStats.productDetail.avgTime + responseTime) / 2;

        // Enhanced cache headers for single products (longer cache for static data)
        c.header('X-Response-Time', `${responseTime}ms`);
        c.header('X-Cache-Status', result.success ? 'processed' : 'error');
        c.header('Cache-Control', 'public, max-age=300, s-maxage=1800'); // Browser: 5min, CDN: 30min
        c.header('Surrogate-Key', `product-${productId}`); // Individual product cache purging
        c.header('Vary', 'Accept-Encoding');
        
        return c.json(result, result.success ? 200 : (result.error?.code === 'PRODUCT_NOT_FOUND' ? 404 : 500));

      } catch (error) {
        routeStats.productDetail.errors++;
        logger.error('Product detail route error:', error as Error);
        
        const response: ApiResponse<ApiProduct> = {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch product',
          },
        };

        const responseTime = Date.now() - startTime;
        c.header('X-Response-Time', `${responseTime}ms`);
        
        return c.json(response, 500);
      }
    }
  );

  /**
   * GET /products/search - Optimized product search with result caching
   */
  products.get(
    '/search',
    validateRequest({ query: searchQuerySchema }),
    async (c) => {
      const startTime = Date.now();
      routeStats.productSearch.requests++;
      
      try {
        const query = c.req.query();
        const validatedQuery = searchQuerySchema.parse(query);

        // Use ProductService search method (which uses getProducts internally)
        const result = await productService.getProducts({
          page: validatedQuery.page,
          perPage: validatedQuery.per_page,
          search: validatedQuery.q,
          categories: validatedQuery.categories,
          orderBy: 'DATE',
          order: 'DESC',
        });

        // Update performance stats
        const responseTime = Date.now() - startTime;
        routeStats.productSearch.avgTime = (routeStats.productSearch.avgTime + responseTime) / 2;

        // Performance headers
        c.header('X-Response-Time', `${responseTime}ms`);
        c.header('X-Cache-Status', result.success ? 'processed' : 'error');
        c.header('X-Search-Query', validatedQuery.q);
        
        return c.json(result, result.success ? 200 : 500);

      } catch (error) {
        routeStats.productSearch.errors++;
        logger.error('Product search route error:', error as Error);
        
        const response: ApiResponse<ApiProduct[]> = {
          success: false,
          error: {
            code: 'SEARCH_ERROR',
            message: 'Failed to search products',
          },
        };

        const responseTime = Date.now() - startTime;
        c.header('X-Response-Time', `${responseTime}ms`);
        
        return c.json(response, 500);
      }
    }
  );

  /**
   * GET /products/bulk - Fetch all products with optimal pagination
   * Designed for initial sync or full catalog fetch
   */
  products.get(
    '/bulk',
    validateRequest({ 
      query: bulkQuerySchema,
    }),
    async (c) => {
      const startTime = Date.now();
      routeStats.bulkFetch.requests++;
      
      try {
        const query = c.req.query();
        const { batch_size, max_concurrent, use_cache } = bulkQuerySchema.parse(query);
        
        let progressCount = 0;
        const result = await productService.getAllProducts({
          batchSize: batch_size,
          maxConcurrent: max_concurrent,
          useCache: use_cache,
          onProgress: (loaded, total) => {
            // Emit progress every 1000 products for monitoring
            if (loaded - progressCount >= 1000 || loaded === total) {
              logger.debug(`Bulk fetch progress: ${loaded}/${total} products (${Math.round(loaded/total*100)}%)`);
              progressCount = loaded;
            }
          }
        });

        const responseTime = Date.now() - startTime;
        routeStats.bulkFetch.avgTime = (routeStats.bulkFetch.avgTime + responseTime) / 2;

        // Add performance metadata to response
        if (result.success) {
          (result as any).meta = {
            total: result.data!.length,
            fetchTimeMs: responseTime,
            batchSize: batch_size,
            maxConcurrent: max_concurrent,
            usedCache: use_cache
          };
        }

        return c.json(result);
      } catch (error) {
        routeStats.bulkFetch.errors++;
        logger.error('Bulk fetch route error:', error as Error);
        
        const response: ApiResponse<ApiProduct[]> = {
          success: false,
          error: {
            code: 'BULK_FETCH_ROUTE_ERROR',
            message: 'Failed to fetch products in bulk',
          },
        };
        
        return c.json(response, 500);
      }
    }
  );

  /**
   * GET /products/stats - Performance monitoring endpoint
   */
  products.get('/stats', async (c) => {
    const stats = {
      routes: routeStats,
      productService: productService.getPerformanceStats(),
    };
    
    return c.json({ success: true, data: stats });
  });

  /**
   * POST /products/cache/clear - Clear product cache (admin endpoint)
   */
  products.post('/cache/clear', async (c) => {
    try {
      await productService.clearCache();
      
      const response: ApiResponse<{ cleared: boolean }> = {
        success: true,
        data: { cleared: true },
      };
      
      return c.json(response);
    } catch (error) {
      logger.error('Cache clear error:', error as Error);
      
      const response: ApiResponse<{ cleared: boolean }> = {
        success: false,
        error: {
          code: 'CACHE_CLEAR_ERROR',
          message: 'Failed to clear cache',
        },
      };
      
      return c.json(response, 500);
    }
  });

  return products;
}
