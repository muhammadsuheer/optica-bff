import { describe, it, expect } from '@jest/globals';
import { Hono } from 'hono';

process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing-and-verification-with-256-bits';
process.env.REDIS_URL = 'redis://localhost:6379';

// Minimal mocks
const mockCacheService: any = { get: async () => null, set: async () => {}, delete: async () => {} };

// Mock user functions used inside auth route (would normally integrate with WP)
const mockUser = { id: 1, email: 'user@test.com', roles: ['customer'] };
(global as any).authenticateUser = async () => ({ success: true, user: mockUser });
(global as any).fetchWordPressUser = async () => ({ success: true, user: mockUser });

describe('Auth refresh rotation', () => {
  it('issues new refresh token and revokes old', async () => {
    const { createAuthRoutes } = await import('../routes/auth.js');
    const app = new Hono();
    app.route('/auth', createAuthRoutes(mockCacheService));

    // Login first
    const loginRes = await app.request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'user@test.com', password: 'Passw0rd!' }) });
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    const oldRefresh = loginData.data.tokens.refresh_token;

    // Refresh
    const refreshRes = await app.request('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: oldRefresh }) });
    expect(refreshRes.status).toBe(200);
    const refreshData = await refreshRes.json();
    const newRefresh = refreshData.data.refresh_token;
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toEqual(oldRefresh);
  });
});
