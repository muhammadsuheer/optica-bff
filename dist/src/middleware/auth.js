import { HTTPException } from 'hono/http-exception';
import { verify } from 'hono/jwt';
import { getCookie } from 'hono/cookie';
import { envConfig } from '../config/env.js';
/**
 * Performance optimizations for JWT authentication
 */
// Cache for decoded JWT payloads to avoid redundant parsing
const tokenCache = new Map();
const TOKEN_CACHE_TTL = 300000; // 5 minutes in milliseconds
const MAX_CACHE_SIZE = 1000;
// Pre-compiled regex for Bearer token extraction (much faster than slice)
const BEARER_TOKEN_REGEX = /^Bearer\s+(.+)$/;
// Pre-allocated error objects to avoid object creation overhead
const AUTH_REQUIRED_ERROR = new HTTPException(401, { message: 'Authentication required' });
const INVALID_TOKEN_ERROR = new HTTPException(401, { message: 'Invalid or expired token' });
const AUTH_FAILED_ERROR = new HTTPException(401, { message: 'Authentication failed' });
/**
 * Fast token cache cleanup (runs periodically)
 */
function cleanupTokenCache() {
    const now = Date.now();
    const entries = Array.from(tokenCache.entries());
    for (const [token, data] of entries) {
        if (data.expires < now) {
            tokenCache.delete(token);
        }
    }
    // Prevent memory leaks by limiting cache size
    if (tokenCache.size > MAX_CACHE_SIZE) {
        const oldestEntries = entries
            .sort((a, b) => a[1].expires - b[1].expires)
            .slice(0, tokenCache.size - MAX_CACHE_SIZE);
        for (const [token] of oldestEntries) {
            tokenCache.delete(token);
        }
    }
}
// Schedule periodic cleanup (every 5 minutes)
let cleanupInterval = null;
if (typeof setInterval !== 'undefined') {
    cleanupInterval = setInterval(cleanupTokenCache, 300000);
}
/**
 * High-performance JWT authentication middleware
 */
export function auth(required = true) {
    return async (c, next) => {
        try {
            // Fast token extraction with minimal allocations
            const authHeader = c.req.header('Authorization');
            let token;
            if (authHeader) {
                const match = BEARER_TOKEN_REGEX.exec(authHeader);
                token = match?.[1];
            }
            if (!token) {
                const cookieToken = getCookie(c, 'auth_token');
                if (cookieToken) {
                    token = cookieToken;
                }
            }
            if (!token) {
                if (required) {
                    throw AUTH_REQUIRED_ERROR;
                }
                await next();
                return;
            }
            // Check token cache first for sub-millisecond performance
            const now = Date.now();
            const cached = tokenCache.get(token);
            if (cached && cached.expires > now) {
                c.user = cached.user;
                await next();
                return;
            }
            // Verify JWT token (only if not cached)
            try {
                const payload = await verify(token, envConfig.security.JWT_SECRET);
                // Fast payload validation with early returns
                if (!payload.sub || !payload.email) {
                    throw INVALID_TOKEN_ERROR;
                }
                // Create user object with minimal allocations
                const user = {
                    id: Number(payload.sub),
                    email: payload.email,
                    displayName: payload.name || '',
                    roles: payload.roles || [],
                };
                // Cache the user data for future requests
                tokenCache.set(token, {
                    user,
                    expires: now + TOKEN_CACHE_TTL
                });
                c.user = user;
                await next();
            }
            catch (jwtError) {
                if (required) {
                    throw INVALID_TOKEN_ERROR;
                }
                await next();
            }
        }
        catch (error) {
            if (error instanceof HTTPException) {
                throw error;
            }
            if (required) {
                throw AUTH_FAILED_ERROR;
            }
            await next();
        }
    };
}
/**
 * High-performance role-based authorization middleware
 */
export function requireRole(roles) {
    // Pre-process roles for optimal performance
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    const roleSet = new Set(requiredRoles); // O(1) lookup instead of O(n)
    // Pre-allocated error with role information
    const accessDeniedError = new HTTPException(403, {
        message: `Access denied. Required roles: ${requiredRoles.join(', ')}`
    });
    return async (c, next) => {
        const user = c.user;
        if (!user) {
            throw AUTH_REQUIRED_ERROR;
        }
        // Fast role checking using Set intersection
        const hasRole = user.roles.some(role => roleSet.has(role));
        if (!hasRole) {
            throw accessDeniedError;
        }
        await next();
    };
}
/**
 * Performance-optimized middleware variants
 */
export const optionalAuth = auth(false);
export const requireAuth = auth(true);
/**
 * Cleanup function for graceful shutdown
 */
export function cleanupAuthCache() {
    tokenCache.clear();
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}
/**
 * Get authentication cache statistics for monitoring
 */
export function getAuthCacheStats() {
    return {
        cacheSize: tokenCache.size,
        maxCacheSize: MAX_CACHE_SIZE,
        cacheTtl: TOKEN_CACHE_TTL,
        memoryUsage: process.memoryUsage ? process.memoryUsage().heapUsed : 0
    };
}
