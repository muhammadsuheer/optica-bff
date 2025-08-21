import { Hono } from 'hono';
import { syncService } from '../services/syncService.js';
import { logger } from '../utils/logger.js';
export const syncRoutes = new Hono();
/**
 * GET /sync/status - Get sync status and statistics
 */
syncRoutes.get('/status', async (c) => {
    try {
        const stats = await syncService.getSyncStats();
        const isRunning = syncService.isSyncRunning();
        return c.json({
            status: 'success',
            data: {
                isRunning,
                ...stats
            }
        });
    }
    catch (error) {
        logger.error('Failed to get sync status:', error);
        return c.json({
            status: 'error',
            message: 'Failed to get sync status'
        }, 500);
    }
});
/**
 * POST /sync/full - Start full synchronization
 */
syncRoutes.post('/full', async (c) => {
    try {
        const body = await c.req.json().catch(() => ({}));
        const options = {
            batchSize: body.batchSize || 50,
            delayBetweenBatches: body.delayBetweenBatches || 100,
            syncProducts: body.syncProducts !== false,
            syncCategories: body.syncCategories !== false,
            syncOrders: body.syncOrders !== false,
            syncCustomers: body.syncCustomers !== false
        };
        if (syncService.isSyncRunning()) {
            return c.json({
                status: 'error',
                message: 'Sync already in progress'
            }, 409);
        }
        // Start sync in background
        syncService.fullSync(options)
            .then((result) => {
            logger.info('Full sync completed:', result);
        })
            .catch((error) => {
            logger.error('Full sync failed:', error);
        });
        return c.json({
            status: 'success',
            message: 'Full sync started',
            data: { options }
        });
    }
    catch (error) {
        logger.error('Failed to start full sync:', error);
        return c.json({
            status: 'error',
            message: 'Failed to start full sync'
        }, 500);
    }
});
/**
 * POST /sync/incremental - Start incremental synchronization
 */
syncRoutes.post('/incremental', async (c) => {
    try {
        const body = await c.req.json().catch(() => ({}));
        const since = body.since ? new Date(body.since) : undefined;
        if (syncService.isSyncRunning()) {
            return c.json({
                status: 'error',
                message: 'Sync already in progress'
            }, 409);
        }
        // Start incremental sync in background
        syncService.incrementalSync(since)
            .then((result) => {
            logger.info('Incremental sync completed:', result);
        })
            .catch((error) => {
            logger.error('Incremental sync failed:', error);
        });
        return c.json({
            status: 'success',
            message: 'Incremental sync started',
            data: { since: since?.toISOString() }
        });
    }
    catch (error) {
        logger.error('Failed to start incremental sync:', error);
        return c.json({
            status: 'error',
            message: 'Failed to start incremental sync'
        }, 500);
    }
});
/**
 * POST /sync/products - Sync products only
 */
syncRoutes.post('/products', async (c) => {
    try {
        const body = await c.req.json().catch(() => ({}));
        const options = {
            batchSize: body.batchSize || 50,
            delayBetweenBatches: body.delayBetweenBatches || 100,
            since: body.since ? new Date(body.since) : undefined
        };
        const result = await syncService.syncProducts(options);
        return c.json({
            status: 'success',
            message: 'Product sync completed',
            data: result
        });
    }
    catch (error) {
        logger.error('Failed to sync products:', error);
        return c.json({
            status: 'error',
            message: 'Failed to sync products'
        }, 500);
    }
});
/**
 * POST /sync/categories - Sync categories only
 */
syncRoutes.post('/categories', async (c) => {
    try {
        const body = await c.req.json().catch(() => ({}));
        const options = {
            batchSize: body.batchSize || 100
        };
        const result = await syncService.syncCategories(options);
        return c.json({
            status: 'success',
            message: 'Category sync completed',
            data: result
        });
    }
    catch (error) {
        logger.error('Failed to sync categories:', error);
        return c.json({
            status: 'error',
            message: 'Failed to sync categories'
        }, 500);
    }
});
/**
 * POST /sync/orders - Sync orders only
 */
