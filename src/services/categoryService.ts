/**
 * Category Service - Edge Runtime Compatible
 * 
 * Handles category operations with date guards and soft deletes.
 */

import { logger } from '../observability/logger'
import databaseService from './databaseService'
import { supabaseClient } from './supabase'

export interface Category {
  id: number
  wc_id: number
  name: string
  slug: string
  description?: string
  parent_id?: number
  count: number
  date_modified_woo: string
  created_at: string
  // updated_at: string // Optional field
  is_deleted: boolean
  deleted_at?: string
}

class CategoryService {
  /**
   * Upsert category with date guard
   */
  async upsertCategoryWithDateGuard(cat: { wc_id: number; date_modified_woo: string; [k: string]: unknown }): Promise<boolean> {
    try {
      const { data: existing } = await supabaseClient
        .from('categories')
        .select('date_modified_woo')
        .eq('wc_id', cat.wc_id)
        .maybeSingle()
      
      if (existing && new Date((existing as any).date_modified_woo) > new Date(cat.date_modified_woo)) {
        return false // older event, skip
      }
      
      const { error } = await supabaseClient
        .from('categories')
        .upsert(cat as any, { onConflict: 'wc_id' })
      
      return !error
    } catch (error) {
      logger.error('Error in upsertCategoryWithDateGuard', new Error('Error'));
      return false
    }
  }

  /**
   * Soft delete category
   */
  async softDeleteCategory(wc_id: number): Promise<boolean> {
    try {
      const { error } = await (supabaseClient as any)
        .from('categories')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('wc_id', wc_id)
      
      return !error
    } catch (error) {
      logger.error('Error in softDeleteCategory', new Error('Error'));
      return false
    }
  }

  /**
   * Get category by WC ID
   */
  async getCategoryByWcId(wc_id: number): Promise<Category | null> {
    try {
      const { data } = await supabaseClient
        .from('categories')
        .select('*')
        .eq('wc_id', wc_id)
        .eq('is_deleted', false)
        .maybeSingle()
      
      return data as Category | null
    } catch (error) {
      logger.error('Error in getCategoryByWcId', new Error('Error'));
      return null
    }
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<Category[]> {
    try {
      const { data } = await supabaseClient
        .from('categories')
        .select('*')
        .eq('is_deleted', false)
        .order('name')
      
      return (data as Category[]) || []
    } catch (error) {
      logger.error('Error in getCategories', error instanceof Error ? error : new Error('Unknown error'))
      return []
    }
  }
}

// Export singleton instance
export const categoryService = new CategoryService()

// Export class for testing
// Exports handled above
