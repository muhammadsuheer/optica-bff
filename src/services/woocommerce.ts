import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api'
import { config } from '../config/env'
import type { Product, ProductQuery, ProductCreateData, ProductUpdateData } from '../types/product'
import type { Order, OrderQuery, OrderCreateData, OrderUpdateData } from '../types/order'

// WooCommerce client wrapper with failover and retry logic
class WooCommerceService {
  private readOnlyClient: WooCommerceRestApi
  private readWriteClient: WooCommerceRestApi
  private lastKeyRotation: Date
  private readonly maxRetries = 3
  private readonly baseDelay = 1000

  constructor() {
    this.readOnlyClient = this.createClient('read')
    this.readWriteClient = this.createClient('write')
    this.lastKeyRotation = new Date()

    console.log('WooCommerce service initialized with dual-key strategy')
  }

  private createClient(type: 'read' | 'write'): WooCommerceRestApi {
    const keys = type === 'read' ? config.woocommerce.readKeys : config.woocommerce.writeKeys

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
    })
  }

  // Execute operation with retry logic and exponential backoff
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.maxRetries,
    baseDelay: number = this.baseDelay
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error: any) {
        lastError = error as Error
        
        // Don't retry on authentication errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.error('WooCommerce authentication error:', error.response?.data)
          throw new Error(`WooCommerce authentication failed: ${error.response?.data?.message || error.message}`)
        }
        
        // Don't retry on client errors (4xx except auth)
        if (error.response?.status >= 400 && error.response?.status < 500) {
          throw new Error(`WooCommerce client error: ${error.response?.data?.message || error.message}`)
        }
        
        // Retry on server errors (5xx) and network errors
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
          console.warn(`WooCommerce API attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`WooCommerce API failed after ${maxRetries} attempts: ${lastError!.message}`)
  }

  // Product operations (READ)
  async getProducts(params: ProductQuery = {}): Promise<{ data: Product[]; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get('products', params))
  }

  async getProduct(id: number, params: any = {}): Promise<{ data: Product; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get(`products/${id}`, params))
  }

  async getProductVariations(productId: number, params: any = {}): Promise<{ data: any[]; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get(`products/${productId}/variations`, params))
  }

  async getProductVariation(productId: number, variationId: number): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get(`products/${productId}/variations/${variationId}`))
  }

  async getProductCategories(params: any = {}): Promise<{ data: any[]; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get('products/categories', params))
  }

  async getProductTags(params: any = {}): Promise<{ data: any[]; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get('products/tags', params))
  }

  // Order operations (READ)
  async getOrders(params: OrderQuery = {}): Promise<{ data: Order[]; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get('orders', params))
  }

  async getOrder(id: number, params: any = {}): Promise<{ data: Order; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get(`orders/${id}`, params))
  }

  async getOrderNotes(orderId: number, params: any = {}): Promise<{ data: any[]; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get(`orders/${orderId}/notes`, params))
  }

  // Customer operations (READ)
  async getCustomers(params: any = {}): Promise<{ data: any[]; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get('customers', params))
  }

  async getCustomer(id: number, params: any = {}): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get(`customers/${id}`, params))
  }

  // Product operations (WRITE)
  async createProduct(productData: ProductCreateData): Promise<{ data: Product; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.post('products', productData))
  }

  async updateProduct(id: number, productData: ProductUpdateData): Promise<{ data: Product; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.put(`products/${id}`, productData))
  }

  async deleteProduct(id: number, force: boolean = false): Promise<{ data: Product; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.delete(`products/${id}`, { force }))
  }

  async batchUpdateProducts(data: { create?: ProductCreateData[]; update?: ProductUpdateData[]; delete?: number[] }): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.post('products/batch', data))
  }

  // Stock management
  async updateProductStock(id: number, stockData: {
    stock_quantity?: number
    stock_status?: 'instock' | 'outofstock' | 'onbackorder'
    manage_stock?: boolean
  }): Promise<{ data: Product; headers: any }> {
    return this.executeWithRetry(() => 
      this.readWriteClient.put(`products/${id}`, stockData)
    )
  }

  // Order operations (WRITE)
  async createOrder(orderData: OrderCreateData): Promise<{ data: Order; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.post('orders', orderData))
  }

  async updateOrder(id: number, orderData: OrderUpdateData): Promise<{ data: Order; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.put(`orders/${id}`, orderData))
  }

  async deleteOrder(id: number, force: boolean = false): Promise<{ data: Order; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.delete(`orders/${id}`, { force }))
  }

  async addOrderNote(orderId: number, noteData: {
    note: string
    customer_note?: boolean
    added_by_user?: boolean
  }): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => 
      this.readWriteClient.post(`orders/${orderId}/notes`, noteData)
    )
  }

  // Customer operations (WRITE)
  async createCustomer(customerData: any): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.post('customers', customerData))
  }

  async updateCustomer(id: number, customerData: any): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.put(`customers/${id}`, customerData))
  }

  async deleteCustomer(id: number, force: boolean = false): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.delete(`customers/${id}`, { force }))
  }

  // Webhook operations
  async getWebhooks(params: any = {}): Promise<{ data: any[]; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get('webhooks', params))
  }

  async createWebhook(webhookData: {
    name: string
    topic: string
    delivery_url: string
    secret?: string
    status?: 'active' | 'paused' | 'disabled'
  }): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.post('webhooks', {
      ...webhookData,
      secret: webhookData.secret || config.woocommerce.webhookSecret
    }))
  }

  async updateWebhook(id: number, webhookData: any): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.put(`webhooks/${id}`, webhookData))
  }

  async deleteWebhook(id: number, force: boolean = false): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.delete(`webhooks/${id}`, { force }))
  }

  // System operations
  async getSystemStatus(): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get('system_status'))
  }

  async getStoreInfo(): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get(''))
  }

  // Health check
  async healthCheck(): Promise<{ status: string; latency: number; error?: string }> {
    const startTime = Date.now()
    
    try {
      await this.readOnlyClient.get('', { _fields: 'name,version' })
      const latency = Date.now() - startTime
      
      return { status: 'healthy', latency }
    } catch (error: any) {
      const latency = Date.now() - startTime
      
      return { 
        status: 'unhealthy', 
        latency, 
        error: error.message 
      }
    }
  }

  // Key rotation functionality
  async rotateKeys(newKeys: {
    readKey: string
    readSecret: string
    writeKey: string
    writeSecret: string
  }): Promise<void> {
    // Test new keys before switching
    const testReadClient = new WooCommerceRestApi({
      url: config.woocommerce.apiUrl,
      consumerKey: newKeys.readKey,
      consumerSecret: newKeys.readSecret,
      version: 'wc/v3',
      queryStringAuth: true
    })

    const testWriteClient = new WooCommerceRestApi({
      url: config.woocommerce.apiUrl,
      consumerKey: newKeys.writeKey,
      consumerSecret: newKeys.writeSecret,
      version: 'wc/v3',
      queryStringAuth: true
    })

    try {
      // Test read key
      await testReadClient.get('products', { per_page: 1 })
      
      // Test write key (create a test customer and delete it)
      const testCustomer = await testWriteClient.post('customers', {
        email: `test-${Date.now()}@example.com`,
        first_name: 'Test',
        last_name: 'User'
      })
      await testWriteClient.delete(`customers/${testCustomer.data.id}`, { force: true })

      // If tests pass, update clients
      this.readOnlyClient = testReadClient
      this.readWriteClient = testWriteClient
      this.lastKeyRotation = new Date()

      console.log('WooCommerce API keys rotated successfully')

    } catch (error: any) {
      console.error('Key rotation failed:', error)
      throw new Error(`Key rotation failed: ${error.message}`)
    }
  }

  // Get last key rotation date
  getLastKeyRotation(): Date {
    return this.lastKeyRotation
  }

  // Bulk operations
  async bulkOperation(endpoint: string, data: any): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.post(`${endpoint}/batch`, data))
  }

  // Search operations
  async searchProducts(query: string, params: any = {}): Promise<{ data: Product[]; headers: any }> {
    return this.getProducts({ search: query, ...params })
  }

  // Reports (if available)
  async getSalesReport(params: any = {}): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get('reports/sales', params))
  }

  async getTopSellersReport(params: any = {}): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get('reports/top_sellers', params))
  }

  // Coupons
  async getCoupons(params: any = {}): Promise<{ data: any[]; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get('coupons', params))
  }

  async getCoupon(id: number): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get(`coupons/${id}`))
  }

  async createCoupon(couponData: any): Promise<{ data: any; headers: any }> {
    return this.executeWithRetry(() => this.readWriteClient.post('coupons', couponData))
  }

  // Shipping
  async getShippingZones(): Promise<{ data: any[]; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get('shipping/zones'))
  }

  async getShippingMethods(zoneId: number): Promise<{ data: any[]; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get(`shipping/zones/${zoneId}/methods`))
  }

  // Tax
  async getTaxRates(params: any = {}): Promise<{ data: any[]; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get('taxes', params))
  }

  async getTaxClasses(): Promise<{ data: any[]; headers: any }> {
    return this.executeWithRetry(() => this.readOnlyClient.get('taxes/classes'))
  }
}

// Create and export singleton instance
export const wcClient = new WooCommerceService()

// Export the class for testing or multiple instances
export { WooCommerceService }
