import { createMiddleware } from 'hono/factory';
import { redis } from '../lib/redis.js';
import { RateLimitError } from '../lib/errors.js';

const IP_RATE_LIMIT = 60; // requests per minute
const WINDOW_MS = 60_000; // 1 minute

/**
 * IP-based rate limiting for public (unauthenticated) endpoints.
 * Uses a sliding window counter in Redis keyed by IP address.
 */
export const ipRateLimitMiddleware = createMiddleware(async (c, next) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown';

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
