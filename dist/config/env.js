import { z } from 'zod';
// Environment validation schema
const envSchema = z.object({
    // Node Environment
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('3000').transform(Number).pipe(z.number().min(1000).max(65535)),
    // WooCommerce API Configuration
    WC_API_URL: z.string().url('Invalid WooCommerce API URL'),
    WC_CONSUMER_KEY_READ: z.string().min(1, 'WooCommerce read consumer key is required'),
    WC_CONSUMER_SECRET_READ: z.string().min(1, 'WooCommerce read consumer secret is required'),
    WC_CONSUMER_KEY_WRITE: z.string().min(1, 'WooCommerce write consumer key is required'),
    WC_CONSUMER_SECRET_WRITE: z.string().min(1, 'WooCommerce write consumer secret is required'),
    WC_WEBHOOK_SECRET: z.string().min(1, 'WooCommerce webhook secret is required'),
    // Supabase Configuration
    SUPABASE_URL: z.string().url('Invalid Supabase URL'),
    SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anonymous key is required'),
    SUPABASE_SERVICE_KEY: z.string().min(1, 'Supabase service key is required'),
    SUPABASE_JWT_SECRET: z.string().min(1, 'Supabase JWT secret is required'),
    // Optional Supabase Backup URLs
    SUPABASE_BACKUP_URL: z.string().url().optional(),
    SUPABASE_BACKUP_URL_2: z.string().url().optional(),
    // BFF API Configuration
    BFF_API_KEY_FRONTEND: z.string().min(32, 'Frontend API key must be at least 32 characters'),
    BFF_API_KEY_ADMIN: z.string().min(32, 'Admin API key must be at least 32 characters'),
    BFF_API_KEY_MOBILE: z.string().min(32, 'Mobile API key must be at least 32 characters'),
    // Cache Configuration
    CACHE_TTL_PRODUCTS: z.string().default('3600').transform(Number).pipe(z.number().min(60).max(86400)),
    CACHE_TTL_SEARCH: z.string().default('1800').transform(Number).pipe(z.number().min(60).max(86400)),
    CACHE_TTL_CATEGORIES: z.string().default('7200').transform(Number).pipe(z.number().min(60).max(86400)),
    // Rate Limiting
    RATE_LIMIT_REQUESTS: z.string().default('1000').transform(Number).pipe(z.number().min(10).max(10000)),
    RATE_LIMIT_WINDOW: z.string().default('3600').transform(Number).pipe(z.number().min(60).max(86400)),
    // Frontend URLs for CORS
    FRONTEND_URL: z.string().url('Invalid frontend URL'),
    MOBILE_APP_URL: z.string().url().optional(),
    ADMIN_URL: z.string().url().optional(),
    // Monitoring & Alerting
    SENTRY_DSN: z.string().url().optional(),
    SLACK_WEBHOOK_URL: z.string().url().optional(),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    // Cost Limits
    DAILY_COST_LIMIT: z.string().default('100').transform(Number).pipe(z.number().min(1)),
    MONTHLY_COST_LIMIT: z.string().default('2000').transform(Number).pipe(z.number().min(10)),
    // CDN Configuration (optional)
    CDN_PURGE_URL: z.string().url().optional(),
    CDN_API_KEY: z.string().optional(),
    // Regional Configuration
    CF_IPCOUNTRY: z.string().optional(),
    VERCEL_REGION: z.string().optional(),
});
// Validate and export environment variables
export const env = envSchema.parse(process.env);
// Utility function to check if we're in production
export const isProduction = () => env.NODE_ENV === 'production';
// Utility function to check if we're in development
export const isDevelopment = () => env.NODE_ENV === 'development';
// Utility function to check if we're in test mode
export const isTest = () => env.NODE_ENV === 'test';
// Configuration objects for easier access
export const config = {
    app: {
        name: 'Optia BFF',
        version: '1.0.0',
        port: env.PORT,
        environment: env.NODE_ENV,
        logLevel: env.LOG_LEVEL,
    },
    woocommerce: {
        apiUrl: env.WC_API_URL,
        readKeys: {
            consumerKey: env.WC_CONSUMER_KEY_READ,
            consumerSecret: env.WC_CONSUMER_SECRET_READ,
        },
        writeKeys: {
            consumerKey: env.WC_CONSUMER_KEY_WRITE,
            consumerSecret: env.WC_CONSUMER_SECRET_WRITE,
        },
        webhookSecret: env.WC_WEBHOOK_SECRET,
    },
    supabase: {
        url: env.SUPABASE_URL,
        anonKey: env.SUPABASE_ANON_KEY,
        serviceKey: env.SUPABASE_SERVICE_KEY,
        jwtSecret: env.SUPABASE_JWT_SECRET,
        backupUrls: [env.SUPABASE_BACKUP_URL, env.SUPABASE_BACKUP_URL_2].filter(Boolean),
    },
    apiKeys: {
        frontend: env.BFF_API_KEY_FRONTEND,
        admin: env.BFF_API_KEY_ADMIN,
        mobile: env.BFF_API_KEY_MOBILE,
    },
    cache: {
        ttl: {
            products: env.CACHE_TTL_PRODUCTS,
            search: env.CACHE_TTL_SEARCH,
            categories: env.CACHE_TTL_CATEGORIES,
        },
    },
    rateLimit: {
        requests: env.RATE_LIMIT_REQUESTS,
        window: env.RATE_LIMIT_WINDOW,
    },
    cors: {
        origins: [
            env.FRONTEND_URL,
            env.MOBILE_APP_URL,
            env.ADMIN_URL,
            // Add localhost for development
            ...(isDevelopment() ? ['http://localhost:3000', 'http://localhost:3001'] : []),
        ].filter(Boolean),
    },
    monitoring: {
        sentryDsn: env.SENTRY_DSN,
        slackWebhook: env.SLACK_WEBHOOK_URL,
    },
    costs: {
        dailyLimit: env.DAILY_COST_LIMIT,
        monthlyLimit: env.MONTHLY_COST_LIMIT,
    },
    cdn: {
        purgeUrl: env.CDN_PURGE_URL,
        apiKey: env.CDN_API_KEY,
    },
};
// Validation function to ensure all required environment variables are set
export function validateEnvironment() {
    try {
        envSchema.parse(process.env);
        return { valid: true, errors: [] };
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
            return { valid: false, errors };
        }
        return { valid: false, errors: ['Unknown validation error'] };
    }
}
// Function to mask sensitive environment variables for logging
export function getMaskedConfig() {
    return {
        ...config,
        woocommerce: {
            ...config.woocommerce,
            readKeys: {
                consumerKey: maskSecret(config.woocommerce.readKeys.consumerKey),
                consumerSecret: maskSecret(config.woocommerce.readKeys.consumerSecret),
            },
            writeKeys: {
                consumerKey: maskSecret(config.woocommerce.writeKeys.consumerKey),
                consumerSecret: maskSecret(config.woocommerce.writeKeys.consumerSecret),
            },
            webhookSecret: maskSecret(config.woocommerce.webhookSecret),
        },
        supabase: {
            ...config.supabase,
            serviceKey: maskSecret(config.supabase.serviceKey),
            jwtSecret: maskSecret(config.supabase.jwtSecret),
        },
        apiKeys: {
            frontend: maskSecret(config.apiKeys.frontend),
            admin: maskSecret(config.apiKeys.admin),
            mobile: maskSecret(config.apiKeys.mobile),
        },
    };
}
function maskSecret(secret) {
    if (secret.length <= 8)
        return '***';
    return secret.substring(0, 4) + '***' + secret.substring(secret.length - 4);
}
//# sourceMappingURL=env.js.map