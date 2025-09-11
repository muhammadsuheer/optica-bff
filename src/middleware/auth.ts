/**
 * Authentication Middleware for Edge Runtime
 * Uses Supabase Auth with JWT verification using jose library
 */

import { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { jwtVerify, SignJWT } from 'jose'
import { supabaseClient } from '../services/supabase'
import { config } from '../config/env'
import { logger } from '../observability/logger'

export interface AuthUser {
  id: string
  email: string
  role: string
  aud: string
  exp: number
}

/**
 * JWT Authentication middleware using jose
 */
export function requireAuth() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      logger.warn('Missing or invalid authorization header', { 
        path: c.req.path,
        method: c.req.method 
      })
      throw new HTTPException(401, { message: 'Authorization header required' })
    }

    try {
      const token = authHeader.replace('Bearer ', '')
      
      // Verify with Supabase (primary method for Supabase-issued tokens)
      const { data: { user }, error } = await supabaseClient.auth.getUser(token)
      
      if (error || !user) {
        logger.warn('Invalid auth token', { error: error?.message })
        throw new HTTPException(401, { message: 'Invalid token' })
      }

      // Set user context
      c.set('user', {
        id: user.id,
        email: user.email || '',
        role: user.role || 'authenticated',
        aud: user.aud || '',
        exp: Math.floor(Date.now() / 1000) + config.auth.tokenExpiry
      } as AuthUser)

      // Set JWT payload for backward compatibility (extract from Supabase user)
      c.set('jwtPayload', {
        sub: user.id,
        email: user.email,
        role: user.role,
        aud: user.aud,
        exp: Math.floor(Date.now() / 1000) + config.auth.tokenExpiry
      })

      logger.debug('User authenticated', {
        userId: user.id,
        email: user.email,
        path: c.req.path
      })

      await next()

    } catch (error) {
      if (error instanceof HTTPException) throw error
      
      logger.warn('Auth token verification failed', { error })
      throw new HTTPException(401, { message: 'Invalid token' })
    }
  }
}

/**
 * Optional authentication middleware using jose
 */
export function optionalAuth() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      await next()
      return
    }

    try {
      const token = authHeader.replace('Bearer ', '')
      
      // Verify with Supabase (primary method for Supabase-issued tokens)
      const { data: { user }, error } = await supabaseClient.auth.getUser(token)
      
      if (error || !user) {
        logger.warn('Invalid auth token', { error: error?.message })
        await next()
        return
      }

      // Set user context
      c.set('user', {
        id: user.id,
        email: user.email || '',
        role: user.role || 'authenticated',
        aud: user.aud || '',
        exp: Math.floor(Date.now() / 1000) + config.auth.tokenExpiry
      } as AuthUser)

      // Set JWT payload for backward compatibility (extract from Supabase user)
      c.set('jwtPayload', {
        sub: user.id,
        email: user.email,
        role: user.role,
        aud: user.aud,
        exp: Math.floor(Date.now() / 1000) + config.auth.tokenExpiry
      })

      logger.debug('User authenticated', {
        userId: user.id,
        email: user.email,
        path: c.req.path
      })

    } catch (error) {
      logger.warn('Auth token verification failed', { error })
    }

    await next()
  }
}

/**
 * Role-based access control middleware
 */
export function requireRole(allowedRoles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as AuthUser

    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' })
    }

    if (!allowedRoles.includes(user.role)) {
      logger.warn('Insufficient role permissions', {
        userId: user.id,
        userRole: user.role,
        requiredRoles: allowedRoles,
        path: c.req.path
      })
      throw new HTTPException(403, { message: 'Insufficient permissions' })
    }

    await next()
  }
}

/**
 * Admin-only access middleware
 */
export function requireAdmin() {
  return requireRole(['admin', 'service_role'])
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(c: Context): boolean {
  return !!c.get('user')
}

/**
 * Get current user from context
 */
export function getCurrentUser(c: Context): AuthUser | null {
  return c.get('user') || null
}

/**
 * Check if current user has specific role
 */
export function hasRole(c: Context, role: string): boolean {
  const user = getCurrentUser(c)
  return user?.role === role || false
}

/**
 * User ownership middleware - ensures user can only access their own resources
 */
export function requireOwnership(userIdParam: string = 'userId') {
  return async (c: Context, next: Next) => {
    const user = getCurrentUser(c)
    
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' })
    }

    const requestedUserId = c.req.param(userIdParam)
    
    // Admin can access any resource
    if (hasRole(c, 'admin') || hasRole(c, 'service_role')) {
      await next()
      return
    }

    // Check ownership
    if (user.id !== requestedUserId) {
      logger.warn('Ownership violation attempt', {
        userId: user.id,
        requestedUserId,
        path: c.req.path
      })
      throw new HTTPException(403, { message: 'Access denied - resource ownership required' })
    }

    await next()
  }
}

/**
 * Session validation middleware
 */
export function validateSession() {
  return async (c: Context, next: Next) => {
    const user = getCurrentUser(c)
    
    if (!user) {
      await next()
      return
    }

    // Check if token is expired
    if (user.exp && user.exp < Math.floor(Date.now() / 1000)) {
      logger.warn('Expired token detected', {
        userId: user.id,
        exp: user.exp,
        now: Math.floor(Date.now() / 1000)
      })
      throw new HTTPException(401, { message: 'Token expired' })
    }

    await next()
  }
}

/**
 * Create a JWT token using jose
 */
export async function createJWT(payload: Record<string, any>, expiresIn: number = 3600): Promise<string> {
  try {
    const secret = new TextEncoder().encode(config.auth.jwtSecret)
    
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
      .sign(secret)
    
    return token
  } catch (error) {
    logger.error('Failed to create JWT token', error instanceof Error ? error : new Error('Unknown error'))
    throw new Error('Token creation failed')
  }
}

/**
 * Verify a JWT token using jose
 */
export async function verifyJWT(token: string): Promise<any> {
  try {
    const secret = new TextEncoder().encode(config.auth.jwtSecret)
    
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256']
    })
    
    return payload
  } catch (error) {
    logger.error('Failed to verify JWT token', error instanceof Error ? error : new Error('Unknown error'))
    throw new Error('Token verification failed')
  }
}
