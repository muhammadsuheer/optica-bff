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

import { config } from '../config/env'
import { logger } from '../utils/logger'

export interface WooApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: any
  timeout?: number
  retries?: number
}

export interface WooApiResponse<T = any> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
  url: string
}

export interface WooApiError {
  code: string
  message: string
  data?: any
  status?: number
}

class WooRestApiClient {
  private baseUrl: string
  private consumerKey: string
  private consumerSecret: string
  private timeout: number
  private maxRetries: number

  constructor() {
    this.baseUrl = config.woocommerce.apiUrl
    this.consumerKey = config.woocommerce.consumerKey
    this.consumerSecret = config.woocommerce.consumerSecret
    this.timeout = 30000 // 30 seconds
    this.maxRetries = 3
  }

  /**
   * Make authenticated request to WooCommerce REST API
   */
  async request<T = any>(
    endpoint: string,
    options: WooApiRequestOptions = {}
  ): Promise<WooApiResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.timeout,
      retries = this.maxRetries
    } = options

    const url = new URL(endpoint, this.baseUrl)
    
    // Add authentication
    url.searchParams.set('consumer_key', this.consumerKey)
    url.searchParams.set('consumer_secret', this.consumerSecret)

    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Optia-BFF/1.0.0',
        'Accept': 'application/json',
        ...headers
      }
    }

    if (body && method !== 'GET') {
      requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const startTime = Date.now()
        
        // Create abort controller for timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)
        
        requestOptions.signal = controller.signal

        const response = await fetch(url.toString(), requestOptions)
        clearTimeout(timeoutId)

        const responseTime = Date.now() - startTime

        // Parse response headers
        const responseHeaders: Record<string, string> = {}
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value
        })

        let data: T
        const contentType = response.headers.get('content-type')
        
        if (contentType?.includes('application/json')) {
          data = await response.json()
        } else {
          data = await response.text() as unknown as T
        }

        const result: WooApiResponse<T> = {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          url: url.toString()
        }

        // Log successful request
        logger.debug('WooCommerce API request successful', {
          method,
          endpoint,
          status: response.status,
          responseTime,
          attempt: attempt + 1
        })

        return result

      } catch (error) {
        lastError = error as Error
        
        // Log failed request
        logger.warn('WooCommerce API request failed', {
          method,
          endpoint,
          attempt: attempt + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
          willRetry: attempt < retries
        })

        // Don't retry on certain errors
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            // Timeout - don't retry
            break
          }
          
          if (error.message.includes('400') || error.message.includes('401') || error.message.includes('403')) {
            // Client errors - don't retry
            break
          }
        }

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // All retries failed
    const error: WooApiError = {
      code: 'REQUEST_FAILED',
      message: lastError?.message || 'Request failed after all retries',
      status: 0
    }

    logger.error('WooCommerce API request failed after all retries', {
      method,
      endpoint,
      error: error.message
    })

    throw error
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, options: Omit<WooApiRequestOptions, 'method'> = {}): Promise<WooApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, body?: any, options: Omit<WooApiRequestOptions, 'method' | 'body'> = {}): Promise<WooApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body })
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, body?: any, options: Omit<WooApiRequestOptions, 'method' | 'body'> = {}): Promise<WooApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body })
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, options: Omit<WooApiRequestOptions, 'method'> = {}): Promise<WooApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }

  /**
   * PATCH request
   */
  async patch<T = any>(endpoint: string, body?: any, options: Omit<WooApiRequestOptions, 'method' | 'body'> = {}): Promise<WooApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body })
  }

  /**
   * Get products with pagination
   */
  async getProducts(params: {
    page?: number
    per_page?: number
    search?: string
    status?: string
    featured?: boolean
    category?: string
    orderby?: string
    order?: 'asc' | 'desc'
  } = {}): Promise<WooApiResponse<any[]>> {
    const queryParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.set(key, value.toString())
      }
    })

    const endpoint = `/wp-json/wc/v3/products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return this.get<any[]>(endpoint)
  }

  /**
   * Get a single product
   */
  async getProduct(id: number): Promise<WooApiResponse<any>> {
    return this.get<any>(`/wp-json/wc/v3/products/${id}`)
  }

  /**
   * Create a product
   */
  async createProduct(product: any): Promise<WooApiResponse<any>> {
    return this.post<any>('/wp-json/wc/v3/products', product)
  }

  /**
   * Update a product
   */
  async updateProduct(id: number, product: any): Promise<WooApiResponse<any>> {
    return this.put<any>(`/wp-json/wc/v3/products/${id}`, product)
  }

  /**
   * Delete a product
   */
  async deleteProduct(id: number): Promise<WooApiResponse<any>> {
    return this.delete<any>(`/wp-json/wc/v3/products/${id}`)
  }

  /**
   * Get orders with pagination
   */
  async getOrders(params: {
    page?: number
    per_page?: number
    status?: string
    customer?: number
    orderby?: string
    order?: 'asc' | 'desc'
  } = {}): Promise<WooApiResponse<any[]>> {
    const queryParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.set(key, value.toString())
      }
    })

    const endpoint = `/wp-json/wc/v3/orders${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return this.get<any[]>(endpoint)
  }

  /**
   * Get a single order
   */
  async getOrder(id: number): Promise<WooApiResponse<any>> {
    return this.get<any>(`/wp-json/wc/v3/orders/${id}`)
  }

  /**
   * Update order status
   */
  async updateOrderStatus(id: number, status: string): Promise<WooApiResponse<any>> {
    return this.put<any>(`/wp-json/wc/v3/orders/${id}`, { status })
  }

  /**
   * Get customers with pagination
   */
  async getCustomers(params: {
    page?: number
    per_page?: number
    search?: string
    email?: string
    orderby?: string
    order?: 'asc' | 'desc'
  } = {}): Promise<WooApiResponse<any[]>> {
    const queryParams = new URLSearchParams()
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.set(key, value.toString())
      }
    })

    const endpoint = `/wp-json/wc/v3/customers${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return this.get<any[]>(endpoint)
  }

  /**
   * Get a single customer
   */
  async getCustomer(id: number): Promise<WooApiResponse<any>> {
    return this.get<any>(`/wp-json/wc/v3/customers/${id}`)
  }

  /**
   * Create a customer
   */
  async createCustomer(customer: any): Promise<WooApiResponse<any>> {
    return this.post<any>('/wp-json/wc/v3/customers', customer)
  }

  /**
   * Update a customer
   */
  async updateCustomer(id: number, customer: any): Promise<WooApiResponse<any>> {
    return this.put<any>(`/wp-json/wc/v3/customers/${id}`, customer)
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = Date.now()
    
    try {
      const response = await this.get('/wp-json/wc/v3/system_status')
      const latency = Date.now() - startTime
      
      return {
        healthy: response.status === 200,
        latency
      }
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Export singleton instance
export const wooRestApiClient = new WooRestApiClient()

// Export class for testing
export { WooRestApiClient }

// Export types
export type { WooApiRequestOptions, WooApiResponse, WooApiError }
