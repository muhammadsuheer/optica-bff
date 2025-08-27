import { cleanEnv, str, num, bool, url } from 'envalid';
import { config as dotenvConfig } from 'dotenv';
import { createHash } from 'crypto';
import { logger } from '../utils/logger.js';

// Load environment variables once at module initialization
dotenvConfig();

/**
 * Configuration categories for lazy loading
 */
enum ConfigCategory {
  CORE = 'core',           // Critical configs needed at startup
  WORDPRESS = 'wordpress', // WordPress/WooCommerce configs (loaded when needed)
  REDIS = 'redis',         // Redis configs (loaded when cache service starts)
  DATABASE = 'database',   // Database connection configs (loaded when database service starts)
  SECURITY = 'security',   // Security configs (loaded when auth middleware starts)
  PERFORMANCE = 'performance', // Performance tuning configs (loaded on demand)
  FEATURES = 'features'    // Feature flags and optional configs (loaded on demand)
}

/**
 * Core configuration that must be validated immediately at startup
 */
const coreConfigSchema = {
  NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'development' }),
  PORT: num({ default: 3000 }),
  HOST: str({ default: '0.0.0.0' }),
};

/**
 * Lazy-loaded configuration schemas organized by category
 */
const configSchemas: Record<ConfigCategory, Record<string, any>> = {
  [ConfigCategory.WORDPRESS]: {
    WP_GRAPHQL_ENDPOINT: url(),
    WP_BASE_URL: url(),
    WOO_CONSUMER_KEY: str(),
    WOO_CONSUMER_SECRET: str(),
    WOO_STORE_API_URL: url(),
  },
  
  [ConfigCategory.REDIS]: {
    REDIS_URL: str({ default: 'redis://localhost:6379' }),
    REDIS_PASSWORD: str({ default: '' }),
    REDIS_DB: num({ default: 0 }),
  },
  
  [ConfigCategory.DATABASE]: {
    DATABASE_URL: str(),
    PGPOOLSIZE: num({ default: 10 }),
    // Removed individual DB config - Supabase uses connection string only
  },
  
  [ConfigCategory.SECURITY]: {
    JWT_SECRET: str(),
    CORS_ORIGIN: str({ default: '*' }),
  JWT_ACCESS_TTL: num({ default: 3600 }),
  JWT_REFRESH_TTL: num({ default: 2592000 }),
  ADMIN_API_KEYS: str({ default: '' }),
  },
  
  [ConfigCategory.PERFORMANCE]: {
    RATE_LIMIT_WINDOW_MS: num({ default: 60000 }), // 1 minute
    RATE_LIMIT_MAX_REQUESTS: num({ default: 100 }),
    CACHE_TTL_PRODUCTS: num({ default: 60 }), // seconds
    CACHE_TTL_PRODUCT_DETAIL: num({ default: 60 }), // seconds
    CACHE_TTL_CATEGORIES: num({ default: 900 }), // seconds
    REQUEST_TIMEOUT_MS: num({ default: 10000 }), // 10 seconds
  },
  
  [ConfigCategory.FEATURES]: {
    IMAGE_QUALITY: num({ default: 80 }),
    IMAGE_MAX_WIDTH: num({ default: 1920 }),
    IMAGE_MAX_HEIGHT: num({ default: 1080 }),
  },
  
  // Core is handled separately, but included for completeness
  [ConfigCategory.CORE]: {}
};

/**
 * Cache for validated configuration sections
 */
class ConfigCache {
  private cache = new Map<ConfigCategory, any>();
  private validationHashes = new Map<ConfigCategory, string>();
  private accessTimes = new Map<ConfigCategory, number>();
  
  /**
   * Generate validation hash for configuration consistency checking
   */
  private generateValidationHash(category: ConfigCategory): string {
    const schema = configSchemas[category];
    const envValues = Object.keys(schema).map(key => `${key}=${process.env[key] || ''}`);
    return createHash('sha256').update(envValues.join('|')).digest('hex').slice(0, 16);
  }
  
  /**
   * Get cached configuration or validate and cache if not present
   */
  get(category: ConfigCategory): any {
    const currentTime = Date.now();
    
    // Check if we have a valid cached version
    if (this.cache.has(category)) {
      // Update access time for LRU tracking
      this.accessTimes.set(category, currentTime);
      
      // Verify configuration hasn't changed (in development)
      if (process.env.NODE_ENV === 'development') {
        const currentHash = this.generateValidationHash(category);
        const cachedHash = this.validationHashes.get(category);
        
        if (currentHash !== cachedHash) {
          logger.warn(`Configuration change detected for ${category}, revalidating...`);
          this.cache.delete(category);
          this.validationHashes.delete(category);
        } else {
          return this.cache.get(category);
        }
      } else {
        return this.cache.get(category);
      }
    }
    
    // Validate and cache the configuration
    logger.debug(`Lazy loading ${category} configuration...`);
    const startTime = performance.now();
    
    try {
      const schema = configSchemas[category];
      const validated = cleanEnv(process.env, schema);
      
      // Cache the validated configuration
      this.cache.set(category, validated);
      this.validationHashes.set(category, this.generateValidationHash(category));
      this.accessTimes.set(category, currentTime);
      
      const loadTime = performance.now() - startTime;
      logger.debug(`${category} configuration loaded in ${loadTime.toFixed(2)}ms`);
      
      return validated;
    } catch (error: any) {
      logger.error(`Failed to validate ${category} configuration:`, error);
      throw new Error(`Invalid ${category} configuration: ${error?.message || 'Unknown error'}`);
    }
  }
  
