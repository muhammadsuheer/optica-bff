/**
 * Product Service - Edge Runtime Compatible
 *
 * Features:
 * - Product CRUD operations
 * - Search and filtering
 * - Caching integration
 * - WooCommerce synchronization
 */
export interface Product {
    id: number;
    wc_id: number;
    name: string;
    slug: string;
    description?: string;
    short_description?: string;
    price?: number;
    regular_price?: number;
    sale_price?: number;
    status: string;
    featured: boolean;
    images: string[];
    categories: string[];
    tags: string[];
    attributes: Record<string, any>;
    stock_status: string;
    stock_quantity?: number;
    weight?: number;
    dimensions?: {
        length?: number;
        width?: number;
        height?: number;
    };
    created_at: string;
    updated_at: string;
}
export interface ProductFilters {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    search?: string;
    min_price?: number;
    max_price?: number;
    featured?: boolean;
    in_stock?: boolean;
    orderBy?: 'created_at' | 'updated_at' | 'name' | 'price';
    orderDirection?: 'asc' | 'desc';
}
export interface ProductSearchResult {
    data: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}
declare class ProductService {
    /**
     * Get products with filtering and pagination
     */
    getProducts(filters?: ProductFilters): Promise<ProductSearchResult | null>;
    /**
     * Get a single product by ID
     */
    getProduct(id: number): Promise<Product | null>;
    /**
     * Get a single product by WooCommerce ID
     */
    getProductByWcId(wcId: number): Promise<Product | null>;
    /**
     * Search products
     */
    searchProducts(query: string, limit?: number): Promise<Product[]>;
    /**
     * Get popular/featured products
     */
    getPopularProducts(limit?: number): Promise<Product[]>;
    /**
     * Create or update a product
     */
    upsertProduct(product: Partial<Product>): Promise<Product | null>;
    /**
     * Bulk upsert products
     */
    bulkUpsertProducts(products: Partial<Product>[]): Promise<Product[]>;
    /**
     * Delete a product
     */
    deleteProduct(id: number): Promise<boolean>;
    /**
     * Get product categories
     */
    getCategories(): Promise<string[]>;
    /**
     * Invalidate product-related caches
     */
    private invalidateProductCaches;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency: number;
        error?: string;
    }>;
}
export declare const productService: ProductService;
export { ProductService };
export type { Product, ProductFilters, ProductSearchResult };
//# sourceMappingURL=productService.d.ts.map