import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { envConfig } from '../config/env.js';

let keySet: Set<string> | null = null;
function loadKeys() {
  if (keySet) return keySet;
  const raw = envConfig.security.ADMIN_API_KEYS as unknown as string;
  keySet = new Set((raw || '').split(',').map(k => k.trim()).filter(Boolean));
  return keySet;
}

export function requireApiKey() {
  return async (c: Context, next: Next) => {
    const keys = loadKeys();
    if (!keys.size) throw new HTTPException(403, { message: 'API key disabled' });
    const header = c.req.header('x-api-key');
    if (!header || !keys.has(header)) throw new HTTPException(401, { message: 'Invalid API key' });
    await next();
  };
}

export function reloadApiKeys() { keySet = null; loadKeys(); }