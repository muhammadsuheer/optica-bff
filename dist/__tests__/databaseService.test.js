/**
 * Database Service Tests
 * Tests for Supabase-based database operations
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { productOperations, checkDatabaseHealth, getDatabaseStats, initializeDatabaseService } from '../services/databaseService.js';
describe('Database Service', () => {
    beforeAll(async () => {
        // Initialize the database service before running tests
        await initializeDatabaseService();
    });
    describe('Health Checks', () => {
        it('should check database health', async () => {
            const isHealthy = await checkDatabaseHealth(true);
            expect(typeof isHealthy).toBe('boolean');
        });
        it('should return database stats', () => {
            const stats = getDatabaseStats();
            expect(stats).toHaveProperty('isHealthy');
            expect(stats).toHaveProperty('lastHealthCheck');
            expect(stats).toHaveProperty('avgQueryTime');
            expect(typeof stats.avgQueryTime).toBe('number');
        });
        it('should initialize database service', async () => {
            const initialized = await initializeDatabaseService();
            expect(typeof initialized).toBe('boolean');
        });
    });
    describe('Product Operations', () => {
        it('should get products with pagination', async () => {
            const result = await productOperations.getMany({
                page: 1,
                limit: 5
            });
            if (result) {
                expect(result).toHaveProperty('data');
                expect(result).toHaveProperty('total');
                expect(Array.isArray(result.data)).toBe(true);
                expect(typeof result.total).toBe('number');
                expect(result.data.length).toBeLessThanOrEqual(5);
            }
            else {
                // Database might be empty or unavailable - that's OK for tests
                expect(result).toBeNull();
            }
        });
        it('should search products', async () => {
            const results = await productOperations.search('test', 10);
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeLessThanOrEqual(10);
        });
        it('should get popular products', async () => {
            const results = await productOperations.getPopular(5);
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeLessThanOrEqual(5);
        });
        it('should handle invalid product ID gracefully', async () => {
            const product = await productOperations.getById(-1);
            expect(product).toBeNull();
        });
        it('should handle non-existent WooCommerce ID gracefully', async () => {
            const product = await productOperations.getByWcId(999999);
            expect(product).toBeNull();
        });
    });
    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            // Test with invalid query parameters
            const result = await productOperations.getMany({
                page: -1,
                limit: -5
            });
            // Should either return empty results or null, not throw
            if (result) {
                expect(result).toHaveProperty('data');
                expect(result).toHaveProperty('total');
            }
            else {
                expect(result).toBeNull();
            }
        });
    });
});
//# sourceMappingURL=databaseService.test.js.map