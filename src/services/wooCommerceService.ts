/**
 * Ultra-Fast WooCommerce Service
 * Optimized for <1ms response times with aggressive caching
 */

import type { ApiProduct } from '../types/index.js';
import { LRUCache } from 'lru-cache';
import { env } from '../config/env.js';

interface WooCommerceConfig {
  url: string;
  consumerKey: string;
  consumerSecret: string;
  version: string;
}

interface RequestOptions {
  timeout?: number;
  retries?: number;
  cacheTimeout?: number;
}

class WooCommerceService {
  private readonly config: WooCommerceConfig;
  private readonly baseUrl: string;
  // Bounded in‑memory cache (ultra-fast) – avoids unbounded Map growth
  private readonly requestCache = new LRUCache<string, { data: ApiProduct | ApiProduct[] | any; expires: number }>({
    max: 500,            // hard cap entries
    ttl: 1000 * 60 * 15, // default safety TTL 15m (per-entry overrides still applied)
  });
  // Track in‑flight fetches (dedupe). We'll self-prune when large.
  private readonly fetchPool: Map<string, Promise<any>> = new Map();

  constructor(config: WooCommerceConfig) {
    this.config = config;
    this.baseUrl = `${config.url}/wp-json/wc/${config.version}`;
  }

  /**
   * Ultra-fast product fetch with memory caching
   */
  async getProduct(id: number, options: RequestOptions = {}): Promise<ApiProduct | null> {
    const cacheKey = `product_${id}`;
    
    // Memory cache hit - 0.1ms
    const cached = this.requestCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data as ApiProduct;
    }

    // Deduplicate concurrent requests
    if (this.fetchPool.has(cacheKey)) {
      return this.fetchPool.get(cacheKey);
    }

  const fetchPromise = this.fetchProductInternal(id, options);
    this.fetchPool.set(cacheKey, fetchPromise);

