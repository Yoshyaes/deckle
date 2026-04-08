import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { usageDaily } from '../schema/db.js';
import { eq, and, sql, gte } from 'drizzle-orm';
import { logger } from '../lib/logger.js';

export const PLAN_LIMITS: Record<string, number> = {
  free: 1000,
  starter: 10000,
  pro: 100000,
  enterprise: Infinity,
};

/**
 * Lua script for atomic usage check-and-reserve.
 *
 * Returns the new counter value after increment, or -1 if the limit is
 * already reached. The key expires at the start of the next calendar month
 * so the counter resets automatically.
 *
 * Keys[1]: usage counter key  (e.g. "usage:usr_abc:2026-04")
 * Argv[1]: plan limit          (e.g. "1000")
 * Argv[2]: TTL in seconds until end-of-month
 */
const ATOMIC_CHECK_AND_RESERVE = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
if limit >= 0 and current >= limit then
  return -1
end
local new_val = redis.call('INCR', KEYS[1])
if new_val == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
end
return new_val
`;

/**
 * Compute seconds until the end of the current calendar month (UTC).
 */
function secondsUntilEndOfMonth(): number {
  const now = new Date();
  const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return Math.max(1, Math.floor((endOfMonth.getTime() - now.getTime()) / 1000));
}

/**
 * Atomically check whether the user is within their plan limit and reserve a
 * slot if so. Returns true (slot reserved) or false (limit reached).
 *
 * Uses a Redis Lua script to ensure check + increment is atomic, eliminating
 * the race condition between separate check and increment operations.
 *
 * Falls back to the Postgres-based check if Redis is unavailable, accepting
 * the original race in that degraded scenario.
 */
export async function checkAndReserveUsage(userId: string, plan: string): Promise<boolean> {
  const limit = PLAN_LIMITS[plan] ?? 1000;
  if (limit === Infinity) return true;

  const now = new Date();
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const redisKey = `usage:${userId}:${monthKey}`;
  const ttl = secondsUntilEndOfMonth();

  try {
    const result = await redis.eval(
      ATOMIC_CHECK_AND_RESERVE,
      1,
      redisKey,
      String(limit),
      String(ttl),
    ) as number;

    // -1 means limit was already reached before increment
    return result !== -1;
  } catch (err) {
    // Redis unavailable — fall back to Postgres check (accepts race condition
    // during outage but prevents hard failures)
    logger.error({ err }, 'Redis unavailable for usage check; falling back to Postgres');
    return checkUsageLimitPostgres(userId, plan);
  }
}

/**
 * Postgres-based usage limit check (kept as fallback).
 * Not atomic — do not use as the primary check in concurrent contexts.
 */
async function checkUsageLimitPostgres(userId: string, plan: string): Promise<boolean> {
  const limit = PLAN_LIMITS[plan] ?? 1000;
  if (limit === Infinity) return true;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${usageDaily.generationCount}), 0)` })
    .from(usageDaily)
    .where(
      and(
        eq(usageDaily.userId, userId),
        gte(usageDaily.date, startOfMonth),
      ),
    );

  return (result[0]?.total || 0) < limit;
}

/**
 * Legacy export kept for any code that needs a read-only usage check
 * (e.g. the usage stats endpoint). Does NOT reserve a slot.
 */
export async function checkUsageLimit(userId: string, plan: string): Promise<boolean> {
  return checkUsageLimitPostgres(userId, plan);
}

export async function incrementUsage(
  userId: string,
  pages: number,
  bytes: number,
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await db
    .insert(usageDaily)
    .values({
      userId,
      date: today,
      generationCount: 1,
      totalPages: pages,
      totalBytes: bytes,
    })
    .onConflictDoUpdate({
      target: [usageDaily.userId, usageDaily.date],
      set: {
        generationCount: sql`${usageDaily.generationCount} + 1`,
        totalPages: sql`${usageDaily.totalPages} + ${pages}`,
        totalBytes: sql`${usageDaily.totalBytes} + ${bytes}`,
      },
    });
}

export async function getUsageStats(userId: string, plan: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const result = await db
    .select({
      generationCount: sql<number>`COALESCE(SUM(${usageDaily.generationCount}), 0)`,
      totalPages: sql<number>`COALESCE(SUM(${usageDaily.totalPages}), 0)`,
      totalBytes: sql<number>`COALESCE(SUM(${usageDaily.totalBytes}), 0)`,
    })
    .from(usageDaily)
    .where(
      and(
        eq(usageDaily.userId, userId),
        gte(usageDaily.date, startOfMonth),
      ),
    );

  const stats = result[0] || { generationCount: 0, totalPages: 0, totalBytes: 0 };

  return {
    period_start: startOfMonth,
    period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
    generation_count: Number(stats.generationCount) || 0,
    total_pages: Number(stats.totalPages) || 0,
    total_bytes: Number(stats.totalBytes) || 0,
    plan,
    limit: PLAN_LIMITS[plan] ?? 1000,
  };
}
