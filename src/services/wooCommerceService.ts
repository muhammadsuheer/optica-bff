/**
 * WooCommerce Service - Edge Runtime Compatible
 * 
 * Features:
 * - WooCommerce API integration
 * - Product synchronization
 * - Order management
 * - Customer management
 * - Webhook handling
 */

import { config } from '../config/env'
import { logger } from '../utils/logger'
import { cacheService, CACHE_TTL, CACHE_TAGS } from './cacheService'

export interface WooCommerceProduct {
  id: number
  name: string
  slug: string
  permalink: string
  date_created: string
  date_created_gmt: string
  date_modified: string
  date_modified_gmt: string
  type: string
  status: string
  featured: boolean
  catalog_visibility: string
  description: string
  short_description: string
  sku: string
  price: string
  regular_price: string
  sale_price: string
  date_on_sale_from: string | null
  date_on_sale_to: string | null
  on_sale: boolean
  purchasable: boolean
  total_sales: number
  virtual: boolean
  downloadable: boolean
  downloads: any[]
  download_limit: number
  download_expiry: number
  external_url: string
  button_text: string
  tax_status: string
  tax_class: string
  manage_stock: boolean
  stock_quantity: number | null
  stock_status: string
  backorders: string
  backorders_allowed: boolean
  backordered: boolean
  sold_individually: boolean
  weight: string
  dimensions: {
    length: string
    width: string
    height: string
  }
  shipping_required: boolean
  shipping_taxable: boolean
  shipping_class: string
  shipping_class_id: number
  reviews_allowed: boolean
  average_rating: string
  rating_count: number
  related_ids: number[]
  upsell_ids: number[]
  cross_sell_ids: number[]
  parent_id: number
  purchase_note: string
  categories: Array<{
    id: number
    name: string
    slug: string
  }>
  tags: Array<{
    id: number
    name: string
    slug: string
  }>
  images: Array<{
    id: number
    date_created: string
    date_created_gmt: string
    date_modified: string
    date_modified_gmt: string
    src: string
    name: string
    alt: string
  }>
  attributes: Array<{
    id: number
    name: string
    position: number
    visible: boolean
    variation: boolean
    options: string[]
  }>
  default_attributes: any[]
  variations: number[]
  grouped_products: number[]
  menu_order: number
  meta_data: Array<{
    id: number
    key: string
    value: any
  }>
}

export interface WooCommerceOrder {
  id: number
  parent_id: number
  status: string
  currency: string
  date_created: string
  date_created_gmt: string
  date_modified: string
  date_modified_gmt: string
  discount_total: string
  discount_tax: string
  shipping_total: string
  shipping_tax: string
  cart_tax: string
  total: string
  total_tax: string
  customer_id: number
  order_key: string
  billing: {
    first_name: string
    last_name: string
    company: string
    address_1: string
    address_2: string
    city: string
    state: string
    postcode: string
    country: string
    email: string
    phone: string
  }
  shipping: {
    first_name: string
    last_name: string
    company: string
    address_1: string
    address_2: string
    city: string
    state: string
    postcode: string
    country: string
  }
  payment_method: string
  payment_method_title: string
  transaction_id: string
  customer_ip_address: string
  customer_user_agent: string
  created_via: string
  customer_note: string
  date_completed: string | null
  date_paid: string | null
  cart_hash: string
  number: string
  meta_data: Array<{
    id: number
    key: string
    value: any
  }>
  line_items: Array<{
    id: number
    name: string
    product_id: number
    variation_id: number
    quantity: number
    tax_class: string
    subtotal: string
    subtotal_tax: string
    total: string
    total_tax: string
    taxes: any[]
    meta_data: Array<{
      id: number
      key: string
      value: any
    }>
    sku: string
    price: number
  }>
  tax_lines: any[]
  shipping_lines: any[]
  fee_lines: any[]
  coupon_lines: any[]
  refunds: any[]
  payment_url: string
  is_editable: boolean
  needs_payment: boolean
  needs_processing: boolean
  date_created_gmt: string
  date_modified_gmt: string
  date_completed_gmt: string | null
  date_paid_gmt: string | null
  currency_symbol: string
}

class WooCommerceService {
  private baseUrl: string
  private consumerKey: string
  private consumerSecret: string

  constructor() {
    this.baseUrl = config.woocommerce.apiUrl
    this.consumerKey = config.woocommerce.consumerKey
    this.consumerSecret = config.woocommerce.consumerSecret
  }

