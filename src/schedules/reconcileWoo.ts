/**
 * WooCommerce Reconciliation Scheduler
 * 
 * Periodic sync with WooCommerce using checkpoints and backoff logic.
 * Handles products, variations, and categories with date-based guards.
 */

import { logger } from '../observability/logger'
import { wooCommerceService } from '../services/wooCommerceService'
import { productService } from '../services/productService'
import { categoryService } from '../services/categoryService'
import databaseService, { supabaseClient } from '../services/databaseService'
import { qstashClient } from '../lib/qstash'
import { config } from '../config/env'

// =======================
// Types
// =======================

interface SyncCheckpoint {
  resource_type: string
  last_sync_at: string
  last_processed_id: number | null
  // updated_at: string // Optional field
}

interface SyncResult {
  resourceType: string
  processed: number
  failed: number
  lastProcessedId: number | null
  hasMore: boolean
  success?: boolean
  error?: string
}

// =======================
// Constants
// =======================

const RESOURCE_TYPES = ['products', 'product_variations', 'categories'] as const
const PAGE_SIZE = 50
const MAX_RETRIES = 3
const BACKOFF_BASE = 1000 // 1 second
const MAX_BACKOFF = 30000 // 30 seconds

// =======================
// Reconciliation Service
// =======================

class WooReconciliationService {
  /**
   * Get sync checkpoint
   */
  async getCheckpoint(resourceType: string): Promise<SyncCheckpoint | null> {
    try {
      // Query the sync_checkpoints table
      const checkpoint = await this.getCheckpointFromDB(resourceType)
      return checkpoint
    } catch (error) {
      logger.error('Failed to get checkpoint', error instanceof Error ? error : new Error('Unknown error'), {
        resourceType
      })
      return null
    }
  }
  
  /**
   * Update sync checkpoint
   */
  async updateCheckpoint(
    resourceType: string,
    lastSyncAt: string,
    lastProcessedId: number | null
  ): Promise<void> {
    try {
      const checkpoint = {
        resource_type: resourceType,
        last_sync_at: lastSyncAt,
        last_processed_id: lastProcessedId,
        // updated_at: new Date().toISOString() // Field not in schema
      }
      
      // Update the sync_checkpoints table
      await this.setCheckpointInDB(resourceType, checkpoint)
      
      logger.info('Checkpoint updated', {
        resourceType,
        lastSyncAt,
        lastProcessedId
      })
    } catch (error) {
      logger.error('Failed to update checkpoint', error instanceof Error ? error : new Error('Unknown error'), {
        resourceType
      })
    }
  }
  
