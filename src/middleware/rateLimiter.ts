import type { Context, Next } from 'hono'
import { kvClient } from '../lib/kvClient'
import { errorJson } from '../lib/errors'

type Bucket = { limit: number; windowSec: number }
type Opts = { byApiKey?: Bucket; byIP?: Bucket }

async function hit(bucket: Bucket, key: string) {
  const now = Math.floor(Date.now() / 1000)
  const windowKey = `rl:${key}:${Math.floor(now / bucket.windowSec)}`
  // INCR + set expiry if first hit
  const current = await kvClient.incr(windowKey)
  if (current === 1) await kvClient.expire(windowKey, bucket.windowSec)
  return { current: current || 0, remaining: Math.max(bucket.limit - (current || 0), 0) }
}

export function rateLimitByKeyAndIP(name: string, config: { requests: number; window: number }) {
  const opts: Opts = {
    byApiKey: { limit: config.requests, windowSec: config.window },
    byIP: { limit: config.requests, windowSec: config.window }
  }
  return async (c: Context, next: Next) => {
    const traceId = (c as any).get('traceId')
    // prefer API key if present
    const apiKey = c.req.header('X-API-Key')
    if (opts.byApiKey && apiKey) {
      const res = await hit(opts.byApiKey, `k:${apiKey}`)
      c.header('X-RateLimit-Limit', String(opts.byApiKey.limit))
      c.header('X-RateLimit-Remaining', String(res.remaining))
      if ((res.current || 0) > opts.byApiKey.limit) {
        return errorJson(c, 'RATE_LIMIT', 'API key rate limit exceeded', 429, undefined, traceId)
      }
      return next()
    }
    // fallback to IP
    if (opts.byIP) {
      const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      const res = await hit(opts.byIP, `ip:${ip}`)
      c.header('X-RateLimit-Limit', String(opts.byIP.limit))
      c.header('X-RateLimit-Remaining', String(res.remaining))
      if ((res.current || 0) > opts.byIP.limit) {
        return errorJson(c, 'RATE_LIMIT', 'IP rate limit exceeded', 429, undefined, traceId)
      }
    }
    await next()
  }
}
