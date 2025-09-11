/**
 * PayFast Service - Edge Runtime Compatible
 * 
 * Handles PayFast payment integration with signature verification,
 * order creation, and ITN processing.
 */

import { logger } from '../observability/logger'
import { config } from '../config/env'
import { cacheService } from './cacheService'
import { md5Hex } from '../utils/md5'

// Admin context protection
function assertAdminContext(ctx?: { isAdmin?: boolean }) {
  if (!ctx?.isAdmin) {
    throw new Error('Admin API access not allowed in public context')
  }
}

// =======================
// Types
// =======================

export interface PayFastOrder {
  id: number
  total: string
  currency: string
  billing_address: any
  shipping_address?: any
  payment_method: string
}

export interface PayFastPaymentUrl {
  url: string
  expires_at: string
}

export interface PayFastITNResult {
  success: boolean
  orderId?: number
  error?: string
}

export interface PayFastOrderResult {
  success: boolean
  order?: PayFastOrder
  cart_token?: string | null
  error?: string
}

// =======================
// PayFast Service Class
// =======================

class PayFastService {
  private merchantId: string
  private merchantKey: string
  private passphrase: string
  private sandbox: boolean
  private wooStoreApiUrl: string
  
  constructor() {
    this.merchantId = config.payfast.merchantId || ''
    this.merchantKey = config.payfast.merchantKey || ''
    this.passphrase = config.payfast.passphrase || ''
    this.sandbox = config.payfast.sandbox || true
    this.wooStoreApiUrl = `${config.woocommerce.apiUrl}/wp-json/wc/store/v1`
  }
  
  /**
   * Create order via WooCommerce Store API
   */
  async createOrder(orderData: {
    billing_address: any
    shipping_address?: any
    payment_method: string
    cart_token?: string | null
  }): Promise<PayFastOrderResult> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      
      if (orderData.cart_token) {
        headers['Cart-Token'] = orderData.cart_token
      }
      
      const response = await fetch(`${this.wooStoreApiUrl}/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          billing_address: orderData.billing_address,
          shipping_address: orderData.shipping_address,
          payment_method: orderData.payment_method
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`WooCommerce Store API error: ${response.status} ${errorText}`)
      }
      
      const order = await response.json()
      const cartToken = response.headers.get('Cart-Token') || response.headers.get('cart-token')
      
      return {
        success: true,
        order,
        cart_token: cartToken
      }
      
    } catch (error) {
      logger.error('PayFast order creation failed', error instanceof Error ? error : new Error('Unknown error'))
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Generate PayFast payment URL
   */
  async generatePaymentUrl(order: PayFastOrder): Promise<string | null> {
    try {
      const baseUrl = this.sandbox 
        ? 'https://sandbox.payfast.co.za/eng/process'
        : 'https://www.payfast.co.za/eng/process'
      
      // Prepare payment parameters
      const paymentParams = {
        merchant_id: this.merchantId,
        merchant_key: this.merchantKey,
        return_url: `${config.app.baseUrl}/payments/payfast/return`,
        cancel_url: `${config.app.baseUrl}/payment-cancelled`,
        notify_url: `${config.app.baseUrl}/payments/payfast/itn`,
        name_first: order.billing_address.first_name,
        name_last: order.billing_address.last_name,
        email_address: order.billing_address.email,
        m_payment_id: order.id.toString(),
        amount: parseFloat(order.total).toFixed(2),
        item_name: `Order #${order.id}`,
        item_description: `Payment for order #${order.id}`,
        custom_str1: order.id.toString(),
        custom_str2: order.payment_method
      }
      
      // Generate signature
      const signature = await this.generateSignature(paymentParams)
      const paymentParamsWithSignature = { ...paymentParams, signature }
      
      // Build payment URL
      const urlParams = new URLSearchParams(paymentParamsWithSignature)
      const paymentUrl = `${baseUrl}?${urlParams.toString()}`
      
      logger.info('PayFast payment URL generated', {
        orderId: order.id,
        amount: paymentParams.amount
      })
      