  /**
   * Sync products with backoff
   */
  async syncProducts(checkpoint: SyncCheckpoint | null): Promise<SyncResult> {
    let retryCount = 0
    let lastProcessedId = checkpoint?.last_processed_id || 0
    
    while (retryCount < MAX_RETRIES) {
      try {
        const result = await this.syncProductsPage(lastProcessedId)
        
        if (result.success) {
          return result
        }
        
        // Handle rate limiting or server errors
        if (result.error?.includes('429') || result.error?.includes('5')) {
          const backoffTime = Math.min(
            BACKOFF_BASE * Math.pow(2, retryCount),
            MAX_BACKOFF
          )
          
          logger.warn('Rate limited, backing off', {
            retryCount,
            backoffTime,
            error: result.error
          })
          
          await new Promise(resolve => setTimeout(resolve, backoffTime))
          retryCount++
          continue
        }
        
        // Other errors
        return result
        
      } catch (error) {
        retryCount++
        
        if (retryCount >= MAX_RETRIES) {
          return {
            resourceType: 'products',
            processed: 0,
            failed: 0,
            lastProcessedId,
            hasMore: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
        
        const backoffTime = Math.min(
          BACKOFF_BASE * Math.pow(2, retryCount),
          MAX_BACKOFF
        )
        
        await new Promise(resolve => setTimeout(resolve, backoffTime))
      }
    }
    
    return {
      resourceType: 'products',
      processed: 0,
      failed: 0,
      lastProcessedId,
      hasMore: false,
      error: 'Max retries exceeded'
    }
  }
  
  /**
   * Sync a page of products
   */
  private async syncProductsPage(lastProcessedId: number): Promise<SyncResult> {
    try {
      // Fetch products from WooCommerce
      const products = await wooCommerceService.getProducts({
        page: 1,
        per_page: PAGE_SIZE,
        orderby: 'id',
        order: 'asc'
      })
      
      if (!products || products.length === 0) {
        return {
          resourceType: 'products',
          processed: 0,
          failed: 0,
          lastProcessedId,
          hasMore: false
        }
      }
      
      // Filter products newer than last processed
      const newProducts = products.filter(p => p.id > lastProcessedId)
      
      if (newProducts.length === 0) {
        return {
          resourceType: 'products',
          processed: 0,
          failed: 0,
          lastProcessedId,
          hasMore: false
        }
      }
      
      // Process products with date guards
      let processed = 0
      let failed = 0
      let maxId = lastProcessedId
      
      for (const product of newProducts) {
        try {
          const success = await productService.upsertProductWithDateGuard({
            wc_id: product.id,
            name: product.name,
            slug: product.slug,
            description: product.description,
            short_description: product.short_description,
            price: parseFloat(product.price) || 0,
            regular_price: parseFloat(product.regular_price) || 0,
            sale_price: product.sale_price ? parseFloat(product.sale_price) : undefined,
            status: product.status,
            featured: product.featured,
            stock_status: product.stock_status,
            stock_quantity: product.stock_quantity || undefined,
            images: product.images?.map(img => img.src) || [],
            categories: product.categories?.map(cat => cat.name) || [],
            tags: product.tags?.map(tag => tag.name) || [],
            attributes: product.attributes?.reduce((acc, attr) => {
              acc[attr.name] = attr.options
              return acc
            }, {} as Record<string, any>) || {},
            created_at: product.date_created,
            updated_at: product.date_modified
          })
          
          if (success) {
            processed++
          } else {
            failed++
          }
          
          maxId = Math.max(maxId, product.id)
          
        } catch (error) {
          failed++
          logger.error('Product sync failed', error instanceof Error ? error : new Error('Unknown error'), {
            productId: product.id
          })
        }
      }
      
      return {
        resourceType: 'products',
        processed,
        failed,
        lastProcessedId: maxId,
        hasMore: newProducts.length === PAGE_SIZE
      }
      
    } catch (error) {
      return {
        resourceType: 'products',
        processed: 0,
        failed: 0,
        lastProcessedId,
        hasMore: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Sync categories with backoff
   */
  async syncCategories(checkpoint: SyncCheckpoint | null): Promise<SyncResult> {
    let retryCount = 0
    let lastProcessedId = checkpoint?.last_processed_id || 0
    
    while (retryCount < MAX_RETRIES) {
      try {
        const result = await this.syncCategoriesPage(lastProcessedId)
        
        if (result.success) {
          return result
        }
        
        // Handle rate limiting or server errors
        if (result.error?.includes('429') || result.error?.includes('5')) {
          const backoffTime = Math.min(
            BACKOFF_BASE * Math.pow(2, retryCount),
            MAX_BACKOFF
          )
          
          logger.warn('Rate limited, backing off', {
            retryCount,
            backoffTime,
            error: result.error
          })
          
          await new Promise(resolve => setTimeout(resolve, backoffTime))
          retryCount++
          continue
        }
        
        // Other errors
        return result
        
      } catch (error) {
        retryCount++
        
        if (retryCount >= MAX_RETRIES) {
          return {
            resourceType: 'categories',
            processed: 0,
            failed: 0,
            lastProcessedId,
            hasMore: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
        
        const backoffTime = Math.min(
          BACKOFF_BASE * Math.pow(2, retryCount),
          MAX_BACKOFF
        )
        
        await new Promise(resolve => setTimeout(resolve, backoffTime))
      }
    }
    
    return {
      resourceType: 'categories',
      processed: 0,
      failed: 0,
      lastProcessedId,
      hasMore: false,
      error: 'Max retries exceeded'
    }
  }
  
  /**
   * Sync a page of categories
   */
  private async syncCategoriesPage(lastProcessedId: number): Promise<SyncResult> {
    try {
      // Fetch categories from WooCommerce
      const categories = await wooCommerceService.getCategories({
        page: 1,
        per_page: PAGE_SIZE,
        orderby: 'id',
        order: 'asc'
      })
      
      if (!categories || categories.length === 0) {
        return {
          resourceType: 'categories',
          processed: 0,
          failed: 0,
          lastProcessedId,
          hasMore: false
        }
      }
      
      // Filter categories newer than last processed
      const newCategories = categories.filter((c: any) => c.id > lastProcessedId)
      
      if (newCategories.length === 0) {
        return {
          resourceType: 'categories',
          processed: 0,
          failed: 0,
          lastProcessedId,
          hasMore: false
        }
      }
      
      // Process categories with date guards
      let processed = 0
      let failed = 0
      let maxId = lastProcessedId
      
      for (const category of newCategories) {
        try {
          const success = await categoryService.upsertCategoryWithDateGuard({
            wc_id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description || '',
            parent_id: category.parent || null,
            count: category.count || undefined,
            date_modified_woo: category.date_modified,
            created_at: category.date_created,
            updated_at: category.date_modified
          })
          
          if (success) {
            processed++
          } else {
            failed++
          }
          
          maxId = Math.max(maxId, category.id)
          
        } catch (error) {
          failed++
          logger.error('Category sync failed', error instanceof Error ? error : new Error('Unknown error'), {
            categoryId: category.id
          })
        }
      }
      
      return {
        resourceType: 'categories',
        processed,
        failed,
        lastProcessedId: maxId,
        hasMore: newCategories.length === PAGE_SIZE
      }
      
    } catch (error) {
      return {
        resourceType: 'categories',
        processed: 0,
        failed: 0,
        lastProcessedId,
        hasMore: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Run full reconciliation
   */
  async runReconciliation(): Promise<void> {
    const startTime = Date.now()
    
    try {
      logger.info('Starting WooCommerce reconciliation')
      
      for (const resourceType of RESOURCE_TYPES) {
        const checkpoint = await this.getCheckpoint(resourceType)
        
        let result: SyncResult
        
        if (resourceType === 'products') {
          result = await this.syncProducts(checkpoint)
        } else if (resourceType === 'categories') {
          result = await this.syncCategories(checkpoint)
        } else {
          continue
        }
        
        if (result.error) {
          logger.error('Reconciliation failed', undefined, {
            resourceType,
            errorMessage: result.error
          })
          continue
        }
        
        // Update checkpoint only on success
        if (result.processed > 0 || result.failed === 0) {
          await this.updateCheckpoint(
            resourceType,
            new Date().toISOString(),
            result.lastProcessedId
          )
        }
        
        logger.info('Resource reconciliation completed', {
          resourceType,
          processed: result.processed,
          failed: result.failed,
          hasMore: result.hasMore
        })
      }
      
      const duration = Date.now() - startTime
      logger.info('WooCommerce reconciliation completed', { duration })
      
    } catch (error) {
      logger.error('Reconciliation failed', error instanceof Error ? error : new Error('Unknown error'))
    }
  }
  
  /**
   * Schedule next reconciliation
   */
  async scheduleNextReconciliation(): Promise<void> {
    try {
      // Schedule next run in 1 hour
      const delay = 3600 // 1 hour in seconds
      
      await qstashClient.enqueueReconciliation(
        'full_sync',
        new Date().toISOString()
      )
      
      logger.info('Next reconciliation scheduled', { delay })
      
    } catch (error) {
      logger.error('Failed to schedule next reconciliation', error instanceof Error ? error : new Error('Unknown error'))
    }
  }
  
  /**
   * Get checkpoint from database
   */
  private async getCheckpointFromDB(resourceType: string): Promise<SyncCheckpoint | null> {
    try {
      const { data } = await supabaseClient
        .from('sync_checkpoints')
        .select('*')
        .eq('resource_type', resourceType)
        .maybeSingle()
      
      return data as SyncCheckpoint | null
    } catch (error) {
      logger.error('Error getting checkpoint from DB', error instanceof Error ? error : new Error('Unknown error'), { resourceType })
      return null
    }
  }
  
  /**
   * Set checkpoint in database
   */
  private async setCheckpointInDB(resourceType: string, cp: Omit<SyncCheckpoint,'resource_type'>): Promise<void> {
    try {
      await supabaseClient
        .from('sync_checkpoints')
        .upsert({ 
          resource_type: resourceType, 
          last_sync_at: cp.last_sync_at,
          last_processed_id: cp.last_processed_id,
          // updated_at: new Date().toISOString() // Field not in schema 
        } as any, { onConflict: 'resource_type' })
    } catch (error) {
      logger.error('Error setting checkpoint in DB', error instanceof Error ? error : new Error('Unknown error'))
    }
  }
}

// Export singleton instance
export const wooReconciliationService = new WooReconciliationService()

// Export class for testing
// Exports handled above
