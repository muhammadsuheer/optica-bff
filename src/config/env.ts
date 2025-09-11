/**
 * Edge-Compatible Environment Configuration
 * 
 * Zod-validated configuration with proper Edge Runtime support.
 * Validates once at cold start and exports frozen config object.
 * 
 * IMPORTANT: Never access process.env directly elsewhere in the codebase.
 * Always import { env } from this module.
 */

import { z } from 'zod'

// =======================
// Environment Schema
// =======================

const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  
  // WordPress/WooCommerce
  WP_BASE_URL: z.string().url('Invalid WordPress base URL'),
  WC_CONSUMER_KEY: z.string().min(1, 'WooCommerce consumer key required'),
  WC_CONSUMER_SECRET: z.string().min(1, 'WooCommerce consumer secret required'),
  WC_WEBHOOK_SECRET: z.string().min(1, 'WooCommerce webhook secret required'),
  
  // PayFast (Optional - only if direct integration needed)
  PAYFAST_MERCHANT_ID: z.string().optional(),
  PAYFAST_MERCHANT_KEY: z.string().optional(),
  PAYFAST_PASSPHRASE: z.string().optional(),
  PAYFAST_SANDBOX: z.string().default('true').transform(s => s === 'true').optional(),
  
  // QStash (Optional - for webhook processing)
  QSTASH_API_URL: z.string().url().optional(),
  QSTASH_TOKEN: z.string().min(1).optional(),
  
  // App
  APP_BASE_URL: z.string().url().optional(),
  
  // Supabase (v2)
  SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key required'),
  
  // Upstash Redis/KV
  UPSTASH_REDIS_REST_URL: z.string().url('Invalid Upstash Redis URL'),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, 'Upstash Redis token required'),
  
  // Authentication & Security
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  API_KEYS: z.string().min(1).transform(str => 
    str.split(',').map(key => key.trim()).filter(Boolean)
  ),
  
  // CORS
  CORS_ORIGINS: z.string().default('*').transform(str => {
    if (str === '*') return ['*']
    return str.split(',').map(origin => origin.trim()).filter(Boolean)
  }),
  
  // Performance & Caching
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  CACHE_STAMPEDE_TTL: z.coerce.number().int().positive().default(60),
  CACHE_BULK_MODE_THRESHOLD: z.coerce.number().int().positive().default(10),
  CACHE_BULK_MODE_WINDOW: z.coerce.number().int().positive().default(5000),
  
  // Rate Limiting
  RATE_LIMIT_QPS: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WINDOW: z.coerce.number().int().positive().default(60),
  
  // Observability
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ENABLE_TRACING: z.string().default('true').transform(s => s === 'true'),
  ENABLE_METRICS: z.string().default('true').transform(s => s === 'true'),
  
  // Optional services
  SENTRY_DSN: z.string().url().optional(),
  
  // Feature flags (for gradual rollouts)
  ENABLE_OPTIMISTIC_UPDATES: z.string().default('true').transform(s => s === 'true'),
  ENABLE_CACHE_STAMPEDE_PROTECTION: z.string().default('true').transform(s => s === 'true'),
  ENABLE_WEBHOOK_VERIFICATION: z.string().default('true').transform(s => s === 'true'),
})

// =======================
// Edge-Safe Environment Access
// =======================

/**
 * Gets environment variables in an Edge Runtime compatible way.
 * 
 * In development: Uses process.env (loaded by tsx --env-file)
 * In production: Uses Vercel-injected environment variables
 */
