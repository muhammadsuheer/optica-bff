import { createHash } from 'crypto';

/**
 * Namespace constants for different resource types
 * Provides consistent naming and easy refactoring
 */
export const CACHE_NAMESPACES = {
  // Product-related namespaces
  PRODUCTS: 'products',
  PRODUCT: 'product',
  PRODUCT_STOCK: 'stock',
  PRODUCT_VARIANTS: 'variants',
  PRODUCT_REVIEWS: 'reviews',
  PRODUCT_CATEGORIES: 'categories',
  
  // User-related namespaces
  USER_SESSION: 'session',
  USER_PROFILE: 'profile',
  USER_CART: 'cart',
  USER_ORDERS: 'orders',
  USER_WISHLIST: 'wishlist',
  
  // Authentication namespaces
  AUTH_TOKEN: 'auth:token',
  AUTH_REFRESH: 'auth:refresh',
  AUTH_BLACKLIST: 'auth:blacklist',
  
  // Rate limiting namespaces
  RATE_LIMIT: 'rate_limit',
  RATE_LIMIT_AUTH: 'rate_limit:auth',
  RATE_LIMIT_API: 'rate_limit:api',
  
  // Content namespaces
  CONTENT_PAGES: 'content:pages',
  CONTENT_POSTS: 'content:posts',
  CONTENT_MENUS: 'content:menus',
  
  // System namespaces
  HEALTH: 'health',
  CONFIG: 'config',
  ANALYTICS: 'analytics',
  
  // Search namespaces
  SEARCH_PRODUCTS: 'search:products',
  SEARCH_CONTENT: 'search:content',
  SEARCH_AUTOCOMPLETE: 'search:autocomplete',
  
  // WooCommerce API namespaces
  WOO_REST: 'woo:rest',
  WOO_STORE: 'woo:store',
  WOO_WEBHOOKS: 'woo:webhooks',
  
  // WordPress GraphQL namespaces
  WP_GRAPHQL: 'wp:gql',
  WP_REST: 'wp:rest',
} as const;

export type CacheNamespace = typeof CACHE_NAMESPACES[keyof typeof CACHE_NAMESPACES];

export class CacheKey {
  private static readonly PREFIX = 'optica';
  private static readonly SEPARATOR = ':';
  private static readonly MAX_KEY_LENGTH = 250; // Redis key length limit
  
  /**
   * Generates a cache key for products list with deterministic parameter ordering
   */
  static products(page = 1, perPage = 20, filters?: Record<string, any>): string {
    const params = {
      page,
      per_page: perPage,
      ...filters,
    };
    
    return this.buildWithParams(CACHE_NAMESPACES.PRODUCTS, params);
  }

  /**
   * Generates a cache key for single product
   */
  static product(id: number | string): string {
    return this.build(CACHE_NAMESPACES.PRODUCT, String(id));
  }

  /**
   * Generates a cache key for product stock information
   */
  static productStock(id: number | string): string {
    return this.build(CACHE_NAMESPACES.PRODUCT_STOCK, String(id));
  }

  /**
   * Generates a cache key for product variants
   */
  static productVariants(productId: number | string): string {
    return this.build(CACHE_NAMESPACES.PRODUCT_VARIANTS, String(productId));
  }

  /**
   * Generates a cache key for product reviews
   */
  static productReviews(productId: number | string, page = 1): string {
    return this.build(CACHE_NAMESPACES.PRODUCT_REVIEWS, String(productId), `page:${page}`);
  }

  /**
   * Generates a cache key for product categories
   */
  static productCategories(parentId?: number): string {
    const suffix = parentId ? `parent:${parentId}` : 'root';
    return this.build(CACHE_NAMESPACES.PRODUCT_CATEGORIES, suffix);
  }

  /**
   * Generates a cache key for user session
   */
  static userSession(userId: number | string): string {
    return this.build(CACHE_NAMESPACES.USER_SESSION, String(userId));
  }

  /**
   * Generates a cache key for user profile
   */
  static userProfile(userId: number | string): string {
    return this.build(CACHE_NAMESPACES.USER_PROFILE, String(userId));
  }