    try {
  const product = await fetchPromise;
  if (!this.isApiProduct(product)) return null;
      
      // Cache for 5 minutes by default
      const cacheTimeout = options.cacheTimeout || 300000;
  this.requestCache.set(cacheKey, { data: product, expires: Date.now() + cacheTimeout });

      return product;
    } finally {
      this.fetchPool.delete(cacheKey);
    }
  }

  /**
   * Batch product fetch with parallel processing
   */
  async getProducts(params: {
    page?: number;
    per_page?: number;
    search?: string;
    category?: string;
    status?: string;
    featured?: boolean;
  } = {}): Promise<ApiProduct[]> {
    const cacheKey = `products_${JSON.stringify(params)}`;
    
    // Memory cache hit
    const cached = this.requestCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data as ApiProduct[];
    }

    if (this.fetchPool.has(cacheKey)) {
      return this.fetchPool.get(cacheKey);
    }

  const fetchPromise = this.fetchProductsInternal(params);
    this.fetchPool.set(cacheKey, fetchPromise);

    try {
      const products = await fetchPromise;
      const filtered = Array.isArray(products) ? products.filter(p => this.isApiProduct(p)) as ApiProduct[] : [];
      // Cache for 2 minutes for list queries
      this.requestCache.set(cacheKey, { data: filtered, expires: Date.now() + 120000 });
      // Prune fetchPool aggressively if it grows too large
      if (this.fetchPool.size > 300) {
        for (const k of this.fetchPool.keys()) { this.fetchPool.delete(k); if (this.fetchPool.size <= 150) break; }
      }
      return filtered;
    } finally {
      this.fetchPool.delete(cacheKey);
    }
  }

  /**
   * Ultra-fast product search with prefix matching
   */
  async searchProducts(query: string, limit = 10): Promise<ApiProduct[]> {
    if (!query || query.length < 2) return [];

    const cacheKey = `search_${query}_${limit}`;
    
    const cached = this.requestCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data as ApiProduct[];
    }

    const params = {
      search: query,
      per_page: limit,
      status: 'publish'
    };

    const products = await this.getProducts(params);
    
    // Cache search results for 1 minute
    this.requestCache.set(cacheKey, {
      data: products,
      expires: Date.now() + 60000
    });

    return products;
  }

  /**
   * Get categories with caching
   */
  async getCategories(params: { parent?: number; per_page?: number } = {}): Promise<any[]> {
    const cacheKey = `categories_${JSON.stringify(params)}`;
    
    const cached = this.requestCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const url = this.buildUrl('products/categories', params);
    const categories = await this.makeRequest(url);
    
    // Cache categories for 10 minutes
    this.requestCache.set(cacheKey, {
      data: categories,
      expires: Date.now() + 600000
    });

    return categories;
  }

  /**
   * Internal product fetcher with optimized HTTP client
   */
  private async fetchProductInternal(id: number, options: RequestOptions): Promise<ApiProduct | null> {
    try {
      const url = this.buildUrl(`products/${id}`);
  const product = await this.makeRequest(url, options);
  return this.isApiProduct(product) ? product : null;
    } catch (error) {
      console.error(`Failed to fetch product ${id}:`, error);
      return null;
    }
  }

  /**
   * Internal products fetcher
   */
  private async fetchProductsInternal(params: any): Promise<ApiProduct[]> {
    try {
      const url = this.buildUrl('products', params);
  const products = await this.makeRequest(url);
  if (!Array.isArray(products)) return [];
  return products.filter(p => this.isApiProduct(p));
    } catch (error) {
      console.error('Failed to fetch products:', error);
      return [];
    }
  }

  /**
   * Optimized HTTP request handler
   */
  private async makeRequest(url: string, options: RequestOptions = {}): Promise<any> {
    const controller = new AbortController();
    const timeout = options.timeout || 5000;
    
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'User-Agent': 'optica-BFF/1.0'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Build authenticated URL with parameters
   */
  private buildUrl(endpoint: string, params: Record<string, any> = {}): string {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    return url.toString();
  }

  /**
   * Clear all caches - useful for forced refreshes
   */
  clearCache(): void {
    this.requestCache.clear();
    this.fetchPool.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.requestCache.size,
      entries: Array.from(this.requestCache.keys())
    };
  }

  /**
   * Warm up cache with popular products
   */
  async warmupCache(productIds: number[]): Promise<void> {
    const promises = productIds.map(id => 
      this.getProduct(id).catch(err => 
        console.warn(`Failed to warm up product ${id}:`, err)
      )
    );
    
    await Promise.allSettled(promises);
  }

  // Runtime shape guard for external data
  private isApiProduct(obj: any): obj is ApiProduct {
    if (!obj || typeof obj !== 'object') return false;
    return typeof obj.id === 'number' && typeof obj.name === 'string' && typeof obj.status === 'string';
  }
}

// Singleton instance for optimal performance
let wooCommerceInstance: WooCommerceService | null = null;

export function createWooCommerceService(config: WooCommerceConfig): WooCommerceService {
  if (!wooCommerceInstance) {
    wooCommerceInstance = new WooCommerceService(config);
  }
  return wooCommerceInstance;
}

export function getWooCommerceService(): WooCommerceService {
  if (!wooCommerceInstance) {
    // Create default instance if none exists
    // Fallback instance (degraded mode) uses dummy credentials; real usage requires env vars
    wooCommerceInstance = new WooCommerceService({
      url: env.WP_BASE_URL || process.env.WP_BASE_URL || 'http://localhost',
      consumerKey: process.env.WOO_CONSUMER_KEY || process.env.WOOCOMMERCE_CONSUMER_KEY || 'demo',
      consumerSecret: process.env.WOO_CONSUMER_SECRET || process.env.WOOCOMMERCE_CONSUMER_SECRET || 'demo',
      version: 'v3'
    });
  }
  return wooCommerceInstance;
}

export { WooCommerceService };
export type { WooCommerceConfig, RequestOptions };