  /**
   * Preload critical configuration categories
   */
  preload(categories: ConfigCategory[]): void {
    logger.info(`Preloading ${categories.length} configuration categories...`);
    const startTime = performance.now();
    
    for (const category of categories) {
      try {
        this.get(category);
      } catch (error) {
        logger.error(`Failed to preload ${category}:`, error as Error);
        throw error;
      }
    }
    
    const totalTime = performance.now() - startTime;
    logger.info(`Configuration preloading completed in ${totalTime.toFixed(2)}ms`);
  }
  
  /**
   * Get cache statistics for monitoring
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      categories: Array.from(this.cache.keys()),
      lastAccess: Array.from(this.accessTimes.entries()).sort((a, b) => b[1] - a[1])
    };
  }
  
  /**
   * Clear cache (useful for testing or development)
   */
  clear(): void {
    this.cache.clear();
    this.validationHashes.clear();
    this.accessTimes.clear();
  }
}

/**
 * Global configuration cache instance
 */
const configCache = new ConfigCache();

/**
 * Immediately validate and export core configuration (required at startup)
 */
export const coreConfig = cleanEnv(process.env, coreConfigSchema);

/**
 * Lazy-loaded configuration getters
 */
export const envConfig = {
  /**
   * Get core configuration (always available)
   */
  get core() {
    return coreConfig;
  },
  
  /**
   * Get WordPress/WooCommerce configuration (lazy-loaded)
   */
  get wordpress() {
    return configCache.get(ConfigCategory.WORDPRESS);
  },
  
  /**
   * Get Redis configuration (lazy-loaded)
   */
  get redis() {
    return configCache.get(ConfigCategory.REDIS);
  },
  
  /**
   * Get security configuration (lazy-loaded)
   */
  get security() {
    return configCache.get(ConfigCategory.SECURITY);
  },
  
  /**
   * Get performance configuration (lazy-loaded)
   */
  get performance() {
    return configCache.get(ConfigCategory.PERFORMANCE);
  },
  
  /**
   * Get feature configuration (lazy-loaded)
   */
  get features() {
    return configCache.get(ConfigCategory.FEATURES);
  },
  
  /**
   * Get database configuration (lazy-loaded)
   */
  get database() {
    return configCache.get(ConfigCategory.DATABASE);
  },
  
  /**
   * Preload multiple configuration categories for better performance
   */
  preload(categories: ConfigCategory[]) {
    configCache.preload(categories);
  },
  
  /**
   * Get cache statistics
   */
  getStats() {
    return configCache.getStats();
  }
};

/**
 * Backward compatibility: create env object that lazily loads all configs
 * This maintains compatibility with existing code while providing performance benefits
 */
export const env = new Proxy({} as any, {
  get(target, prop: string) {
    // Handle core config properties
    if (prop in coreConfigSchema) {
      return coreConfig[prop as keyof typeof coreConfig];
    }
    
    // Handle WordPress properties
    if (prop in configSchemas[ConfigCategory.WORDPRESS]) {
      return envConfig.wordpress[prop];
    }
    
    // Handle Redis properties
    if (prop in configSchemas[ConfigCategory.REDIS]) {
      return envConfig.redis[prop];
    }
    
    // Handle security properties
    if (prop in configSchemas[ConfigCategory.SECURITY]) {
      return envConfig.security[prop];
    }
    
    // Handle performance properties
    if (prop in configSchemas[ConfigCategory.PERFORMANCE]) {
      return envConfig.performance[prop];
    }
    
    // Handle feature properties
    if (prop in configSchemas[ConfigCategory.FEATURES]) {
      return envConfig.features[prop];
    }
    
    // Handle database properties
    if (prop in configSchemas[ConfigCategory.DATABASE]) {
      return envConfig.database[prop];
    }
    
    // Return undefined for unknown properties
    return undefined;
  }
});

/**
 * Type definitions for better TypeScript support
 */
export type CoreConfig = typeof coreConfig;
export type WordPressConfig = ReturnType<typeof envConfig.wordpress>;
export type RedisConfig = ReturnType<typeof envConfig.redis>;
export type SecurityConfig = ReturnType<typeof envConfig.security>;
export type PerformanceConfig = ReturnType<typeof envConfig.performance>;
export type FeatureConfig = ReturnType<typeof envConfig.features>;

/**
 * Combined type for backward compatibility
 */
export type EnvConfig = CoreConfig & WordPressConfig & RedisConfig & SecurityConfig & PerformanceConfig & FeatureConfig;

/**
 * Export configuration categories for selective preloading
 */
export { ConfigCategory };