  /**
   * Generates a cache key for user cart
   */
  static userCart(userId: number | string): string {
    return this.build(CACHE_NAMESPACES.USER_CART, String(userId));
  }

  /**
   * Generates a cache key for user orders
   */
  static userOrders(userId: number | string, page = 1): string {
    return this.build(CACHE_NAMESPACES.USER_ORDERS, String(userId), `page:${page}`);
  }

  /**
   * Generates a cache key for user wishlist
   */
  static userWishlist(userId: number | string): string {
    return this.build(CACHE_NAMESPACES.USER_WISHLIST, String(userId));
  }

  /**
   * Generates a cache key for authentication tokens
   */
  static authToken(userId: number | string, tokenId?: string): string {
    const suffix = tokenId ? `${userId}:${tokenId}` : String(userId);
    return this.build(CACHE_NAMESPACES.AUTH_TOKEN, suffix);
  }

  /**
   * Generates a cache key for refresh tokens
   */
  static authRefreshToken(userId: number | string): string {
    return this.build(CACHE_NAMESPACES.AUTH_REFRESH, String(userId));
  }

  /**
   * Generates a cache key for blacklisted tokens
   */
  static authBlacklistToken(tokenHash: string): string {
    return this.build(CACHE_NAMESPACES.AUTH_BLACKLIST, tokenHash);
  }

  /**
   * Generates a cache key for rate limiting
   */
  static rateLimit(category: string, identifier: string): string {
    return this.build(CACHE_NAMESPACES.RATE_LIMIT, category, identifier);
  }

  /**
   * Generates a cache key for authentication rate limiting
   */
  static rateLimitAuth(route: string, identifier: string): string {
    return this.build(CACHE_NAMESPACES.RATE_LIMIT_AUTH, route, identifier);
  }

  /**
   * Generates a cache key for API rate limiting
   */
  static rateLimitAPI(endpoint: string, identifier: string): string {
    return this.build(CACHE_NAMESPACES.RATE_LIMIT_API, endpoint, identifier);
  }

  /**
   * Generates a cache key for content pages
   */
  static contentPage(slug: string): string {
    return this.build(CACHE_NAMESPACES.CONTENT_PAGES, slug);
  }

  /**
   * Generates a cache key for content posts
   */
  static contentPosts(page = 1, category?: string): string {
    const suffix = category ? `category:${category}:page:${page}` : `page:${page}`;
    return this.build(CACHE_NAMESPACES.CONTENT_POSTS, suffix);
  }

  /**
   * Generates a cache key for navigation menus
   */
  static contentMenu(location: string): string {
    return this.build(CACHE_NAMESPACES.CONTENT_MENUS, location);
  }

  /**
   * Generates a cache key for health check
   */
  static healthCheck(): string {
    return this.build(CACHE_NAMESPACES.HEALTH);
  }

  /**
   * Generates a cache key for system configuration
   */
  static config(key: string): string {
    return this.build(CACHE_NAMESPACES.CONFIG, key);
  }

  /**
   * Generates a cache key for analytics data
   */
  static analytics(metric: string, period: string): string {
    return this.build(CACHE_NAMESPACES.ANALYTICS, metric, period);
  }

  /**
   * Generates a cache key for product search results
   */
  static searchProducts(query: string, filters?: Record<string, any>): string {
    const params = {
      q: query,
      ...filters,
    };
    
    return this.buildWithParams(CACHE_NAMESPACES.SEARCH_PRODUCTS, params);
  }

  /**
   * Generates a cache key for content search results
   */
  static searchContent(query: string, type?: string): string {
    const suffix = type ? `${query}:type:${type}` : query;
    return this.build(CACHE_NAMESPACES.SEARCH_CONTENT, this.hashIfLong(suffix));
  }

  /**
   * Generates a cache key for search autocomplete suggestions
   */
  static searchAutocomplete(query: string): string {
    return this.build(CACHE_NAMESPACES.SEARCH_AUTOCOMPLETE, this.hashIfLong(query));
  }