      return paymentUrl
      
    } catch (error) {
      logger.error('PayFast payment URL generation failed', error instanceof Error ? error : new Error('Unknown error'), {orderId: order.id})
      
      return null
    }
  }
  
  /**
   * Generate PayFast signature
   */
  private async generateSignature(params: Record<string, string>): Promise<string> {
    try {
      // Remove empty values and signature
      const filteredParams = Object.entries(params)
        .filter(([key, value]) => value && key !== 'signature')
        .sort(([a], [b]) => a.localeCompare(b))
      
      // Create query string
      const queryString = filteredParams
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')
      
      // Add passphrase
      const stringToSign = `${queryString}&passphrase=${encodeURIComponent(this.passphrase)}`
      
      // Generate MD5 hash using our MD5 utility
      return md5Hex(stringToSign)
      
    } catch (error) {
      logger.error('PayFast signature generation failed', error instanceof Error ? error : new Error('Unknown error'))
      
      throw new Error('Failed to generate PayFast signature')
    }
  }
  
  /**
   * Verify PayFast return signature
   */
  async verifyReturnSignature(params: Record<string, string>): Promise<boolean> {
    try {
      const receivedSignature = params.signature
      if (!receivedSignature) {
        return false
      }
      
      // Generate expected signature
      const expectedSignature = await this.generateSignature(params)
      
      return receivedSignature.toLowerCase() === expectedSignature.toLowerCase()
      
    } catch (error) {
      logger.error('PayFast return signature verification failed', error instanceof Error ? error : new Error('Unknown error'))
      
      return false
    }
  }
  
  /**
   * Verify PayFast ITN signature
   */
  async verifyITNSignature(params: Record<string, string>, rawBody: string): Promise<boolean> {
    try {
      const receivedSignature = params.signature
      if (!receivedSignature) {
        return false
      }
      
      // For ITN, PayFast sends the signature in the raw body
      // We need to extract the signature from the raw body and verify it
      const bodyParams = new URLSearchParams(rawBody)
      const bodySignature = bodyParams.get('signature')
      
      if (!bodySignature) {
        return false
      }
      
      // Remove signature from params for verification
      const paramsWithoutSignature = { ...params }
      delete paramsWithoutSignature.signature
      
      // Generate expected signature
      const expectedSignature = await this.generateSignature(paramsWithoutSignature)
      
      // Compare signatures (case-insensitive as per PayFast docs)
      return bodySignature.toLowerCase() === expectedSignature.toLowerCase()
      
    } catch (error) {
      logger.error('PayFast ITN signature verification failed', error instanceof Error ? error : new Error('Unknown error'))
      
      return false
    }
  }
  
  /**
   * Check for duplicate transaction
   */
  async isDuplicateTransaction(gatewayTxnId: string): Promise<boolean> {
    try {
      const cacheKey = `payfast:processed:${gatewayTxnId}`
      const existing = await cacheService.get(cacheKey)
      
      if (existing) {
        return true
      }
      
      // Mark as processed for 24 hours
      await cacheService.set(cacheKey, true, { ttl: 86400 })
      
      return false
      
    } catch (error) {
      logger.error('PayFast duplicate check failed', error instanceof Error ? error : new Error('Unknown error'), {gatewayTxnId})
      
      return false
    }
  }
  
  /**
   * Process PayFast ITN
   */
  async processITN(params: Record<string, string>): Promise<PayFastITNResult> {
    try {
      const orderId = parseInt(params.custom_str1)
      const paymentStatus = params.payment_status
      const gatewayTxnId = params.pf_payment_id
      
      if (!orderId) {
        return {
          success: false,
          error: 'Invalid order ID in ITN'
        }
      }
      
      // Update order status based on payment status
      let wooStatus = 'pending'
      if (paymentStatus === 'COMPLETE') {
        wooStatus = 'processing'
      } else if (paymentStatus === 'FAILED') {
        wooStatus = 'failed'
      } else if (paymentStatus === 'CANCELLED') {
        wooStatus = 'cancelled'
      }
      
      // Update order in WooCommerce
      const updateResult = await this.updateOrderStatus(orderId, wooStatus, {
        gateway_txn_id: gatewayTxnId,
        payment_status: paymentStatus,
        processed_at: new Date().toISOString()
      }, { isAdmin: true })
      
      if (!updateResult) {
        return {
          success: false,
          error: 'Failed to update order status'
        }
      }
      
      logger.info('PayFast ITN processed successfully', {
        orderId,
        paymentStatus,
        gatewayTxnId,
        wooStatus
      })
      
      return {
        success: true,
        orderId
      }
      
    } catch (error) {
      logger.error('PayFast ITN processing failed', error instanceof Error ? error : new Error('Unknown error'))
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  /**
   * Update order status in WooCommerce
   */
  private   async updateOrderStatus(
    orderId: number, 
    status: string, 
    metaData: Record<string, any>,
    ctx?: { isAdmin?: boolean }
  ): Promise<boolean> {
    try {
      // Ensure this is only called from admin context
      assertAdminContext(ctx)
      
      const response = await fetch(`${config.woocommerce.apiUrl}/wp-json/wc/v3/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${config.woocommerce.consumerKey}:${config.woocommerce.consumerSecret}`)}`
        },
        body: JSON.stringify({
          status,
          meta_data: Object.entries(metaData).map(([key, value]) => ({
            key,
            value
          }))
        })
      })
      
      return response.ok
      
    } catch (error) {
      logger.error('WooCommerce order status update failed', error instanceof Error ? error : new Error('Unknown error'), {orderId,
        status})
      
      return false
    }
  }
}

// Export singleton instance
export const payfastService = new PayFastService()

// Export class for testing
// Exports handled above
