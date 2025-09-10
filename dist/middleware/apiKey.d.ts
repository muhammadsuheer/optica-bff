/**
 * API Key Authentication Middleware for Edge Runtime
 */
import { Context, Next } from 'hono';
export interface ApiKeyContext {
    keyType: 'frontend' | 'admin' | 'mobile';
    permissions: string[];
}
/**
 * Validate API key and extract permissions
 */
export declare function validateApiKey(apiKey: string): Promise<ApiKeyContext | null>;
/**
 * API Key middleware factory
 */
export declare function apiKey(options?: {
    required?: boolean;
    allowedKeyTypes?: Array<'frontend' | 'admin' | 'mobile'>;
}): (c: Context, next: Next) => Promise<void>;
/**
 * Check if current API key has specific permission
 */
export declare function hasPermission(c: Context, permission: string): boolean;
/**
 * Require specific permission middleware
 */
export declare function requirePermission(permission: string): (c: Context, next: Next) => Promise<void>;
//# sourceMappingURL=apiKey.d.ts.map