  /**
   * Make authenticated request to WooCommerce API
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T | null> {
    try {
      const url = new URL(endpoint, this.baseUrl)
      
      // Add authentication
      url.searchParams.set('consumer_key', this.consumerKey)
      url.searchParams.set('consumer_secret', this.consumerSecret)

      const response = await fetch(url.toString(), {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Optia-BFF/1.0.0',
          ...options.headers
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data as T

    } catch (error) {
      logger.error('WooCommerce API request failed', { 
        endpoint, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      return null
    }
  }

  /**
   * Get products from WooCommerce
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
  } = {}): Promise<WooCommerceProduct[]> {
    try {
      const {
        page = 1,
        per_page = 20,
        search,
        status = 'publish',
        featured,
        category,
        orderby = 'date',
        order = 'desc'
      } = params

      // Generate cache key
      const cacheKey = `wc:products:${JSON.stringify(params)}`
      
      // Try to get from cache first
      const cached = await cacheService.get<WooCommerceProduct[]>(cacheKey)
      if (cached) {
        logger.debug('WooCommerce products cache hit', { params })
        return cached
      }

      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        per_page: per_page.toString(),
        status,
        orderby,
        order
      })

      if (search) queryParams.set('search', search)
      if (featured !== undefined) queryParams.set('featured', featured.toString())
      if (category) queryParams.set('category', category)

      const products = await this.makeRequest<WooCommerceProduct[]>(
        `/wp-json/wc/v3/products?${queryParams.toString()}`
      )

      if (!products) {
        return []
      }

      // Cache the result
      await cacheService.set(cacheKey, products, {
        ttl: CACHE_TTL.PRODUCTS.LIST,
        tags: [CACHE_TAGS.PRODUCTS, 'woocommerce']
      })

      logger.info('WooCommerce products fetched', { 
        count: products.length, 
        params 
      })

      return products

    } catch (error) {
      logger.error('Error fetching WooCommerce products', { error, params })
      return []
    }
  }

  /**
   * Get a single product from WooCommerce
   */
  async getProduct(id: number): Promise<WooCommerceProduct | null> {
    try {
      // Generate cache key
      const cacheKey = `wc:product:${id}`
      
      // Try to get from cache first
      const cached = await cacheService.get<WooCommerceProduct>(cacheKey)
      if (cached) {
        logger.debug('WooCommerce product cache hit', { id })
        return cached
      }

      const product = await this.makeRequest<WooCommerceProduct>(
        `/wp-json/wc/v3/products/${id}`
      )

      if (!product) {
        return null
      }

      // Cache the result
      await cacheService.set(cacheKey, product, {
        ttl: CACHE_TTL.PRODUCTS.SINGLE,
        tags: [CACHE_TAGS.PRODUCTS, 'woocommerce']
      })

      logger.debug('WooCommerce product fetched', { id })
      return product

    } catch (error) {
      logger.error('Error fetching WooCommerce product', { error, id })
      return null
    }
  }

  /**
   * Get orders from WooCommerce
   */
  async getOrders(params: {
    page?: number
    per_page?: number
    status?: string
    customer?: number
    orderby?: string
    order?: 'asc' | 'desc'
  } = {}): Promise<WooCommerceOrder[]> {
    try {
      const {
        page = 1,
        per_page = 20,
        status,
        customer,
        orderby = 'date',
        order = 'desc'
      } = params

      // Generate cache key
      const cacheKey = `wc:orders:${JSON.stringify(params)}`
      
      // Try to get from cache first
      const cached = await cacheService.get<WooCommerceOrder[]>(cacheKey)
      if (cached) {
        logger.debug('WooCommerce orders cache hit', { params })
        return cached
      }

      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        per_page: per_page.toString(),
        orderby,
        order
      })

      if (status) queryParams.set('status', status)
      if (customer) queryParams.set('customer', customer.toString())

      const orders = await this.makeRequest<WooCommerceOrder[]>(
        `/wp-json/wc/v3/orders?${queryParams.toString()}`
      )

      if (!orders) {
        return []
      }

      // Cache the result
      await cacheService.set(cacheKey, orders, {
        ttl: CACHE_TTL.ORDERS.LIST,
        tags: [CACHE_TAGS.ORDERS, 'woocommerce']
      })

      logger.info('WooCommerce orders fetched', { 
        count: orders.length, 
        params 
      })

