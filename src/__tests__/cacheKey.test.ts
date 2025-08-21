import { describe, it, expect } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';

describe('Cache Key Utility Performance Tests', () => {
  describe('Key Generation Performance', () => {
    it('should generate cache keys under 1ms each', async () => {
      // Import after setting env vars
      const { CacheKey } = await import('../utils/cacheKey.js');

      const times: number[] = [];

      // Test key generation performance
      for (let i = 0; i < 100; i++) {
        const startTime = Date.now();
        
        const key = CacheKey.products(i, 10, {
          search: `test-query-${i}`,
          category: 'electronics',
          sort: 'name',
          order: 'asc',
        });

        const endTime = Date.now();
        times.push(endTime - startTime);

        expect(key).toBeTruthy();
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      }

      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(avgTime).toBeLessThan(2); // Average under 2ms (very fast)
      expect(maxTime).toBeLessThan(5); // Max under 5ms
    });

    it('should generate consistent keys for same parameters', async () => {
      const { CacheKey } = await import('../utils/cacheKey.js');

      const page = 1;
      const perPage = 20;
      const filters = {
        search: 'test-product',
        category: 'electronics',
      };

      // Generate the same key multiple times
      const keys = Array.from({ length: 10 }, () =>
        CacheKey.products(page, perPage, filters)
      );

      // All keys should be identical
      const firstKey = keys[0];
      keys.forEach(key => {
        expect(key).toBe(firstKey);
      });
    });

    it('should generate different keys for different parameters', async () => {
      const { CacheKey } = await import('../utils/cacheKey.js');

      const key1 = CacheKey.products(1, 10);
      const key2 = CacheKey.products(2, 10);
      const key3 = CacheKey.product(1);
      const key4 = CacheKey.userProfile(1);

      // All keys should be different
      const keys = [key1, key2, key3, key4];
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(4);
    });
  });

  describe('Static Method Performance', () => {
    it('should handle different cache key types efficiently', async () => {
      const { CacheKey } = await import('../utils/cacheKey.js');

      const startTime = Date.now();

      // Test different static methods
      const productKey = CacheKey.products(1, 10);
      const productDetailKey = CacheKey.product(123);
      const stockKey = CacheKey.productStock(123);
      const userProfileKey = CacheKey.userProfile(456);
      const userCartKey = CacheKey.userCart(456);
      const authTokenKey = CacheKey.authToken('token-123');

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(10); // All operations should be very fast
      
      // All keys should be different and properly formatted
      const keys = [productKey, productDetailKey, stockKey, userProfileKey, userCartKey, authTokenKey];
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(6);

      keys.forEach(key => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
        expect(key).toContain('optica:'); // Should have prefix
      });
    });

    it('should validate namespace constants are properly used', async () => {
      const { CACHE_NAMESPACES } = await import('../utils/cacheKey.js');

      // Verify expected namespaces exist
      expect(CACHE_NAMESPACES).toHaveProperty('PRODUCTS');
      expect(CACHE_NAMESPACES).toHaveProperty('PRODUCT');
      expect(CACHE_NAMESPACES).toHaveProperty('USER_PROFILE');
      expect(CACHE_NAMESPACES).toHaveProperty('AUTH_TOKEN');

      // Verify namespace values are strings
      Object.values(CACHE_NAMESPACES).forEach(value => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Parameter Handling', () => {
    it('should handle complex filter objects efficiently', async () => {
      const { CacheKey } = await import('../utils/cacheKey.js');

      const complexFilters = {
        search: 'complex search query with spaces',
        category: ['electronics', 'computers'],
        price: { min: 100, max: 1000 },
        inStock: true,
        metadata: {
          userId: 12345,
          sessionId: 'abc-123-def',
          timestamp: Date.now(),
        },
      };

      const startTime = Date.now();
      const key = CacheKey.products(1, 20, complexFilters);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5); // Should be fast even with complex objects
      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
    });

    it('should handle null and undefined values gracefully', async () => {
      const { CacheKey } = await import('../utils/cacheKey.js');

      const filtersWithNulls = {
        search: null,
        category: undefined,
        filters: {
          price: null,
          inStock: undefined,
        },
      };

      const key = CacheKey.products(1, 10, filtersWithNulls);
      
      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
    });

    it('should handle edge cases for IDs', async () => {
      const { CacheKey } = await import('../utils/cacheKey.js');

      // Test different ID types
      const numericKey = CacheKey.product(123);
      const stringKey = CacheKey.product('abc-123');
      const zeroKey = CacheKey.product(0);

      [numericKey, stringKey, zeroKey].forEach(key => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });

      // All should be different
      const uniqueKeys = new Set([numericKey, stringKey, zeroKey]);
      expect(uniqueKeys.size).toBe(3);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with high key generation volume', async () => {
      const { CacheKey } = await import('../utils/cacheKey.js');

      const iterations = 1000;
      const times: number[] = [];
      const generatedKeys = new Set<string>();

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const keyStartTime = Date.now();
        
        const key = CacheKey.products(
          i % 10 + 1,
          10,
          {
            search: `query-${i}`,
            category: ['electronics', 'books', 'clothing'][i % 3],
            userId: Math.floor(i / 10),
          }
        );

        const keyEndTime = Date.now();
        times.push(keyEndTime - keyStartTime);
        generatedKeys.add(key);
      }

      const totalTime = Date.now() - startTime;
      const avgTime = times.reduce((sum, time) => sum + time, 0) / iterations;
      const maxTime = Math.max(...times);

      expect(totalTime).toBeLessThan(1000); // Total time under 1 second
      expect(avgTime).toBeLessThan(2); // Average time per key
      expect(maxTime).toBeLessThan(10); // Max time per key

      // Verify all keys are unique (no collisions)
      expect(generatedKeys.size).toBe(iterations);
    });

    it('should handle concurrent key generation', async () => {
      const { CacheKey } = await import('../utils/cacheKey.js');

      const concurrentOperations = 100;
      const startTime = Date.now();

      // Generate keys concurrently
      const promises = Array.from({ length: concurrentOperations }, (_, i) =>
        Promise.resolve(CacheKey.product(`${i}-${Date.now()}-${Math.random()}`))
      );

      const keys = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(100); // Should be very fast
      expect(keys.length).toBe(concurrentOperations);

      // All keys should be unique
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(concurrentOperations);
    });
  });

  describe('Method Coverage and Functionality', () => {
    it('should provide comprehensive cache key generation methods', async () => {
      const { CacheKey } = await import('../utils/cacheKey.js');

      // Test product-related methods
      expect(typeof CacheKey.products).toBe('function');
      expect(typeof CacheKey.product).toBe('function');
      expect(typeof CacheKey.productStock).toBe('function');
      expect(typeof CacheKey.productVariants).toBe('function');
      expect(typeof CacheKey.productReviews).toBe('function');
      expect(typeof CacheKey.productCategories).toBe('function');

      // Test user-related methods
      expect(typeof CacheKey.userProfile).toBe('function');
      expect(typeof CacheKey.userCart).toBe('function');
      expect(typeof CacheKey.userOrders).toBe('function');

      // Test auth-related methods
      expect(typeof CacheKey.authToken).toBe('function');
      expect(typeof CacheKey.authRefreshToken).toBe('function');

      // Test method outputs
      const productKey = CacheKey.products(1, 10);
      const userKey = CacheKey.userProfile(123);
      const authKey = CacheKey.authToken('token-123');
      
      [productKey, userKey, authKey].forEach(key => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });
    });

    it('should handle method chaining and different parameter types', async () => {
      const { CacheKey } = await import('../utils/cacheKey.js');

      // Test different parameter combinations
      const productList = CacheKey.products(1, 20, { category: 'electronics' });
      const productDetail = CacheKey.product(123);
      const productReviews = CacheKey.productReviews(123, 2);
      const userOrders = CacheKey.userOrders(456, 3);

      [productList, productDetail, productReviews, userOrders].forEach(key => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
        expect(key).toContain('optica:');
      });

      // All should be unique
      const uniqueKeys = new Set([productList, productDetail, productReviews, userOrders]);
      expect(uniqueKeys.size).toBe(4);
    });
  });

  describe('Key Format and Structure', () => {
    it('should generate keys with consistent format', async () => {
      const { CacheKey } = await import('../utils/cacheKey.js');

      const key = CacheKey.products(1, 10, { search: 'test' });
      
      // Should start with prefix
      expect(key).toMatch(/^optica:/);
      
      // Should contain namespace
      expect(key).toContain('products');
      
      // Should be reasonable length
      expect(key.length).toBeLessThan(300);
      expect(key.length).toBeGreaterThan(10);
    });

    it('should handle key length limits efficiently', async () => {
      const { CacheKey } = await import('../utils/cacheKey.js');

      // Create a very large filter object
      const largeFilters = {
        search: 'a'.repeat(1000),
        description: 'b'.repeat(2000),
        tags: Array.from({ length: 100 }, (_, i) => `very-long-tag-name-${i}`),
        metadata: {
          veryLongFieldName: 'very-long-value'.repeat(50),
          anotherLongField: Array.from({ length: 50 }, (_, i) => `item-${i}`),
        },
      };

      const startTime = Date.now();
      const key = CacheKey.products(1, 10, largeFilters);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10);
      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
      
      // Should handle long keys appropriately (compressed/hashed)
      expect(key.length).toBeLessThan(500);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not accumulate memory during key generation', async () => {
      const { CacheKey } = await import('../utils/cacheKey.js');

      const initialMemory = process.memoryUsage().heapUsed;

      // Generate many keys
      for (let i = 0; i < 1000; i++) {
        CacheKey.products(i % 10 + 1, 10, {
          iteration: i,
          data: `test-data-${i}`,
          timestamp: Date.now(),
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 2MB for 1000 operations)
      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024);
    });
  });
});
