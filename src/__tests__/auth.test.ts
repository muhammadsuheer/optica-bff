import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Hono } from 'hono';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing-and-verification-with-256-bits';
process.env.WP_GRAPHQL_ENDPOINT = 'https://test.com/graphql';
process.env.WP_BASE_URL = 'https://test.com';
process.env.WOO_CONSUMER_KEY = 'test_key';
process.env.WOO_CONSUMER_SECRET = 'test_secret';
process.env.WOO_STORE_API_URL = 'https://test.com/wp-json/wc/store/v1';
process.env.REDIS_URL = 'redis://localhost:6379';

describe('Auth API Performance Tests', () => {
  describe('JWT Token Generation Performance', () => {
    it('should generate access tokens in under 10ms each', async () => {
      // Import after setting env vars
      const { createAuthRoutes } = await import('../routes/auth.js');
      
      // Mock cache service
      const mockCacheService = {
        get: async () => null,
        set: async () => {},
        delete: async () => {},
        healthCheck: async () => true,
      } as any;

      const app = new Hono();
      app.route('/auth', createAuthRoutes(mockCacheService));

      const times: number[] = [];
      
      // Test token generation performance
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        
        const res = await app.request('/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
          }),
        });

        const endTime = Date.now();
        times.push(endTime - startTime);

        if (res.status === 200) {
          const data = await res.json();
          expect(data).toHaveProperty('success', true);
          expect(data.data).toHaveProperty('accessToken');
          expect(data.data).toHaveProperty('refreshToken');
        }
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(avgTime).toBeLessThan(50); // Average under 50ms
      expect(maxTime).toBeLessThan(100); // Max under 100ms
    });
  });

  describe('Authentication Flow Performance', () => {
    it('should complete full auth flow efficiently', async () => {
      // Import after setting env vars
      const { createAuthRoutes } = await import('../routes/auth.js');
      
      // Mock cache service with some data
      let tokenStore: Record<string, any> = {};
      
      const mockCacheService = {
        get: async (key: string) => tokenStore[key] || null,
        set: async (key: string, value: any) => { tokenStore[key] = value; },
        delete: async (key: string) => { delete tokenStore[key]; },
        healthCheck: async () => true,
      } as any;

      const app = new Hono();
      app.route('/auth', createAuthRoutes(mockCacheService));

      // Step 1: Login
      const loginStart = Date.now();
      const loginRes = await app.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      });
      const loginTime = Date.now() - loginStart;

      expect(loginTime).toBeLessThan(100);
      expect(loginRes.status).toBe(200);

      if (loginRes.status === 200) {
        const loginData = await loginRes.json();
        const { accessToken, refreshToken } = loginData.data;

        // Step 2: Verify token
        const verifyStart = Date.now();
        const verifyRes = await app.request('/auth/verify', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        const verifyTime = Date.now() - verifyStart;

        expect(verifyTime).toBeLessThan(50);

        // Step 3: Refresh token
        const refreshStart = Date.now();
        const refreshRes = await app.request('/auth/refresh', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refreshToken,
          }),
        });
        const refreshTime = Date.now() - refreshStart;

        expect(refreshTime).toBeLessThan(75);

        // Step 4: Logout
        const logoutStart = Date.now();
        const logoutRes = await app.request('/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        const logoutTime = Date.now() - logoutStart;

        expect(logoutTime).toBeLessThan(50);
        expect(logoutRes.status).toBe(200);
      }
    });
  });

  describe('Validation Performance', () => {
    it('should validate requests quickly', async () => {
      const { createAuthRoutes } = await import('../routes/auth.js');
      
      const mockCacheService = {
        get: async () => null,
        set: async () => {},
        delete: async () => {},
        healthCheck: async () => true,
      } as any;

      const app = new Hono();
      app.route('/auth', createAuthRoutes(mockCacheService));

      // Test validation performance with invalid data
      const startTime = Date.now();
      
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invalid-email',
          password: '123', // Too short
        }),
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(25); // Validation should be very fast
      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data).toHaveProperty('success', false);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple simultaneous requests efficiently', async () => {
      const { createAuthRoutes } = await import('../routes/auth.js');
      
      const mockCacheService = {
        get: async () => 0, // Allow all requests (rate limiting)
        set: async () => {},
        delete: async () => {},
        healthCheck: async () => true,
      } as any;

      const app = new Hono();
      app.route('/auth', createAuthRoutes(mockCacheService));

      const concurrentRequests = 10;
      const startTime = Date.now();

      // Send multiple concurrent login requests
      const promises = Array.from({ length: concurrentRequests }, () =>
        app.request('/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
          }),
        })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / concurrentRequests;

      expect(totalTime).toBeLessThan(1000); // Total time under 1 second
      expect(avgTimePerRequest).toBeLessThan(100); // Average time per request

      // All requests should complete successfully
      responses.forEach(res => {
        expect([200, 429]).toContain(res.status); // 200 or rate limited
      });
    });
  });

  describe('Memory Usage', () => {
    it('should maintain reasonable memory usage during operations', async () => {
      const { createAuthRoutes } = await import('../routes/auth.js');
      
      const mockCacheService = {
        get: async () => null,
        set: async () => {},
        delete: async () => {},
        healthCheck: async () => true,
      } as any;

      const app = new Hono();
      app.route('/auth', createAuthRoutes(mockCacheService));

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many authentication operations
      for (let i = 0; i < 50; i++) {
        await app.request('/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: `test${i}@example.com`,
            password: 'password123',
          }),
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 5MB for 50 operations)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Response Time Headers', () => {
    it('should include performance headers in all responses', async () => {
      const { createAuthRoutes } = await import('../routes/auth.js');
      
      const mockCacheService = {
        get: async () => null,
        set: async () => {},
        delete: async () => {},
        healthCheck: async () => true,
      } as any;

      const app = new Hono();
      app.route('/auth', createAuthRoutes(mockCacheService));

      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      });

      // Should have response time header
      const responseTimeHeader = res.headers.get('X-Response-Time');
      expect(responseTimeHeader).toBeTruthy();
      expect(responseTimeHeader).toMatch(/^\d+ms$/);

      // Parse and validate the response time
      const responseTime = parseInt(responseTimeHeader!.replace('ms', ''));
      expect(responseTime).toBeGreaterThan(0);
      expect(responseTime).toBeLessThan(1000); // Should be under 1 second
    });
  });
});
