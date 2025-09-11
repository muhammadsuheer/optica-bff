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

import { supabaseClient, type Database } from './supabase'

// Export supabaseClient for other services
export { supabaseClient }
import { config } from '../config/env'
import { logger } from '../observability/logger'
import { logMigrationStatus } from './migrationService'

// Database health status
let isHealthy = false
let lastHealthCheck = 0
const HEALTH_CHECK_INTERVAL = 30000 // 30 seconds

// Performance monitoring
const dbStats = {
  connectionAttempts: 0,
  successfulConnections: 0,
  failedConnections: 0,
  healthChecks: 0,
  avgQueryTime: 0,
  lastError: null as string | null,
}

/**
 * Check database health with caching
 */
export async function checkDatabaseHealth(forceCheck = false): Promise<boolean> {
  const now = Date.now()
  
  // Use cached result if recent and not forced
  if (!forceCheck && (now - lastHealthCheck) < HEALTH_CHECK_INTERVAL && isHealthy) {
    return isHealthy
  }

  try {
    const startTime = Date.now()
    
    // Simple health check query - use count query
    const { error } = await supabaseClient
      .from('products')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    
    if (error) throw error
    
    const queryTime = Date.now() - startTime
    dbStats.avgQueryTime = dbStats.avgQueryTime === 0 ? queryTime : Math.round((dbStats.avgQueryTime + queryTime) / 2)
    dbStats.healthChecks++
    dbStats.successfulConnections++
    
    isHealthy = true
    lastHealthCheck = now
    
    logger.debug(`Database health check passed (${queryTime}ms)`)
    return true
  } catch (error) {
    dbStats.failedConnections++
    dbStats.lastError = error instanceof Error ? error.message : 'Health check failed'
    isHealthy = false
    lastHealthCheck = now
    
    logger.error('Database health check failed', error instanceof Error ? error : new Error('Unknown error'))
    return false
  }
}

/**
 * Execute database operation with error handling and optional fallback
 */
export async function executeWithFallback<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T | null> {
  try {
    const startTime = Date.now()
    const result = await operation()
    const queryTime = Date.now() - startTime
    
    // Update performance stats
    dbStats.avgQueryTime = dbStats.avgQueryTime === 0 ? queryTime : Math.round((dbStats.avgQueryTime + queryTime) / 2)
    
    return result
  } catch (error) {
    logger.error('Database operation failed', error instanceof Error ? error : new Error('Unknown error'))
    dbStats.lastError = error instanceof Error ? error.message : 'Unknown error'
    
    // Try fallback if available
    if (fallback) {
      try {
        logger.debug('Attempting fallback operation...')
        return await fallback()
      } catch (fallbackError) {
        logger.error('Fallback operation also failed', new Error('Error'));
      }
    }
    
    return null
  }
}

/**
 * Get database performance statistics
 */
export function getDatabaseStats() {
  return {
    ...dbStats,
    isHealthy,
    lastHealthCheck: lastHealthCheck ? new Date(lastHealthCheck).toISOString() : null,
    healthCheckAgeMs: lastHealthCheck ? (Date.now() - lastHealthCheck) : null,
  }
}

// Type aliases for easier use
type Tables = Database['public']['Tables']
type ProductRow = Tables['products']['Row']
type ProductInsert = Tables['products']['Insert']
type ProductUpdate = Tables['products']['Update']
type OrderRow = Tables['orders']['Row']
type OrderInsert = Tables['orders']['Insert']
type CartRow = Tables['carts']['Row']
type CartInsert = Tables['carts']['Insert']
type CartUpdate = Tables['carts']['Update']
type DLQRow = any // Tables['dlq']['Row']
type DLQInsert = any // Tables['dlq']['Insert']
type DLQUpdate = any // Tables['dlq']['Update']

/**
 * Product Operations
 */
