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
import { config } from '../config/env';
import { logger } from '../utils/logger';
class WooRestApiClient {
    baseUrl;
    consumerKey;
    consumerSecret;
    timeout;
    maxRetries;
    constructor() {
        this.baseUrl = config.woocommerce.apiUrl;
        this.consumerKey = config.woocommerce.consumerKey;
        this.consumerSecret = config.woocommerce.consumerSecret;
        this.timeout = 30000; // 30 seconds
        this.maxRetries = 3;
    }
    /**
     * Make authenticated request to WooCommerce REST API
     */
    async request(endpoint, options = {}) {
        const { method = 'GET', headers = {}, body, timeout = this.timeout, retries = this.maxRetries } = options;
        const url = new URL(endpoint, this.baseUrl);
        // Add authentication
        url.searchParams.set('consumer_key', this.consumerKey);
        url.searchParams.set('consumer_secret', this.consumerSecret);
        const requestOptions = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Optia-BFF/1.0.0',
                'Accept': 'application/json',
                ...headers
            }
        };
        if (body && method !== 'GET') {
            requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }
        let lastError = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const startTime = Date.now();
                // Create abort controller for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                requestOptions.signal = controller.signal;
                const response = await fetch(url.toString(), requestOptions);
                clearTimeout(timeoutId);
                const responseTime = Date.now() - startTime;
                // Parse response headers
                const responseHeaders = {};
                response.headers.forEach((value, key) => {
                    responseHeaders[key] = value;
                });
                let data;
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                    data = await response.json();
                }
                else {
                    data = await response.text();
                }
                const result = {
                    data,
                    status: response.status,
                    statusText: response.statusText,
                    headers: responseHeaders,
                    url: url.toString()
                };
                // Log successful request
                logger.debug('WooCommerce API request successful', {
                    method,
                    endpoint,
                    status: response.status,
                    responseTime,
                    attempt: attempt + 1
                });
                return result;
            }
            catch (error) {
                lastError = error;
                // Log failed request
                logger.warn('WooCommerce API request failed', {
                    method,
                    endpoint,
                    attempt: attempt + 1,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    willRetry: attempt < retries
                });
                // Don't retry on certain errors
                if (error instanceof Error) {
                    if (error.name === 'AbortError') {
                        // Timeout - don't retry
                        break;
                    }
                    if (error.message.includes('400') || error.message.includes('401') || error.message.includes('403')) {
                        // Client errors - don't retry
                        break;
                    }
                }
                // Wait before retry (exponential backoff)
                if (attempt < retries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        // All retries failed
        const error = {
            code: 'REQUEST_FAILED',
            message: lastError?.message || 'Request failed after all retries',
            status: 0
        };
        logger.error('WooCommerce API request failed after all retries', {
            method,
            endpoint,
            error: error.message
        });
        throw error;
    }
    /**
     * GET request
     */
    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }
    /**
     * POST request
     */
    async post(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'POST', body });
    }
    /**
     * PUT request
     */
    async put(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'PUT', body });
    }
    /**
     * DELETE request
     */
    async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }
    /**
     * PATCH request
     */
    async patch(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'PATCH', body });
    }
    /**
     * Get products with pagination
     */
    async getProducts(params = {}) {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.set(key, value.toString());
            }
        });
        const endpoint = `/wp-json/wc/v3/products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        return this.get(endpoint);
    }
    /**
     * Get a single product
     */
    async getProduct(id) {
        return this.get(`/wp-json/wc/v3/products/${id}`);
    }
    /**
     * Create a product
     */
    async createProduct(product) {
        return this.post('/wp-json/wc/v3/products', product);
    }
    /**
     * Update a product
     */
    async updateProduct(id, product) {
        return this.put(`/wp-json/wc/v3/products/${id}`, product);
    }
    /**
     * Delete a product
     */
    async deleteProduct(id) {
        return this.delete(`/wp-json/wc/v3/products/${id}`);
    }
    /**
     * Get orders with pagination
     */
    async getOrders(params = {}) {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.set(key, value.toString());
            }
        });
        const endpoint = `/wp-json/wc/v3/orders${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        return this.get(endpoint);
    }
    /**
     * Get a single order
     */
    async getOrder(id) {
        return this.get(`/wp-json/wc/v3/orders/${id}`);
    }
    /**
     * Update order status
     */
    async updateOrderStatus(id, status) {
        return this.put(`/wp-json/wc/v3/orders/${id}`, { status });
    }
    /**
     * Get customers with pagination
     */
    async getCustomers(params = {}) {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.set(key, value.toString());
            }
        });
        const endpoint = `/wp-json/wc/v3/customers${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        return this.get(endpoint);
    }
    /**
     * Get a single customer
     */
    async getCustomer(id) {
        return this.get(`/wp-json/wc/v3/customers/${id}`);
    }
    /**
     * Create a customer
     */
    async createCustomer(customer) {
        return this.post('/wp-json/wc/v3/customers', customer);
    }
    /**
     * Update a customer
     */
    async updateCustomer(id, customer) {
        return this.put(`/wp-json/wc/v3/customers/${id}`, customer);
    }
    /**
     * Health check
     */
    async healthCheck() {
        const startTime = Date.now();
        try {
            const response = await this.get('/wp-json/wc/v3/system_status');
            const latency = Date.now() - startTime;
            return {
                healthy: response.status === 200,
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
export const wooRestApiClient = new WooRestApiClient();
// Export class for testing
export { WooRestApiClient };
//# sourceMappingURL=wooRestApiClient.js.map