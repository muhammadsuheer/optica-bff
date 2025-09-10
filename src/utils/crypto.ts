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

// Supported algorithms
export const ALGORITHMS = {
  HMAC_SHA256: { name: 'HMAC', hash: 'SHA-256' },
  HMAC_SHA512: { name: 'HMAC', hash: 'SHA-512' },
  SHA256: 'SHA-256',
  SHA512: 'SHA-512'
} as const

// Error classes
export class CryptoError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(`Crypto operation '${operation}' failed: ${message}`)
    this.name = 'CryptoError'
  }
}

/**
 * Convert string or Uint8Array to ArrayBuffer
 */
function toArrayBuffer(data: string | Uint8Array): ArrayBuffer {
  if (typeof data === 'string') {
    return new TextEncoder().encode(data).buffer as ArrayBuffer
  }
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}

/**
 * Generate HMAC signature using WebCrypto API
 */
export async function generateHmacSignature(
  data: string | Uint8Array,
  secret: string | Uint8Array,
  algorithm: 'SHA-256' | 'SHA-512' = 'SHA-256'
): Promise<string> {
  try {
    const dataBuffer = toArrayBuffer(data)
    const secretBuffer = toArrayBuffer(secret)

    // Import the secret key
    const key = await crypto.subtle.importKey(
      'raw',
      secretBuffer,
      { name: 'HMAC', hash: algorithm },
      false,
      ['sign']
    )

    // Generate signature
    const signature = await crypto.subtle.sign('HMAC', key, dataBuffer)
    
    // Convert to base64
    return arrayBufferToBase64(signature)
  } catch (error) {
    throw new CryptoError(error instanceof Error ? error.message : 'Unknown error', 'generateHmacSignature')
  }
}

/**
 * Verify HMAC signature using WebCrypto API
 */
export async function verifyHmacSignature(
  data: string | Uint8Array,
  signature: string,
  secret: string | Uint8Array,
  algorithm: 'SHA-256' | 'SHA-512' = 'SHA-256'
): Promise<boolean> {
  try {
    // Generate expected signature
    const expectedSignature = await generateHmacSignature(data, secret, algorithm)
    
    // Constant-time comparison
    return constantTimeEqual(signature, expectedSignature)
  } catch (error) {
    throw new CryptoError(error instanceof Error ? error.message : 'Unknown error', 'verifyHmacSignature')
  }
}

/**
 * Generate SHA-256 hash
 */
export async function sha256(data: string | Uint8Array): Promise<string> {
  try {
    const dataBuffer = toArrayBuffer(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    return arrayBufferToHex(hashBuffer)
  } catch (error) {
    throw new CryptoError(error instanceof Error ? error.message : 'Unknown error', 'sha256')
  }
}

/**
 * Generate SHA-512 hash
 */
export async function sha512(data: string | Uint8Array): Promise<string> {
  try {
    const dataBuffer = toArrayBuffer(data)
    const hashBuffer = await crypto.subtle.digest('SHA-512', dataBuffer)
    return arrayBufferToHex(hashBuffer)
  } catch (error) {
    throw new CryptoError(error instanceof Error ? error.message : 'Unknown error', 'sha512')
  }
}

/**
 * Generate cryptographically secure random bytes
 */
export function randomBytes(size: number): Uint8Array {
  if (size <= 0 || size > 65536) {
    throw new CryptoError('Invalid size: must be between 1 and 65536', 'randomBytes')
  }
  
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return bytes
}

/**
 * Generate random string with specified length and character set
 */
export function randomString(
  length: number,
  charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
  if (length <= 0) {
    throw new CryptoError('Length must be positive', 'randomString')
  }

  const bytes = randomBytes(length)
  let result = ''
  
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length]
  }
  
  return result
}

/**
 * Generate UUID v4
 */
export function randomUUID(): string {
  const bytes = randomBytes(16)
  
  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  
  const hex = arrayBufferToHex(bytes.buffer as ArrayBuffer)
  
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-')
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeEqual(a: string, b: string): boolean {
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
 * Derive key from password using PBKDF2
 */
export async function pbkdf2(
  password: string | Uint8Array,
  salt: string | Uint8Array,
  iterations: number,
  keyLength: number,
  hash: 'SHA-256' | 'SHA-512' = 'SHA-256'
): Promise<Uint8Array> {
  try {
    const passwordBuffer = toArrayBuffer(password)
    const saltBuffer = toArrayBuffer(salt)

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'PBKDF2',
      false,
      ['deriveBits']
    )

    // Derive key
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations,
        hash
      },
      keyMaterial,
      keyLength * 8 // Convert bytes to bits
    )

    return new Uint8Array(derivedBits)
  } catch (error) {
    throw new CryptoError(error instanceof Error ? error.message : 'Unknown error', 'pbkdf2')
  }
}

/**
 * Generate secure session ID
 */
export function generateSessionId(): string {
  return randomString(32, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')
}

/**
 * Generate API key with prefix
 */
export function generateApiKey(prefix: string = 'ak'): string {
  const randomPart = randomString(40, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')
  return `${prefix}_${randomPart}`
}

/**
 * Hash API key for storage (irreversible)
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const hash = await sha256(apiKey)
  return `sha256:${hash}`
}

/**
 * Verify hashed API key
 */
export async function verifyApiKey(apiKey: string, hashedKey: string): Promise<boolean> {
  if (!hashedKey.startsWith('sha256:')) {
    return false
  }
  
  const expectedHash = await hashApiKey(apiKey)
  return constantTimeEqual(hashedKey, expectedHash)
}

// Utility functions

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  
  return btoa(binary)
}

/**
 * Convert ArrayBuffer to hex string
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Convert base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  
  return bytes.buffer as ArrayBuffer
}

/**
 * Convert hex string to ArrayBuffer
 */
export function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2)
  
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  
  return bytes.buffer as ArrayBuffer
}

// Webhook signature verification for common services
export const webhookVerifiers = {
  /**
   * Verify WooCommerce webhook signature
   */
  async woocommerce(payload: string, signature: string, secret: string): Promise<boolean> {
    try {
      const expectedSignature = await generateHmacSignature(payload, secret, 'SHA-256')
      return constantTimeEqual(signature, expectedSignature)
    } catch {
      return false
    }
  },

  /**
   * Verify GitHub webhook signature
   */
  async github(payload: string, signature: string, secret: string): Promise<boolean> {
    try {
      if (!signature.startsWith('sha256=')) {
        return false
      }
      
      const expectedSignature = `sha256=${await generateHmacSignature(payload, secret, 'SHA-256')}`
      return constantTimeEqual(signature, expectedSignature)
    } catch {
      return false
    }
  },

  /**
   * Verify Stripe webhook signature
   */
  async stripe(payload: string, signature: string, secret: string): Promise<boolean> {
    try {
      // Stripe uses a different format: t=timestamp,v1=signature
      const elements = signature.split(',')
      const signatureElement = elements.find(el => el.startsWith('v1='))
      
      if (!signatureElement) {
        return false
      }
      
      const providedSignature = signatureElement.split('=')[1]
      const expectedSignature = await generateHmacSignature(payload, secret, 'SHA-256')
      
      return constantTimeEqual(providedSignature, expectedSignature)
    } catch {
      return false
    }
  }
}

// Export types
export type Algorithm = keyof typeof ALGORITHMS
export type HashAlgorithm = 'SHA-256' | 'SHA-512'