      return orders

    } catch (error) {
      logger.error('Error fetching WooCommerce orders', { error, params })
      return []
    }
  }

  /**
   * Get a single order from WooCommerce
   */
  async getOrder(id: number): Promise<WooCommerceOrder | null> {
    try {
      // Generate cache key
      const cacheKey = `wc:order:${id}`
      
      // Try to get from cache first
      const cached = await cacheService.get<WooCommerceOrder>(cacheKey)
      if (cached) {
        logger.debug('WooCommerce order cache hit', { id })
        return cached
      }

      const order = await this.makeRequest<WooCommerceOrder>(
        `/wp-json/wc/v3/orders/${id}`
      )

      if (!order) {
        return null
      }

      // Cache the result
      await cacheService.set(cacheKey, order, {
        ttl: CACHE_TTL.ORDERS.SINGLE,
        tags: [CACHE_TAGS.ORDERS, 'woocommerce']
      })

      logger.debug('WooCommerce order fetched', { id })
      return order

    } catch (error) {
      logger.error('Error fetching WooCommerce order', { error, id })
      return null
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(id: number, status: string): Promise<WooCommerceOrder | null> {
    try {
      const order = await this.makeRequest<WooCommerceOrder>(
        `/wp-json/wc/v3/orders/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ status })
        }
      )

      if (order) {
        // Invalidate order cache
        await cacheService.del(`wc:order:${id}`)
        await cacheService.invalidateByTags([CACHE_TAGS.ORDERS])
        
        logger.info('WooCommerce order status updated', { id, status })
      }

      return order

    } catch (error) {
      logger.error('Error updating WooCommerce order status', { error, id, status })
      return null
    }
  }

  /**
   * Sync product from WooCommerce to local database
   */
  async syncProduct(wcProduct: WooCommerceProduct): Promise<boolean> {
    try {
      // Transform WooCommerce product to local format
      const localProduct = {
        wc_id: wcProduct.id,
        name: wcProduct.name,
        slug: wcProduct.slug,
        description: wcProduct.description,
        short_description: wcProduct.short_description,
        price: parseFloat(wcProduct.price) || 0,
        regular_price: parseFloat(wcProduct.regular_price) || 0,
        sale_price: wcProduct.sale_price ? parseFloat(wcProduct.sale_price) : null,
        status: wcProduct.status,
        featured: wcProduct.featured,
        images: wcProduct.images.map(img => img.src),
        categories: wcProduct.categories.map(cat => cat.name),
        tags: wcProduct.tags.map(tag => tag.name),
        attributes: wcProduct.attributes.reduce((acc, attr) => {
          acc[attr.name] = attr.options
          return acc
        }, {} as Record<string, any>),
        stock_status: wcProduct.stock_status,
        stock_quantity: wcProduct.stock_quantity,
        weight: wcProduct.weight ? parseFloat(wcProduct.weight) : null,
        dimensions: {
          length: wcProduct.dimensions.length ? parseFloat(wcProduct.dimensions.length) : null,
          width: wcProduct.dimensions.width ? parseFloat(wcProduct.dimensions.width) : null,
          height: wcProduct.dimensions.height ? parseFloat(wcProduct.dimensions.height) : null
        },
        created_at: wcProduct.date_created,
        updated_at: wcProduct.date_modified
      }

      // Import databaseService to upsert the product
      const { productService } = await import('./productService')
      const result = await productService.upsertProduct(localProduct)

      if (result) {
        logger.info('Product synced from WooCommerce', { 
          wc_id: wcProduct.id, 
          local_id: result.id 
        })
        return true
      }

      return false

    } catch (error) {
      logger.error('Error syncing product from WooCommerce', { 
        error, 
        wc_id: wcProduct.id 
      })
      return false
    }
  }

  /**
   * Sync multiple products from WooCommerce
   */
  async syncProducts(wcProducts: WooCommerceProduct[]): Promise<{ synced: number; failed: number }> {
    let synced = 0
    let failed = 0

    for (const wcProduct of wcProducts) {
      const success = await this.syncProduct(wcProduct)
      if (success) {
        synced++
      } else {
        failed++
      }
    }

    logger.info('Products sync completed', { synced, failed, total: wcProducts.length })
    return { synced, failed }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    const startTime = Date.now()
    
    try {
      // Test API connectivity
      const products = await this.makeRequest<WooCommerceProduct[]>(
        '/wp-json/wc/v3/products?per_page=1'
      )
      
      const latency = Date.now() - startTime
      
      return {
        healthy: products !== null,
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
export const wooCommerceService = new WooCommerceService()

// Export class for testing
export { WooCommerceService }

// Export types
export type { WooCommerceProduct, WooCommerceOrder }
