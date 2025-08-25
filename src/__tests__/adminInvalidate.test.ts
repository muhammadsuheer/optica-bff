import { describe, it, expect } from '@jest/globals';
import { Hono } from 'hono';

process.env.ADMIN_API_KEYS = 'test-admin-key';

const mockCacheService: any = { deletePattern: async () => {} };

describe('Admin cache invalidate endpoint', () => {
  it('rejects without API key', async () => {
    const { default: app } = await import('../index.js');
    const res = await app.request('/admin/cache/invalidate', { method: 'POST', body: JSON.stringify({ pattern: 'product:*' }) });
    expect(res.status).toBe(401); // invalid because no key
  });
});
