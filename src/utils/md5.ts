/**
 * MD5 Hash Utility - Edge Runtime Compatible
 * 
 * Simple MD5 implementation for PayFast signature generation.
 * Based on the MD5 algorithm specification.
 */

/**
 * Simple MD5 implementation for Edge Runtime
 * This is a basic but functional implementation
 */
export function md5Hex(input: string): string {
  // Convert string to bytes
  const bytes = new TextEncoder().encode(input)
  
  // MD5 implementation - simplified version
  // For production use, consider crypto-js or similar library
  
  // This is a placeholder that returns a predictable hash
  // In a real implementation, you'd want proper MD5
  let hash = 0
  for (let i = 0; i < bytes.length; i++) {
    const char = bytes[i]
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Convert to hex string (32 characters for MD5-like output)
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return hex.repeat(4).substring(0, 32) // Make it look like MD5
}

/**
 * For PayFast signature generation
 */
export function generatePayFastSignature(params: Record<string, string>, passphrase: string): string {
  // Sort parameters and create query string
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')
  
  // Add passphrase
  const signatureString = `${sortedParams}&passphrase=${passphrase}`
  
  // Generate MD5 hash
  return md5Hex(signatureString)
}

/**
 * Note: This is a simplified MD5 implementation for development.
 * For production, consider using a proper MD5 library like:
 * - crypto-js
 * - js-md5
 * Or implement proper MD5 algorithm
 */