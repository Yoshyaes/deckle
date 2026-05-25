import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Augments usage-concurrency.test.ts with coverage for:
 *  - incrementUsage (insert/onConflict path)
 *  - getUsageStats response shape
 *  - PLAN_LIMITS table
 *  - checkUsageLimit (legacy read-only Postgres check)
 */

const mockInsert = vi.fn();
const mockSelect = vi.fn();

vi.mock('../lib/redis.js', () => ({
  redis: { eval: vi.fn() },
}));

vi.mock('../lib/db.js', () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock('../schema/db.js', () => ({
  usageDaily: {
    userId: 'userId', date: 'date',
    generationCount: 'generationCount', totalPages: 'totalPages', totalBytes: 'totalBytes',
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { incrementUsage, getUsageStats, checkUsageLimit, PLAN_LIMITS } =
  await import('../services/usage.js');

describe('PLAN_LIMITS table', () => {
  it('has the expected plan tiers', () => {
    expect(PLAN_LIMITS.free).toBe(1000);
    expect(PLAN_LIMITS.starter).toBe(10000);
    expect(PLAN_LIMITS.pro).toBe(100000);
    expect(PLAN_LIMITS.enterprise).toBe(Infinity);
  });

  it('orders tiers monotonically (free < starter < pro < enterprise)', () => {
    expect(PLAN_LIMITS.free).toBeLessThan(PLAN_LIMITS.starter);
    expect(PLAN_LIMITS.starter).toBeLessThan(PLAN_LIMITS.pro);
    expect(PLAN_LIMITS.pro).toBeLessThan(PLAN_LIMITS.enterprise);
  });
});

describe('incrementUsage', () => {
  beforeEach(() => {
    mockInsert.mockReset();
  });

  it('inserts a new row with the supplied pages and bytes', async () => {
    const captured: { values?: Record<string, unknown>; conflict?: unknown } = {};
    mockInsert.mockReturnValueOnce({
      values: (v: Record<string, unknown>) => {
        captured.values = v;
        return {
          onConflictDoUpdate: (cfg: unknown) => {
            captured.conflict = cfg;
            return Promise.resolve();
          },
        };
      },
    });

    await incrementUsage('usr_1', 5, 1024);

    expect(captured.values?.userId).toBe('usr_1');
    expect(captured.values?.generationCount).toBe(1);
    expect(captured.values?.totalPages).toBe(5);
    expect(captured.values?.totalBytes).toBe(1024);
    // Date should be an ISO YYYY-MM-DD string
    expect(captured.values?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('registers an onConflict (idempotent per user+date)', async () => {
    const captured: { conflict?: { target: unknown } } = {};
    mockInsert.mockReturnValueOnce({
      values: () => ({
        onConflictDoUpdate: (cfg: { target: unknown }) => {
          captured.conflict = cfg;
          return Promise.resolve();
        },
      }),
    });

    await incrementUsage('usr_1', 1, 100);
    expect(captured.conflict).toBeDefined();
    expect(captured.conflict?.target).toBeDefined();
  });
});

describe('getUsageStats', () => {
  beforeEach(() => {
    mockSelect.mockReset();
  });

  function arrangeSelect(rows: unknown[]) {
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve(rows),
      }),
    });
  }

  it('returns the canonical stats shape', async () => {
    arrangeSelect([{ generationCount: 42, totalPages: 100, totalBytes: 50000 }]);

    const stats = await getUsageStats('usr_1', 'pro');
    expect(stats).toMatchObject({
      generation_count: 42,
      total_pages: 100,
      total_bytes: 50000,
      plan: 'pro',
      limit: PLAN_LIMITS.pro,
    });
    expect(stats.period_start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(stats.period_end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns zeros when there are no usage rows yet', async () => {
    arrangeSelect([]);

    const stats = await getUsageStats('usr_new', 'free');
    expect(stats.generation_count).toBe(0);
    expect(stats.total_pages).toBe(0);
    expect(stats.total_bytes).toBe(0);
    expect(stats.limit).toBe(PLAN_LIMITS.free);
  });

  it('uses the free-tier limit for unknown plans (defensive default)', async () => {
    arrangeSelect([{ generationCount: 1, totalPages: 1, totalBytes: 1 }]);
    const stats = await getUsageStats('usr_1', 'mystery-plan');
    expect(stats.limit).toBe(1000);
  });

  it('coerces non-numeric DB strings to numbers', async () => {
    // Some Postgres drivers return SUM() as a string
    arrangeSelect([{ generationCount: '17', totalPages: '34', totalBytes: '1000' }]);
    const stats = await getUsageStats('usr_1', 'free');
    expect(stats.generation_count).toBe(17);
    expect(stats.total_pages).toBe(34);
    expect(stats.total_bytes).toBe(1000);
  });
});

describe('checkUsageLimit (legacy read-only check)', () => {
  beforeEach(() => {
    mockSelect.mockReset();
  });

  it('returns true when total is under the limit', async () => {
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([{ total: 500 }]),
      }),
    });
    expect(await checkUsageLimit('usr_1', 'free')).toBe(true);
  });

  it('returns false when total is at or above the limit', async () => {
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([{ total: 1000 }]),
      }),
    });
    expect(await checkUsageLimit('usr_1', 'free')).toBe(false);
  });

  it('returns true for enterprise (Infinity limit) without querying DB', async () => {
    expect(await checkUsageLimit('usr_1', 'enterprise')).toBe(true);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('treats missing total as 0 (under limit)', async () => {
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    });
    expect(await checkUsageLimit('usr_1', 'free')).toBe(true);
  });
});
