/**
 * Edge-Compatible Cache Key Generator
 * Uses Web Crypto API instead of Node.js crypto
 */

/**
 * Generate a hash using Web Crypto API (Edge compatible)
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate cache key with hash for consistent length
 */
export async function generateCacheKey(prefix: string, data: any): Promise<string> {
  const dataString = typeof data === 'string' ? data : JSON.stringify(data)
  const hash = await hashString(dataString)
  return `${prefix}:${hash.substring(0, 16)}`
}

/**
 * Sanitize cache key to ensure compatibility
 */
export function sanitizeCacheKey(key: string): string {
  return key
    .replace(/[^a-zA-Z0-9:_-]/g, '_')
    .toLowerCase()
    .substring(0, 200) // Limit length
}

/**
 * Create cache key with TTL suffix
 */
export function createTtlKey(baseKey: string, ttl: number): string {
  const expiryTime = Math.floor(Date.now() / 1000) + ttl
  return `${baseKey}:exp:${expiryTime}`
}

/**
 * Extract expiry time from TTL key
 */
export function getExpiryFromKey(key: string): number | null {
  const match = key.match(/:exp:(\d+)$/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Check if cache key has expired
 */
export function isKeyExpired(key: string): boolean {
  const expiry = getExpiryFromKey(key)
  if (!expiry) return false
  return Math.floor(Date.now() / 1000) > expiry
}
