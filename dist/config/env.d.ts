import { z } from 'zod';
declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodEnum<{
        development: "development";
        production: "production";
        test: "test";
    }>>;
    PORT: z.ZodPipe<z.ZodPipe<z.ZodDefault<z.ZodString>, z.ZodTransform<number, string>>, z.ZodNumber>;
    WC_API_URL: z.ZodString;
    WC_CONSUMER_KEY_READ: z.ZodString;
    WC_CONSUMER_SECRET_READ: z.ZodString;
    WC_CONSUMER_KEY_WRITE: z.ZodString;
    WC_CONSUMER_SECRET_WRITE: z.ZodString;
    WC_WEBHOOK_SECRET: z.ZodString;
    SUPABASE_URL: z.ZodString;
    SUPABASE_ANON_KEY: z.ZodString;
    SUPABASE_SERVICE_KEY: z.ZodString;
    SUPABASE_JWT_SECRET: z.ZodString;
    SUPABASE_BACKUP_URL: z.ZodOptional<z.ZodString>;
    SUPABASE_BACKUP_URL_2: z.ZodOptional<z.ZodString>;
    BFF_API_KEY_FRONTEND: z.ZodString;
    BFF_API_KEY_ADMIN: z.ZodString;
    BFF_API_KEY_MOBILE: z.ZodString;
    CACHE_TTL_PRODUCTS: z.ZodPipe<z.ZodPipe<z.ZodDefault<z.ZodString>, z.ZodTransform<number, string>>, z.ZodNumber>;
    CACHE_TTL_SEARCH: z.ZodPipe<z.ZodPipe<z.ZodDefault<z.ZodString>, z.ZodTransform<number, string>>, z.ZodNumber>;
    CACHE_TTL_CATEGORIES: z.ZodPipe<z.ZodPipe<z.ZodDefault<z.ZodString>, z.ZodTransform<number, string>>, z.ZodNumber>;
    RATE_LIMIT_REQUESTS: z.ZodPipe<z.ZodPipe<z.ZodDefault<z.ZodString>, z.ZodTransform<number, string>>, z.ZodNumber>;
    RATE_LIMIT_WINDOW: z.ZodPipe<z.ZodPipe<z.ZodDefault<z.ZodString>, z.ZodTransform<number, string>>, z.ZodNumber>;
    FRONTEND_URL: z.ZodString;
    MOBILE_APP_URL: z.ZodOptional<z.ZodString>;
    ADMIN_URL: z.ZodOptional<z.ZodString>;
    SENTRY_DSN: z.ZodOptional<z.ZodString>;
    SLACK_WEBHOOK_URL: z.ZodOptional<z.ZodString>;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<{
        error: "error";
        warn: "warn";
        info: "info";
        debug: "debug";
    }>>;
    DAILY_COST_LIMIT: z.ZodPipe<z.ZodPipe<z.ZodDefault<z.ZodString>, z.ZodTransform<number, string>>, z.ZodNumber>;
    MONTHLY_COST_LIMIT: z.ZodPipe<z.ZodPipe<z.ZodDefault<z.ZodString>, z.ZodTransform<number, string>>, z.ZodNumber>;
    CDN_PURGE_URL: z.ZodOptional<z.ZodString>;
    CDN_API_KEY: z.ZodOptional<z.ZodString>;
    CF_IPCOUNTRY: z.ZodOptional<z.ZodString>;
    VERCEL_REGION: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const env: {
    NODE_ENV: "development" | "production" | "test";
    PORT: number;
    WC_API_URL: string;
    WC_CONSUMER_KEY_READ: string;
    WC_CONSUMER_SECRET_READ: string;
    WC_CONSUMER_KEY_WRITE: string;
    WC_CONSUMER_SECRET_WRITE: string;
    WC_WEBHOOK_SECRET: string;
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_KEY: string;
    SUPABASE_JWT_SECRET: string;
    BFF_API_KEY_FRONTEND: string;
    BFF_API_KEY_ADMIN: string;
    BFF_API_KEY_MOBILE: string;
    CACHE_TTL_PRODUCTS: number;
    CACHE_TTL_SEARCH: number;
    CACHE_TTL_CATEGORIES: number;
    RATE_LIMIT_REQUESTS: number;
    RATE_LIMIT_WINDOW: number;
    FRONTEND_URL: string;
    LOG_LEVEL: "error" | "warn" | "info" | "debug";
    DAILY_COST_LIMIT: number;
    MONTHLY_COST_LIMIT: number;
    SUPABASE_BACKUP_URL?: string | undefined;
    SUPABASE_BACKUP_URL_2?: string | undefined;
    MOBILE_APP_URL?: string | undefined;
    ADMIN_URL?: string | undefined;
    SENTRY_DSN?: string | undefined;
    SLACK_WEBHOOK_URL?: string | undefined;
    CDN_PURGE_URL?: string | undefined;
    CDN_API_KEY?: string | undefined;
    CF_IPCOUNTRY?: string | undefined;
    VERCEL_REGION?: string | undefined;
};
export type Environment = z.infer<typeof envSchema>;
export declare const isProduction: () => boolean;
export declare const isDevelopment: () => boolean;
export declare const isTest: () => boolean;
export declare const config: {
    readonly app: {
        readonly name: "Optia BFF";
        readonly version: "1.0.0";
        readonly port: number;
        readonly environment: "development" | "production" | "test";
        readonly logLevel: "error" | "warn" | "info" | "debug";
    };
    readonly woocommerce: {
        readonly apiUrl: string;
        readonly readKeys: {
            readonly consumerKey: string;
            readonly consumerSecret: string;
        };
        readonly writeKeys: {
            readonly consumerKey: string;
            readonly consumerSecret: string;
        };
        readonly webhookSecret: string;
    };
    readonly supabase: {
        readonly url: string;
        readonly anonKey: string;
        readonly serviceKey: string;
        readonly jwtSecret: string;
        readonly backupUrls: (string | undefined)[];
    };
    readonly apiKeys: {
        readonly frontend: string;
        readonly admin: string;
        readonly mobile: string;
    };
    readonly cache: {
        readonly ttl: {
            readonly products: number;
            readonly search: number;
            readonly categories: number;
        };
    };
    readonly rateLimit: {
        readonly requests: number;
        readonly window: number;
    };
    readonly cors: {
        readonly origins: (string | undefined)[];
    };
    readonly monitoring: {
        readonly sentryDsn: string | undefined;
        readonly slackWebhook: string | undefined;
    };
    readonly costs: {
        readonly dailyLimit: number;
        readonly monthlyLimit: number;
    };
    readonly cdn: {
        readonly purgeUrl: string | undefined;
        readonly apiKey: string | undefined;
    };
};
export declare function validateEnvironment(): {
    valid: boolean;
    errors: string[];
};
export declare function getMaskedConfig(): {
    woocommerce: {
        readKeys: {
            consumerKey: string;
            consumerSecret: string;
        };
        writeKeys: {
            consumerKey: string;
            consumerSecret: string;
        };
        webhookSecret: string;
        apiUrl: string;
    };
    supabase: {
        serviceKey: string;
        jwtSecret: string;
        url: string;
        anonKey: string;
        backupUrls: (string | undefined)[];
    };
    apiKeys: {
        frontend: string;
        admin: string;
        mobile: string;
    };
    app: {
        readonly name: "Optia BFF";
        readonly version: "1.0.0";
        readonly port: number;
        readonly environment: "development" | "production" | "test";
        readonly logLevel: "error" | "warn" | "info" | "debug";
    };
    cache: {
        readonly ttl: {
            readonly products: number;
            readonly search: number;
            readonly categories: number;
        };
    };
    rateLimit: {
        readonly requests: number;
        readonly window: number;
    };
    cors: {
        readonly origins: (string | undefined)[];
    };
    monitoring: {
        readonly sentryDsn: string | undefined;
        readonly slackWebhook: string | undefined;
    };
    costs: {
        readonly dailyLimit: number;
        readonly monthlyLimit: number;
    };
    cdn: {
        readonly purgeUrl: string | undefined;
        readonly apiKey: string | undefined;
    };
};
export {};
//# sourceMappingURL=env.d.ts.map