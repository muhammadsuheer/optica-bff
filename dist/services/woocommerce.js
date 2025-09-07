import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import { config } from '../config/env';
// WooCommerce client wrapper with failover and retry logic
class WooCommerceService {
    readOnlyClient;
    readWriteClient;
    lastKeyRotation;
    maxRetries = 3;
    baseDelay = 1000;
    constructor() {
        this.readOnlyClient = this.createClient('read');
        this.readWriteClient = this.createClient('write');
        this.lastKeyRotation = new Date();
        console.log('WooCommerce service initialized with dual-key strategy');
    }
    createClient(type) {
        const keys = type === 'read' ? config.woocommerce.readKeys : config.woocommerce.writeKeys;
        return new WooCommerceRestApi({
            url: config.woocommerce.apiUrl,
            consumerKey: keys.consumerKey,
            consumerSecret: keys.consumerSecret,
            version: 'wc/v3',
            queryStringAuth: true, // For HTTPS
            timeout: 30000,
            axiosConfig: {
                headers: {
                    'User-Agent': `Optia-BFF/1.0.0 (${type})`
                }
            }
        });
    }
    // Execute operation with retry logic and exponential backoff
    async executeWithRetry(operation, maxRetries = this.maxRetries, baseDelay = this.baseDelay) {
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                // Don't retry on authentication errors
                if (error.response?.status === 401 || error.response?.status === 403) {
                    console.error('WooCommerce authentication error:', error.response?.data);
                    throw new Error(`WooCommerce authentication failed: ${error.response?.data?.message || error.message}`);
                }
                // Don't retry on client errors (4xx except auth)
                if (error.response?.status >= 400 && error.response?.status < 500) {
                    throw new Error(`WooCommerce client error: ${error.response?.data?.message || error.message}`);
                }
                // Retry on server errors (5xx) and network errors
                if (attempt < maxRetries - 1) {
                    const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
                    console.warn(`WooCommerce API attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw new Error(`WooCommerce API failed after ${maxRetries} attempts: ${lastError.message}`);
    }
    // Product operations (READ)
    async getProducts(params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get('products', params));
    }
    async getProduct(id, params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get(`products/${id}`, params));
    }
    async getProductVariations(productId, params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get(`products/${productId}/variations`, params));
    }
    async getProductVariation(productId, variationId) {
        return this.executeWithRetry(() => this.readOnlyClient.get(`products/${productId}/variations/${variationId}`));
    }
    async getProductCategories(params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get('products/categories', params));
    }
    async getProductTags(params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get('products/tags', params));
    }
    // Order operations (READ)
    async getOrders(params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get('orders', params));
    }
    async getOrder(id, params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get(`orders/${id}`, params));
    }
    async getOrderNotes(orderId, params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get(`orders/${orderId}/notes`, params));
    }
    // Customer operations (READ)
    async getCustomers(params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get('customers', params));
    }
    async getCustomer(id, params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get(`customers/${id}`, params));
    }
    // Product operations (WRITE)
    async createProduct(productData) {
        return this.executeWithRetry(() => this.readWriteClient.post('products', productData));
    }
    async updateProduct(id, productData) {
        return this.executeWithRetry(() => this.readWriteClient.put(`products/${id}`, productData));
    }
    async deleteProduct(id, force = false) {
        return this.executeWithRetry(() => this.readWriteClient.delete(`products/${id}`, { force }));
    }
    async batchUpdateProducts(data) {
        return this.executeWithRetry(() => this.readWriteClient.post('products/batch', data));
    }
    // Stock management
    async updateProductStock(id, stockData) {
        return this.executeWithRetry(() => this.readWriteClient.put(`products/${id}`, stockData));
    }
    // Order operations (WRITE)
    async createOrder(orderData) {
        return this.executeWithRetry(() => this.readWriteClient.post('orders', orderData));
    }
    async updateOrder(id, orderData) {
        return this.executeWithRetry(() => this.readWriteClient.put(`orders/${id}`, orderData));
    }
    async deleteOrder(id, force = false) {
        return this.executeWithRetry(() => this.readWriteClient.delete(`orders/${id}`, { force }));
    }
    async addOrderNote(orderId, noteData) {
        return this.executeWithRetry(() => this.readWriteClient.post(`orders/${orderId}/notes`, noteData));
    }
    // Customer operations (WRITE)
    async createCustomer(customerData) {
        return this.executeWithRetry(() => this.readWriteClient.post('customers', customerData));
    }
    async updateCustomer(id, customerData) {
        return this.executeWithRetry(() => this.readWriteClient.put(`customers/${id}`, customerData));
    }
    async deleteCustomer(id, force = false) {
        return this.executeWithRetry(() => this.readWriteClient.delete(`customers/${id}`, { force }));
    }
    // Webhook operations
    async getWebhooks(params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get('webhooks', params));
    }
    async createWebhook(webhookData) {
        return this.executeWithRetry(() => this.readWriteClient.post('webhooks', {
            ...webhookData,
            secret: webhookData.secret || config.woocommerce.webhookSecret
        }));
    }
    async updateWebhook(id, webhookData) {
        return this.executeWithRetry(() => this.readWriteClient.put(`webhooks/${id}`, webhookData));
    }
    async deleteWebhook(id, force = false) {
        return this.executeWithRetry(() => this.readWriteClient.delete(`webhooks/${id}`, { force }));
    }
    // System operations
    async getSystemStatus() {
        return this.executeWithRetry(() => this.readOnlyClient.get('system_status'));
    }
    async getStoreInfo() {
        return this.executeWithRetry(() => this.readOnlyClient.get(''));
    }
    // Health check
    async healthCheck() {
        const startTime = Date.now();
        try {
            await this.readOnlyClient.get('', { _fields: 'name,version' });
            const latency = Date.now() - startTime;
            return { status: 'healthy', latency };
        }
        catch (error) {
            const latency = Date.now() - startTime;
            return {
                status: 'unhealthy',
                latency,
                error: error.message
            };
        }
    }
    // Key rotation functionality
    async rotateKeys(newKeys) {
        // Test new keys before switching
        const testReadClient = new WooCommerceRestApi({
            url: config.woocommerce.apiUrl,
            consumerKey: newKeys.readKey,
            consumerSecret: newKeys.readSecret,
            version: 'wc/v3',
            queryStringAuth: true
        });
        const testWriteClient = new WooCommerceRestApi({
            url: config.woocommerce.apiUrl,
            consumerKey: newKeys.writeKey,
            consumerSecret: newKeys.writeSecret,
            version: 'wc/v3',
            queryStringAuth: true
        });
        try {
            // Test read key
            await testReadClient.get('products', { per_page: 1 });
            // Test write key (create a test customer and delete it)
            const testCustomer = await testWriteClient.post('customers', {
                email: `test-${Date.now()}@example.com`,
                first_name: 'Test',
                last_name: 'User'
            });
            await testWriteClient.delete(`customers/${testCustomer.data.id}`, { force: true });
            // If tests pass, update clients
            this.readOnlyClient = testReadClient;
            this.readWriteClient = testWriteClient;
            this.lastKeyRotation = new Date();
            console.log('WooCommerce API keys rotated successfully');
        }
        catch (error) {
            console.error('Key rotation failed:', error);
            throw new Error(`Key rotation failed: ${error.message}`);
        }
    }
    // Get last key rotation date
    getLastKeyRotation() {
        return this.lastKeyRotation;
    }
    // Bulk operations
    async bulkOperation(endpoint, data) {
        return this.executeWithRetry(() => this.readWriteClient.post(`${endpoint}/batch`, data));
    }
    // Search operations
    async searchProducts(query, params = {}) {
        return this.getProducts({ search: query, ...params });
    }
    // Reports (if available)
    async getSalesReport(params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get('reports/sales', params));
    }
    async getTopSellersReport(params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get('reports/top_sellers', params));
    }
    // Coupons
    async getCoupons(params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get('coupons', params));
    }
    async getCoupon(id) {
        return this.executeWithRetry(() => this.readOnlyClient.get(`coupons/${id}`));
    }
    async createCoupon(couponData) {
        return this.executeWithRetry(() => this.readWriteClient.post('coupons', couponData));
    }
    // Shipping
    async getShippingZones() {
        return this.executeWithRetry(() => this.readOnlyClient.get('shipping/zones'));
    }
    async getShippingMethods(zoneId) {
        return this.executeWithRetry(() => this.readOnlyClient.get(`shipping/zones/${zoneId}/methods`));
    }
    // Tax
    async getTaxRates(params = {}) {
        return this.executeWithRetry(() => this.readOnlyClient.get('taxes', params));
    }
    async getTaxClasses() {
        return this.executeWithRetry(() => this.readOnlyClient.get('taxes/classes'));
    }
}
// Create and export singleton instance
export const wcClient = new WooCommerceService();
// Export the class for testing or multiple instances
export { WooCommerceService };
//# sourceMappingURL=woocommerce.js.map