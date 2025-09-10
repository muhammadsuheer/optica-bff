/**
 * Sync Service - Edge Runtime Compatible
 *
 * Features:
 * - WooCommerce to local database synchronization
 * - Bidirectional sync support
 * - Conflict resolution
 * - Batch processing
 * - Progress tracking
 */
export interface SyncOptions {
    batchSize?: number;
    force?: boolean;
    direction?: 'from_wc' | 'to_wc' | 'bidirectional';
    entityTypes?: Array<'products' | 'orders' | 'customers'>;
    dryRun?: boolean;
}
export interface SyncResult {
    success: boolean;
    totalProcessed: number;
    totalSynced: number;
    totalFailed: number;
    totalSkipped: number;
    errors: Array<{
        entity: string;
        entityId: string | number;
        error: string;
    }>;
    duration: number;
    timestamp: string;
}
export interface SyncProgress {
    entityType: string;
    total: number;
    processed: number;
    synced: number;
    failed: number;
    skipped: number;
    currentBatch: number;
    totalBatches: number;
    isComplete: boolean;
    errors: string[];
}
declare class SyncService {
    private isRunning;
    private currentProgress;
    /**
     * Check if sync is currently running
     */
    isSyncRunning(): boolean;
    /**
     * Get current sync progress
     */
    getCurrentProgress(): SyncProgress | null;
    /**
     * Sync products from WooCommerce to local database
     */
    syncProductsFromWooCommerce(options?: SyncOptions): Promise<SyncResult>;
    /**
     * Sync orders from WooCommerce to local database
     */
    syncOrdersFromWooCommerce(options?: SyncOptions): Promise<SyncResult>;
    /**
     * Full synchronization (products + orders)
     */
    fullSync(options?: SyncOptions): Promise<{
        products: SyncResult;
        orders: SyncResult;
        overall: {
            success: boolean;
            totalDuration: number;
            totalProcessed: number;
            totalSynced: number;
            totalFailed: number;
        };
    }>;
    /**
     * Get WooCommerce product count
     */
    private getWooCommerceProductCount;
    /**
     * Get WooCommerce order count
     */
    private getWooCommerceOrderCount;
    /**
     * Health check
     */
    healthCheck(): Promise<{
        healthy: boolean;
        latency: number;
        error?: string;
    }>;
}
export declare const syncService: SyncService;
export { SyncService };
export type { SyncOptions, SyncResult, SyncProgress };
//# sourceMappingURL=syncService.d.ts.map