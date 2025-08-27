/**
 * Database Service - Ultra-High Performance PostgreSQL Integration
 * 
 * Features:
 * - Connection pooling with health monitoring
 * - Database-agnostic design with Prisma
 * - Comprehensive error handling and fallbacks
 * - Performance monitoring and metrics
 * - Graceful degradation patterns
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { envConfig } from '../config/env.js';

// Global Prisma instance with optimized configuration
let prisma: PrismaClient | null = null;

// Database health status
let isHealthy = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// Performance monitoring
const dbStats = {
  connectionAttempts: 0,
  successfulConnections: 0,
  failedConnections: 0,
  healthChecks: 0,
  avgQueryTime: 0,
  lastError: null as string | null,
};

/**
 * Initialize Prisma client with optimized configuration
 */
export function initializePrisma(): PrismaClient {
  if (prisma) {
    return prisma;
  }

  logger.debug('Initializing Prisma client...');
  
  try {
    prisma = new PrismaClient({
      log: [
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
      datasources: {
        db: {
          url: envConfig.database?.DATABASE_URL || process.env.DATABASE_URL,
        },
      },
      // Optimize for Supabase connection limits
      connectionLimit: envConfig.database?.PGPOOLSIZE || 10,
    });

    // Error event handling
    (prisma as any).$on('error', (event: any) => {
      logger.error('Prisma error:', new Error(event.message || event.toString()));
      dbStats.lastError = event.message;
      isHealthy = false;
    });

    // Warning event handling
    (prisma as any).$on('warn', (event: any) => {
      logger.warn('Prisma warning:', { event: event.message || event.toString() });
    });

    dbStats.connectionAttempts++;
    logger.info('Prisma client initialized successfully');
    
    return prisma;
  } catch (error) {
    dbStats.failedConnections++;
    dbStats.lastError = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to initialize Prisma client:', error as Error);
    throw error;
  }
}

/**
 * Get the Prisma client instance
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    return initializePrisma();
  }
  return prisma;
}

/**
 * Check database health with caching
 */
export async function checkDatabaseHealth(forceCheck = false): Promise<boolean> {
  const now = Date.now();
  
  // Use cached result if recent and not forced
  if (!forceCheck && (now - lastHealthCheck) < HEALTH_CHECK_INTERVAL && isHealthy) {
    return isHealthy;
  }

  try {
    const client = getPrismaClient();
    const startTime = Date.now();
    
    // Simple health check query
    await client.$queryRaw`SELECT 1`;
    
    const queryTime = Date.now() - startTime;
    dbStats.avgQueryTime = (dbStats.avgQueryTime + queryTime) / 2;
    dbStats.healthChecks++;
    dbStats.successfulConnections++;
    
    isHealthy = true;
    lastHealthCheck = now;
    
    logger.debug(`Database health check passed (${queryTime}ms)`);
    return true;
  } catch (error) {
    dbStats.failedConnections++;
    dbStats.lastError = error instanceof Error ? error.message : 'Health check failed';
    isHealthy = false;
    lastHealthCheck = now;
    
    logger.error('Database health check failed:', error as Error);
    return false;
  }
}

/**
 * Execute database operation with error handling and fallback
 */
export async function executeWithFallback<T>(
  operation: () => Promise<T>,
  fallback?: () => Promise<T>
): Promise<T | null> {
  try {
    // Check database health first
    const healthy = await checkDatabaseHealth();
    if (!healthy && fallback) {
      logger.warn('Database unhealthy, using fallback');
      return await fallback();
    }

    const startTime = Date.now();
    const result = await operation();
    const queryTime = Date.now() - startTime;
    
    // Update performance stats
    dbStats.avgQueryTime = (dbStats.avgQueryTime + queryTime) / 2;
    
    return result;
  } catch (error) {
    logger.error('Database operation failed:', error as Error);
    dbStats.lastError = error instanceof Error ? error.message : 'Unknown error';
    
    // Try fallback if available
    if (fallback) {
      try {
        logger.debug('Attempting fallback operation...');
        return await fallback();
      } catch (fallbackError) {
        logger.error('Fallback operation also failed:', fallbackError as Error);
      }
    }
    
    return null;
  }
}

/**
 * Get database performance statistics
 */
export function getDatabaseStats() {
  return {
    ...dbStats,
    isHealthy,
    lastHealthCheck: new Date(lastHealthCheck).toISOString(),
    healthCheckAge: Date.now() - lastHealthCheck,
  };
}

/**
 * Close database connection gracefully
 */
export async function closeDatabaseConnection(): Promise<void> {
  if (prisma) {
    try {
      await prisma.$disconnect();
      logger.info('Database connection closed gracefully');
    } catch (error) {
      logger.error('Error closing database connection:', error as Error);
    } finally {
      prisma = null;
      isHealthy = false;
    }
  }
}

/**
 * Database transaction wrapper with error handling
 */
export async function withTransaction<T>(
  operation: (tx: any) => Promise<T>
): Promise<T | null> {
  const client = getPrismaClient();
  const slowThresholdMs = Number(process.env.DB_SLOW_MS || 200);
  
  try {
    return await client.$transaction(async (tx: any) => {
      const start = performance.now();
      const result = await operation(tx);
      const dur = performance.now() - start;
      if (dur > slowThresholdMs) {
        logger.warn('slow_transaction', { duration_ms: Math.round(dur), threshold_ms: slowThresholdMs });
      }
      return result;
    });
  } catch (error) {
    logger.error('Transaction failed:', error as Error);
    dbStats.lastError = error instanceof Error ? error.message : 'Transaction failed';
    return null;
  }
}

/**
 * Initialize database service and run initial health check
 */
export async function initializeDatabaseService(): Promise<boolean> {
  try {
    logger.info('Initializing database service...');
    
    // Initialize Prisma client
    initializePrisma();
    
    // Run initial health check
    const healthy = await checkDatabaseHealth(true);
    
    if (healthy) {
      logger.info('Database service initialized successfully');
      // Start periodic health checks
      setInterval(() => {
        checkDatabaseHealth().catch(err => logger.error('Health check failed:', err as Error));
      }, HEALTH_CHECK_INTERVAL);
    } else {
      logger.warn('Database service initialized but database is not healthy');
    }
    
    return healthy;
  } catch (error) {
    logger.error('Failed to initialize database service:', error as Error);
    return false;
  }
}

/**
 * Get a single product by ID with optimized query
 */
// Minimal representation of product row used by BFF (numbers coerced from Prisma Decimal)
export interface DbProductLite {
  id: number;
  woocommerce_id: number; // non-null per schema (unique)
  name: string;
  description: string | null;
  price: number | null;      // coerced
  sale_price: number | null; // coerced
  stock_quantity: number | null;
  status: string;
  categories: any; // TODO: refine categories relation type
  images: any;     // TODO: refine image relation type
  meta_data: any;  // TODO: refine meta_data structure
  date_created: Date;
  date_modified: Date;
}

export async function getProduct(id: number): Promise<DbProductLite | null> {
  return executeWithFallback(async () => {
    const client = getPrismaClient();
  const row = await client.cachedProduct.findUnique({
      where: { id },
      select: {
        id: true,
        woocommerce_id: true,
        name: true,
        description: true,
        price: true,
        sale_price: true,
        stock_quantity: true,
        status: true,
        category_ids: true,
        images: true,
        metadata: true,
        cached_at: true,
        expires_at: true
      }
    });
    if (!row) return null;
    return {
      ...row,
      woocommerce_id: row.woocommerce_id == null ? null : Number(row.woocommerce_id),
      price: row.price == null ? null : Number(row.price),
      sale_price: row.sale_price == null ? null : Number(row.sale_price),
      categories: row.category_ids ? JSON.parse(row.category_ids) : [],
      meta_data: row.metadata || {},
      date_created: row.cached_at,
      date_modified: row.cached_at
    } as DbProductLite;
  });
}

/**
 * Get popular products for cache warmup
 */
export interface DbPopularProduct { id: number; woocommerce_id: number | null; name: string; sku: string | null; price: number | null; }

export async function getPopularProducts(limit = 100): Promise<DbPopularProduct[]> {
  const result = await executeWithFallback(async () => {
    const client = getPrismaClient();
    const rows = await client.cachedProduct.findMany({
      take: limit,
      where: { status: 'publish' },
      orderBy: [ { cached_at: 'desc' } ],
      select: { id: true, woocommerce_id: true, name: true, price: true }
    });
    return rows.map((r: any) => ({
      id: r.id,
      woocommerce_id: r.woocommerce_id ?? null,
      name: r.name,
      sku: r.sku,
      price: r.price == null ? null : Number(r.price)
    })) as DbPopularProduct[];
  }, async () => {
    // Fallback: return some mock popular products
    logger.warn('Using fallback popular products');
  const mockProducts: DbPopularProduct[] = Array.from({ length: Math.min(limit, 20) }, (_, i) => ({
      id: i + 1,
      woocommerce_id: i + 1,
      name: `Popular Product ${i + 1}`,
      sku: `POPULAR-${i + 1}`,
      price: null
    }));
    return mockProducts;
  });
  return result || [];
}

// Export Prisma client for direct access when needed
export { prisma };
export default {
  initializePrisma,
  getPrismaClient,
  checkDatabaseHealth,
  executeWithFallback,
  getDatabaseStats,
  closeDatabaseConnection,
  withTransaction,
  initializeDatabaseService,
  getProduct,
  getPopularProducts,
};
