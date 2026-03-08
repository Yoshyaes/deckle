import { createMiddleware } from 'hono/factory';
import { redis } from '../lib/redis.js';
import { RateLimitError } from '../lib/errors.js';

const PLAN_RATE_LIMITS: Record<string, number> = {
  free: 10,
  starter: 100,
  pro: 100,
  enterprise: 500,
};

export const rateLimitMiddleware = createMiddleware(async (c, next) => {
  const user = c.get('user');
  if (!user) return next();

  const limit = PLAN_RATE_LIMITS[user.plan] || 10;
  const key = `ratelimit:${user.id}`;
  const now = Date.now();
  const window = 1000; // 1 second sliding window

  try {
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, now - window);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.zcard(key);
    pipeline.expire(key, 2);

    const results = await pipeline.exec();
    const rawCount = results?.[2]?.[1];
    const count = typeof rawCount === 'number' && Number.isFinite(rawCount) ? rawCount : Infinity;

    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, limit - count)));
    c.header('X-RateLimit-Reset', String(Math.ceil((now + window) / 1000)));

    if (count > limit) {
      c.header('Retry-After', '1');
      throw new RateLimitError(1);
    }
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    // Fail closed: deny request if Redis is unavailable
    console.error('Rate limiter error (denying request):', err);
    throw new RateLimitError(5);
  }

  return next();
});
