import { db } from '../lib/db.js';
import { usageDaily, users } from '../schema/db.js';
import { eq, and, sql, gte } from 'drizzle-orm';

const PLAN_LIMITS: Record<string, number> = {
  free: 1000,
  starter: 10000,
  pro: 100000,
  enterprise: Infinity,
};

export async function checkUsageLimit(userId: string, plan: string): Promise<boolean> {
  const limit = PLAN_LIMITS[plan] || 1000;
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
    limit: PLAN_LIMITS[plan] || 1000,
  };
}
