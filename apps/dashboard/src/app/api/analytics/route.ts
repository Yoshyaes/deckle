import { NextResponse } from 'next/server';
import { db, generations, usageDaily, templates } from '@/lib/db';
import { getCurrentUser } from '@/lib/data';
import { eq, and, sql, gte, desc } from 'drizzle-orm';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const [
    topTemplates,
    errorStats,
    avgLatency,
    typeBreakdown,
    dailyGens,
    peakHours,
  ] = await Promise.all([
    db
      .select({
        templateId: generations.templateId,
        templateName: templates.name,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(generations)
      .leftJoin(templates, eq(generations.templateId, templates.id))
      .where(
        and(
          eq(generations.userId, user.id),
          gte(generations.createdAt, thirtyDaysAgo),
          sql`${generations.templateId} IS NOT NULL`,
        ),
      )
      .groupBy(generations.templateId, templates.name)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10),

    db
      .select({
        total: sql<number>`COUNT(*)::int`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${generations.status} = 'failed')::int`,
      })
      .from(generations)
      .where(
        and(
          eq(generations.userId, user.id),
          gte(generations.createdAt, thirtyDaysAgo),
        ),
      ),

    db
      .select({
        date: sql<string>`DATE(${generations.createdAt})`,
        avgMs: sql<number>`ROUND(AVG(${generations.generationTimeMs}))::int`,
      })
      .from(generations)
      .where(
        and(
          eq(generations.userId, user.id),
          gte(generations.createdAt, thirtyDaysAgo),
          eq(generations.status, 'completed'),
        ),
      )
      .groupBy(sql`DATE(${generations.createdAt})`)
      .orderBy(sql`DATE(${generations.createdAt})`),

    db
      .select({
        type: generations.inputType,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(generations)
      .where(
        and(
          eq(generations.userId, user.id),
          gte(generations.createdAt, thirtyDaysAgo),
        ),
      )
      .groupBy(generations.inputType),

    db
      .select({
        date: usageDaily.date,
        count: usageDaily.generationCount,
      })
      .from(usageDaily)
      .where(
        and(
          eq(usageDaily.userId, user.id),
          gte(usageDaily.date, thirtyDaysAgoStr),
        ),
      )
      .orderBy(usageDaily.date),

    db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${generations.createdAt})::int`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(generations)
      .where(
        and(
          eq(generations.userId, user.id),
          gte(generations.createdAt, thirtyDaysAgo),
        ),
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${generations.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${generations.createdAt})`),
  ]);

  const errorRate = errorStats[0]?.total
    ? Math.round((errorStats[0].failed / errorStats[0].total) * 1000) / 10
    : 0;

  return NextResponse.json({
    top_templates: topTemplates.map((t) => ({
      template_id: t.templateId,
      template_name: t.templateName || 'Deleted template',
      count: t.count,
    })),
    error_rate: errorRate,
    total_generations: errorStats[0]?.total || 0,
    failed_generations: errorStats[0]?.failed || 0,
    avg_latency_by_day: avgLatency.map((d) => ({ date: d.date, avg_ms: d.avgMs })),
    generation_by_type: typeBreakdown.map((t) => ({ type: t.type, count: t.count })),
    daily_generations: dailyGens.map((d) => ({ date: d.date, count: d.count })),
    peak_hours: peakHours.map((h) => ({ hour: h.hour, count: h.count })),
  });
}
