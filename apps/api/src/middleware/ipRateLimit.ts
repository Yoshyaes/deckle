import { createMiddleware } from 'hono/factory';
import { Context } from 'hono';
import { redis } from '../lib/redis.js';
import { RateLimitError } from '../lib/errors.js';

const IP_RATE_LIMIT = 60; // requests per minute
const WINDOW_MS = 60_000; // 1 minute

/**
 * Extract the client IP address from the request.
 *
 * Strategy: prefer x-real-ip (set authoritatively by the reverse proxy) over
 * x-forwarded-for, which is client-controllable when the proxy appends rather
 * than replaces. If TRUSTED_PROXY_COUNT is set, we take the Nth-from-right
 * entry of x-forwarded-for (skipping the trusted proxy hop count) to support
 * multi-hop setups where the load balancer appends to the header.
 */
function extractClientIp(c: Context): string {
  // x-real-ip is set by nginx/caddy to the true client IP — prefer it.
  const realIp = c.req.header('x-real-ip');
  if (realIp) return realIp.trim();

  // x-forwarded-for: client, proxy1, proxy2
  // The rightmost entry added by our trusted proxy is most reliable.
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    const hops = forwardedFor.split(',').map((s) => s.trim());
    const trustedProxyCount = parseInt(process.env.TRUSTED_PROXY_COUNT || '1', 10);
    // Remove the trailing `trustedProxyCount` entries (our own proxies)
    const clientIndex = Math.max(0, hops.length - trustedProxyCount - 1);
    const ip = hops[clientIndex];
    if (ip) return ip;
  }

  return 'unknown';
}

export const ipRateLimitMiddleware = createMiddleware(async (c, next) => {
  const ip = extractClientIp(c);

  const key = `ipratelimit:${ip}`;
  const now = Date.now();

  try {
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, now - WINDOW_MS);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.zcard(key);
    pipeline.expire(key, 120);

    const results = await pipeline.exec();
    const rawCount = results?.[2]?.[1];
    const count = typeof rawCount === 'number' && Number.isFinite(rawCount) ? rawCount : 0;

    c.header('X-RateLimit-Limit', String(IP_RATE_LIMIT));
    c.header('X-RateLimit-Remaining', String(Math.max(0, IP_RATE_LIMIT - count)));

    if (count > IP_RATE_LIMIT) {
      c.header('Retry-After', '60');
      throw new RateLimitError(60);
    }
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    // Fail open for public routes — don't block if Redis is down
  }

  return next();
});
