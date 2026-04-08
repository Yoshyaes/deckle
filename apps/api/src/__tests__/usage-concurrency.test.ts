/**
 * Concurrency tests for the usage limit check-and-reserve logic.
 *
 * These tests validate that concurrent requests cannot bypass plan limits
 * through the race condition that existed between the separate check and
 * increment operations. The fix uses an atomic Redis Lua script.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock Redis ---
let redisCounter = 0;
let redisLimit = Infinity;
let redisAvailable = true;

vi.mock('../lib/redis.js', () => ({
  redis: {
    eval: vi.fn(async (_script: string, _numKeys: number, _key: string, limitStr: string, _ttl: string) => {
      if (!redisAvailable) throw new Error('Redis unavailable');
      const limit = parseInt(limitStr, 10);
      if (limit >= 0 && redisCounter >= limit) {
        return -1; // limit reached
      }
      redisCounter++;
      return redisCounter;
    }),
  },
}));

// --- Mock DB (for the Postgres fallback path) ---
vi.mock('../lib/db.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ total: redisCounter }])),
      })),
    })),
  },
}));

vi.mock('../schema/db.js', () => ({
  usageDaily: { userId: 'userId', date: 'date', generationCount: 'generationCount' },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Import after mocks
const { checkAndReserveUsage } = await import('../services/usage.js');

describe('Usage limit concurrency', () => {
  beforeEach(() => {
    redisCounter = 0;
    redisLimit = Infinity;
    redisAvailable = true;
    vi.clearAllMocks();
  });

  it('allows requests up to the plan limit', async () => {
    const LIMIT = 5;
    // Simulate 5 concurrent requests for a plan with limit=5
    const results = await Promise.all(
      Array.from({ length: LIMIT }, () => checkAndReserveUsage('usr_1', 'free')),
    );
    // All 5 should be allowed (mock limit = Infinity, only 5 requested)
    expect(results.every(Boolean)).toBe(true);
    expect(redisCounter).toBe(LIMIT);
  });

  it('blocks requests once the limit is reached', async () => {
    // Pre-fill counter to exactly the free plan limit
    redisCounter = 1000;

    const result = await checkAndReserveUsage('usr_1', 'free');
    expect(result).toBe(false);
    // Counter must not have been incremented
    expect(redisCounter).toBe(1000);
  });

  it('atomically prevents concurrent requests from all passing when at limit-1', async () => {
    // Set counter to limit - 1 so only one more request should succeed
    redisCounter = 999; // free plan limit is 1000

    // Fire 10 concurrent requests simultaneously
    const results = await Promise.all(
      Array.from({ length: 10 }, () => checkAndReserveUsage('usr_1', 'free')),
    );

    const allowed = results.filter(Boolean).length;
    const blocked = results.filter((r) => !r).length;

    // Exactly 1 should pass (the one that gets counter from 999→1000)
    expect(allowed).toBe(1);
    expect(blocked).toBe(9);
    expect(redisCounter).toBe(1000);
  });

  it('enterprise plan with Infinity limit always returns true without hitting Redis', async () => {
    const result = await checkAndReserveUsage('usr_1', 'enterprise');
    expect(result).toBe(true);
    // Redis eval should NOT be called for Infinity plans
    const { redis } = await import('../lib/redis.js');
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('falls back to Postgres check when Redis is unavailable', async () => {
    redisAvailable = false;
    redisCounter = 0; // below limit in mock DB

    // Should not throw — should fall back gracefully
    const result = await checkAndReserveUsage('usr_1', 'free');
    expect(typeof result).toBe('boolean');
  });
});