function getEnvironmentVariables(): Record<string, string | undefined> {
  // Edge Runtime detection
  const isEdgeRuntime = typeof globalThis !== 'undefined' && 'EdgeRuntime' in globalThis
  
  if (isEdgeRuntime) {
    // In Vercel Edge Runtime, env vars are available on globalThis
    const globalEnv = globalThis as any
    
    // Extract known environment variables
    const envVars: Record<string, string | undefined> = {}
    const requiredVars = [
      'NODE_ENV', 'WP_BASE_URL', 'WC_CONSUMER_KEY', 'WC_CONSUMER_SECRET', 'WC_WEBHOOK_SECRET',
      'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
      'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
      'JWT_SECRET', 'API_KEYS', 'CORS_ORIGINS',
      'CACHE_TTL_SECONDS', 'CACHE_STAMPEDE_TTL',
      'RATE_LIMIT_QPS', 'RATE_LIMIT_WINDOW',
      'LOG_LEVEL', 'ENABLE_TRACING', 'ENABLE_METRICS',
      'SENTRY_DSN', 'ENABLE_OPTIMISTIC_UPDATES', 'ENABLE_CACHE_STAMPEDE_PROTECTION',
      'ENABLE_WEBHOOK_VERIFICATION'
    ]
    
    for (const varName of requiredVars) {
      // Try multiple access patterns for Vercel Edge Runtime
      envVars[varName] = globalEnv[varName] || 
                        globalEnv.process?.env?.[varName] ||
                        (globalThis as any)[varName]
    }
    
    return envVars
  } else {
    // Development mode - use Node.js process.env
    return process.env
  }
}

// =======================
// Configuration Parsing & Validation
// =======================

/**
 * Parse and validate environment variables once at module load
 */
function createConfig() {
  try {
    const rawEnv = getEnvironmentVariables()
    const validatedEnv = envSchema.parse(rawEnv)
    
    return {
      // Environment
      NODE_ENV: validatedEnv.NODE_ENV,
      IS_DEVELOPMENT: validatedEnv.NODE_ENV === 'development',
      IS_PRODUCTION: validatedEnv.NODE_ENV === 'production',
      
      // WordPress/WooCommerce
      WP_BASE_URL: validatedEnv.WP_BASE_URL,
      WC_API_URL: `${validatedEnv.WP_BASE_URL}/wp-json/wc/v3`,
      WC_CONSUMER_KEY: validatedEnv.WC_CONSUMER_KEY,
      WC_CONSUMER_SECRET: validatedEnv.WC_CONSUMER_SECRET,
      WC_WEBHOOK_SECRET: validatedEnv.WC_WEBHOOK_SECRET,
      
      // PayFast (Optional)
      PAYFAST_MERCHANT_ID: validatedEnv.PAYFAST_MERCHANT_ID,
      PAYFAST_MERCHANT_KEY: validatedEnv.PAYFAST_MERCHANT_KEY,
      PAYFAST_PASSPHRASE: validatedEnv.PAYFAST_PASSPHRASE,
      PAYFAST_SANDBOX: validatedEnv.PAYFAST_SANDBOX,
      
      // QStash (Optional)
      QSTASH_API_URL: validatedEnv.QSTASH_API_URL,
      QSTASH_TOKEN: validatedEnv.QSTASH_TOKEN,
      
      // App (Optional)
      APP_BASE_URL: validatedEnv.APP_BASE_URL,
      
      // Supabase
      SUPABASE_URL: validatedEnv.SUPABASE_URL,
      SUPABASE_ANON_KEY: validatedEnv.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: validatedEnv.SUPABASE_SERVICE_ROLE_KEY,
      
      // Upstash
      UPSTASH_REDIS_REST_URL: validatedEnv.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: validatedEnv.UPSTASH_REDIS_REST_TOKEN,
      
      // Auth
      JWT_SECRET: validatedEnv.JWT_SECRET,
      API_KEYS: validatedEnv.API_KEYS,
      
      // CORS
      CORS_ORIGINS: validatedEnv.CORS_ORIGINS,
      
      // Caching
      CACHE_TTL_SECONDS: validatedEnv.CACHE_TTL_SECONDS,
      CACHE_STAMPEDE_TTL: validatedEnv.CACHE_STAMPEDE_TTL,
      
      // Rate Limiting
      RATE_LIMIT_QPS: validatedEnv.RATE_LIMIT_QPS,
      RATE_LIMIT_WINDOW: validatedEnv.RATE_LIMIT_WINDOW,
      
      // Observability
      LOG_LEVEL: validatedEnv.LOG_LEVEL,
      ENABLE_TRACING: validatedEnv.ENABLE_TRACING,
      ENABLE_METRICS: validatedEnv.ENABLE_METRICS,
      SENTRY_DSN: validatedEnv.SENTRY_DSN,
      
      // Feature Flags
      ENABLE_OPTIMISTIC_UPDATES: validatedEnv.ENABLE_OPTIMISTIC_UPDATES,
      ENABLE_CACHE_STAMPEDE_PROTECTION: validatedEnv.ENABLE_CACHE_STAMPEDE_PROTECTION,
      ENABLE_WEBHOOK_VERIFICATION: validatedEnv.ENABLE_WEBHOOK_VERIFICATION,
    } as const
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .filter(issue => issue.code === 'invalid_type' && issue.received === 'undefined')
        .map(issue => issue.path.join('.'))
      
      const invalidVars = error.issues
        .filter(issue => issue.code !== 'invalid_type' || issue.received !== 'undefined')
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      
      let errorMessage = 'Environment validation failed:\n'
      
      if (missingVars.length > 0) {
        errorMessage += `Missing variables: ${missingVars.join(', ')}\n`
      }
      
      if (invalidVars.length > 0) {
        errorMessage += `Invalid variables: ${invalidVars.join(', ')}\n`
      }
      
      throw new Error(errorMessage)
    }
    
    throw new Error(`Environment configuration error: ${error}`)
  }
}

