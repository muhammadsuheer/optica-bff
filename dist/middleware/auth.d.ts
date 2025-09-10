/**
 * Authentication Middleware for Edge Runtime
 * Uses Supabase Auth with JWT verification using jose library
 */
import { Context, Next } from 'hono';
export interface AuthUser {
    id: string;
    email: string;
    role: string;
    aud: string;
    exp: number;
}
/**
 * JWT Authentication middleware using jose
 */
export declare function requireAuth(): (c: Context, next: Next) => Promise<void>;
/**
 * Optional authentication middleware using jose
 */
export declare function optionalAuth(): (c: Context, next: Next) => Promise<void>;
/**
 * Role-based access control middleware
 */
export declare function requireRole(allowedRoles: string[]): (c: Context, next: Next) => Promise<void>;
/**
 * Admin-only access middleware
 */
export declare function requireAdmin(): (c: Context, next: Next) => Promise<void>;
/**
 * Check if user is authenticated
 */
export declare function isAuthenticated(c: Context): boolean;
/**
 * Get current user from context
 */
export declare function getCurrentUser(c: Context): AuthUser | null;
/**
 * Check if current user has specific role
 */
export declare function hasRole(c: Context, role: string): boolean;
/**
 * User ownership middleware - ensures user can only access their own resources
 */
export declare function requireOwnership(userIdParam?: string): (c: Context, next: Next) => Promise<void>;
/**
 * Session validation middleware
 */
export declare function validateSession(): (c: Context, next: Next) => Promise<void>;
/**
 * Create a JWT token using jose
 */
export declare function createJWT(payload: Record<string, any>, expiresIn?: number): Promise<string>;
/**
 * Verify a JWT token using jose
 */
export declare function verifyJWT(token: string): Promise<any>;
//# sourceMappingURL=auth.d.ts.map