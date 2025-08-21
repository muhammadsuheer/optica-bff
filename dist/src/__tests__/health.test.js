import { describe, it, expect } from '@jest/globals';
import { Hono } from 'hono';
// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.WP_GRAPHQL_ENDPOINT = 'https://test.com/graphql';
process.env.WP_BASE_URL = 'https://test.com';
process.env.WOO_CONSUMER_KEY = 'test_key';
process.env.WOO_CONSUMER_SECRET = 'test_secret';
process.env.WOO_STORE_API_URL = 'https://test.com/wp-json/wc/store/v1';
process.env.REDIS_URL = 'redis://localhost:6379';
describe('Health API Performance Tests', () => {
    describe('GET /health/live (Liveness Probe)', () => {
        it('should respond under 10ms with minimal checks', async () => {
            // Import after setting env vars
            const { createHealthRoutes } = await import('../routes/health.js');
            const mockCacheService = {
                healthCheck: async () => true,
            };
            const app = new Hono();
            app.route('/health', createHealthRoutes(mockCacheService));
            const startTime = Date.now();
            const res = await app.request('/health/live');
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            expect(responseTime).toBeLessThan(10); // Very fast liveness check
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data).toHaveProperty('status', 'ok');
            expect(data).toHaveProperty('timestamp');
            expect(data).toHaveProperty('service', 'optica-bff');
            // Verify response time header
            const responseTimeHeader = res.headers.get('X-Response-Time');
            expect(responseTimeHeader).toBeTruthy();
            expect(responseTimeHeader).toMatch(/^\d+ms$/);
        });
    });
    describe('GET /health/ready (Readiness Probe)', () => {
        it('should respond under 100ms with comprehensive checks', async () => {
            const { createHealthRoutes } = await import('../routes/health.js');
            const mockCacheService = {
                healthCheck: async () => true,
            };
            const app = new Hono();
            app.route('/health', createHealthRoutes(mockCacheService));
            const startTime = Date.now();
            const res = await app.request('/health/ready');
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            expect(responseTime).toBeLessThan(100); // Comprehensive but still fast
            expect([200, 503]).toContain(res.status); // May fail if dependencies are down
            const data = await res.json();
            expect(data).toHaveProperty('status');
            expect(data).toHaveProperty('timestamp');
            expect(data).toHaveProperty('service', 'optica-bff');
            if (res.status === 200) {
                expect(data).toHaveProperty('checks');
                expect(data.checks).toHaveProperty('cache');
            }
        });
    });
    describe('Health API Reliability', () => {
        it('should maintain consistent performance under load', async () => {
            const { createHealthRoutes } = await import('../routes/health.js');
            const mockCacheService = {
                healthCheck: async () => true,
            };
            const app = new Hono();
            app.route('/health', createHealthRoutes(mockCacheService));
            const iterations = 20;
            const liveTimes = [];
            // Test multiple iterations to check consistency
            for (let i = 0; i < iterations; i++) {
                // Test liveness
                const liveStart = Date.now();
                const liveRes = await app.request('/health/live');
                const liveTime = Date.now() - liveStart;
                liveTimes.push(liveTime);
                expect(liveRes.status).toBe(200);
            }
            // Analyze performance consistency
            const avgLiveTime = liveTimes.reduce((sum, time) => sum + time, 0) / iterations;
            const maxLiveTime = Math.max(...liveTimes);
            expect(avgLiveTime).toBeLessThan(15);
            expect(maxLiveTime).toBeLessThan(30);
            // Check for performance consistency (low standard deviation)
            const liveStdDev = Math.sqrt(liveTimes.reduce((sum, time) => sum + Math.pow(time - avgLiveTime, 2), 0) / iterations);
            expect(liveStdDev).toBeLessThan(10); // Low variation in response times
        });
        it('should handle concurrent requests efficiently', async () => {
            const { createHealthRoutes } = await import('../routes/health.js');
            const mockCacheService = {
                healthCheck: async () => true,
            };
            const app = new Hono();
            app.route('/health', createHealthRoutes(mockCacheService));
            const concurrentRequests = 20;
            const startTime = Date.now();
            // Send multiple concurrent liveness checks
            const promises = Array.from({ length: concurrentRequests }, () => app.request('/health/live'));
            const responses = await Promise.all(promises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            const avgTimePerRequest = totalTime / concurrentRequests;
            expect(totalTime).toBeLessThan(200); // Total time under 200ms
            expect(avgTimePerRequest).toBeLessThan(15); // Average time per request
            // All requests should succeed
            responses.forEach(res => {
                expect(res.status).toBe(200);
            });
        });
    });
    describe('Memory and Resource Management', () => {
        it('should not accumulate memory during health checks', async () => {
            const { createHealthRoutes } = await import('../routes/health.js');
            const mockCacheService = {
                healthCheck: async () => true,
            };
            const app = new Hono();
            app.route('/health', createHealthRoutes(mockCacheService));
            const initialMemory = process.memoryUsage().heapUsed;
            // Perform many health checks
            for (let i = 0; i < 50; i++) {
                await app.request('/health/live');
            }
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            // Memory increase should be minimal (less than 2MB for 50 requests)
            expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024);
        });
    });
    describe('Response Headers and Metadata', () => {
        it('should include proper monitoring headers', async () => {
            const { createHealthRoutes } = await import('../routes/health.js');
            const mockCacheService = {
                healthCheck: async () => true,
            };
            const app = new Hono();
            app.route('/health', createHealthRoutes(mockCacheService));
            const res = await app.request('/health/live');
            expect(res.status).toBe(200);
            // Verify essential headers
            expect(res.headers.get('Content-Type')).toContain('application/json');
            expect(res.headers.get('X-Response-Time')).toBeTruthy();
            const data = await res.json();
            expect(data.timestamp).toBeTruthy();
            expect(new Date(data.timestamp).getTime()).toBeCloseTo(Date.now(), -3); // Within 1 second
        });
    });
});