// =======================
// Export Configuration
// =======================

/**
 * Frozen configuration object - validated once at module load
 */
export const env = Object.freeze(createConfig())

// Structured config object for easier access
export const config = {
  // Environment
  nodeEnv: env.NODE_ENV,
  isDevelopment: env.IS_DEVELOPMENT,
  isProduction: env.IS_PRODUCTION,
  
  // WooCommerce
  woocommerce: {
    apiUrl: env.WC_API_URL,
    consumerKey: env.WC_CONSUMER_KEY,
    consumerSecret: env.WC_CONSUMER_SECRET,
    webhookSecret: env.WC_WEBHOOK_SECRET,
  },
  
  // PayFast
  payfast: {
    merchantId: env.PAYFAST_MERCHANT_ID,
    merchantKey: env.PAYFAST_MERCHANT_KEY,
    passphrase: env.PAYFAST_PASSPHRASE,
    sandbox: env.PAYFAST_SANDBOX,
  },
  
  // QStash
  qstash: {
    apiUrl: env.QSTASH_API_URL,
    token: env.QSTASH_TOKEN,
  },
  
  // App
  app: {
    baseUrl: env.APP_BASE_URL,
  },
  
  // Supabase
  supabase: {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  },
  
  // Upstash
  kv: {
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  },
  
  // CORS
  cors: {
    origins: env.CORS_ORIGINS,
    credentials: true,
    maxAge: 86400,
  },
  
  // Rate Limiting
  rateLimiting: {
    requests: env.RATE_LIMIT_QPS,
    window: env.RATE_LIMIT_WINDOW,
  },
  
  // Auth
  auth: {
    jwtSecret: env.JWT_SECRET || 'dev-secret-key',
    tokenExpiry: 86400 // 24 hours
  },
  
  // Monitoring
  monitoring: {
    sentryDsn: env.SENTRY_DSN
  },
  
  // Tax
  tax: {
    rate: 0.085
  },
  
  // Cache Configuration
  cache: {
    ttlSeconds: env.CACHE_TTL_SECONDS,
    stampedeTtl: env.CACHE_STAMPEDE_TTL,
    bulkModeThreshold: 100, // Default threshold
    bulkModeWindow: 60, // Default window in seconds
  },
} as const

/**
 * Type definition for the configuration
 */
export type Env = typeof env

/**
 * Runtime detection helper
 */
export const isEdgeRuntime = typeof globalThis !== 'undefined' && 'EdgeRuntime' in globalThis

/**
 * Environment helpers
 */
export const isDevelopment = env.IS_DEVELOPMENT
export const isProduction = env.IS_PRODUCTION