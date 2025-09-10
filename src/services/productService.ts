/**
 * Product Service - Edge Runtime Compatible
 * 
 * Features:
 * - Product CRUD operations
 * - Search and filtering
 * - Caching integration
 * - WooCommerce synchronization
 */

import { cacheService, CACHE_KEYS, CACHE_TTL, CACHE_TAGS } from './cacheService'
import databaseService from './databaseService'
import { logger } from '../utils/logger'

export interface Product {
  id: number
  wc_id: number
  name: string
  slug: string
  description?: string
  short_description?: string
  price?: number
  regular_price?: number
  sale_price?: number
  status: string
  featured: boolean
  images: string[]
  categories: string[]
  tags: string[]
  attributes: Record<string, any>
  stock_status: string
  stock_quantity?: number
  weight?: number
  dimensions?: {
    length?: number
    width?: number
    height?: number
  }
  created_at: string
  updated_at: string
}

export interface ProductFilters {
  page?: number
  limit?: number
  status?: string
  category?: string
  search?: string
  min_price?: number
  max_price?: number
  featured?: boolean
  in_stock?: boolean
  orderBy?: 'created_at' | 'updated_at' | 'name' | 'price'
  orderDirection?: 'asc' | 'desc'
}

export interface ProductSearchResult {
  data: Product[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

class ProductService {
  /**
   * Get products with filtering and pagination
   */
  async getProducts(filters: ProductFilters = {}): Promise<ProductSearchResult | null> {
    try {
      const {
        page = 1,
        limit = 20,
        status = 'publish',
        search,
        orderBy = 'created_at',
        orderDirection = 'desc'
      } = filters

      // Generate cache key
      const cacheKey = CACHE_KEYS.PRODUCTS.LIST(filters, page)
      
      // Try to get from cache first
      const cached = await cacheService.get<ProductSearchResult>(cacheKey)
      if (cached) {
        logger.debug('Products cache hit', { filters, page })
        return cached
      }

      // Get from database
      const result = await databaseService.getProducts({
        page,
        limit,
        status,
        search,
        orderBy,
        orderDirection
      })

      if (!result) {
        return null
      }

      const response: ProductSearchResult = {
        data: result.data as Product[],
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
        hasNext: page * limit < result.total,
        hasPrev: page > 1
      }

      // Cache the result
      await cacheService.set(cacheKey, response, {
        ttl: CACHE_TTL.PRODUCTS.LIST,
        tags: [CACHE_TAGS.PRODUCTS, CACHE_TAGS.PRODUCT_LIST]
      })

      logger.info('Products fetched', { 
        count: result.data.length, 
        total: result.total, 
        page, 
        filters 
      })

      return response

    } catch (error) {
      logger.error('Error fetching products', { error, filters })
      return null
    }
  }

  /**
   * Get a single product by ID
   */
  async getProduct(id: number): Promise<Product | null> {
    try {
      // Generate cache key
      const cacheKey = CACHE_KEYS.PRODUCTS.SINGLE(id)
      
      // Try to get from cache first
      const cached = await cacheService.get<Product>(cacheKey)
      if (cached) {
        logger.debug('Product cache hit', { id })
        return cached
      }

      // Get from database
      const product = await databaseService.getProduct(id)
      
      if (!product) {
        return null
      }

      // Cache the result
      await cacheService.set(cacheKey, product, {
        ttl: CACHE_TTL.PRODUCTS.SINGLE,
        tags: [CACHE_TAGS.PRODUCTS]
      })

      logger.debug('Product fetched', { id })
      return product as Product

    } catch (error) {
      logger.error('Error fetching product', { error, id })
      return null
    }
  }

  /**
   * Get a single product by WooCommerce ID
   */
  async getProductByWcId(wcId: number): Promise<Product | null> {
    try {
      // Generate cache key
      const cacheKey = `products:wc:${wcId}`
      
      // Try to get from cache first
      const cached = await cacheService.get<Product>(cacheKey)
      if (cached) {
        logger.debug('Product by WC ID cache hit', { wcId })
        return cached
      }

      // Get from database
      const product = await databaseService.products.getByWcId(wcId)
      
      if (!product) {
        return null
      }

      // Cache the result
      await cacheService.set(cacheKey, product, {
        ttl: CACHE_TTL.PRODUCTS.SINGLE,
        tags: [CACHE_TAGS.PRODUCTS]
      })

      logger.debug('Product by WC ID fetched', { wcId })
      return product as Product

    } catch (error) {
      logger.error('Error fetching product by WC ID', { error, wcId })
      return null
    }
  }

  /**
   * Search products
   */
  async searchProducts(query: string, limit: number = 20): Promise<Product[]> {
    try {
      if (!query || query.trim().length < 2) {
        return []
      }

      const trimmedQuery = query.trim()
      
      // Generate cache key
      const cacheKey = CACHE_KEYS.PRODUCTS.SEARCH(trimmedQuery, limit)
      
      // Try to get from cache first
      const cached = await cacheService.get<Product[]>(cacheKey)
      if (cached) {
        logger.debug('Product search cache hit', { query: trimmedQuery })
        return cached
      }

      // Search in database
      const products = await databaseService.searchProducts(trimmedQuery, limit)
      
      if (!products) {
        return []
      }

      // Cache the result
      await cacheService.set(cacheKey, products, {
        ttl: CACHE_TTL.PRODUCTS.SEARCH,
        tags: [CACHE_TAGS.PRODUCTS, CACHE_TAGS.PRODUCT_SEARCH]
      })

      logger.info('Products searched', { query: trimmedQuery, count: products.length })
      return products as Product[]

    } catch (error) {
      logger.error('Error searching products', { error, query })
      return []
    }
  }

  /**
   * Get popular/featured products
   */
  async getPopularProducts(limit: number = 20): Promise<Product[]> {
    try {
      // Generate cache key
      const cacheKey = CACHE_KEYS.PRODUCTS.POPULAR(limit)
      
      // Try to get from cache first
      const cached = await cacheService.get<Product[]>(cacheKey)
      if (cached) {
        logger.debug('Popular products cache hit', { limit })
        return cached
      }

      // Get from database
      const products = await databaseService.products.getPopular(limit)
      
      if (!products) {
        return []
      }

      // Cache the result
      await cacheService.set(cacheKey, products, {
        ttl: CACHE_TTL.PRODUCTS.POPULAR,
        tags: [CACHE_TAGS.PRODUCTS]
      })

      logger.info('Popular products fetched', { count: products.length })
      return products as Product[]

    } catch (error) {
      logger.error('Error fetching popular products', { error, limit })
      return []
    }
  }

  /**
   * Create or update a product
   */
  async upsertProduct(product: Partial<Product>): Promise<Product | null> {
    try {
      const result = await databaseService.createProduct(product)
      
      if (!result) {
        return null
      }

      // Invalidate related caches
      await this.invalidateProductCaches()

      logger.info('Product upserted', { id: result.id, wc_id: result.wc_id })
      return result as Product

    } catch (error) {
      logger.error('Error upserting product', { error, product })
      return null
    }
  }

  /**
   * Bulk upsert products
   */
  async bulkUpsertProducts(products: Partial<Product>[]): Promise<Product[]> {
    try {
      const result = await databaseService.products.bulkUpsert(products)
      
      if (!result) {
        return []
      }

      // Invalidate related caches
      await this.invalidateProductCaches()

      logger.info('Products bulk upserted', { count: result.length })
      return result as Product[]

    } catch (error) {
      logger.error('Error bulk upserting products', { error, count: products.length })
      return []
    }
  }

  /**
   * Delete a product
   */
  async deleteProduct(id: number): Promise<boolean> {
    try {
      const success = await databaseService.deleteProduct(id)
      
      if (success) {
        // Invalidate related caches
        await this.invalidateProductCaches()
        
        logger.info('Product deleted', { id })
      }

      return success

    } catch (error) {
      logger.error('Error deleting product', { error, id })
      return false
    }
  }

  /**
   * Get product categories
   */
  async getCategories(): Promise<string[]> {
    try {
      // Generate cache key
      const cacheKey = CACHE_KEYS.PRODUCTS.CATEGORIES()
      
      // Try to get from cache first
      const cached = await cacheService.get<string[]>(cacheKey)
      if (cached) {
        logger.debug('Categories cache hit')
        return cached
      }

      // Get from database (this would need to be implemented in databaseService)
      // For now, return empty array
      const categories: string[] = []

      // Cache the result
      await cacheService.set(cacheKey, categories, {
        ttl: CACHE_TTL.PRODUCTS.CATEGORIES,
        tags: [CACHE_TAGS.PRODUCTS]
      })

      logger.debug('Categories fetched', { count: categories.length })
      return categories

    } catch (error) {
      logger.error('Error fetching categories', { error })
      return []
    }
  }

  /**
   * Invalidate product-related caches
   */
  private async invalidateProductCaches(): Promise<void> {
    try {
      await cacheService.invalidateByTags([
        CACHE_TAGS.PRODUCTS,
        CACHE_TAGS.PRODUCT_LIST,
        CACHE_TAGS.PRODUCT_SEARCH
      ])
      
      logger.debug('Product caches invalidated')
    } catch (error) {
      logger.error('Error invalidating product caches', { error })
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = Date.now()
    
    try {
      // Test database connectivity
      const testProduct = await databaseService.getProduct(1)
      const latency = Date.now() - startTime
      
      return {
        healthy: true,
        latency
      }
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Export singleton instance
export const productService = new ProductService()

// Export class for testing
export { ProductService }

// Export types
export type { Product, ProductFilters, ProductSearchResult }
