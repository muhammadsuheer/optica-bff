/**
 * API Key Authentication Middleware for Edge Runtime
 */

import { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { config } from '../config/env'
import { logger } from '../utils/logger'

export interface ApiKeyContext {
  keyType: 'frontend' | 'admin' | 'mobile'
  permissions: string[]
}

// API key permissions mapping
const API_KEY_PERMISSIONS = {
  frontend: ['read:products', 'read:categories', 'read:orders', 'read:cart', 'write:cart'],
  admin: ['read:*', 'write:*', 'delete:*'],
  mobile: ['read:products', 'read:categories', 'read:orders', 'read:cart', 'write:cart', 'write:orders', 'read:customers']
}

/**
 * Secure constant-time comparison for API keys
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * Create HMAC signature for API key using Web Crypto API
 */
async function createApiKeySignature(apiKey: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(apiKey)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate API key and extract permissions
 */
export async function validateApiKey(apiKey: string): Promise<ApiKeyContext | null> {
  try {
    if (!apiKey || apiKey.length < 32) {
      return null
    }

    // Use constant-time comparison directly with configured keys
    // API keys should be stored as plain text in environment (they're already secrets)
    for (let i = 0; i < config.auth.apiKeys.length; i++) {
      const configuredKey = config.auth.apiKeys[i]
      
      if (constantTimeCompare(apiKey, configuredKey)) {
        // Determine key type based on position (better than string comparison)
        switch (i) {
          case 0:
            return {
              keyType: 'frontend',
              permissions: API_KEY_PERMISSIONS.frontend
            }
          case 1:
            return {
              keyType: 'admin', 
              permissions: API_KEY_PERMISSIONS.admin
            }
          case 2:
            return {
              keyType: 'mobile',
              permissions: API_KEY_PERMISSIONS.mobile
            }
          default:
            // Additional keys default to frontend permissions
            return {
              keyType: 'frontend',
              permissions: API_KEY_PERMISSIONS.frontend
            }
        }
      }
    }
    
    return null
  } catch (error) {
    logger.error('API key validation error', { error })
    return null
  }
}

/**
 * API Key middleware factory
 */
export function apiKey(options: {
  required?: boolean
  allowedKeyTypes?: Array<'frontend' | 'admin' | 'mobile'>
} = {}) {
  const { required = true, allowedKeyTypes = ['frontend', 'admin', 'mobile'] } = options

  return async (c: Context, next: Next) => {
    const apiKeyHeader = c.req.header('x-api-key') || c.req.header('authorization')?.replace('Bearer ', '')
    
    if (!apiKeyHeader) {
      if (required) {
        logger.warn('API key missing', { 
          path: c.req.path, 
          method: c.req.method,
          userAgent: c.req.header('user-agent')
        })
        throw new HTTPException(401, { message: 'API key required' })
      }
      await next()
      return
    }

    const keyContext = await validateApiKey(apiKeyHeader)
    
    if (!keyContext) {
      logger.warn('Invalid API key', { 
        path: c.req.path, 
        method: c.req.method,
        keyPrefix: apiKeyHeader.substring(0, 8) + '...'
      })
      throw new HTTPException(401, { message: 'Invalid API key' })
    }

    if (!allowedKeyTypes.includes(keyContext.keyType)) {
      logger.warn('API key type not allowed for this endpoint', { 
        path: c.req.path, 
        method: c.req.method,
        keyType: keyContext.keyType,
        allowedTypes: allowedKeyTypes
      })
      throw new HTTPException(403, { message: 'Insufficient permissions' })
    }

    // Set context for use in handlers
    c.set('apiKey', keyContext)
    
    logger.debug('API key validated', {
      keyType: keyContext.keyType,
      path: c.req.path,
      method: c.req.method
    })

    await next()
  }
}

/**
 * Check if current API key has specific permission
 */
export function hasPermission(c: Context, permission: string): boolean {
  const keyContext = c.get('apiKey') as ApiKeyContext
  
  if (!keyContext) {
    return false
  }
  
  // Admin has all permissions
  if (keyContext.keyType === 'admin') {
    return true
  }
  
  // Check specific permission or wildcard
  return keyContext.permissions.includes(permission) || 
         keyContext.permissions.some(p => p.endsWith(':*') && permission.startsWith(p.replace(':*', ':')))
}

/**
 * Require specific permission middleware
 */
export function requirePermission(permission: string) {
  return async (c: Context, next: Next) => {
    if (!hasPermission(c, permission)) {
      logger.warn('Permission denied', {
        permission,
        apiKeyType: c.get('apiKey')?.keyType,
        path: c.req.path,
        method: c.req.method
      })
      throw new HTTPException(403, { message: `Permission '${permission}' required` })
    }
    
    await next()
  }
}
