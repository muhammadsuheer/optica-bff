/**
 * Database Service - Supabase Integration for Vercel Edge
 *
 * Features:
 * - Supabase HTTP client (Edge-compatible)
 * - Comprehensive error handling and fallbacks
 * - Performance monitoring and metrics
 * - Graceful degradation patterns
 * - Type-safe operations with Supabase types
 */
import { type Database } from './supabase';
declare let isHealthy: boolean;
declare const dbStats: {
    connectionAttempts: number;
    successfulConnections: number;
    failedConnections: number;
    healthChecks: number;
    avgQueryTime: number;
    lastError: string | null;
};
/**
 * Check database health with caching
 */
export declare function checkDatabaseHealth(forceCheck?: boolean): Promise<boolean>;
/**
 * Execute database operation with error handling and optional fallback
 */
export declare function executeWithFallback<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T | null>;
/**
 * Get database performance statistics
 */
export declare function getDatabaseStats(): {
    isHealthy: boolean;
    lastHealthCheck: string | null;
    healthCheckAgeMs: number | null;
    connectionAttempts: number;
    successfulConnections: number;
    failedConnections: number;
    healthChecks: number;
    avgQueryTime: number;
    lastError: string | null;
};
type Tables = Database['public']['Tables'];
type ProductRow = Tables['products']['Row'];
type ProductInsert = Tables['products']['Insert'];
type OrderRow = Tables['orders']['Row'];
type OrderInsert = Tables['orders']['Insert'];
type CartRow = Tables['carts']['Row'];
type CartInsert = Tables['carts']['Insert'];
type CartUpdate = Tables['carts']['Update'];
/**
 * Product Operations
 */
export declare const productOperations: {
    /**
     * Get a single product by ID
     */
    getById(id: number): Promise<ProductRow | null>;
    /**
     * Get a single product by WooCommerce ID
     */
    getByWcId(wcId: number): Promise<ProductRow | null>;
    /**
     * Get products with pagination and filtering
     */
    getMany(options?: {
        page?: number;
        limit?: number;
        status?: string;
        category?: string;
        search?: string;
        orderBy?: "created_at" | "updated_at" | "name" | "price";
        orderDirection?: "asc" | "desc";
    }): Promise<{
        data: ProductRow[];
        total: number;
    } | null>;
    /**
     * Get popular/featured products
     */
    getPopular(limit?: number): Promise<ProductRow[]>;
    /**
     * Search products using full-text search
     */
    search(query: string, limit?: number): Promise<ProductRow[]>;
    /**
     * Create or update a product (upsert by wc_id)
     */
    upsert(product: ProductInsert): Promise<ProductRow | null>;
    /**
     * Bulk upsert products
     */
    bulkUpsert(products: ProductInsert[]): Promise<ProductRow[] | null>;
    /**
     * Delete a product
     */
    delete(id: number): Promise<boolean>;
};
/**
 * Order Operations
 */
export declare const orderOperations: {
    /**
     * Get a single order by ID
     */
    getById(id: number): Promise<OrderRow | null>;
    /**
     * Get orders with pagination and filtering
     */
    getMany(options?: {
        page?: number;
        limit?: number;
        status?: string;
        customerId?: number;
        orderBy?: "date_created" | "date_modified" | "total";
        orderDirection?: "asc" | "desc";
    }): Promise<{
        data: OrderRow[];
        total: number;
    } | null>;
    /**
     * Create or update an order
     */
    upsert(order: OrderInsert): Promise<OrderRow | null>;
};
/**
 * Cart Operations
 */
export declare const cartOperations: {
    /**
     * Get cart by session ID
     */
    getBySessionId(sessionId: string): Promise<CartRow | null>;
    /**
     * Create or update a cart
     */
    upsert(cart: CartInsert | CartUpdate): Promise<CartRow | null>;
    /**
     * Delete expired carts
     */
    deleteExpired(): Promise<number>;
};
/**
 * Analytics and Metrics
 */
