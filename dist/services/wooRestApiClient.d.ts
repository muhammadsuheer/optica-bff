/**
 * WooCommerce REST API Client - Edge Runtime Compatible
 *
 * Features:
 * - HTTP client for WooCommerce REST API
 * - Authentication handling
 * - Request/response logging
 * - Error handling and retries
 * - Rate limiting
 */
export interface WooApiRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
    retries?: number;
}
export interface WooApiResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    url: string;
}
export interface WooApiError {
    code: string;
    message: string;
    data?: any;
    status?: number;
}
declare class WooRestApiClient {
    private baseUrl;
    private consumerKey;
    private consumerSecret;
    private timeout;
    private maxRetries;
    constructor();
    /**
     * Make authenticated request to WooCommerce REST API
     */
    request<T = any>(endpoint: string, options?: WooApiRequestOptions): Promise<WooApiResponse<T>>;
    /**
     * GET request
     */
    get<T = any>(endpoint: string, options?: Omit<WooApiRequestOptions, 'method'>): Promise<WooApiResponse<T>>;
    /**
     * POST request
     */
    post<T = any>(endpoint: string, body?: any, options?: Omit<WooApiRequestOptions, 'method' | 'body'>): Promise<WooApiResponse<T>>;
    /**
     * PUT request
     */
    put<T = any>(endpoint: string, body?: any, options?: Omit<WooApiRequestOptions, 'method' | 'body'>): Promise<WooApiResponse<T>>;
    /**
     * DELETE request
     */
    delete<T = any>(endpoint: string, options?: Omit<WooApiRequestOptions, 'method'>): Promise<WooApiResponse<T>>;
    /**
     * PATCH request
     */
    patch<T = any>(endpoint: string, body?: any, options?: Omit<WooApiRequestOptions, 'method' | 'body'>): Promise<WooApiResponse<T>>;
    /**
     * Get products with pagination
     */
    getProducts(params?: {
        page?: number;
        per_page?: number;
        search?: string;
        status?: string;
        featured?: boolean;
        category?: string;
        orderby?: string;
        order?: 'asc' | 'desc';
    }): Promise<WooApiResponse<any[]>>;
    /**
     * Get a single product
     */
    getProduct(id: number): Promise<WooApiResponse<any>>;
    /**
     * Create a product
     */
    createProduct(product: any): Promise<WooApiResponse<any>>;
    /**
     * Update a product
     */
    updateProduct(id: number, product: any): Promise<WooApiResponse<any>>;
    /**
     * Delete a product
     */
    deleteProduct(id: number): Promise<WooApiResponse<any>>;
    /**
     * Get orders with pagination
     */
    getOrders(params?: {
        page?: number;
        per_page?: number;
        status?: string;
        customer?: number;
        orderby?: string;
        order?: 'asc' | 'desc';
    }): Promise<WooApiResponse<any[]>>;
    /**
     * Get a single order
     */
    getOrder(id: number): Promise<WooApiResponse<any>>;
    /**
     * Update order status
     */
    updateOrderStatus(id: number, status: string): Promise<WooApiResponse<any>>;
    /**
     * Get customers with pagination
     */
    getCustomers(params?: {
        page?: number;
        per_page?: number;
        search?: string;
        email?: string;
        orderby?: string;
        order?: 'asc' | 'desc';
    }): Promise<WooApiResponse<any[]>>;
    /**
     * Get a single customer
     */
    getCustomer(id: number): Promise<WooApiResponse<any>>;
    /**
     * Create a customer
     */
    createCustomer(customer: any): Promise<WooApiResponse<any>>;
    /**
     * Update a customer
     */
    updateCustomer(id: number, customer: any): Promise<WooApiResponse<any>>;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency: number;
        error?: string;
    }>;
}
export declare const wooRestApiClient: WooRestApiClient;
export { WooRestApiClient };
export type { WooApiRequestOptions, WooApiResponse, WooApiError };
//# sourceMappingURL=wooRestApiClient.d.ts.map