import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { db, generations, users } from '@/lib/db';
import { eq, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || '';
  const userId = searchParams.get('userId') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  const conditions: any[] = [];
  if (status && status !== 'all') {
    conditions.push(eq(generations.status, status as any));
  }
  if (userId) {
    conditions.push(sql`g.user_id = ${userId}`);
  }

  const whereClause = conditions.length > 0
    ? sql`${sql.join(conditions, sql` AND `)}`
    : sql`TRUE`;

  const results = await db.execute(sql`
    SELECT
      g.id,
      g.user_id,
      u.email AS user_email,
      g.input_type,
      g.status,
      g.pages,
      g.file_size_bytes,
      g.generation_time_ms,
      g.error,
      g.created_at
    FROM generations g
    JOIN users u ON u.id = g.user_id
    WHERE ${whereClause}
    ORDER BY g.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*) AS total FROM generations WHERE ${whereClause}
  `);

  return NextResponse.json({
    data: results.rows,
    total: (countResult.rows[0] as any)?.total || 0,
  });
}
