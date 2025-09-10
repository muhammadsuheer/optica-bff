/**
 * Supabase Adapter - Modern v2 Client with RLS-First Design
 * 
 * Provides typed, secure access to Supabase with proper separation
 * between anon (user-scoped) and service-role (admin) clients.
 * 
 * Key principles:
 * - RLS policies enforce all security
 * - Service role only for admin operations
 * - Typed queries with generated types
 * - Edge Runtime compatible
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../config/env'
import { logger } from '../observability/logger'

// =======================
// Types (Generate with: supabase gen types typescript)
// =======================

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          wc_id: number
          name: string
          slug: string
          description: string | null
          short_description: string | null
          price: number
          regular_price: number
          sale_price: number | null
          stock_quantity: number | null
          stock_status: 'instock' | 'outofstock' | 'onbackorder'
          manage_stock: boolean
          status: 'draft' | 'publish' | 'private'
          featured: boolean
          categories: any[]
          images: any[]
          attributes: any[]
          created_at: string
          updated_at: string
          synced_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      orders: {
        Row: {
          id: string
          wc_id: number | null
          user_id: string | null
          status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded'
          total: number
          subtotal: number
          tax_total: number
          shipping_total: number
          currency: string
          payment_method: string | null
          billing_address: any
          shipping_address: any
          line_items: any[]
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      carts: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          items: any[]
          totals: any
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['carts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['carts']['Insert']>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// =======================
// Client Instances
// =======================

/**
 * Anonymous client for user-scoped operations
 * - Uses anon key
 * - RLS policies apply
 * - Safe to use with user JWT tokens
 */
let anonClient: SupabaseClient<Database> | null = null

/**
 * Service role client for admin operations
 * - Uses service role key
 * - Bypasses RLS (use carefully!)
 * - Only for server-side admin operations
 */
let serviceClient: SupabaseClient<Database> | null = null

// =======================
// Client Factories
// =======================

/**
 * Get anonymous client (lazy initialization)
 */
export function getAnonClient(): SupabaseClient<Database> {
  if (!anonClient) {
    anonClient = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: false, // Edge Runtime doesn't support localStorage
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'X-Client-Info': 'optia-bff-anon'
          }
        }
      }
    )
    
    logger.debug('Supabase anon client initialized')
  }
  
  return anonClient
}

/**
 * Get service role client (lazy initialization)
 * WARNING: Only use for admin operations, never expose to client
 */
export function getServiceClient(): SupabaseClient<Database> {
  if (!serviceClient) {
    serviceClient = createClient<Database>(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'X-Client-Info': 'optia-bff-service'
          }
        }
      }
    )
    
    logger.debug('Supabase service client initialized')
  }
  
  return serviceClient
}

/**
 * Get client with user context (for authenticated requests)
 */
export function getClientWithAuth(accessToken: string): SupabaseClient<Database> {
  const client = getAnonClient()
  
  // Set the user's access token
  client.auth.setSession({
    access_token: accessToken,
    refresh_token: '', // Not needed for server-side operations
    expires_in: 3600,
    expires_at: Date.now() + 3600000,
    token_type: 'bearer',
    user: null as any
  })
  
  return client
}

// =======================
// Typed Query Helpers
// =======================

/**
 * Product repository with typed queries
 */
export const productRepository = {
  /**
   * Get products with filters (uses RLS)
   */
  async findMany(filters: {
    status?: 'publish' | 'draft'
    featured?: boolean
    category?: string
    search?: string
    limit?: number
    offset?: number
  } = {}) {
    const client = getAnonClient()
    let query = client
      .from('products')
      .select('*')
    
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    
    if (filters.featured !== undefined) {
      query = query.eq('featured', filters.featured)
    }
    
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }
    
    if (filters.limit) {
      query = query.limit(filters.limit)
    }
    
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
    }
    
    const { data, error, count } = await query
    
    if (error) {
      logger.error('Product query failed', { error, filters })
      throw new Error(`Failed to fetch products: ${error.message}`)
    }
    
    return { data, count }
  },

  /**
   * Get single product by ID
   */
  async findById(id: string) {
    const client = getAnonClient()
    const { data, error } = await client
      .from('products')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      logger.error('Product fetch failed', { error, id })
      throw new Error(`Failed to fetch product: ${error.message}`)
    }
    
    return data
  },

  /**
   * Upsert product (admin only)
   */
  async upsert(product: Database['public']['Tables']['products']['Insert']) {
    const client = getServiceClient()
    const { data, error } = await client
      .from('products')
      .upsert(product, { onConflict: 'wc_id' })
      .select()
      .single()
    
    if (error) {
      logger.error('Product upsert failed', { error, product: { wc_id: product.wc_id } })
      throw new Error(`Failed to upsert product: ${error.message}`)
    }
    
    return data
  }
}

/**
 * Order repository with typed queries
 */
export const orderRepository = {
  /**
   * Create order (user-scoped via RLS)
   */
  async create(order: Database['public']['Tables']['orders']['Insert'], userId?: string) {
    const client = userId ? getClientWithAuth(userId) : getAnonClient()
    const { data, error } = await client
      .from('orders')
      .insert(order)
      .select()
      .single()
    
    if (error) {
      logger.error('Order creation failed', { error, order: { total: order.total } })
      throw new Error(`Failed to create order: ${error.message}`)
    }
    
    return data
  },

  /**
   * Get user orders (RLS enforced)
   */
  async findByUserId(userId: string, limit = 10, offset = 0) {
    const client = getClientWithAuth(userId)
    const { data, error } = await client
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    if (error) {
      logger.error('User orders fetch failed', { error, userId })
      throw new Error(`Failed to fetch orders: ${error.message}`)
    }
    
    return data
  }
}

/**
 * Cart repository with typed queries
 */
export const cartRepository = {
  /**
   * Get cart by session or user ID
   */
  async findBySessionOrUser(sessionId?: string, userId?: string) {
    const client = getAnonClient()
    let query = client.from('carts').select('*')
    
    if (userId) {
      query = query.eq('user_id', userId)
    } else if (sessionId) {
      query = query.eq('session_id', sessionId)
    } else {
      throw new Error('Either sessionId or userId is required')
    }
    
    const { data, error } = await query.single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      logger.error('Cart fetch failed', { error, sessionId, userId })
      throw new Error(`Failed to fetch cart: ${error.message}`)
    }
    
    return data
  },

  /**
   * Upsert cart
   */
  async upsert(cart: Database['public']['Tables']['carts']['Insert']) {
    const client = getAnonClient()
    const { data, error } = await client
      .from('carts')
      .upsert(cart, { 
        onConflict: cart.user_id ? 'user_id' : 'session_id' 
      })
      .select()
      .single()
    
    if (error) {
      logger.error('Cart upsert failed', { error })
      throw new Error(`Failed to save cart: ${error.message}`)
    }
    
    return data
  }
}

// =======================
// Health Check
// =======================

/**
 * Check Supabase connection health
 */
export async function healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  try {
    const start = Date.now()
    const client = getAnonClient()
    
    // Simple query to test connection
    const { error } = await client
      .from('products')
      .select('id')
      .limit(1)
    
    const latency = Date.now() - start
    
    if (error) {
      return { healthy: false, error: error.message }
    }
    
    return { healthy: true, latency }
  } catch (error) {
    return { 
      healthy: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// =======================
// Exports
// =======================

export type { Database }
export { getAnonClient as supabase } // Legacy compatibility
