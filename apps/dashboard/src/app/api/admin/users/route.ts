import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { db, users } from '@/lib/db';
import { sql, eq, ilike } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type FunnelStage =
  | 'all'
  | 'signed_up_only'
  | 'has_key_no_gen'
  | 'has_gen'
  | 'active_7d'
  | 'churned_30d'
  | 'at_risk';

function stageClause(stage: FunnelStage): string {
  switch (stage) {
    case 'signed_up_only':
      return `(k.key_count IS NULL OR k.key_count = 0) AND (g.gen_count IS NULL OR g.gen_count = 0)`;
    case 'has_key_no_gen':
      return `(k.key_count > 0) AND (g.gen_count IS NULL OR g.gen_count = 0)`;
    case 'has_gen':
      return `g.gen_count > 0`;
    case 'active_7d':
      return `g.last_generation >= NOW() - INTERVAL '7 days'`;
    case 'churned_30d':
      return `g.gen_count > 0 AND g.last_generation < NOW() - INTERVAL '30 days'`;
    case 'at_risk':
      // Generated before but went quiet for 7-30 days — warming up to churn
      return `g.gen_count > 0 AND g.last_generation >= NOW() - INTERVAL '30 days' AND g.last_generation < NOW() - INTERVAL '7 days'`;
    case 'all':
    default:
      return `TRUE`;
  }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const plan = searchParams.get('plan') || '';
  const stage = (searchParams.get('stage') || 'all') as FunnelStage;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  const userConditions: any[] = [];
  if (search) {
    userConditions.push(ilike(users.email, `%${search}%`));
  }
  if (plan && plan !== 'all') {
    userConditions.push(eq(users.plan, plan as any));
  }

  const userWhere =
    userConditions.length > 0
      ? sql`${sql.join(userConditions, sql` AND `)}`
      : sql`TRUE`;

  const stageWhereSql = sql.raw(stageClause(stage));

  const results = await db.execute(sql`
    SELECT
      u.id,
      u.email,
      u.plan,
      u.role,
      u.created_at,
      COALESCE(g.gen_count, 0)          AS generation_count,
      COALESCE(g.success_count, 0)      AS success_count,
      COALESCE(g.failure_count, 0)      AS failure_count,
      COALESCE(k.key_count, 0)          AS key_count,
      g.last_generation,
      g.first_generation,
      CASE
        WHEN g.first_generation IS NOT NULL
        THEN EXTRACT(EPOCH FROM (g.first_generation - u.created_at))::int
        ELSE NULL
      END                               AS time_to_first_gen_sec,
      CASE
        WHEN g.last_generation IS NOT NULL
        THEN EXTRACT(EPOCH FROM (NOW() - g.last_generation))::int / 86400
        ELSE NULL
      END                               AS days_since_last_gen,
      g.first_status                    AS first_gen_status,
      g.first_error                     AS first_error_message,
      g.input_types                     AS used_input_types,
      CASE WHEN t.tpl_count > 0 THEN TRUE ELSE FALSE END AS has_created_template,
      LEAST(100, GREATEST(0,
        CASE WHEN k.key_count > 0                                                       THEN 20 ELSE 0 END +
        CASE WHEN g.gen_count > 0                                                       THEN 20 ELSE 0 END +
        CASE WHEN g.gen_count > 0 AND (g.success_count::float / g.gen_count) >= 0.8    THEN 20 ELSE 0 END +
        CASE WHEN g.last_generation >= NOW() - INTERVAL '7 days'                        THEN 40 ELSE 0 END +
        CASE WHEN g.gen_count > 0 AND g.last_generation < NOW() - INTERVAL '30 days'   THEN -30 ELSE 0 END
      ))::int                           AS health_score
    FROM users u
    LEFT JOIN (
      SELECT
        gn.user_id,
        COUNT(*)::int                                              AS gen_count,
        COUNT(*) FILTER (WHERE gn.status = 'completed')::int       AS success_count,
        COUNT(*) FILTER (WHERE gn.status = 'failed')::int          AS failure_count,
        MAX(gn.created_at)                                         AS last_generation,
        MIN(gn.created_at)                                         AS first_generation,
        (
          SELECT gg.status FROM generations gg
          WHERE gg.user_id = gn.user_id
          ORDER BY gg.created_at ASC LIMIT 1
        )                                                          AS first_status,
        (
          SELECT gg.error FROM generations gg
          WHERE gg.user_id = gn.user_id AND gg.status = 'failed'
          ORDER BY gg.created_at ASC LIMIT 1
        )                                                          AS first_error,
        ARRAY_AGG(DISTINCT gn.input_type)                          AS input_types
      FROM generations gn
      GROUP BY gn.user_id
    ) g ON g.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*)::int AS key_count
      FROM api_keys
      GROUP BY user_id
    ) k ON k.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*)::int AS tpl_count
      FROM templates
      GROUP BY user_id
    ) t ON t.user_id = u.id
    WHERE ${userWhere} AND (${stageWhereSql})
    ORDER BY u.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM users u
    LEFT JOIN (
      SELECT user_id, COUNT(*)::int AS gen_count, MAX(created_at) AS last_generation
      FROM generations
      GROUP BY user_id
    ) g ON g.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*)::int AS key_count
      FROM api_keys
      GROUP BY user_id
    ) k ON k.user_id = u.id
    WHERE ${userWhere} AND (${stageWhereSql})
  `);

  return NextResponse.json({
    data: results.rows,
    total: (countResult.rows[0] as any)?.total || 0,
  });
}
