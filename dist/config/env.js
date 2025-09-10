/**
 * Edge Runtime Compatible Environment Configuration
 *
 * This module provides a production-ready environment variable system that works
 * in both development (Node.js) and production (Vercel Edge Runtime).
 *
 * Key Features:
 * - 100% Edge Runtime compatible
 * - No process.env leakage
 * - Proper type safety with Zod validation
 * - Works with Vercel environment variables
 */
import { z } from 'zod';
// Environment variable schema with proper defaults and validation
const envSchema = z.object({
    // Node environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
    // Supabase configuration
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_KEY: z.string().min(1),
    SUPABASE_BACKUP_URL: z.string().url().optional(),
    SUPABASE_BACKUP_URL_2: z.string().url().optional(),
    // Vercel KV (Upstash Redis) configuration
    KV_REST_API_URL: z.string().url(),
    KV_REST_API_TOKEN: z.string().min(1),
    KV_REST_API_READ_ONLY_TOKEN: z.string().optional(),
    // WooCommerce configuration
    WC_API_URL: z.string().url(),
    WC_CONSUMER_KEY: z.string().min(1),
    WC_CONSUMER_SECRET: z.string().min(1),
    WC_WEBHOOK_SECRET: z.string().min(1),
    // WordPress configuration (optional)
    WP_GRAPHQL_URL: z.string().url().optional(),
    WP_API_URL: z.string().url().optional(),
    // Authentication & Security
    JWT_SECRET: z.string().min(32),
    API_KEYS: z.string().transform(str => str.split(',').map(k => k.trim())),
    // CORS configuration
    CORS_ORIGINS: z.string().default('*').transform(str => str.split(',').map(origin => origin.trim())),
    // Frontend URL
    FRONTEND_URL: z.string().url(),
    // Rate limiting configuration
    RATE_LIMIT_REQUESTS: z.coerce.number().default(1000),
    RATE_LIMIT_WINDOW: z.coerce.number().default(3600),
    // Cache configuration
    CACHE_TTL_PRODUCTS: z.coerce.number().default(3600),
    CACHE_TTL_SEARCH: z.coerce.number().default(1800),
    CACHE_TTL_CATEGORIES: z.coerce.number().default(7200),
    // Optional configuration
    SENTRY_DSN: z.string().url().optional(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    // Feature flags
    ENABLE_REALTIME: z.string().default('false').transform(s => s === 'true'),
    ENABLE_WEBHOOKS: z.string().default('true').transform(s => s === 'true'),
    ENABLE_CACHING: z.string().default('true').transform(s => s === 'true'),
    ENABLE_RATE_LIMITING: z.string().default('true').transform(s => s === 'true'),
    DEBUG_MODE: z.string().default('false').transform(s => s === 'true'),
    ENABLE_METRICS: z.string().default('true').transform(s => s === 'true')
});
// Edge-compatible environment variable access
function getEnvironmentVariables() {
    const env = {};
    // In development, environment variables come from process.env (loaded by dev tools)
    // In production (Vercel Edge), they are injected directly into the runtime
    if (typeof process !== 'undefined' && process.env) {
        // Development mode - use process.env
        return process.env;
    }
    // Production Edge Runtime mode - environment variables are available as globals
    // Vercel injects environment variables directly into the global scope
    const globalEnv = globalThis;
    // Try to access common environment variable patterns in Edge Runtime
    const envVarNames = [
        'NODE_ENV', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY',
        'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'WC_API_URL', 'WC_CONSUMER_KEY',
        'WC_CONSUMER_SECRET', 'WC_WEBHOOK_SECRET', 'JWT_SECRET', 'API_KEYS',
        'CORS_ORIGINS', 'FRONTEND_URL', 'RATE_LIMIT_REQUESTS', 'RATE_LIMIT_WINDOW',
        'CACHE_TTL_PRODUCTS', 'CACHE_TTL_SEARCH', 'CACHE_TTL_CATEGORIES',
        'SENTRY_DSN', 'LOG_LEVEL', 'ENABLE_REALTIME', 'ENABLE_WEBHOOKS',
        'ENABLE_CACHING', 'ENABLE_RATE_LIMITING', 'DEBUG_MODE', 'ENABLE_METRICS'
    ];
    for (const name of envVarNames) {
        // In Vercel Edge Runtime, environment variables are available directly
        const value = globalEnv[name] || globalEnv.process?.env?.[name];
        if (value !== undefined) {
            env[name] = String(value);
        }
    }
    return env;
}
// Parse and validate environment variables
function createConfig() {
    try {
        const rawEnv = getEnvironmentVariables();
        const validatedEnv = envSchema.parse(rawEnv);
        return {
            // Environment
            nodeEnv: validatedEnv.NODE_ENV,
            isDevelopment: validatedEnv.NODE_ENV === 'development',
            isProduction: validatedEnv.NODE_ENV === 'production',
            // Supabase
            supabase: {
                url: validatedEnv.SUPABASE_URL,
                anonKey: validatedEnv.SUPABASE_ANON_KEY,
                serviceKey: validatedEnv.SUPABASE_SERVICE_KEY,
                backupUrls: [validatedEnv.SUPABASE_BACKUP_URL, validatedEnv.SUPABASE_BACKUP_URL_2].filter(Boolean)
            },
            // Redis/KV
            kv: {
                url: validatedEnv.KV_REST_API_URL,
                token: validatedEnv.KV_REST_API_TOKEN,
                readOnlyToken: validatedEnv.KV_REST_API_READ_ONLY_TOKEN
            },
            // WooCommerce
            woocommerce: {
                apiUrl: validatedEnv.WC_API_URL,
                consumerKey: validatedEnv.WC_CONSUMER_KEY,
                consumerSecret: validatedEnv.WC_CONSUMER_SECRET,
                webhookSecret: validatedEnv.WC_WEBHOOK_SECRET,
                readKeys: {
                    consumerKey: validatedEnv.WC_CONSUMER_KEY,
                    consumerSecret: validatedEnv.WC_CONSUMER_SECRET
                }
            },
            // Authentication
            auth: {
                jwtSecret: validatedEnv.JWT_SECRET,
                apiKeys: validatedEnv.API_KEYS,
                tokenExpiry: 3600
            },
            // CORS
            cors: {
                origins: validatedEnv.CORS_ORIGINS,
                credentials: true,
                maxAge: 86400
            },
            // Frontend
            frontend: {
                url: validatedEnv.FRONTEND_URL
            },
            // Rate limiting
            rateLimiting: {
                requests: validatedEnv.RATE_LIMIT_REQUESTS,
                window: validatedEnv.RATE_LIMIT_WINDOW,
                enabled: validatedEnv.ENABLE_RATE_LIMITING
            },
            // Cache
            cache: {
                ttl: {
                    products: validatedEnv.CACHE_TTL_PRODUCTS,
                    search: validatedEnv.CACHE_TTL_SEARCH,
                    categories: validatedEnv.CACHE_TTL_CATEGORIES
                },
                enabled: validatedEnv.ENABLE_CACHING
            },
            // Features
            features: {
                realtime: validatedEnv.ENABLE_REALTIME,
                webhooks: validatedEnv.ENABLE_WEBHOOKS,
                metrics: validatedEnv.ENABLE_METRICS
            },
            // Debug
            debug: {
                enabled: validatedEnv.DEBUG_MODE,
                logLevel: validatedEnv.LOG_LEVEL
            },
            // Optional services
            sentry: {
                dsn: validatedEnv.SENTRY_DSN
            },
            stripe: {
                webhookSecret: validatedEnv.STRIPE_WEBHOOK_SECRET
            },
            // Webhooks
            webhooks: {
                wooCommerceSecret: validatedEnv.WC_WEBHOOK_SECRET,
                stripeSecret: validatedEnv.STRIPE_WEBHOOK_SECRET
            },
            // WordPress
            wordpress: {
                graphqlUrl: validatedEnv.WP_GRAPHQL_URL
            },
            // Tax configuration
            tax: {
                rate: 0.085
            },
            // Shipping configuration
            shipping: {
                defaultRate: 10.00
            },
            // Monitoring
            monitoring: {
                sentryDsn: validatedEnv.SENTRY_DSN
            }
        };
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            const missingVars = error.issues
                .filter(issue => issue.code === 'invalid_type' && issue.received === 'undefined')
                .map(issue => issue.path.join('.'));
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }
        throw error;
    }
}
// Export the configuration
export const config = createConfig();
//# sourceMappingURL=env.js.map