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
};
export class CacheKey {
    static PREFIX = 'optica';
    static SEPARATOR = ':';
    static MAX_KEY_LENGTH = 250; // Redis key length limit
    /**
     * Generates a cache key for products list with deterministic parameter ordering
     */
    static products(page = 1, perPage = 20, filters) {
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
    static product(id) {
        return this.build(CACHE_NAMESPACES.PRODUCT, String(id));
    }
    /**
     * Generates a cache key for product stock information
     */
    static productStock(id) {
        return this.build(CACHE_NAMESPACES.PRODUCT_STOCK, String(id));
    }
    /**
     * Generates a cache key for product variants
     */
    static productVariants(productId) {
        return this.build(CACHE_NAMESPACES.PRODUCT_VARIANTS, String(productId));
    }
    /**
     * Generates a cache key for product reviews
     */
    static productReviews(productId, page = 1) {
        return this.build(CACHE_NAMESPACES.PRODUCT_REVIEWS, String(productId), `page:${page}`);
    }
    /**
     * Generates a cache key for product categories
     */
    static productCategories(parentId) {
        const suffix = parentId ? `parent:${parentId}` : 'root';
        return this.build(CACHE_NAMESPACES.PRODUCT_CATEGORIES, suffix);
    }
    /**
     * Generates a cache key for user session
     */
    static userSession(userId) {
        return this.build(CACHE_NAMESPACES.USER_SESSION, String(userId));
    }
    /**
     * Generates a cache key for user profile
     */
    static userProfile(userId) {
        return this.build(CACHE_NAMESPACES.USER_PROFILE, String(userId));
    }
    /**
     * Generates a cache key for user cart
     */
    static userCart(userId) {
        return this.build(CACHE_NAMESPACES.USER_CART, String(userId));
    }
    /**
     * Generates a cache key for user orders
     */
    static userOrders(userId, page = 1) {
        return this.build(CACHE_NAMESPACES.USER_ORDERS, String(userId), `page:${page}`);
    }
    /**
     * Generates a cache key for user wishlist
     */
    static userWishlist(userId) {
        return this.build(CACHE_NAMESPACES.USER_WISHLIST, String(userId));
    }
    /**
     * Generates a cache key for authentication tokens
     */
    static authToken(userId, tokenId) {
        const suffix = tokenId ? `${userId}:${tokenId}` : String(userId);
        return this.build(CACHE_NAMESPACES.AUTH_TOKEN, suffix);
    }
    /**
     * Generates a cache key for refresh tokens
     */
    static authRefreshToken(userId) {
        return this.build(CACHE_NAMESPACES.AUTH_REFRESH, String(userId));
    }
    /**
     * Generates a cache key for blacklisted tokens
     */
    static authBlacklistToken(tokenHash) {
        return this.build(CACHE_NAMESPACES.AUTH_BLACKLIST, tokenHash);
    }
    /**
     * Generates a cache key for rate limiting
     */
    static rateLimit(category, identifier) {
        return this.build(CACHE_NAMESPACES.RATE_LIMIT, category, identifier);
    }
    /**
     * Generates a cache key for authentication rate limiting
     */
    static rateLimitAuth(route, identifier) {
        return this.build(CACHE_NAMESPACES.RATE_LIMIT_AUTH, route, identifier);
    }
    /**
     * Generates a cache key for API rate limiting
     */
    static rateLimitAPI(endpoint, identifier) {
        return this.build(CACHE_NAMESPACES.RATE_LIMIT_API, endpoint, identifier);
    }
    /**
     * Generates a cache key for content pages
     */
    static contentPage(slug) {
        return this.build(CACHE_NAMESPACES.CONTENT_PAGES, slug);
    }
    /**
     * Generates a cache key for content posts
     */
    static contentPosts(page = 1, category) {
        const suffix = category ? `category:${category}:page:${page}` : `page:${page}`;
        return this.build(CACHE_NAMESPACES.CONTENT_POSTS, suffix);
    }
    /**
     * Generates a cache key for navigation menus
     */
    static contentMenu(location) {
        return this.build(CACHE_NAMESPACES.CONTENT_MENUS, location);
    }
    /**
     * Generates a cache key for health check
     */
    static healthCheck() {
        return this.build(CACHE_NAMESPACES.HEALTH);
    }
    /**
     * Generates a cache key for system configuration
     */
    static config(key) {
        return this.build(CACHE_NAMESPACES.CONFIG, key);
    }
    /**
     * Generates a cache key for analytics data
     */
    static analytics(metric, period) {
        return this.build(CACHE_NAMESPACES.ANALYTICS, metric, period);
    }
    /**
     * Generates a cache key for product search results
     */
    static searchProducts(query, filters) {
        const params = {
            q: query,
            ...filters,
        };
        return this.buildWithParams(CACHE_NAMESPACES.SEARCH_PRODUCTS, params);
    }
    /**
     * Generates a cache key for content search results
     */
    static searchContent(query, type) {
        const suffix = type ? `${query}:type:${type}` : query;
        return this.build(CACHE_NAMESPACES.SEARCH_CONTENT, this.hashIfLong(suffix));
    }
    /**
     * Generates a cache key for search autocomplete suggestions
     */
    static searchAutocomplete(query) {
        return this.build(CACHE_NAMESPACES.SEARCH_AUTOCOMPLETE, this.hashIfLong(query));
    }
    /**
     * Generates a cache key for WooCommerce REST API responses
     */
    static wooRest(endpoint, params) {
        const key = params ? `${endpoint}:${this.serializeParams(params)}` : endpoint;
        return this.build(CACHE_NAMESPACES.WOO_REST, this.hashIfLong(key));
    }
    /**
     * Generates a cache key for WooCommerce Store API responses
     */
    static wooStore(endpoint, params) {
        const key = params ? `${endpoint}:${this.serializeParams(params)}` : endpoint;
        return this.build(CACHE_NAMESPACES.WOO_STORE, this.hashIfLong(key));
    }
    /**
     * Generates a cache key for WordPress GraphQL responses
     */
    static wpGraphQL(query, variables) {
        const queryHash = createHash('sha256').update(query).digest('hex').slice(0, 16);
        const key = variables ? `${queryHash}:${this.serializeParams(variables)}` : queryHash;
        return this.build(CACHE_NAMESPACES.WP_GRAPHQL, this.hashIfLong(key));
    }
    /**
     * Generates a cache key for WordPress REST API responses
     */
    static wpRest(endpoint, params) {
        const key = params ? `${endpoint}:${this.serializeParams(params)}` : endpoint;
        return this.build(CACHE_NAMESPACES.WP_REST, this.hashIfLong(key));
    }
    /**
     * Builds a cache key from parts with length validation
     */
    static build(...parts) {
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
    static buildWithParams(namespace, params) {
        const serializedParams = this.serializeParams(params);
        return this.build(namespace, serializedParams);
    }
    /**
     * Serializes parameters in a deterministic way for consistent cache keys
     */
    static serializeParams(params) {
        // Sort keys for deterministic output
        const sortedEntries = Object.entries(params)
            .sort(([a], [b]) => a.localeCompare(b))
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => {
            // Handle arrays and objects
            if (Array.isArray(value)) {
                return `${key}=${value.sort().join(',')}`;
            }
            else if (typeof value === 'object') {
                return `${key}=${JSON.stringify(value)}`;
            }
            return `${key}=${String(value)}`;
        });
        return sortedEntries.join('&');
    }
    /**
     * Hash string if it's too long for Redis key
     */
    static hashIfLong(str, maxLength = 100) {
        if (str.length <= maxLength) {
            return str;
        }
        return createHash('sha256').update(str).digest('hex').slice(0, 32);
    }
    /**
     * Public method to build custom cache keys with validation
     */
    static buildKey(...parts) {
        return this.build(...parts);
    }
    /**
     * Extracts parts from a cache key
     */
    static parse(key) {
        return key.split(this.SEPARATOR);
    }
    /**
     * Checks if a key belongs to our cache namespace
     */
    static isOurs(key) {
        return key.startsWith(this.PREFIX + this.SEPARATOR);
    }
    /**
     * Gets the namespace from a cache key
     */
    static getNamespace(key) {
        const parts = this.parse(key);
        return parts.length >= 2 ? parts[1] : null;
    }
    /**
     * Generate cache key pattern for deletion operations
     */
    static pattern(namespace, ...parts) {
        return this.build(namespace, ...parts, '*');
    }
    /**
     * Generate cache key for temporary data with TTL indication
     */
    static temp(key, ttlSeconds) {
        return this.build('temp', `${ttlSeconds}s`, key);
    }
}
