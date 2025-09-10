import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env';
import { logger } from '../utils/logger';
// Main Supabase client
class SupabaseService {
    client;
    backupClients = [];
    currentClientIndex = 0;
    constructor() {
        // Primary client
        this.client = createClient(config.supabase.url, config.supabase.serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            },
            global: {
                headers: {
                    'User-Agent': 'Optia-BFF/1.0.0'
                }
            }
        });
        // Initialize backup clients if available
        config.supabase.backupUrls.forEach((url, index) => {
            if (url) {
                this.backupClients.push(createClient(url, config.supabase.serviceKey, {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false
                    },
                    global: {
                        headers: {
                            'User-Agent': `Optia-BFF/1.0.0 (backup-${index + 1})`
                        }
                    }
                }));
            }
        });
        logger.info('Supabase service initialized', { totalClients: this.backupClients.length + 1 });
    }
    // Get the current active client
    getClient() {
        return this.client;
    }
    // Execute operation with failover support
    async executeWithFailover(operation, maxRetries = 3) {
        const allClients = [this.client, ...this.backupClients];
        let lastError;
        for (let attempt = 0; attempt < maxRetries && attempt < allClients.length; attempt++) {
            const clientIndex = (this.currentClientIndex + attempt) % allClients.length;
            const client = allClients[clientIndex];
            try {
                const result = await operation(client);
                // Update current client if we switched
                if (clientIndex !== this.currentClientIndex) {
                    logger.info('Switched to backup Supabase client', { clientIndex });
                    this.currentClientIndex = clientIndex;
                    this.client = client;
                }
                return result;
            }
            catch (error) {
                lastError = error;
                logger.warn('Supabase client failed', { clientIndex, error: error.message });
                // Don't retry on authentication or permission errors
                if (error.message?.includes('JWT') || error.message?.includes('permission')) {
                    throw error;
                }
                continue;
            }
        }
        throw new Error(`All Supabase clients failed. Last error: ${lastError.message}`);
    }
    // Health check for all clients
    async healthCheck() {
        const allClients = [this.client, ...this.backupClients];
        const results = await Promise.allSettled(allClients.map(async (client, index) => {
            const start = Date.now();
            try {
                await client.from('products').select('count(*)').limit(1).single();
                return {
                    healthy: true,
                    latency: Date.now() - start,
                    index
                };
            }
            catch (error) {
                return {
                    healthy: false,
                    latency: Date.now() - start,
                    error: error.message,
                    index
                };
            }
        }));
        const primary = results[0].status === 'fulfilled'
            ? results[0].value
            : { healthy: false, latency: 0, error: 'Connection failed' };
        const backups = results.slice(1).map(result => result.status === 'fulfilled'
            ? result.value
            : { healthy: false, latency: 0, error: 'Connection failed' });
        return { primary, backups };
    }
    // Convenience methods for common operations
    async from(table) {
        return this.client.from(table);
    }
    async rpc(fn, args) {
        return this.executeWithFailover(async (client) => {
            const result = await client.rpc(fn, args);
            return result;
        });
    }
    // Transaction support
    async transaction(operations) {
        return this.executeWithFailover(operations);
    }
    // Realtime subscriptions
    channel(topic) {
        return this.client.channel(topic);
    }
    // Storage operations (if needed)
    get storage() {
        return this.client.storage;
    }
    // Auth operations (if needed)
    get auth() {
        return this.client.auth;
    }
}
// Create and export singleton instance
export const supabase = new SupabaseService();
// Export the raw client for direct access when needed
export const supabaseClient = supabase.getClient();
//# sourceMappingURL=supabase.js.map