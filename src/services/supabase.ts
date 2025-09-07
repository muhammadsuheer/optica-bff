import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from '../config/env'

// Simplified database interface for now
interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: number
          wc_id: number
          name: string
          slug: string
          description: string | null
          short_description: string | null
          price: number | null
          regular_price: number | null
          sale_price: number | null
          status: string
          stock_quantity: number | null
          stock_status: string
          manage_stock: boolean
          categories: any
          tags: any
          images: any
          attributes: any
          variations: any
          meta_data: any
          search_vector: string | null
          created_at: string
          updated_at: string
          synced_at: string
        }
        Insert: {
          wc_id: number
          name: string
          slug: string
          description?: string | null
          short_description?: string | null
          price?: number | null
          regular_price?: number | null
          sale_price?: number | null
          status?: string
          stock_quantity?: number | null
          stock_status?: string
          manage_stock?: boolean
          categories?: any
          tags?: any
          images?: any
          attributes?: any
          variations?: any
          meta_data?: any
          search_vector?: string | null
          created_at?: string
          updated_at?: string
          synced_at?: string
        }
        Update: {
          wc_id?: number
          name?: string
          slug?: string
          description?: string | null
          short_description?: string | null
          price?: number | null
          regular_price?: number | null
          sale_price?: number | null
          status?: string
          stock_quantity?: number | null
          stock_status?: string
          manage_stock?: boolean
          categories?: any
          tags?: any
          images?: any
          attributes?: any
          variations?: any
          meta_data?: any
          search_vector?: string | null
          created_at?: string
          updated_at?: string
          synced_at?: string
        }
      }
      orders: {
        Row: {
          id: number
          wc_id: number
          order_key: string
          status: string
          currency: string
          total: number
          subtotal: number
          tax_total: number
          shipping_total: number
          customer_id: number | null
          customer_note: string | null
          billing: any
          shipping: any
          line_items: any
          shipping_lines: any
          tax_lines: any
          fee_lines: any
          coupon_lines: any
          payment_method: string | null
          payment_method_title: string | null
          transaction_id: string | null
          date_created: string
          date_modified: string
          date_completed: string | null
          date_paid: string | null
          synced_at: string
        }
        Insert: {
          wc_id: number
          order_key: string
          status: string
          currency: string
          total: number
          subtotal: number
          tax_total?: number
          shipping_total?: number
          customer_id?: number | null
          customer_note?: string | null
          billing: any
          shipping: any
          line_items: any
          shipping_lines?: any
          tax_lines?: any
          fee_lines?: any
          coupon_lines?: any
          payment_method?: string | null
          payment_method_title?: string | null
          transaction_id?: string | null
          date_created: string
          date_modified: string
          date_completed?: string | null
          date_paid?: string | null
          synced_at?: string
        }
        Update: {
          wc_id?: number
          order_key?: string
          status?: string
          currency?: string
          total?: number
          subtotal?: number
          tax_total?: number
          shipping_total?: number
          customer_id?: number | null
          customer_note?: string | null
          billing?: any
          shipping?: any
          line_items?: any
          shipping_lines?: any
          tax_lines?: any
          fee_lines?: any
          coupon_lines?: any
          payment_method?: string | null
          payment_method_title?: string | null
          transaction_id?: string | null
          date_created?: string
          date_modified?: string
          date_completed?: string | null
          date_paid?: string | null
          synced_at?: string
        }
      }
      carts: {
        Row: {
          id: number
          session_id: string
          user_id: number | null
          items: any
          totals: any
          coupons: any
          shipping: any
          billing: any
          status: string
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          session_id: string
          user_id?: number | null
          items: any
          totals: any
          coupons?: any
          shipping?: any
          billing?: any
          status?: string
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          session_id?: string
          user_id?: number | null
          items?: any
          totals?: any
          coupons?: any
          shipping?: any
          billing?: any
          status?: string
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      api_keys: {
        Row: {
          id: number
          key_hash: string
          name: string
          permissions: any
          rate_limit: number
          rate_window: number
          is_active: boolean
          last_used_at: string | null
          usage_count: number
          created_at: string
          expires_at: string | null
        }
        Insert: {
          key_hash: string
          name: string
          permissions: any
          rate_limit?: number
          rate_window?: number
          is_active?: boolean
          last_used_at?: string | null
          usage_count?: number
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          key_hash?: string
          name?: string
          permissions?: any
          rate_limit?: number
          rate_window?: number
          is_active?: boolean
          last_used_at?: string | null
          usage_count?: number
          created_at?: string
          expires_at?: string | null
        }
      }
      cache_index: {
        Row: {
          id: number
          cache_key: string
          resource_type: string
          resource_ids: number[]
          tags: string[]
          data: any
          expires_at: string
          created_at: string
          accessed_at: string
          hit_count: number
        }
        Insert: {
          cache_key: string
          resource_type: string
          resource_ids?: number[]
          tags?: string[]
          data: any
          expires_at: string
          created_at?: string
          accessed_at?: string
          hit_count?: number
        }
        Update: {
          cache_key?: string
          resource_type?: string
          resource_ids?: number[]
          tags?: string[]
          data?: any
          expires_at?: string
          created_at?: string
          accessed_at?: string
          hit_count?: number
        }
      }
      webhooks_log: {
        Row: {
          id: number
          webhook_id: string | null
          topic: string
          resource: string
          resource_id: number
          event: string
          payload: any
          signature: string | null
          processed: boolean
          processed_at: string | null
          error_message: string | null
          retry_count: number
          created_at: string
        }
        Insert: {
          webhook_id?: string | null
          topic: string
          resource: string
          resource_id: number
          event: string
          payload: any
          signature?: string | null
          processed?: boolean
          processed_at?: string | null
          error_message?: string | null
          retry_count?: number
          created_at?: string
        }
        Update: {
          webhook_id?: string | null
          topic?: string
          resource?: string
          resource_id?: number
          event?: string
          payload?: any
          signature?: string | null
          processed?: boolean
          processed_at?: string | null
          error_message?: string | null
          retry_count?: number
          created_at?: string
        }
      }
      rate_limits: {
        Row: {
          id: number
          client_id: string
          endpoint: string
          method: string
          status_code: number | null
          user_agent: string | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          client_id: string
          endpoint: string
          method: string
          status_code?: number | null
          user_agent?: string | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          client_id?: string
          endpoint?: string
          method?: string
          status_code?: number | null
          user_agent?: string | null
          ip_address?: string | null
          created_at?: string
        }
      }
      metrics: {
        Row: {
          id: number
          name: string
          value: number
          tags: any
          timestamp: string
        }
        Insert: {
          name: string
          value: number
          tags?: any
          timestamp: string
        }
        Update: {
          name?: string
          value?: number
          tags?: any
          timestamp?: string
        }
      }
    }
  }
}

