/**
 * WooCommerce Webhook Consumer - QStash Worker
 * 
 * Processes WooCommerce webhook events from QStash queue.
 * Handles product, category, and order synchronization with Supabase.
 */

import { logger } from '../observability/logger'
import { errorJson } from '../lib/errors'
import { productService } from '../services/productService'
import { categoryService } from '../services/categoryService'
import { orderService } from '../services/orderService'
import { cacheService } from '../services/cacheService'
import databaseService, { supabaseClient } from '../services/databaseService'

// =======================
// Types
// =======================

interface WebhookEvent {
  source: string
  event: string
  payload: any
  deliveryId?: string
  timestamp: number
}

interface ProcessingResult {
  success: boolean
  processed: boolean
  error?: string
}

// =======================
// Event Processors
// =======================

/**
 * Process product events
 */
async function processProductEvent(event: string, payload: any): Promise<ProcessingResult> {
  try {
    const product = payload
    
    // Transform WooCommerce product to local format
    const localProduct = {
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
      stock_quantity: product.stock_quantity,
      images: product.images?.map((img: any) => img.src) || [],
      categories: product.categories?.map((cat: any) => cat.name) || [],
      tags: product.tags?.map((tag: any) => tag.name) || [],
      attributes: product.attributes?.reduce((acc: any, attr: any) => {
        acc[attr.name] = attr.options
        return acc
      }, {}) || {},
      variations: product.variations || [],
      meta_data: product.meta_data?.reduce((acc: any, meta: any) => {
        acc[meta.key] = meta.value
        return acc
      }, {}) || {},
      date_modified_woo: product.date_modified,
      created_at: product.date_created,
      updated_at: product.date_modified
    }
    
    let result
    if (event === 'product.deleted') {
      // Soft delete
      result = await productService.softDeleteProduct(product.id)
    } else {
      // Upsert with date guard
      result = await productService.upsertProductWithDateGuard(localProduct as any)
    }
    
    if (result) {
      // Invalidate cache tags
      await cacheService.invalidateTags([
        'store:products',
        'store:product',
        `product:${product.id}`,
        ...(product.categories?.map((cat: any) => `category:${cat.slug}`) || [])
      ])
      
      logger.info('Product event processed', {
        event,
        productId: product.id,
        wcId: product.id
      })
      
      return { success: true, processed: true }
    }
    
    return { success: true, processed: false }
    
  } catch (error) {
    logger.error('Product event processing failed', error instanceof Error ? error : new Error('Unknown error'), {event,
      productId: payload.id})
    
    return {
      success: false,
      processed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Process category events
 */
async function processCategoryEvent(event: string, payload: any): Promise<ProcessingResult> {
  try {
    const category = payload
    
    const localCategory = {
      wc_id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parent_id: category.parent,
      count: category.count,
      date_modified_woo: category.date_modified,
      created_at: category.date_created,
      updated_at: category.date_modified
    }
    
    let result
    if (event === 'category.deleted') {
      result = await categoryService.softDeleteCategory(category.id)
    } else {
      result = await categoryService.upsertCategoryWithDateGuard(localCategory)
    }
    
    if (result) {
      // Invalidate cache tags
      await cacheService.invalidateTags([
        'store:products',
        'store:categories',
        `category:${category.slug}`
      ])
      
      logger.info('Category event processed', {
        event,
        categoryId: category.id,
        wcId: category.id
      })
      
      return { success: true, processed: true }
    }
    
    return { success: true, processed: false }
    
  } catch (error) {
    logger.error('Category event processing failed', error instanceof Error ? error : new Error('Unknown error'), {event,
      categoryId: payload.id})
    
    return {
      success: false,
      processed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Process order events
 */
async function processOrderEvent(event: string, payload: any): Promise<ProcessingResult> {
  try {
    const order = payload
    
    const localOrder = {
      wc_id: order.id,
      status: order.status,
      currency: order.currency,
      total: parseFloat(order.total),
      customer_id: order.customer_id,
      billing_address: order.billing,
      shipping_address: order.shipping,
      payment_method: order.payment_method,
      payment_method_title: order.payment_method_title,
      transaction_id: order.transaction_id,
      date_modified_woo: order.date_modified,
      created_at: order.date_created,
      updated_at: order.date_modified
    }
    
    const result = await orderService.upsertOrderWithDateGuard(localOrder)
    
    if (result) {
      logger.info('Order event processed', {
        event,
        orderId: order.id,
        wcId: order.id
      })
      
      return { success: true, processed: true }
    }
    
    return { success: true, processed: false }
    
  } catch (error) {
    logger.error('Order event processing failed', error instanceof Error ? error : new Error('Unknown error'), {event,
      orderId: payload.id})
    
    return {
      success: false,
      processed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// =======================
// Main Consumer Function
// =======================

/**
 * Process WooCommerce webhook event
 */
export async function processWooWebhookEvent(event: WebhookEvent): Promise<ProcessingResult> {
  try {
    const { source, event: eventType, payload, deliveryId } = event
    
    if (source !== 'woocommerce') {
      logger.warn('Unsupported webhook source', { source })
      return { success: true, processed: false }
    }
    
    // Route to appropriate processor
    let result: ProcessingResult
    
    if (eventType.startsWith('product')) {
      result = await processProductEvent(eventType, payload)
    } else if (eventType.startsWith('category')) {
      result = await processCategoryEvent(eventType, payload)
    } else if (eventType.startsWith('order')) {
      result = await processOrderEvent(eventType, payload)
    } else {
      logger.info('Unsupported webhook event type', { eventType })
      return { success: true, processed: false }
    }
    
    // Record processed event
    if (result.processed) {
      await recordProcessedEvent(deliveryId || crypto.randomUUID(), eventType, payload)
    }
    
    return result
    
  } catch (error) {
    logger.error('Webhook event processing failed', error instanceof Error ? error : new Error('Unknown error'), {event})
    
    return {
      success: false,
      processed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Record processed event in database
 */
async function recordProcessedEvent(
  eventId: string,
  topic: string,
  payload: any
): Promise<void> {
  try {
    // This would typically insert into a processed_events table
    // For now, we'll just log it
    logger.info('Event processed and recorded', {
      eventId,
      topic,
      entityId: payload.id
    })
  } catch (error) {
    logger.error('Failed to record processed event', error instanceof Error ? error : new Error('Unknown error'), {eventId,
      topic})
  }
}

// =======================
// QStash Handler
// =======================

/**
 * QStash webhook handler entry point
 */
export async function handleQStashWebhook(request: Request): Promise<Response> {
  try {
    const payload = await request.json()
    const event: WebhookEvent = payload
    
    const result = await processWooWebhookEvent(event)
    
    if (result.success) {
      return new Response(JSON.stringify({
        success: true,
        processed: result.processed
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: result.error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
  } catch (error) {
    logger.error('QStash webhook handler error', error instanceof Error ? error : new Error('Unknown error'))
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// // Exports handled above // Already exported above