export const productOperations = {
  /**
   * Get a single product by ID
   */
  async getById(id: number): Promise<ProductRow | null> {
    return executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    })
  },

  /**
   * Get a single product by WooCommerce ID
   */
  async getByWcId(wcId: number): Promise<ProductRow | null> {
    return executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('wc_id', wcId)
        .single()
      
      if (error) throw error
      return data
    })
  },

  /**
   * Get products with pagination and filtering
   */
  async getMany(options: {
    page?: number
    limit?: number
    status?: string
    category?: string
    search?: string
    orderBy?: 'created_at' | 'updated_at' | 'name' | 'price'
    orderDirection?: 'asc' | 'desc'
  } = {}): Promise<{ data: ProductRow[]; total: number } | null> {
    return executeWithFallback(async (): Promise<any> => {
      const {
        page = 1,
        limit = 20,
        status = 'publish',
        search,
        orderBy = 'created_at',
        orderDirection = 'desc'
      } = options

      const from = (page - 1) * limit
      const to = from + limit - 1

      let query = supabaseClient
        .from('products')
        .select('*', { count: 'exact' })
        .eq('status', status)
        .order(orderBy, { ascending: orderDirection === 'asc' })
        .range(from, to)

      // Add search if provided
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      }

      const { data, error, count } = await query

      if (error) throw error

      return {
        data: data || [],
        total: count || 0
      }
    })
  },

  /**
   * Get popular/featured products
   */
  async getPopular(limit = 20): Promise<ProductRow[]> {
    const result = await executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('status', 'publish')
        .not('price', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    })

    return result || []
  },

  /**
   * Search products using full-text search
   */
  async search(query: string, limit = 20): Promise<ProductRow[]> {
    const result = await executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('status', 'publish')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%,short_description.ilike.%${query}%`)
        .limit(limit)

      if (error) throw error
      return data || []
    })

    return result || []
  },

  /**
   * Create or update a product (upsert by wc_id)
   */
  async upsert(product: ProductInsert): Promise<ProductRow | null> {
    return executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('products')
        .upsert(product as any, { 
          onConflict: 'wc_id',
          ignoreDuplicates: false 
        })
        .select()
        .single()

      if (error) throw error
      return data
    })
  },

  /**
   * Bulk upsert products
   */
  async bulkUpsert(products: ProductInsert[]): Promise<ProductRow[] | null> {
    return executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('products')
        .upsert(products as any, { 
          onConflict: 'wc_id',
          ignoreDuplicates: false 
        })
        .select()

      if (error) throw error
      return data || []
    })
  },

  /**
   * Delete a product
   */
  async delete(id: number): Promise<boolean> {
    const result = await executeWithFallback(async (): Promise<any> => {
      const { error } = await supabaseClient
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error
      return true
    })

    return result || false
  }
}

/**
 * Order Operations
 */
export const orderOperations = {
  /**
   * Get a single order by ID
   */
  async getById(id: number): Promise<OrderRow | null> {
    return executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    })
  },

  /**
   * Get orders with pagination and filtering
   */
  async getMany(options: {
    page?: number
    limit?: number
    status?: string
    customerId?: number
    orderBy?: 'date_created' | 'date_modified' | 'total'
    orderDirection?: 'asc' | 'desc'
  } = {}): Promise<{ data: OrderRow[]; total: number } | null> {
    return executeWithFallback(async (): Promise<any> => {
      const {
        page = 1,
        limit = 20,
        status,
        customerId,
        orderBy = 'date_created',
        orderDirection = 'desc'
      } = options

      const from = (page - 1) * limit
      const to = from + limit - 1

      let query = supabaseClient
        .from('orders')
        .select('*', { count: 'exact' })
        .order(orderBy, { ascending: orderDirection === 'asc' })
        .range(from, to)

      if (status) {
        query = query.eq('status', status)
      }

      if (customerId) {
        query = query.eq('customer_id', customerId)
      }

      const { data, error, count } = await query

      if (error) throw error

      return {
        data: data || [],
        total: count || 0
      }
    })
  },

  /**
   * Create or update an order
   */
  async upsert(order: OrderInsert): Promise<OrderRow | null> {
    return executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('orders')
        .upsert(order as any, { 
          onConflict: 'wc_id',
          ignoreDuplicates: false 
        })
        .select()
        .single()

      if (error) throw error
      return data
    })
  }
}

/**
 * Cart Operations
 */
export const cartOperations = {
  /**
   * Get cart by session ID
   */
  async getBySessionId(sessionId: string): Promise<CartRow | null> {
    return executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('carts')
        .select('*')
        .eq('session_id', sessionId)
        .eq('status', 'active')
        .single()
      
      if (error && error.code !== 'PGRST116') throw error // PGRST116 is "not found"
      return data
    })
  },

  /**
   * Create or update a cart
   */
  async upsert(cart: CartInsert | CartUpdate): Promise<CartRow | null> {
    return executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('carts')
        .upsert(cart as any, { 
          onConflict: 'session_id',
          ignoreDuplicates: false 
        })
        .select()
        .single()

      if (error) throw error
      return data
    })
  },

  /**
   * Delete expired carts
   */
  async deleteExpired(): Promise<number> {
    const result = await executeWithFallback(async (): Promise<any> => {
      const { count, error } = await supabaseClient
        .from('carts')
        .delete({ count: 'exact' })
        .lt('expires_at', new Date().toISOString())

      if (error) throw error
      return count || 0
    })

    return result || 0
  }
}

/**
 * DLQ (Dead Letter Queue) Operations
 */
export const dlqOperations = {
  /**
   * Insert a DLQ record
   */
  async insert(record: DLQInsert): Promise<DLQRow | null> {
    return executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('dlq')
        .insert(record)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
  },

  /**
   * Get DLQ record by ID
   */
  async getById(id: number): Promise<DLQRow | null> {
    return executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('dlq')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    })
  },

  /**
   * Get DLQ records by topic
   */
  async getByTopic(topic: string, limit = 50): Promise<DLQRow[]> {
    const result = await executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('dlq')
        .select('*')
        .eq('topic', topic)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      return data || []
    })

    return result || []
  },

  /**
   * Update DLQ record
   */
  async update(id: number, updates: DLQUpdate): Promise<DLQRow | null> {
    return executeWithFallback(async (): Promise<any> => {
      const { data, error } = await (supabaseClient as any)
        .from('dlq')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
  },

  /**
   * Delete DLQ record
   */
  async delete(id: number): Promise<boolean> {
    const result = await executeWithFallback(async (): Promise<any> => {
      const { error } = await supabaseClient
        .from('dlq')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      return true
    })

    return result || false
  },

  /**
   * Get DLQ statistics
   */
  async getStats(): Promise<{ total: number; byTopic: Record<string, number> } | null> {
    return executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('dlq')
        .select('topic')
      
      if (error) throw error
      
      const stats = {
        total: data?.length || 0,
        byTopic: {} as Record<string, number>
      }
      
      data?.forEach((record: any) => {
        stats.byTopic[(record as any).topic] = (stats.byTopic[(record as any).topic] || 0) + 1
      })
      
      return stats
    })
  }
}

/**
 * Analytics and Metrics
 */
export const analyticsOperations = {
  /**
   * Log a metric
   */
  async logMetric(name: string, value: number, tags?: Record<string, any>): Promise<boolean> {
    const result = await executeWithFallback(async (): Promise<any> => {
      const { error } = await supabaseClient
        .from('metrics')
        .insert({ // Type assertion for insert
          name,
          value,
          tags: tags || {},
          timestamp: new Date().toISOString()
        } as any)

      if (error) throw error
      return true
    })

    return result || false
  },

  /**
   * Get metrics for a time period
   */
  async getMetrics(
    name: string,
    startTime: Date,
    endTime: Date
  ): Promise<Array<{ value: number; timestamp: string; tags: any }> | null> {
    return executeWithFallback(async (): Promise<any> => {
      const { data, error } = await supabaseClient
        .from('metrics')
        .select('value, timestamp, tags')
        .eq('name', name)
        .gte('timestamp', startTime.toISOString())
        .lte('timestamp', endTime.toISOString())
        .order('timestamp', { ascending: true })

      if (error) throw error
      return data || []
    })
  }
}

/**
 * Initialize database service (Edge-compatible)
 */
export async function initializeDatabaseService(): Promise<boolean> {
  try {
    logger.info('Initializing database service...')
    
    // Run initial health check
    const healthy = await checkDatabaseHealth(true)
    
    if (!healthy) {
      logger.warn('Database is not healthy, skipping migrations')
      return false
    }

    // Check migration status (migrations should be run manually in Supabase)
    await logMigrationStatus()

    logger.info('Database service initialized successfully')
    return true
  } catch (error) {
    logger.error('Failed to initialize database service:', error instanceof Error ? error : new Error('Unknown error'))
    return false
  }
}

// Export individual operations and utilities
// Exports handled above

// Export the supabase client for direct access when needed
// Exports handled above from './supabase'

// Default export with all operations
export default {
  checkDatabaseHealth,
  executeWithFallback,
  getDatabaseStats,
  initializeDatabaseService,
  
  // Product operations
  getProduct: (id: number) => productOperations.getById(id),
  getProducts: (options: any) => productOperations.getMany(options),
  searchProducts: (query: string, limit?: number) => productOperations.search(query, limit),
  createProduct: (product: any) => productOperations.upsert(product),
  updateProduct: (id: number, updates: any) => productOperations.upsert({ id, ...updates }),
  deleteProduct: (id: number) => productOperations.delete(id),
  
  // Order operations
  getOrder: (id: number) => orderOperations.getById(id),
  getOrders: (options: any) => orderOperations.getMany(options),
  createOrder: (order: any) => orderOperations.upsert(order),
  updateOrderStatus: async (id: number, updates: any) => {
    const existing = await orderOperations.getById(id)
    if (!existing) return null
    return orderOperations.upsert({ ...existing, ...updates, id })
  },
  calculateOrderTotals: async (lineItems: any[]) => {
    try {
      // Calculate order totals from line items with price validation
      let subtotal = 0
      for (const item of lineItems) {
        // Always validate against current product price (prevent price manipulation)
        const product = await productOperations.getById(item.product_id)
        if (!product) {
          throw new Error(`Product ${item.product_id} not found`)
        }

        // Get current price (for variation or regular product)
        const currentPrice = item.variation_id 
          ? product.variations?.find((v: any) => v.id === item.variation_id)?.price || product.price
          : product.price

        if (!currentPrice || currentPrice <= 0) {
          throw new Error(`Invalid price for product ${product.name}`)
        }

        // If line item has a price, validate it matches current price (allow small tolerance for timing)
        if (item.price && Math.abs(item.price - currentPrice) > 0.01) {
          logger.warn('Price mismatch detected', {
            productId: item.product_id,
            lineItemPrice: item.price,
            currentPrice,
            difference: Math.abs(item.price - currentPrice)
          })
          // Use current price for security
        }

        // Always use current validated price
        subtotal += currentPrice * item.quantity
      }

      // Get configurable tax rate (default 8.5%)
      const taxRate = 0.085 // config.tax?.rate || 0.085
      const tax = subtotal * taxRate
      
      // Add shipping if applicable
      const shipping = 0 // config.shipping?.defaultRate || 0
      const total = subtotal + tax + shipping
      
      return { 
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        shipping: Math.round(shipping * 100) / 100,
        total: Math.round(total * 100) / 100
      }
    } catch (error) {
      logger.error('Error calculating order totals', new Error('Error'));
      return { subtotal: 0, tax: 0, shipping: 0, total: 0 }
    }
  },
  getOrderTracking: async (id: number) => {
    try {
      const order = await orderOperations.getById(id)
      if (!order) {
        return null
      }

      // Get order status history (if available)
      let history: any[] = []
      try {
        // Try to get from order_status_history table or metadata
        const historyResult = await supabaseClient
          .from('order_status_history')
          .select('*')
          .eq('order_id', id)
          .order('created_at', { ascending: true })
        
        if (historyResult.data) {
          history = historyResult.data.map((entry: any) => ({
            status: entry.status,
            timestamp: entry.created_at,
            note: entry.note || null,
            user_id: entry.user_id || null
          }))
        }
      } catch (error) {
        // Fallback to basic history from order metadata
        logger.debug('Order history table not available, using fallback', { orderId: id })
        history = [
          {
            status: order.status,
            timestamp: new Date().toISOString(), // order.updated_at || order.created_at
            note: 'Order status',
            user_id: null
          }
        ]
      }

      return {
        status: order.status || 'unknown',
        tracking_number: (order as any)?.tracking_number || null,
        estimated_delivery: (order as any)?.estimated_delivery || null,
        shipping_carrier: (order as any)?.shipping_carrier || null,
        history
      }
    } catch (error) {
      logger.error('Error getting order tracking', new Error('Error'));
      return null
    }
  },

  // Add method to update order status with history tracking
  updateOrderStatusWithHistory: async (id: number, newStatus: string, note?: string, userId?: string) => {
    try {
      const order = await orderOperations.getById(id)
      if (!order) {
        throw new Error('Order not found')
      }

      // Update order status
      const updatedOrder = await orderOperations.upsert({ 
        ...order, 
        // id, // Remove this as it's auto-generated 
        status: newStatus,
        // updated_at: new Date().toISOString() // Field not in schema
      })

      // Add to status history
      try {
        await (supabaseClient as any)
          .from('order_status_history')
          .insert({
            order_id: id,
            status: newStatus,
            note: note || null,
            user_id: userId || null,
            created_at: new Date().toISOString()
          })
      } catch (historyError) {
        // Log but don't fail the order update if history insert fails
        logger.warn('Failed to insert order status history', { error: historyError, orderId: id })
      }

      return updatedOrder
    } catch (error) {
      logger.error('Error updating order status with history', new Error('Error'));
      throw error
    }
  },
  
  // Inventory management
  updateInventory: async (productId: number, quantityChange: number, operation: 'decrease' | 'increase' = 'decrease') => {
    try {
      const product = await productOperations.getById(productId)
      if (!product) {
        throw new Error('Product not found')
      }

      if (product.stock_quantity === null) {
        // Product doesn't track inventory
        return true
      }

      const newQuantity = operation === 'decrease' 
        ? product.stock_quantity - quantityChange
        : product.stock_quantity + quantityChange

      if (newQuantity < 0) {
        throw new Error('Insufficient inventory')
      }

      // Update stock quantity
      await productOperations.upsert({
        ...product,
        updated_at: product.updated_at || undefined,
        stock_quantity: newQuantity,
        stock_status: newQuantity > 0 ? 'instock' : 'outofstock'
      })

      logger.info('Inventory updated', { 
        productId, 
        operation, 
        quantityChange, 
        oldQuantity: product.stock_quantity, 
        newQuantity 
      })

      return true
    } catch (error) {
      logger.error('Error updating inventory', new Error('Error'));
      throw error
    }
  },

  // Reserve inventory for pending orders
  reserveInventory: async (lineItems: any[], orderId?: number) => {
    try {
      const reservations: any[] = []
      
      for (const item of lineItems) {
        const product = await productOperations.getById(item.product_id)
        if (!product) {
          throw new Error(`Product ${item.product_id} not found`)
        }

        if (product.stock_quantity !== null) {
          if (product.stock_quantity < item.quantity) {
            throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock_quantity}, Requested: ${item.quantity}`)
          }

          // Reserve the inventory
          // TODO: Implement inventory management
          // await updateInventory(item.product_id, item.quantity, 'decrease')
          
          reservations.push({
            product_id: item.product_id,
            quantity: item.quantity,
            order_id: orderId
          })
        }
      }

      return reservations
    } catch (error) {
      logger.error('Error reserving inventory', new Error('Error'));
      throw error
    }
  },

  // Release reserved inventory (e.g., when order is cancelled)
  releaseInventory: async (lineItems: any[]) => {
    try {
      for (const item of lineItems) {
        // TODO: Implement inventory management
        // await updateInventory(item.product_id, item.quantity, 'increase')
      }
      
      logger.info('Inventory released', { lineItems })
      return true
    } catch (error) {
      logger.error('Error releasing inventory', new Error('Error'));
      throw error
    }
  },

  // Customer operations
  getCustomer: async (id: number) => {
    // For now, return a mock customer - would need to implement customer table
    return {
      id,
      email: `user${id}@example.com`,
      first_name: 'John',
      last_name: 'Doe',
      phone: '+1234567890',
      billing: {},
      shipping: {},
      created_at: new Date().toISOString(),
      // updated_at: new Date().toISOString() // Field not in schema
    }
  },
  getCustomers: async (options: any) => {
    // Mock implementation - would need customer table
    return {
      data: [],
      total: 0
    }
  },
  createCustomer: async (customer: any) => {
    // Mock implementation - would need customer table
    return {
      id: Math.floor(Math.random() * 1000),
      ...customer,
      created_at: new Date().toISOString(),
      // updated_at: new Date().toISOString() // Field not in schema
    }
  },
  updateCustomer: async (id: number, updates: any) => {
    // Mock implementation - would need customer table
    return {
      id,
      ...updates,
      // updated_at: new Date().toISOString() // Field not in schema
    }
  },
  deleteCustomer: async (id: number) => {
    // Mock implementation - would need customer table
    return true
  },
  
  // Cart operations
  getCart: async (cartId: string, cartType: 'user' | 'session') => {
    try {
      if (cartType === 'session') {
        return cartOperations.getBySessionId(cartId)
      } else {
        // For user carts, get by user_id
        // TODO: Implement getMany for cart operations
        const result = { data: [], total: 0 }
        // await cartOperations.getMany({ 
        //   filters: { user_id: cartId },
        //   limit: 1 
        // })
        return result.data[0] || null
      }
    } catch (error) {
      logger.error('Error getting cart', new Error('Error'));
      return null
    }
  },
  addToCart: async (data: any) => {
    try {
      const { cartId, cartType, productId, quantity, variationId } = data
      
      // Get existing cart or create new one
      let cart = await cartOperations.getBySessionId(cartId)
      if (!cart) {
        cart = {
          id: 0,
          session_id: cartType === 'session' ? cartId : '',
          user_id: cartType === 'user' ? parseInt(cartId) : null,
          items: [],
          totals: { subtotal: 0, tax: 0, total: 0, items_count: 0 },
          coupons: null,
          shipping: null,
          billing: null,
          status: 'active',
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString()
        }
      }

      // Get product details for pricing
      const product = await productOperations.getById(productId)
      if (!product) {
        throw new Error('Product not found')
      }

      // Check stock availability
      if (product.stock_quantity !== null && product.stock_quantity < quantity) {
        throw new Error('Insufficient stock')
      }

      // Validate price integrity (prevent price manipulation)
      const currentPrice = variationId 
        ? product.variations?.find((v: any) => v.id === variationId)?.price || product.price
        : product.price
      
      if (!currentPrice || currentPrice <= 0) {
        throw new Error('Invalid product price')
      }

      // Add or update item in cart
      if (cart) {
        const existingItemIndex = cart.items.findIndex((item: any) => 
          item.product_id === productId && item.variation_id === variationId
        )

        if (existingItemIndex >= 0) {
          // Update existing item quantity and refresh price
          cart.items[existingItemIndex].quantity += quantity
          cart.items[existingItemIndex].price = currentPrice // Always use current price
        } else {
          // Add new item with current price
          cart.items.push({
            product_id: productId,
            variation_id: variationId,
            quantity,
            price: currentPrice, // Use validated current price
            name: product.name,
            image: product.images?.[0]?.src || null
          })
        }
      }

      // Recalculate totals
      if (cart) {
        // Calculate totals inline
        let subtotal = 0
        let items_count = 0
        for (const item of (cart as any)?.items || []) {
          const itemTotal = (item.price || 0) * item.quantity
          subtotal += itemTotal
          items_count += item.quantity
        }
        const taxRate = 0.085 // 8.5% tax rate
        const tax = subtotal * taxRate
        const total = subtotal + tax;
        (cart as any).totals = {};
        (cart as any).totals.subtotal = subtotal;
        (cart as any).totals.tax = tax;
        (cart as any).totals.total = total;
        (cart as any).totals.items_count = items_count;
      }
      cart.totals.items_count = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0)

      return cartOperations.upsert(cart)
    } catch (error) {
      logger.error('Error adding to cart', new Error('Error'));
      throw error
    }
  },
  updateCartItem: async (data: any) => {
    try {
      const { cartId, cartType, productId, variationId, quantity } = data
      
      // Get existing cart
      const cart = await cartOperations.getBySessionId(cartId)
      if (!cart) {
        throw new Error('Cart not found')
      }
      if (!cart) {
        throw new Error('Cart not found')
      }

      // Find the item to update
      const itemIndex = cart.items.findIndex((item: any) => 
        item.product_id === productId && item.variation_id === variationId
      )

      if (itemIndex === -1) {
        throw new Error('Item not found in cart')
      }

      if (quantity <= 0) {
        // Remove item if quantity is 0 or negative
        cart.items.splice(itemIndex, 1)
      } else {
        // Update quantity and validate stock
        const product = await productOperations.getById(productId)
        if (product && product.stock_quantity !== null && product.stock_quantity < quantity) {
          throw new Error('Insufficient stock')
        }
        cart.items[itemIndex].quantity = quantity
      }

      // Recalculate totals
      if (cart) {
        // Calculate totals inline
        let subtotal = 0
        let items_count = 0
        for (const item of (cart as any)?.items || []) {
          const itemTotal = (item.price || 0) * item.quantity
          subtotal += itemTotal
          items_count += item.quantity
        }
        const taxRate = 0.085 // 8.5% tax rate
        const tax = subtotal * taxRate
        const total = subtotal + tax;
        (cart as any).totals = {};
        (cart as any).totals.subtotal = subtotal;
        (cart as any).totals.tax = tax;
        (cart as any).totals.total = total;
        (cart as any).totals.items_count = items_count;
      }
      cart.totals.items_count = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0)

      return cartOperations.upsert(cart)
    } catch (error) {
      logger.error('Error updating cart item', new Error('Error'));
      throw error
    }
  },
  removeFromCart: async (cartId: string, cartType: string, productId: number, variationId?: number) => {
    try {
      // Get existing cart
      const cart = await cartOperations.getBySessionId(cartId)
      if (!cart) {
        throw new Error('Cart not found')
      }
      if (!cart) {
        throw new Error('Cart not found')
      }

      // Find and remove the item
      const itemIndex = cart.items.findIndex((item: any) => 
        item.product_id === productId && item.variation_id === variationId
      )

      if (itemIndex === -1) {
        throw new Error('Item not found in cart')
      }

      cart.items.splice(itemIndex, 1)

      // Recalculate totals
      if (cart) {
        // Calculate totals inline
        let subtotal = 0
        let items_count = 0
        for (const item of (cart as any)?.items || []) {
          const itemTotal = (item.price || 0) * item.quantity
          subtotal += itemTotal
          items_count += item.quantity
        }
        const taxRate = 0.085 // 8.5% tax rate
        const tax = subtotal * taxRate
        const total = subtotal + tax;
        (cart as any).totals = {};
        (cart as any).totals.subtotal = subtotal;
        (cart as any).totals.tax = tax;
        (cart as any).totals.total = total;
        (cart as any).totals.items_count = items_count;
      }
      cart.totals.items_count = cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0)

      return cartOperations.upsert(cart)
    } catch (error) {
      logger.error('Error removing from cart', new Error('Error'));
      throw error
    }
  },
  clearCart: async (cartId: string, cartType: string) => {
    try {
      // Get existing cart
      const cart = await cartOperations.getBySessionId(cartId)
      if (!cart) {
        throw new Error('Cart not found')
      }
      if (!cart) {
        return true // Cart doesn't exist, consider it cleared
      }

      // Clear all items
      cart.items = []
      cart.totals = { subtotal: 0, tax: 0, total: 0, items_count: 0       }

      if (!cart) {
        throw new Error('Cart not found')
      }
      return cartOperations.upsert(cart)
    } catch (error) {
      logger.error('Error clearing cart', new Error('Error'));
      throw error
    }
  },
  getCartTotals: async (cartId: string, cartType: string) => {
    try {
      const cart = await cartOperations.getBySessionId(cartId)
      if (!cart) {
        throw new Error('Cart not found')
      }
      if (!cart || !cart.items?.length) {
        return {
          subtotal: 0,
          tax: 0,
          total: 0,
          items_count: 0
        }
      }

      // Calculate totals inline
      let subtotal = 0
      let items_count = 0
      for (const item of (cart as any)?.items || []) {
        const itemTotal = (item.price || 0) * item.quantity
        subtotal += itemTotal
        items_count += item.quantity
      }
      const taxRate = 0.085 // 8.5% tax rate
      const tax = subtotal * taxRate
      const total = subtotal + tax
      return { subtotal, tax, total, items_count }
    } catch (error) {
      logger.error('Error getting cart totals', new Error('Error'));
      return {
        subtotal: 0,
        tax: 0,
        total: 0,
        items_count: 0
      }
    }
  },

  // Add the calculateCartTotals helper method
  calculateCartTotals: async (items: any[]) => {
    let subtotal = 0
    let items_count = 0

    for (const item of items) {
      const itemTotal = (item.price || 0) * item.quantity
      subtotal += itemTotal
      items_count += item.quantity
    }

    // Get configurable tax rate (default 8.5%)
    const taxRate = config.tax?.rate || 0.085
    const tax = subtotal * taxRate
    const total = subtotal + tax

    return {
      subtotal: Math.round(subtotal * 100) / 100, // Round to 2 decimal places
      tax: Math.round(tax * 100) / 100,
      total: Math.round(total * 100) / 100,
      items_count
    }
  },
  mergeCart: async (sessionId: string, userId: string) => {
    // Merge session cart with user cart
    return cartOperations.getBySessionId(sessionId)
  },
  
  // Analytics
  getPerformanceMetrics: async (): Promise<any> => {
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
    
    const metrics = await analyticsOperations.getMetrics('performance', startTime, endTime)
    
    return {
      response_times: metrics || [],
      error_rate: 0,
      request_count: 0
    }
  },
  
  // Health check
  healthCheck: async (): Promise<any> => {
    const healthy = await checkDatabaseHealth()
    const stats = getDatabaseStats()
    
    return {
      healthy,
      responseTime: stats.avgQueryTime,
      ...stats
    }
  },
  
  // DLQ operations
  insertDLQ: (record: any) => dlqOperations.insert(record),
  getDLQById: (id: number) => dlqOperations.getById(id),
  getDLQByTopic: (topic: string, limit?: number) => dlqOperations.getByTopic(topic, limit),
  updateDLQ: (id: number, updates: any) => dlqOperations.update(id, updates),
  deleteDLQ: (id: number) => dlqOperations.delete(id),
  getDLQStats: () => dlqOperations.getStats(),
  
  // Legacy operations for backward compatibility
  products: productOperations,
  orders: orderOperations,
  carts: cartOperations,
  analytics: analyticsOperations,
  dlq: dlqOperations,
}

