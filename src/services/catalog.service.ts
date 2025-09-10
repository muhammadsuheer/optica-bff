/**
 * Catalog Service - Product and Category Management
 * 
 * Handles product listing, filtering, search, and category operations
 * with caching and performance optimizations.
 */

import { productRepository } from '../adapters/supabase'
import { withCache, productCache } from '../adapters/cache'
import { logger } from '../utils/logger'

// =======================
// Types
// =======================

export interface ProductFilters {
  page: number
  per_page: number
  status?: 'publish' | 'draft'
  featured?: boolean
  category?: string
  search?: string
  sort: 'name' | 'price' | 'date' | 'popularity'
  order: 'asc' | 'desc'
  min_price?: number
  max_price?: number
}

export interface ProductListResult {
  products: any[]
  pagination: {
    page: number
    perPage: number
    total: number
    totalPages: number
  }
  cached?: boolean
}

export interface SearchResult {
  products: any[]
  pagination: {
    page: number
    perPage: number
    total: number
    totalPages: number
  }
  total: number
  searchTime: number
  cached?: boolean
}

export interface CategoryFilters {
  parent?: string
  include_empty: boolean
}

// =======================
// Product Operations
// =======================

/**
 * Get products with filtering and pagination
 */
export async function getProducts(filters: ProductFilters): Promise<ProductListResult> {
  const start = Date.now()
  
  try {
    // Convert filters to repository format
    const repoFilters = {
      status: filters.status,
      featured: filters.featured,
      category: filters.category,
      search: filters.search,
      limit: filters.per_page,
      offset: (filters.page - 1) * filters.per_page
    }
    
    const { data: products, count } = await productRepository.findMany(repoFilters)
    
    const total = count || 0
    const totalPages = Math.ceil(total / filters.per_page)
    
    const result: ProductListResult = {
      products: products || [],
      pagination: {
        page: filters.page,
        perPage: filters.per_page,
        total,
        totalPages
      }
    }
    
    logger.debug('Products fetched', {
      count: products?.length || 0,
      total,
      filters,
      duration: Date.now() - start
    })
    
    return result
  } catch (error) {
    logger.error('Failed to fetch products', { error, filters })
    throw error
  }
}

/**
 * Get single product by ID
 */
export async function getProductById(id: string): Promise<any | null> {
  try {
    const product = await productRepository.findById(id)
    
    if (product) {
      logger.debug('Product fetched', { id, name: product.name })
    }
    
    return product
  } catch (error) {
    logger.error('Failed to fetch product', { error, id })
    throw error
  }
}

/**
 * Get featured products
 */
export async function getFeaturedProducts(limit: number = 10): Promise<any[]> {
  try {
    const { data: products } = await productRepository.findMany({
      featured: true,
      status: 'publish',
      limit
    })
    
    logger.debug('Featured products fetched', { count: products?.length || 0 })
    
    return products || []
  } catch (error) {
    logger.error('Failed to fetch featured products', { error, limit })
    throw error
  }
}

/**
 * Search products
 */
export async function searchProducts(query: {
  q: string
  page: number
  per_page: number
  category?: string
  min_price?: number
  max_price?: number
}): Promise<SearchResult> {
  const start = Date.now()
  
  try {
    const repoFilters = {
      search: query.q,
      category: query.category,
      limit: query.per_page,
      offset: (query.page - 1) * query.per_page
    }
    
    const { data: products, count } = await productRepository.findMany(repoFilters)
    
    const total = count || 0
    const totalPages = Math.ceil(total / query.per_page)
    const searchTime = Date.now() - start
    
    const result: SearchResult = {
      products: products || [],
      pagination: {
        page: query.page,
        perPage: query.per_page,
        total,
        totalPages
      },
      total,
      searchTime
    }
    
    logger.debug('Products searched', {
      query: query.q,
      count: products?.length || 0,
      total,
      searchTime
    })
    
    return result
  } catch (error) {
    logger.error('Failed to search products', { error, query })
    throw error
  }
}

// =======================
// Category Operations
// =======================

/**
 * Get categories with optional filtering
 */
export async function getCategories(filters: CategoryFilters): Promise<any[]> {
  try {
    // For now, return empty array - implement when category table is ready
    // This would query a categories table in Supabase
    logger.debug('Categories fetched', { filters })
    
    return []
  } catch (error) {
    logger.error('Failed to fetch categories', { error, filters })
    throw error
  }
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(slug: string): Promise<any | null> {
  try {
    // For now, return null - implement when category table is ready
    logger.debug('Category fetched by slug', { slug })
    
    return null
  } catch (error) {
    logger.error('Failed to fetch category', { error, slug })
    throw error
  }
}

// =======================
// Cache Management
// =======================

/**
 * Invalidate product cache
 */
export async function invalidateProductCache(productId?: string): Promise<void> {
  try {
    if (productId) {
      await productCache.invalidateProduct(productId)
      logger.debug('Product cache invalidated', { productId })
    } else {
      const count = await productCache.invalidateAll()
      logger.debug('All product cache invalidated', { count })
    }
  } catch (error) {
    logger.error('Failed to invalidate product cache', { error, productId })
    // Don't throw - cache invalidation failures shouldn't break the app
  }
}

// =======================
// Health Check
// =======================

/**
 * Check catalog service health
 */
export async function healthCheck(): Promise<{ healthy: boolean; error?: string }> {
  try {
    // Test basic product query
    await productRepository.findMany({ limit: 1 })
    
    return { healthy: true }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// =======================
// Exports
// =======================

export const catalogService = {
  getProducts,
  getProductById,
  getFeaturedProducts,
  searchProducts,
  getCategories,
  getCategoryBySlug,
  invalidateProductCache,
  healthCheck
}