syncRoutes.post('/orders', async (c) => {
    try {
        const body = await c.req.json().catch(() => ({}));
        const options = {
            batchSize: body.batchSize || 50,
            since: body.since ? new Date(body.since) : undefined
        };
        const result = await syncService.syncOrders(options);
        return c.json({
            status: 'success',
            message: 'Order sync completed',
            data: result
        });
    }
    catch (error) {
        logger.error('Failed to sync orders:', error);
        return c.json({
            status: 'error',
            message: 'Failed to sync orders'
        }, 500);
    }
});
/**
 * POST /sync/customers - Sync customers only
 */
syncRoutes.post('/customers', async (c) => {
    try {
        const body = await c.req.json().catch(() => ({}));
        const options = {
            batchSize: body.batchSize || 100
        };
        const result = await syncService.syncCustomers(options);
        return c.json({
            status: 'success',
            message: 'Customer sync completed',
            data: result
        });
    }
    catch (error) {
        logger.error('Failed to sync customers:', error);
        return c.json({
            status: 'error',
            message: 'Failed to sync customers'
        }, 500);
    }
});
/**
 * POST /sync/products - Sync products specifically
 */
syncRoutes.post('/products', async (c) => {
    try {
        const body = await c.req.json().catch(() => ({}));
        const options = {
            batchSize: body.batchSize || 50,
            parallelBatches: body.parallelBatches || 3,
            force: body.force || false,
            includeCustomFields: body.includeCustomFields !== false
        };
        if (syncService.isSyncRunning()) {
            return c.json({
                status: 'error',
                message: 'Sync already in progress'
            }, 409);
        }
        // Start products sync
        const result = await syncService.syncProducts(options);
        return c.json({
            status: 'success',
            message: 'Products sync completed',
            data: result
        });
    }
    catch (error) {
        logger.error('Failed to sync products:', error);
        return c.json({
            status: 'error',
            message: 'Failed to sync products'
        }, 500);
    }
});
/**
 * POST /sync/categories - Sync categories specifically
 */
syncRoutes.post('/categories', async (c) => {
    try {
        const body = await c.req.json().catch(() => ({}));
        const options = {
            batchSize: body.batchSize || 100
        };
        if (syncService.isSyncRunning()) {
            return c.json({
                status: 'error',
                message: 'Sync already in progress'
            }, 409);
        }
        const result = await syncService.syncCategories(options);
        return c.json({
            status: 'success',
            message: 'Categories sync completed',
            data: result
        });
    }
    catch (error) {
        logger.error('Failed to sync categories:', error);
        return c.json({
            status: 'error',
            message: 'Failed to sync categories'
        }, 500);
    }
});
/**
 * POST /sync/orders - Sync orders specifically
 */
syncRoutes.post('/orders', async (c) => {
    try {
        const body = await c.req.json().catch(() => ({}));
        const options = {
            batchSize: body.batchSize || 50,
            since: body.since ? new Date(body.since) : undefined
        };
        if (syncService.isSyncRunning()) {
            return c.json({
                status: 'error',
                message: 'Sync already in progress'
            }, 409);
        }
        const result = await syncService.syncOrders(options);
        return c.json({
            status: 'success',
            message: 'Orders sync completed',
            data: result
        });
    }
    catch (error) {
        logger.error('Failed to sync orders:', error);
        return c.json({
            status: 'error',
            message: 'Failed to sync orders'
        }, 500);
    }
});
/**
 * POST /sync/initial - Initial full sync (replaces sync:initial CLI)
 */
syncRoutes.post('/initial', async (c) => {
    try {
        const body = await c.req.json().catch(() => ({}));
        const options = {
            batchSize: body.batchSize || 50,
            parallelBatches: body.parallelBatches || 3,
            syncProducts: body.syncProducts !== false,
            syncCategories: body.syncCategories !== false,
            syncOrders: body.syncOrders !== false,
            syncCustomers: body.syncCustomers !== false,
            resumeFromCheckpoint: body.resumeFromCheckpoint !== false
        };
        if (syncService.isSyncRunning()) {
            return c.json({
                status: 'error',
                message: 'Sync already in progress'
            }, 409);
        }
        // Start initial sync in background
        syncService.initialSync(options)
            .then((result) => {
            logger.info('Initial sync completed:', result);
        })
            .catch((error) => {
            logger.error('Initial sync failed:', error);
        });
        return c.json({
            status: 'success',
            message: 'Initial sync started',
            data: { options }
        });
    }
    catch (error) {
        logger.error('Failed to start initial sync:', error);
        return c.json({
            status: 'error',
            message: 'Failed to start initial sync'
        }, 500);
    }
});
