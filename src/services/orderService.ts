/**
 * Order Service - Edge Runtime Compatible
 * 
 * Handles order operations with date guards and soft deletes.
 */

import { logger } from '../observability/logger'
import databaseService from './databaseService'
import { supabaseClient } from './supabase'

export interface Order {
  id: number
  wc_id: number
  status: string
  currency: string
  total: number
  customer_id?: number
  billing_address?: any
  shipping_address?: any
  payment_method?: string
  payment_method_title?: string
  transaction_id?: string
  date_modified_woo: string
  created_at: string
  // updated_at: string // Optional field
  is_deleted: boolean
  deleted_at?: string
}

class OrderService {
  /**
   * Upsert order with date guard
   */
  async upsertOrderWithDateGuard(order: { wc_id: number; date_modified_woo: string; [k: string]: unknown }): Promise<boolean> {
    try {
      const { data: existing } = await supabaseClient
        .from('orders')
        .select('date_modified_woo')
        .eq('wc_id', order.wc_id)
        .maybeSingle()
      
      if (existing && new Date((existing as any).date_modified_woo) > new Date(order.date_modified_woo)) {
        return false // older event, skip
      }
      
      const { error } = await supabaseClient
        .from('orders')
        .upsert(order as any, { onConflict: 'wc_id' })
      
      return !error
    } catch (error) {
      logger.error('Error in upsertOrderWithDateGuard', new Error('Error'));
      return false
    }
  }

  /**
   * Get order by WC ID
   */
  async getOrderByWcId(wc_id: number): Promise<Order | null> {
    try {
      const { data } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('wc_id', wc_id)
        .eq('is_deleted', false)
        .maybeSingle()
      
      return data as Order | null
    } catch (error) {
      logger.error('Error in getOrderByWcId', new Error('Error'));
      return null
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(wc_id: number, status: string): Promise<boolean> {
    try {
      const { error } = await (supabaseClient as any)
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('wc_id', wc_id)
      
      return !error
    } catch (error) {
      logger.error('Error in updateOrderStatus', new Error('Error'));
      return false
    }
  }

  /**
   * Get orders by customer
   */
  async getOrdersByCustomer(customer_id: number): Promise<Order[]> {
    try {
      const { data } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('customer_id', customer_id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
      
      return (data as Order[]) || []
    } catch (error) {
      logger.error('Error in getOrdersByCustomer', new Error('Error'));
      return []
    }
  }
}

// Export singleton instance
export const orderService = new OrderService()

// Export class for testing
// Exports handled above
