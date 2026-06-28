import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { db, users, generations, usageDaily } from '@/lib/db';
import { sql, gte, eq, ne } from 'drizzle-orm';

// Monthly price per plan in cents — update when pricing changes
const PLAN_PRICE_CENTS: Record<string, number> = {
  free: 0,
  starter: 2900,
  pro: 9900,
  enterprise: 29900,
};

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const today = now.toISOString().split('T')[0];

  const [
    [userStats],
    [genStats],
    [monthlyUsage],
    [todayUsage],
    planDistribution,
    dailyGenerations,
    recentGenerations,
    [newUsersThisMonth],
  ] = await Promise.all([
    // Total users
    db.select({ total: sql<number>`COUNT(*)` }).from(users),

    // Generation stats (all time)
    db.select({
      total: sql<number>`COUNT(*)`,
      completed: sql<number>`COUNT(*) FILTER (WHERE ${generations.status} = 'completed')`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${generations.status} = 'failed')`,
      avgLatency: sql<number>`COALESCE(AVG(${generations.generationTimeMs}), 0)`,
      totalBytes: sql<number>`COALESCE(SUM(${generations.fileSizeBytes}), 0)`,
    }).from(generations),

    // This month's generations
    db.select({
      count: sql<number>`COALESCE(SUM(${usageDaily.generationCount}), 0)`,
      pages: sql<number>`COALESCE(SUM(${usageDaily.totalPages}), 0)`,
      bytes: sql<number>`COALESCE(SUM(${usageDaily.totalBytes}), 0)`,
    }).from(usageDaily).where(gte(usageDaily.date, startOfMonth)),

    // Today's generations
    db.select({
      count: sql<number>`COALESCE(SUM(${usageDaily.generationCount}), 0)`,
    }).from(usageDaily).where(eq(usageDaily.date, today)),

    // Plan distribution
    db.select({
      plan: users.plan,
      count: sql<number>`COUNT(*)`,
    }).from(users).groupBy(users.plan),

    // Daily generations last 30 days
    db.select({
      date: usageDaily.date,
      count: sql<number>`SUM(${usageDaily.generationCount})`,
    }).from(usageDaily)
      .where(gte(usageDaily.date, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]))
      .groupBy(usageDaily.date)
      .orderBy(usageDaily.date),

    // Active users last 7 days (users with usage)
    db.select({
      activeUsers: sql<number>`COUNT(DISTINCT ${usageDaily.userId})`,
    }).from(usageDaily).where(gte(usageDaily.date, sevenDaysAgo)),

    // New users this month
    db.select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(gte(users.createdAt, new Date(now.getFullYear(), now.getMonth(), 1))),
  ]);

  const errorRate = genStats.total > 0
    ? Math.round((genStats.failed / genStats.total) * 1000) / 10
    : 0;

  // Revenue — computed from plan distribution × monthly price
  let mrrCents = 0;
  let paidUsers = 0;
  for (const row of planDistribution) {
    const price = PLAN_PRICE_CENTS[row.plan] ?? 0;
    if (price > 0) {
      mrrCents += price * row.count;
      paidUsers += row.count;
    }
  }
  const totalNonZeroUsers = userStats.total > 0 ? userStats.total : 1;
  const conversionRatePct = Math.round((paidUsers / totalNonZeroUsers) * 1000) / 10;

  // Fill daily generations for missing days
  const dailyMap = new Map(dailyGenerations.map((d) => [d.date, d.count]));
  const filledDaily: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    filledDaily.push({ date: key, count: dailyMap.get(key) || 0 });
  }

  return NextResponse.json({
    totalUsers: userStats.total,
    newUsersThisMonth: newUsersThisMonth.count,
    totalGenerations: genStats.total,
    generationsThisMonth: monthlyUsage.count,
    generationsToday: todayUsage.count,
    activeUsersLast7d: recentGenerations[0]?.activeUsers || 0,
    errorRate,
    avgLatencyMs: Math.round(genStats.avgLatency),
    totalStorageBytes: genStats.totalBytes,
    mrrCents,
    arrCents: mrrCents * 12,
    paidUsers,
    conversionRatePct,
    planDistribution,
    dailyGenerations: filledDaily,
  });
}
