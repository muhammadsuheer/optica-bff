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
export declare const config: {
    nodeEnv: "development" | "production" | "test";
    isDevelopment: boolean;
    isProduction: boolean;
    supabase: {
        url: string;
        anonKey: string;
        serviceKey: string;
        backupUrls: (string | undefined)[];
    };
    kv: {
        url: string;
        token: string;
        readOnlyToken: string | undefined;
    };
    woocommerce: {
        apiUrl: string;
        consumerKey: string;
        consumerSecret: string;
        webhookSecret: string;
        readKeys: {
            consumerKey: string;
            consumerSecret: string;
        };
    };
    auth: {
        jwtSecret: string;
        apiKeys: string[];
        tokenExpiry: number;
    };
    cors: {
        origins: string[];
        credentials: boolean;
        maxAge: number;
    };
    frontend: {
        url: string;
    };
    rateLimiting: {
        requests: number;
        window: number;
        enabled: boolean;
    };
    cache: {
        ttl: {
            products: number;
            search: number;
            categories: number;
        };
        enabled: boolean;
    };
    features: {
        realtime: boolean;
        webhooks: boolean;
        metrics: boolean;
    };
    debug: {
        enabled: boolean;
        logLevel: "debug" | "info" | "warn" | "error";
    };
    sentry: {
        dsn: string | undefined;
    };
    stripe: {
        webhookSecret: string | undefined;
    };
    webhooks: {
        wooCommerceSecret: string;
        stripeSecret: string | undefined;
    };
    wordpress: {
        graphqlUrl: string | undefined;
    };
    tax: {
        rate: number;
    };
    shipping: {
        defaultRate: number;
    };
    monitoring: {
        sentryDsn: string | undefined;
    };
};
export type Config = typeof config;
//# sourceMappingURL=env.d.ts.map