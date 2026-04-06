import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { db, generations } from '@/lib/db';
import { eq, and, sql, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const errorBreakdown = await db
    .select({
      error: generations.error,
      count: sql<number>`COUNT(*)::int`,
      lastOccurrence: sql<string>`MAX(${generations.createdAt})`,
    })
    .from(generations)
    .where(
      and(
        eq(generations.userId, id),
        eq(generations.status, 'failed' as any),
      )
    )
    .groupBy(generations.error)
    .orderBy(desc(sql`COUNT(*)`));

  const total = errorBreakdown.reduce((sum, row) => sum + row.count, 0);

  return NextResponse.json({
    data: errorBreakdown.map((row) => ({
      error: row.error || 'Unknown error',
      count: row.count,
      percentage: total > 0 ? Math.round((row.count / total) * 1000) / 10 : 0,
      last_occurrence: row.lastOccurrence,
    })),
    total_failures: total,
  });
}