  /**
   * Generates a cache key for WooCommerce REST API responses
   */
  static wooRest(endpoint: string, params?: Record<string, any>): string {
    const key = params ? `${endpoint}:${this.serializeParams(params)}` : endpoint;
    return this.build(CACHE_NAMESPACES.WOO_REST, this.hashIfLong(key));
  }

  /**
   * Generates a cache key for WooCommerce Store API responses
   */
  static wooStore(endpoint: string, params?: Record<string, any>): string {
    const key = params ? `${endpoint}:${this.serializeParams(params)}` : endpoint;
    return this.build(CACHE_NAMESPACES.WOO_STORE, this.hashIfLong(key));
  }

  /**
   * Generates a cache key for WordPress GraphQL responses
   */
  static wpGraphQL(query: string, variables?: Record<string, any>): string {
    const queryHash = createHash('sha256').update(query).digest('hex').slice(0, 16);
    const key = variables ? `${queryHash}:${this.serializeParams(variables)}` : queryHash;
    return this.build(CACHE_NAMESPACES.WP_GRAPHQL, this.hashIfLong(key));
  }

  /**
   * Generates a cache key for WordPress REST API responses
   */
  static wpRest(endpoint: string, params?: Record<string, any>): string {
    const key = params ? `${endpoint}:${this.serializeParams(params)}` : endpoint;
    return this.build(CACHE_NAMESPACES.WP_REST, this.hashIfLong(key));
  }

  /**
   * Builds a cache key from parts with length validation
   */
  private static build(...parts: string[]): string {
    const key = [this.PREFIX, ...parts].join(this.SEPARATOR);
    
    // If key is too long, hash the non-prefix parts
    if (key.length > this.MAX_KEY_LENGTH) {
      const prefix = this.PREFIX;
      const content = parts.join(this.SEPARATOR);
      const hash = createHash('sha256').update(content).digest('hex').slice(0, 32);
      return `${prefix}${this.SEPARATOR}hash${this.SEPARATOR}${hash}`;
    }
    
    return key;
  }

  /**
   * Builds a cache key with deterministic parameter serialization
   */
  private static buildWithParams(namespace: string, params: Record<string, any>): string {
    const serializedParams = this.serializeParams(params);
    return this.build(namespace, serializedParams);
  }

  /**
   * Serializes parameters in a deterministic way for consistent cache keys
   */
  private static serializeParams(params: Record<string, any>): string {
    // Sort keys for deterministic output
    const sortedEntries = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        // Handle arrays and objects
        if (Array.isArray(value)) {
          return `${key}=${value.sort().join(',')}`;
        } else if (typeof value === 'object') {
          return `${key}=${JSON.stringify(value)}`;
        }
        return `${key}=${String(value)}`;
      });

    return sortedEntries.join('&');
  }

  /**
   * Hash string if it's too long for Redis key
   */
  private static hashIfLong(str: string, maxLength = 100): string {
    if (str.length <= maxLength) {
      return str;
    }
    
    return createHash('sha256').update(str).digest('hex').slice(0, 32);
  }

  /**
   * Public method to build custom cache keys with validation
   */
  static buildKey(...parts: string[]): string {
    return this.build(...parts);
  }

  /**
   * Extracts parts from a cache key
   */
  static parse(key: string): string[] {
    return key.split(this.SEPARATOR);
  }

  /**
   * Checks if a key belongs to our cache namespace
   */
  static isOurs(key: string): boolean {
    return key.startsWith(this.PREFIX + this.SEPARATOR);
  }

  /**
   * Gets the namespace from a cache key
   */
  static getNamespace(key: string): string | null {
    const parts = this.parse(key);
    return parts.length >= 2 ? parts[1] : null;
  }

  /**
   * Generate cache key pattern for deletion operations
   */
  static pattern(namespace: CacheNamespace, ...parts: string[]): string {
    return this.build(namespace, ...parts, '*');
  }

  /**
   * Generate cache key for temporary data with TTL indication
   */
  static temp(key: string, ttlSeconds: number): string {
    return this.build('temp', `${ttlSeconds}s`, key);
  }
}
