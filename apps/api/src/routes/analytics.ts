import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { generations, usageDaily, templates } from '../schema/db.js';
import { eq, and, sql, gte, desc } from 'drizzle-orm';

const app = new Hono();

app.get('/', async (c) => {
  const user = c.get('user');
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Run all queries in parallel
  const [
    topTemplates,
    errorStats,
    avgLatency,
    typeBreakdown,
    dailyGens,
    peakHours,
  ] = await Promise.all([
    // Top templates by usage (last 30 days)
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
          gte(generations.createdAt, new Date(thirtyDaysAgo)),
          sql`${generations.templateId} IS NOT NULL`,
        ),
      )
      .groupBy(generations.templateId, templates.name)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10),

    // Error rate (last 30 days)
    db
      .select({
        total: sql<number>`COUNT(*)::int`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${generations.status} = 'failed')::int`,
      })
      .from(generations)
      .where(
        and(
          eq(generations.userId, user.id),
          gte(generations.createdAt, new Date(thirtyDaysAgo)),
        ),
      ),

    // Average generation latency by day (last 30 days)
    db
      .select({
        date: sql<string>`DATE(${generations.createdAt})`,
        avgMs: sql<number>`ROUND(AVG(${generations.generationTimeMs}))::int`,
      })
      .from(generations)
      .where(
        and(
          eq(generations.userId, user.id),
          gte(generations.createdAt, new Date(thirtyDaysAgo)),
          eq(generations.status, 'completed'),
        ),
      )
      .groupBy(sql`DATE(${generations.createdAt})`)
      .orderBy(sql`DATE(${generations.createdAt})`),

    // Generation type breakdown
    db
      .select({
        type: generations.inputType,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(generations)
      .where(
        and(
          eq(generations.userId, user.id),
          gte(generations.createdAt, new Date(thirtyDaysAgo)),
        ),
      )
      .groupBy(generations.inputType),

    // Daily generation counts (from usage_daily)
    db
      .select({
        date: usageDaily.date,
        count: usageDaily.generationCount,
      })
      .from(usageDaily)
      .where(
        and(
          eq(usageDaily.userId, user.id),
          gte(usageDaily.date, thirtyDaysAgo),
        ),
      )
      .orderBy(usageDaily.date),

    // Peak hours (last 30 days)
    db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${generations.createdAt})::int`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(generations)
      .where(
        and(
          eq(generations.userId, user.id),
          gte(generations.createdAt, new Date(thirtyDaysAgo)),
        ),
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${generations.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${generations.createdAt})`),
  ]);

  const errorRate = errorStats[0]?.total
    ? Math.round((errorStats[0].failed / errorStats[0].total) * 1000) / 10
    : 0;

  return c.json({
    top_templates: topTemplates.map((t) => ({
      template_id: t.templateId,
      template_name: t.templateName || 'Deleted template',
      count: t.count,
    })),
    error_rate: errorRate,
    total_generations: errorStats[0]?.total || 0,
    failed_generations: errorStats[0]?.failed || 0,
    avg_latency_by_day: avgLatency.map((d) => ({
      date: d.date,
      avg_ms: d.avgMs,
    })),
    generation_by_type: typeBreakdown.map((t) => ({
      type: t.type,
      count: t.count,
    })),
    daily_generations: dailyGens.map((d) => ({
      date: d.date,
      count: d.count,
    })),
    peak_hours: peakHours.map((h) => ({
      hour: h.hour,
      count: h.count,
    })),
  });
});

export default app;