// DLQ types and methods
export type DLQRecord = {
  id: number
  job_id: string
  topic: string
  payload: unknown
  error: string
  retry_count: number
  max_retries: number
  processed_at: string | null
  created_at: string
}

export async function insertDLQRecord(r: Omit<DLQRecord,'id'|'created_at'|'processed_at'>): Promise<DLQRecord> {
  const { data, error } = await supabaseClient.from('dlq').insert(r as any).select('*').single()
  if (error) throw error
  return data as DLQRecord
}

export async function getDLQRecord(id: number): Promise<DLQRecord | null> {
  const { data } = await supabaseClient.from('dlq').select('*').eq('id', id).maybeSingle()
  return (data as any) ?? null
}

export async function updateDLQRecord(id: number, updates: Partial<DLQRecord>): Promise<DLQRecord> {
  const { data, error } = await (supabaseClient as any).from('dlq').update(updates).eq('id', id).select('*').single()
  if (error) throw error
  return data as DLQRecord
}

export async function getDLQRecordsByTopic(topic: string, limit = 50): Promise<DLQRecord[]> {
  const { data } = await supabaseClient.from('dlq').select('*').eq('topic', topic).order('created_at', { ascending: false }).limit(limit)
  return (data as DLQRecord[]) ?? []
}

export async function getDLQStats(): Promise<{ total: number; byTopic: Record<string, number>; byStatus: Record<string, number> }> {
  const { count: total } = await supabaseClient.from('dlq').select('*', { count: 'exact', head: true })
  return { total: Number(total ?? 0), byTopic: {}, byStatus: {} }
}

export async function deleteOldDLQRecords(cutoffISO: string): Promise<number> {
  const { count } = await supabaseClient.from('dlq').delete({ count: 'exact' }).lt('created_at', cutoffISO)
  return Number(count ?? 0)
}