// Main Supabase client
class SupabaseService {
  private client: SupabaseClient<Database>
  private backupClients: SupabaseClient<Database>[] = []
  private currentClientIndex: number = 0

  constructor() {
    // Primary client
    this.client = createClient<Database>(
      config.supabase.url,
      config.supabase.serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            'User-Agent': 'Optia-BFF/1.0.0'
          }
        }
      }
    )

    // Initialize backup clients if available
    config.supabase.backupUrls.forEach((url, index) => {
      if (url) {
        this.backupClients.push(
          createClient<Database>(
            url,
            config.supabase.serviceKey,
            {
              auth: {
                autoRefreshToken: false,
                persistSession: false
              },
              global: {
                headers: {
                  'User-Agent': `Optia-BFF/1.0.0 (backup-${index + 1})`
                }
              }
            }
          )
        )
      }
    })

    console.log(`Supabase service initialized with ${this.backupClients.length + 1} clients`)
  }

  // Get the current active client
  getClient(): SupabaseClient<Database> {
    return this.client
  }

  // Execute operation with failover support
  async executeWithFailover<T>(
    operation: (client: SupabaseClient<Database>) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    const allClients = [this.client, ...this.backupClients]
    let lastError: Error

    for (let attempt = 0; attempt < maxRetries && attempt < allClients.length; attempt++) {
      const clientIndex = (this.currentClientIndex + attempt) % allClients.length
      const client = allClients[clientIndex]

      try {
        const result = await operation(client)
        
        // Update current client if we switched
        if (clientIndex !== this.currentClientIndex) {
          console.log(`Switched to Supabase client ${clientIndex}`)
          this.currentClientIndex = clientIndex
          this.client = client
        }

        return result
      } catch (error: any) {
        lastError = error as Error
        console.warn(`Supabase client ${clientIndex} failed:`, error.message)
        
        // Don't retry on authentication or permission errors
        if (error.message?.includes('JWT') || error.message?.includes('permission')) {
          throw error
        }

        continue
      }
    }

    throw new Error(`All Supabase clients failed. Last error: ${lastError!.message}`)
  }

  // Health check for all clients
  async healthCheck(): Promise<{
    primary: { healthy: boolean; latency: number; error?: string }
    backups: Array<{ healthy: boolean; latency: number; error?: string }>
  }> {
    const allClients = [this.client, ...this.backupClients]
    const results = await Promise.allSettled(
      allClients.map(async (client, index) => {
        const start = Date.now()
        try {
          await client.from('products').select('count(*)').limit(1).single()
          return {
            healthy: true,
            latency: Date.now() - start,
            index
          }
        } catch (error: any) {
          return {
            healthy: false,
            latency: Date.now() - start,
            error: error.message,
            index
          }
        }
      })
    )

    const primary = results[0].status === 'fulfilled' 
      ? results[0].value 
      : { healthy: false, latency: 0, error: 'Connection failed' }

    const backups = results.slice(1).map(result => 
      result.status === 'fulfilled' 
        ? result.value 
        : { healthy: false, latency: 0, error: 'Connection failed' }
    )

    return { primary, backups }
  }

  // Convenience methods for common operations
  async from<T extends keyof Database['public']['Tables']>(table: T) {
    return this.client.from(table)
  }

  async rpc(fn: string, args?: any): Promise<any> {
    return this.executeWithFailover(async (client) => {
      const result = await client.rpc(fn, args)
      return result
    })
  }

  // Transaction support
  async transaction<T>(
    operations: (client: SupabaseClient<Database>) => Promise<T>
  ): Promise<T> {
    return this.executeWithFailover(operations)
  }

  // Realtime subscriptions
  channel(topic: string) {
    return this.client.channel(topic)
  }

  // Storage operations (if needed)
  get storage() {
    return this.client.storage
  }

  // Auth operations (if needed)
  get auth() {
    return this.client.auth
  }
}

// Create and export singleton instance
export const supabase = new SupabaseService()

// Export the raw client for direct access when needed
export const supabaseClient = supabase.getClient()

// Export database interface for use in other modules  
export type { Database }
