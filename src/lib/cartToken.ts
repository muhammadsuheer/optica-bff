/**
 * Cart Token Helper - Edge Runtime Compatible
 * 
 * Handles Cart-Token header management for WooCommerce Store API integration.
 * Ensures cart tokens are properly forwarded and echoed in responses.
 */

import type { Context } from 'hono'

// =======================
// Types
// =======================

export interface CartTokenInfo {
  token: string | null
  isNew: boolean
}

// =======================
// Cart Token Management
// =======================

/**
 * Read Cart-Token from request headers
 * Supports both 'Cart-Token' and 'cart-token' header names
 */
export function readCartToken(c: Context): string | null {
  // Try both header name variations
  const cartToken = c.req.header('Cart-Token') || c.req.header('cart-token')
  return cartToken || null
}

/**
 * Echo Cart-Token in response headers
 * Always sets the token in the response, even if it was null (for new carts)
 */
export function echoCartToken(c: Context, token: string | null = null): void {
  const tokenToEcho = token || readCartToken(c)
  
  if (tokenToEcho) {
    c.header('Cart-Token', tokenToEcho)
  }
}

/**
 * Forward Cart-Token to upstream requests
 * Returns headers object with Cart-Token included
 */
export function forwardCartToken(c: Context, additionalHeaders: Record<string, string> = {}): Record<string, string> {
  const cartToken = readCartToken(c)
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...additionalHeaders
  }
  
  if (cartToken) {
    headers['Cart-Token'] = cartToken
  }
  
  return headers
}

/**
 * Mint new cart token by calling WooCommerce Store API
 * Returns the token from the response headers
 */
export async function mintCartToken(wooStoreApiUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${wooStoreApiUrl}/cart`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      return null
    }
    
    // Extract Cart-Token from response headers
    const cartToken = response.headers.get('Cart-Token') || response.headers.get('cart-token')
    return cartToken
  } catch (error) {
    return null
  }
}

/**
 * Get or mint cart token for the request
 * Returns token info with whether it's new or existing
 */
export async function getOrMintCartToken(
  c: Context, 
  wooStoreApiUrl: string
): Promise<CartTokenInfo> {
  const existingToken = readCartToken(c)
  
  if (existingToken) {
    return {
      token: existingToken,
      isNew: false
    }
  }
  
  // Mint new token
  const newToken = await mintCartToken(wooStoreApiUrl)
  
  return {
    token: newToken,
    isNew: true
  }
}

/**
 * Middleware to ensure Cart-Token is available
 * Automatically mints token if missing
 */
export function cartTokenMiddleware(wooStoreApiUrl: string) {
  return async (c: Context, next: () => Promise<void>) => {
    const tokenInfo = await getOrMintCartToken(c, wooStoreApiUrl)
    
    // Store token info in context for use in handlers
    c.set('cartToken', tokenInfo.token)
    c.set('cartTokenIsNew', tokenInfo.isNew)
    
    await next()
    
    // Always echo the token in response
    echoCartToken(c, tokenInfo.token)
  }
}

// =======================
// Exports
// =======================

// Functions already exported above, no need for re-export
// // Exports handled above
