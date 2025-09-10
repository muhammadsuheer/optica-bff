/**
 * WebCrypto API Utilities for Edge Runtime
 *
 * Replaces Node.js crypto module with Web Standard APIs
 * Features:
 * - HMAC signature generation and verification
 * - Random value generation
 * - Hash functions (SHA-256, SHA-512)
 * - Constant-time string comparison
 * - Key derivation functions
 */
export declare const ALGORITHMS: {
    readonly HMAC_SHA256: {
        readonly name: "HMAC";
        readonly hash: "SHA-256";
    };
    readonly HMAC_SHA512: {
        readonly name: "HMAC";
        readonly hash: "SHA-512";
    };
    readonly SHA256: "SHA-256";
    readonly SHA512: "SHA-512";
};
export declare class CryptoError extends Error {
    readonly operation: string;
    constructor(message: string, operation: string);
}
/**
 * Generate HMAC signature using WebCrypto API
 */
export declare function generateHmacSignature(data: string | Uint8Array, secret: string | Uint8Array, algorithm?: 'SHA-256' | 'SHA-512'): Promise<string>;
/**
 * Verify HMAC signature using WebCrypto API
 */
export declare function verifyHmacSignature(data: string | Uint8Array, signature: string, secret: string | Uint8Array, algorithm?: 'SHA-256' | 'SHA-512'): Promise<boolean>;
/**
 * Generate SHA-256 hash
 */
export declare function sha256(data: string | Uint8Array): Promise<string>;
/**
 * Generate SHA-512 hash
 */
export declare function sha512(data: string | Uint8Array): Promise<string>;
/**
 * Generate cryptographically secure random bytes
 */
export declare function randomBytes(size: number): Uint8Array;
/**
 * Generate random string with specified length and character set
 */
export declare function randomString(length: number, charset?: string): string;
/**
 * Generate UUID v4
 */
export declare function randomUUID(): string;
/**
 * Constant-time string comparison to prevent timing attacks
 */
export declare function constantTimeEqual(a: string, b: string): boolean;
/**
 * Derive key from password using PBKDF2
 */
export declare function pbkdf2(password: string | Uint8Array, salt: string | Uint8Array, iterations: number, keyLength: number, hash?: 'SHA-256' | 'SHA-512'): Promise<Uint8Array>;
/**
 * Generate secure session ID
 */
export declare function generateSessionId(): string;
/**
 * Generate API key with prefix
 */
export declare function generateApiKey(prefix?: string): string;
/**
 * Hash API key for storage (irreversible)
 */
export declare function hashApiKey(apiKey: string): Promise<string>;
/**
 * Verify hashed API key
 */
export declare function verifyApiKey(apiKey: string, hashedKey: string): Promise<boolean>;
/**
 * Convert base64 string to ArrayBuffer
 */
export declare function base64ToArrayBuffer(base64: string): ArrayBuffer;
/**
 * Convert hex string to ArrayBuffer
 */
export declare function hexToArrayBuffer(hex: string): ArrayBuffer;
export declare const webhookVerifiers: {
    /**
     * Verify WooCommerce webhook signature
     */
    woocommerce(payload: string, signature: string, secret: string): Promise<boolean>;
    /**
     * Verify GitHub webhook signature
     */
    github(payload: string, signature: string, secret: string): Promise<boolean>;
    /**
     * Verify Stripe webhook signature
     */
    stripe(payload: string, signature: string, secret: string): Promise<boolean>;
};
export type Algorithm = keyof typeof ALGORITHMS;
export type HashAlgorithm = 'SHA-256' | 'SHA-512';
//# sourceMappingURL=crypto.d.ts.map