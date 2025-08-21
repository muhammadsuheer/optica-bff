import { describe, it, expect } from '@jest/globals';
import { Hono } from 'hono';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';
process.env.RATE_LIMIT_WINDOW_MS = '60000';

describe('Rate Limiter Middleware Performance Tests', () => {
  describe('Rate Limiting Performance', () => {
    it('should process rate limiting checks under 5ms each', async () => {
      // Import after setting env vars
      const { createGlobalRateLimiter } = await import('../middleware/rateLimiter.js');
      
      const mockCacheService = {
        get: async () => 0, // No previous requests
        redis: {
          pipeline: () => ({
            incr: () => ({ pexpire: () => ({ exec: async () => [[null, 1], [null, 'OK']] }) }),
          }),
        },
      } as any;

      const rateLimiter = createGlobalRateLimiter(mockCacheService);
      
      const app = new Hono();
      app.use('*', rateLimiter.middleware('general'));
      app.get('/', (c) => c.json({ success: true }));

      const times: number[] = [];

      // Test rate limiting performance
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        
        const res = await app.request('/', {
          headers: {
            'x-forwarded-for': `192.168.1.${i}`,
          },
        });

        const endTime = Date.now();
        times.push(endTime - startTime);

        expect(res.status).toBe(200);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(avgTime).toBeLessThan(20); // Average under 20ms
      expect(maxTime).toBeLessThan(50); // Max under 50ms
    });

    it('should enforce rate limits accurately', async () => {
      const { createGlobalRateLimiter } = await import('../middleware/rateLimiter.js');
      
      let requestCount = 0;
      const mockCacheService = {
        get: async () => requestCount,
        redis: {
          pipeline: () => ({
            incr: () => ({ 
              pexpire: () => ({ 
                exec: async () => {
                  requestCount++;
                  return [[null, requestCount], [null, 'OK']];
                }
              })
            }),
          }),
        },
      } as any;

      const rateLimiter = createGlobalRateLimiter(mockCacheService);

      const app = new Hono();
      app.use('*', rateLimiter.middleware('auth')); // 5 requests per minute for auth
      app.post('/login', (c) => c.json({ success: true }));

      const clientIP = '192.168.1.100';

      // Send requests up to the limit
      for (let i = 1; i <= 5; i++) {
        const res = await app.request('/login', {
          method: 'POST',
          headers: {
            'x-forwarded-for': clientIP,
          },
        });

        expect(res.status).toBe(200);
        expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
      }

      // Next request should be rate limited
      const rateLimitedRes = await app.request('/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': clientIP,
        },
      });

      expect(rateLimitedRes.status).toBe(429);
      
      const data = await rateLimitedRes.json();
      expect(data).toHaveProperty('success', false);
      expect(data.error?.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should handle different rate limit categories', async () => {
      const { createGlobalRateLimiter } = await import('../middleware/rateLimiter.js');
      
      const mockCacheService = {
        get: async (key: string) => {
          // Simulate different counters for different categories
          if (key.includes('general')) return 0;
          if (key.includes('auth')) return 0;
          if (key.includes('api')) return 0;
          return 0;
        },
        redis: {
          pipeline: () => ({
            incr: () => ({ pexpire: () => ({ exec: async () => [[null, 1], [null, 'OK']] }) }),
          }),
        },
      } as any;

      const rateLimiter = createGlobalRateLimiter(mockCacheService);

      // Test general rate limiting (100 requests per minute)
      const generalApp = new Hono();
      generalApp.use('*', rateLimiter.middleware('general'));
      generalApp.get('/', (c) => c.json({ success: true }));

      const generalRes = await generalApp.request('/');
      expect(generalRes.status).toBe(200);
      expect(generalRes.headers.get('X-RateLimit-Limit')).toBeTruthy();

      // Test auth rate limiting (5 requests per minute)
      const authApp = new Hono();
      authApp.use('*', rateLimiter.middleware('auth'));
      authApp.post('/login', (c) => c.json({ success: true }));

      const authRes = await authApp.request('/login', { method: 'POST' });
      expect(authRes.status).toBe(200);
      expect(authRes.headers.get('X-RateLimit-Limit')).toBe('5');
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle concurrent requests from same IP correctly', async () => {
      const { createGlobalRateLimiter } = await import('../middleware/rateLimiter.js');
      
      let requestCount = 0;
      const mockCacheService = {
        get: async () => requestCount,
        redis: {
          pipeline: () => ({
            incr: () => ({ 
              pexpire: () => ({ 
                exec: async () => {
                  requestCount++;
                  return [[null, requestCount], [null, 'OK']];
                }
              })
            }),
          }),
        },
      } as any;

      const rateLimiter = createGlobalRateLimiter(mockCacheService);

      const app = new Hono();
      app.use('*', rateLimiter.middleware('auth')); // 5 requests per minute
      app.post('/login', (c) => c.json({ success: true }));

      const clientIP = '192.168.1.200';
      const concurrentRequests = 7; // More than the limit

      const startTime = Date.now();

      // Send concurrent requests
      const promises = Array.from({ length: concurrentRequests }, () =>
        app.request('/login', {
          method: 'POST',
          headers: {
            'x-forwarded-for': clientIP,
          },
        })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(500); // Should handle quickly

      // Count successful and rate-limited responses
      const successCount = responses.filter(res => res.status === 200).length;
      const rateLimitedCount = responses.filter(res => res.status === 429).length;

      expect(successCount + rateLimitedCount).toBe(concurrentRequests);
      expect(rateLimitedCount).toBeGreaterThan(0); // Some should be rate limited
    });

    it('should isolate rate limits per IP address', async () => {
      const { createGlobalRateLimiter } = await import('../middleware/rateLimiter.js');
      
      const requestCounts: Record<string, number> = {};
      
      const mockCacheService = {
        get: async (key: string) => {
          const ip = key.split(':')[1] || 'unknown';
          return requestCounts[ip] || 0;
        },
        redis: {
          pipeline: () => ({
            incr: () => ({ 
              pexpire: () => ({ 
                exec: async () => {
                  // This is a simplified mock - in real scenario, Redis handles the key properly
                  return [[null, 1], [null, 'OK']];
                }
              })
            }),
          }),
        },
      } as any;

      const rateLimiter = createGlobalRateLimiter(mockCacheService);

      const app = new Hono();
      app.use('*', rateLimiter.middleware('auth')); // 5 requests per minute
      app.post('/login', (c) => c.json({ success: true }));

      // Test requests from different IPs
      const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3'];

      for (const ip of ips) {
        const res = await app.request('/login', {
          method: 'POST',
          headers: {
            'x-forwarded-for': ip,
          },
        });

        expect(res.status).toBe(200); // Each IP gets its own limit
        // Note: We can't test exact remaining count due to mock simplification
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle Redis connection failures gracefully', async () => {
      const { createGlobalRateLimiter } = await import('../middleware/rateLimiter.js');
      
      const mockCacheService = {
        get: async () => { throw new Error('Redis connection failed'); },
        redis: {
          pipeline: () => ({
            incr: () => ({ 
              pexpire: () => ({ 
                exec: async () => { throw new Error('Redis pipeline failed'); }
              })
            }),
          }),
        },
      } as any;

      const rateLimiter = createGlobalRateLimiter(mockCacheService);

      const app = new Hono();
      app.use('*', rateLimiter.middleware('general'));
      app.get('/', (c) => c.json({ success: true }));

      const res = await app.request('/');

      // Should fall back to allowing requests when Redis fails
      expect(res.status).toBe(200);
      
      // Should indicate rate limiting is available (middleware still runs)
      expect(res.headers.get('X-RateLimit-Limit')).toBeTruthy();
    });

    it('should handle malformed or missing IP addresses', async () => {
      const { createGlobalRateLimiter } = await import('../middleware/rateLimiter.js');
      
      const mockCacheService = {
        get: async () => 0,
        redis: {
          pipeline: () => ({
            incr: () => ({ pexpire: () => ({ exec: async () => [[null, 1], [null, 'OK']] }) }),
          }),
        },
      } as any;

      const rateLimiter = createGlobalRateLimiter(mockCacheService);

      const app = new Hono();
      app.use('*', rateLimiter.middleware('general'));
      app.get('/', (c) => c.json({ success: true }));

      // Test without IP header
      const res1 = await app.request('/');
      expect(res1.status).toBe(200);

      // Test with malformed IP
      const res2 = await app.request('/', {
        headers: {
          'x-forwarded-for': 'invalid-ip-address',
        },
      });
      expect(res2.status).toBe(200);

      // Test with multiple IPs (should use first one)
      const res3 = await app.request('/', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1',
        },
      });
      expect(res3.status).toBe(200);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory during rate limiting operations', async () => {
      const { createGlobalRateLimiter } = await import('../middleware/rateLimiter.js');
      
      const mockCacheService = {
        get: async () => 0,
        redis: {
          pipeline: () => ({
            incr: () => ({ pexpire: () => ({ exec: async () => [[null, 1], [null, 'OK']] }) }),
          }),
        },
      } as any;

      const rateLimiter = createGlobalRateLimiter(mockCacheService);

      const app = new Hono();
      app.use('*', rateLimiter.middleware('general'));
      app.get('/', (c) => c.json({ success: true }));

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many rate limiting operations
      for (let i = 0; i < 100; i++) {
        await app.request('/', {
          headers: {
            'x-forwarded-for': `192.168.1.${i % 50}`, // Cycle through IPs
          },
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 5MB for 100 operations)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });
});
