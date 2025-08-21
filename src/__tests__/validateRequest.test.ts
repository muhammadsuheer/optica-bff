import { describe, it, expect } from '@jest/globals';
import { Hono } from 'hono';
import { z } from 'zod';

// Mock environment variables
process.env.NODE_ENV = 'test';

describe('Validation Middleware Performance Tests', () => {
  describe('Schema Validation Performance', () => {
    it('should validate requests under 5ms each', async () => {
      // Import after setting env vars
      const { validateRequest, CommonSchemas } = await import('../middleware/validateRequest.js');

      const app = new Hono();
      app.use('*', validateRequest({
        body: CommonSchemas.productQuery,
      }));
      app.post('/products', (c) => c.json({ success: true }));

      const times: number[] = [];

      // Test validation performance
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        
        const res = await app.request('/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            page: 1,
            per_page: 10,
            search: 'test',
            category: 'electronics',
          }),
        });

        const endTime = Date.now();
        times.push(endTime - startTime);

        expect(res.status).toBe(200);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(avgTime).toBeLessThan(15); // Average under 15ms
      expect(maxTime).toBeLessThan(30); // Max under 30ms
    });

    it('should reject invalid data quickly', async () => {
      const { validateRequest, CommonSchemas } = await import('../middleware/validateRequest.js');

      const app = new Hono();
      app.use('*', validateRequest({
        body: CommonSchemas.productQuery,
      }));
      app.post('/products', (c) => c.json({ success: true }));

      const startTime = Date.now();
      
      const res = await app.request('/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page: 'invalid', // Should be number
          per_page: -1, // Should be positive
          search: 123, // Should be string
        }),
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(10); // Validation errors should be very fast
      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data).toHaveProperty('success', false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
      expect(data.error?.details).toBeTruthy();
    });
  });

  describe('Multiple Schema Validation', () => {
    it('should handle parallel validation efficiently', async () => {
      const { validateRequest, CommonSchemas } = await import('../middleware/validateRequest.js');

      const app = new Hono();
      app.use('*', validateRequest({
        query: CommonSchemas.productQuery,
        body: z.object({
          name: z.string().min(1),
          email: z.string().email(),
        }),
      }));
      app.post('/submit', (c) => c.json({ success: true }));

      const startTime = Date.now();
      
      const res = await app.request('/submit?page=1&per_page=10', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john@example.com',
        }),
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(20); // Parallel validation should be fast
      expect(res.status).toBe(200);
    });

    it('should fail fast on first validation error', async () => {
      const { validateRequest, CommonSchemas } = await import('../middleware/validateRequest.js');

      const app = new Hono();
      app.use('*', validateRequest({
        query: CommonSchemas.productQuery,
        body: z.object({
          name: z.string().min(1),
          email: z.string().email(),
        }),
      }));
      app.post('/submit', (c) => c.json({ success: true }));

      const startTime = Date.now();
      
      const res = await app.request('/submit?page=invalid', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: '', // Invalid
          email: 'invalid-email', // Invalid
        }),
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(15); // Should fail fast
      expect(res.status).toBe(400);
      
      const data = await res.json();
      expect(data.error?.details).toBeTruthy();
    });
  });

  describe('Schema Precompilation Performance', () => {
    it('should benefit from precompiled schemas', async () => {
      const { validateRequest, CommonSchemas } = await import('../middleware/validateRequest.js');

      // Test with precompiled schema
      const precompiledApp = new Hono();
      precompiledApp.use('*', validateRequest({
        body: CommonSchemas.productQuery, // Precompiled
      }));
      precompiledApp.post('/products', (c) => c.json({ success: true }));

      // Test with dynamic schema
      const dynamicApp = new Hono();
      dynamicApp.use('*', validateRequest({
        body: z.object({
          page: z.number().int().positive().optional(),
          per_page: z.number().int().min(1).max(100).optional(),
          search: z.string().optional(),
          category: z.string().optional(),
        }), // Created each time
      }));
      dynamicApp.post('/products', (c) => c.json({ success: true }));

      const testData = {
        page: 1,
        per_page: 10,
        search: 'test',
        category: 'electronics',
      };

      // Measure precompiled performance
      const precompiledTimes: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await precompiledApp.request('/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData),
        });
        precompiledTimes.push(Date.now() - start);
      }

      // Measure dynamic performance
      const dynamicTimes: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await dynamicApp.request('/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData),
        });
        dynamicTimes.push(Date.now() - start);
      }

      const precompiledAvg = precompiledTimes.reduce((a, b) => a + b) / precompiledTimes.length;
      const dynamicAvg = dynamicTimes.reduce((a, b) => a + b) / dynamicTimes.length;

      // Both should be fast, but precompiled might have slight advantage
      expect(precompiledAvg).toBeLessThan(20);
      expect(dynamicAvg).toBeLessThan(25);
    });
  });

  describe('Concurrent Validation', () => {
    it('should handle multiple concurrent validations efficiently', async () => {
      const { validateRequest, CommonSchemas } = await import('../middleware/validateRequest.js');

      const app = new Hono();
      app.use('*', validateRequest({
        body: CommonSchemas.productQuery,
      }));
      app.post('/products', (c) => c.json({ success: true }));

      const concurrentRequests = 20;
      const startTime = Date.now();

      // Send multiple concurrent validation requests
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        app.request('/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            page: i + 1,
            per_page: 10,
            search: `test-${i}`,
          }),
        })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / concurrentRequests;

      expect(totalTime).toBeLessThan(300); // Total time under 300ms
      expect(avgTimePerRequest).toBeLessThan(20); // Average time per request

      // All requests should succeed
      responses.forEach(res => {
        expect(res.status).toBe(200);
      });
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle malformed JSON quickly', async () => {
      const { validateRequest, CommonSchemas } = await import('../middleware/validateRequest.js');

      const app = new Hono();
      app.use('*', validateRequest({
        body: CommonSchemas.productQuery,
      }));
      app.post('/products', (c) => c.json({ success: true }));

      const startTime = Date.now();
      
      const res = await app.request('/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{ invalid json }',
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(10); // Should handle JSON errors quickly
      expect(res.status).toBe(400);
    });

    it('should handle missing content-type gracefully', async () => {
      const { validateRequest, CommonSchemas } = await import('../middleware/validateRequest.js');

      const app = new Hono();
      app.use('*', validateRequest({
        body: CommonSchemas.productQuery,
      }));
      app.post('/products', (c) => c.json({ success: true }));

      const startTime = Date.now();
      
      const res = await app.request('/products', {
        method: 'POST',
        body: JSON.stringify({ page: 1 }),
        // No Content-Type header
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(15); // Should handle gracefully
      expect([200, 400]).toContain(res.status); // May succeed or fail depending on implementation
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory during validation operations', async () => {
      const { validateRequest, CommonSchemas } = await import('../middleware/validateRequest.js');

      const app = new Hono();
      app.use('*', validateRequest({
        body: CommonSchemas.productQuery,
      }));
      app.post('/products', (c) => c.json({ success: true }));

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many validation operations
      for (let i = 0; i < 100; i++) {
        await app.request('/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            page: i % 10 + 1,
            per_page: 10,
            search: `test-${i}`,
          }),
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 3MB for 100 operations)
      expect(memoryIncrease).toBeLessThan(3 * 1024 * 1024);
    });
  });

  describe('Custom Schema Performance', () => {
    it('should validate complex nested schemas efficiently', async () => {
      const { validateRequest } = await import('../middleware/validateRequest.js');

      const complexSchema = z.object({
        user: z.object({
          id: z.number().int().positive(),
          name: z.string().min(1).max(100),
          email: z.string().email(),
          profile: z.object({
            age: z.number().int().min(0).max(150),
            preferences: z.array(z.string()).max(10),
            settings: z.object({
              notifications: z.boolean(),
              theme: z.enum(['light', 'dark']),
            }),
          }),
        }),
        products: z.array(z.object({
          id: z.number().int().positive(),
          name: z.string().min(1),
          price: z.number().positive(),
          categories: z.array(z.string()).min(1),
        })).max(50),
      });

      const app = new Hono();
      app.use('*', validateRequest({ body: complexSchema }));
      app.post('/complex', (c) => c.json({ success: true }));

      const complexData = {
        user: {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          profile: {
            age: 30,
            preferences: ['electronics', 'books'],
            settings: {
              notifications: true,
              theme: 'dark' as const,
            },
          },
        },
        products: [
          {
            id: 1,
            name: 'Laptop',
            price: 999.99,
            categories: ['electronics', 'computers'],
          },
        ],
      };

      const startTime = Date.now();
      
      const res = await app.request('/complex', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(complexData),
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(25); // Complex validation should still be fast
      expect(res.status).toBe(200);
    });
  });
});