export declare const analyticsOperations: {
    /**
     * Log a metric
     */
    logMetric(name: string, value: number, tags?: Record<string, any>): Promise<boolean>;
    /**
     * Get metrics for a time period
     */
    getMetrics(name: string, startTime: Date, endTime: Date): Promise<Array<{
        value: number;
        timestamp: string;
        tags: any;
    }> | null>;
};
/**
 * Initialize database service (Edge-compatible)
 */
export declare function initializeDatabaseService(): Promise<boolean>;
export { isHealthy, dbStats };
export { supabaseClient as supabase } from './supabase';
declare const _default: {
    checkDatabaseHealth: typeof checkDatabaseHealth;
    executeWithFallback: typeof executeWithFallback;
    getDatabaseStats: typeof getDatabaseStats;
    initializeDatabaseService: typeof initializeDatabaseService;
    getProduct: (id: number) => Promise<{
        id: number;
        wc_id: number;
        name: string;
        slug: string;
        description: string | null;
        short_description: string | null;
        price: number | null;
        regular_price: number | null;
        sale_price: number | null;
        status: string;
        stock_quantity: number | null;
        stock_status: string;
        manage_stock: boolean;
        categories: any;
        tags: any;
        images: any;
        attributes: any;
        variations: any;
        meta_data: any;
        search_vector: string | null;
        created_at: string;
        updated_at: string;
        synced_at: string;
    } | null>;
    getProducts: (options: any) => Promise<{
        data: ProductRow[];
        total: number;
    } | null>;
    searchProducts: (query: string, limit?: number) => Promise<{
        id: number;
        wc_id: number;
        name: string;
        slug: string;
        description: string | null;
        short_description: string | null;
        price: number | null;
        regular_price: number | null;
        sale_price: number | null;
        status: string;
        stock_quantity: number | null;
        stock_status: string;
        manage_stock: boolean;
        categories: any;
        tags: any;
        images: any;
        attributes: any;
        variations: any;
        meta_data: any;
        search_vector: string | null;
        created_at: string;
        updated_at: string;
        synced_at: string;
    }[]>;
    createProduct: (product: any) => Promise<{
        id: number;
        wc_id: number;
        name: string;
        slug: string;
        description: string | null;
        short_description: string | null;
        price: number | null;
        regular_price: number | null;
        sale_price: number | null;
        status: string;
        stock_quantity: number | null;
        stock_status: string;
        manage_stock: boolean;
        categories: any;
        tags: any;
        images: any;
        attributes: any;
        variations: any;
        meta_data: any;
        search_vector: string | null;
        created_at: string;
        updated_at: string;
        synced_at: string;
    } | null>;
    updateProduct: (id: number, updates: any) => Promise<{
        id: number;
        wc_id: number;
        name: string;
        slug: string;
        description: string | null;
        short_description: string | null;
        price: number | null;
        regular_price: number | null;
        sale_price: number | null;
        status: string;
        stock_quantity: number | null;
        stock_status: string;
        manage_stock: boolean;
        categories: any;
        tags: any;
        images: any;
        attributes: any;
        variations: any;
        meta_data: any;
        search_vector: string | null;
        created_at: string;
        updated_at: string;
        synced_at: string;
    } | null>;
    deleteProduct: (id: number) => Promise<boolean>;
    getOrder: (id: number) => Promise<{
        id: number;
        wc_id: number;
        order_key: string;
        status: string;
        currency: string;
        total: number;
        subtotal: number;
        tax_total: number;
        shipping_total: number;
        customer_id: number | null;
        customer_note: string | null;
        billing: any;
        shipping: any;
        line_items: any;
        shipping_lines: any;
        tax_lines: any;
        fee_lines: any;
        coupon_lines: any;
        payment_method: string | null;
        payment_method_title: string | null;
        transaction_id: string | null;
        date_created: string;
        date_modified: string;
        date_completed: string | null;
        date_paid: string | null;
        synced_at: string;
    } | null>;
    getOrders: (options: any) => Promise<{
        data: OrderRow[];
        total: number;
    } | null>;
    createOrder: (order: any) => Promise<{
        id: number;
        wc_id: number;
        order_key: string;
        status: string;
        currency: string;
        total: number;
        subtotal: number;
        tax_total: number;
        shipping_total: number;
        customer_id: number | null;
        customer_note: string | null;
        billing: any;
        shipping: any;
        line_items: any;
        shipping_lines: any;
        tax_lines: any;
        fee_lines: any;
        coupon_lines: any;
        payment_method: string | null;
        payment_method_title: string | null;
        transaction_id: string | null;
        date_created: string;
        date_modified: string;
        date_completed: string | null;
        date_paid: string | null;
        synced_at: string;
    } | null>;
    updateOrderStatus: (id: number, updates: any) => Promise<{
        id: number;
        wc_id: number;
        order_key: string;
        status: string;
        currency: string;
        total: number;
        subtotal: number;
        tax_total: number;
        shipping_total: number;
        customer_id: number | null;
        customer_note: string | null;
        billing: any;
        shipping: any;
        line_items: any;
        shipping_lines: any;
        tax_lines: any;
        fee_lines: any;
        coupon_lines: any;
        payment_method: string | null;
        payment_method_title: string | null;
        transaction_id: string | null;
        date_created: string;
        date_modified: string;
        date_completed: string | null;
        date_paid: string | null;
        synced_at: string;
    } | null>;
    calculateOrderTotals: (lineItems: any[]) => Promise<{
        subtotal: number;
        tax: number;
        shipping: number;
        total: number;
    }>;
    getOrderTracking: (id: number) => Promise<{
        status: string;
        tracking_number: any;
        estimated_delivery: any;
        shipping_carrier: any;
        history: any[];
    } | null>;
    updateOrderStatusWithHistory: (id: number, newStatus: string, note?: string, userId?: string) => Promise<{
        id: number;
        wc_id: number;
        order_key: string;
        status: string;
        currency: string;
        total: number;
        subtotal: number;
        tax_total: number;
        shipping_total: number;
        customer_id: number | null;
        customer_note: string | null;
        billing: any;
        shipping: any;
        line_items: any;
        shipping_lines: any;
        tax_lines: any;
        fee_lines: any;
        coupon_lines: any;
        payment_method: string | null;
        payment_method_title: string | null;
        transaction_id: string | null;
        date_created: string;
        date_modified: string;
        date_completed: string | null;
        date_paid: string | null;
        synced_at: string;
    } | null>;
    updateInventory: (productId: number, quantityChange: number, operation?: "decrease" | "increase") => Promise<boolean>;
    reserveInventory: (lineItems: any[], orderId?: number) => Promise<{
        product_id: any;
        quantity: any;
        order_id: number | undefined;
    }[]>;
    releaseInventory: (lineItems: any[]) => Promise<boolean>;
    getCustomer: (id: number) => Promise<{
        id: number;
        email: string;
        first_name: string;
        last_name: string;
        phone: string;
        billing: {};
        shipping: {};
        created_at: string;
        updated_at: string;
    }>;
    getCustomers: (options: any) => Promise<{
        data: never[];
        total: number;
    }>;
    createCustomer: (customer: any) => Promise<any>;
    updateCustomer: (id: number, updates: any) => Promise<any>;
    deleteCustomer: (id: number) => Promise<boolean>;
    getCart: (cartId: string, cartType: "user" | "session") => Promise<any>;
    addToCart: (data: any) => Promise<{
        id: number;
        session_id: string;
        user_id: number | null;
        items: any;
        totals: any;
        coupons: any;
        shipping: any;
        billing: any;
        status: string;
        expires_at: string;
        created_at: string;
        updated_at: string;
    } | null>;
    updateCartItem: (data: any) => Promise<{
        id: number;
        session_id: string;
        user_id: number | null;
        items: any;
        totals: any;
        coupons: any;
        shipping: any;
        billing: any;
        status: string;
        expires_at: string;
        created_at: string;
        updated_at: string;
    } | null>;
    removeFromCart: (cartId: string, cartType: string, productId: number, variationId?: number) => Promise<{
        id: number;
        session_id: string;
        user_id: number | null;
        items: any;
        totals: any;
        coupons: any;
        shipping: any;
        billing: any;
        status: string;
        expires_at: string;
        created_at: string;
        updated_at: string;
    } | null>;
    clearCart: (cartId: string, cartType: string) => Promise<true | {
        id: number;
        session_id: string;
        user_id: number | null;
        items: any;
        totals: any;
        coupons: any;
        shipping: any;
        billing: any;
        status: string;
        expires_at: string;
        created_at: string;
        updated_at: string;
    } | null>;
    getCartTotals: (cartId: string, cartType: string) => Promise<any>;
    calculateCartTotals: (items: any[]) => Promise<{
        subtotal: number;
        tax: number;
        total: number;
        items_count: number;
    }>;
    mergeCart: (sessionId: string, userId: string) => Promise<{
        id: number;
        session_id: string;
        user_id: number | null;
        items: any;
        totals: any;
        coupons: any;
        shipping: any;
        billing: any;
        status: string;
        expires_at: string;
        created_at: string;
        updated_at: string;
    } | null>;
    getPerformanceMetrics: () => Promise<{
        response_times: {
            value: number;
            timestamp: string;
            tags: any;
        }[];
        error_rate: number;
        request_count: number;
    }>;
    healthCheck: () => Promise<{
        isHealthy: boolean;
        lastHealthCheck: string | null;
        healthCheckAgeMs: number | null;
        connectionAttempts: number;
        successfulConnections: number;
        failedConnections: number;
        healthChecks: number;
        avgQueryTime: number;
        lastError: string | null;
        healthy: boolean;
        responseTime: number;
    }>;
    products: {
        /**
         * Get a single product by ID
         */
        getById(id: number): Promise<ProductRow | null>;
        /**
         * Get a single product by WooCommerce ID
         */
        getByWcId(wcId: number): Promise<ProductRow | null>;
        /**
         * Get products with pagination and filtering
         */
        getMany(options?: {
            page?: number;
            limit?: number;
            status?: string;
            category?: string;
            search?: string;
            orderBy?: "created_at" | "updated_at" | "name" | "price";
            orderDirection?: "asc" | "desc";
        }): Promise<{
            data: ProductRow[];
            total: number;
        } | null>;
        /**
         * Get popular/featured products
         */
        getPopular(limit?: number): Promise<ProductRow[]>;
        /**
         * Search products using full-text search
         */
        search(query: string, limit?: number): Promise<ProductRow[]>;
        /**
         * Create or update a product (upsert by wc_id)
         */
        upsert(product: ProductInsert): Promise<ProductRow | null>;
        /**
         * Bulk upsert products
         */
        bulkUpsert(products: ProductInsert[]): Promise<ProductRow[] | null>;
        /**
         * Delete a product
         */
        delete(id: number): Promise<boolean>;
    };
    orders: {
        /**
         * Get a single order by ID
         */
        getById(id: number): Promise<OrderRow | null>;
        /**
         * Get orders with pagination and filtering
         */
        getMany(options?: {
            page?: number;
            limit?: number;
            status?: string;
            customerId?: number;
            orderBy?: "date_created" | "date_modified" | "total";
            orderDirection?: "asc" | "desc";
        }): Promise<{
            data: OrderRow[];
            total: number;
        } | null>;
        /**
         * Create or update an order
         */
        upsert(order: OrderInsert): Promise<OrderRow | null>;
    };
    carts: {
        /**
         * Get cart by session ID
         */
        getBySessionId(sessionId: string): Promise<CartRow | null>;
        /**
         * Create or update a cart
         */
        upsert(cart: CartInsert | CartUpdate): Promise<CartRow | null>;
        /**
         * Delete expired carts
         */
        deleteExpired(): Promise<number>;
    };
    analytics: {
        /**
         * Log a metric
         */
        logMetric(name: string, value: number, tags?: Record<string, any>): Promise<boolean>;
        /**
         * Get metrics for a time period
         */
        getMetrics(name: string, startTime: Date, endTime: Date): Promise<Array<{
            value: number;
            timestamp: string;
            tags: any;
        }> | null>;
    };
};
export default _default;
//# sourceMappingURL=databaseService.d.ts.map