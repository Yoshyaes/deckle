import { db, users, apiKeys, generations, templates, usageDaily } from './db';
import { eq, and, desc, sql, gte, count } from 'drizzle-orm';

const DEV_MODE = process.env.DOCUFORGE_DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production';

/**
 * Get the current user from Clerk session → DB lookup.
 * In dev mode (DOCUFORGE_DEV_BYPASS=true), returns the seeded test user
 * so the dashboard works without Clerk credentials.
 */
export async function getCurrentUser() {
  if (DEV_MODE) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'dev@docuforge.local'))
      .limit(1);
    return user || null;
  }

  const { auth, currentUser } = await import('@clerk/nextjs/server');
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (existing) return existing;

  // Auto-provision user if webhook hasn't fired yet
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress || `${clerkId}@clerk.user`;

  const [newUser] = await db
    .insert(users)
    .values({ email, clerkId, plan: 'free' })
    .onConflictDoNothing()
    .returning();

  if (newUser) return newUser;

  // Race condition: another request may have inserted — re-fetch
  const [retried] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  return retried || null;
}

/**
 * Dashboard overview stats.
 */
export async function getOverviewStats(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];

  // Monthly generation count
  const [usageResult] = await db
    .select({
      totalGenerations: sql<number>`COALESCE(SUM(${usageDaily.generationCount}), 0)`,
      totalPages: sql<number>`COALESCE(SUM(${usageDaily.totalPages}), 0)`,
      totalBytes: sql<number>`COALESCE(SUM(${usageDaily.totalBytes}), 0)`,
    })
    .from(usageDaily)
    .where(and(eq(usageDaily.userId, userId), gte(usageDaily.date, startOfMonth)));

  // Average generation time + success rate
  const [genStats] = await db
    .select({
      avgTime: sql<number>`COALESCE(AVG(${generations.generationTimeMs}), 0)`,
      total: sql<number>`COUNT(*)`,
      completed: sql<number>`COUNT(*) FILTER (WHERE ${generations.status} = 'completed')`,
    })
    .from(generations)
    .where(eq(generations.userId, userId));

  const successRate =
    genStats.total > 0
      ? Math.round((genStats.completed / genStats.total) * 1000) / 10
      : 0;

  return {
    generationCount: usageResult?.totalGenerations || 0,
    totalPages: usageResult?.totalPages || 0,
    avgTimeMs: Math.round(genStats.avgTime || 0),
    successRate,
  };
}

/**
 * Recent generations for the table.
 */
export async function getRecentGenerations(userId: string, limit = 10) {
  const results = await db
    .select({
      id: generations.id,
      templateId: generations.templateId,
      inputType: generations.inputType,
      status: generations.status,
      pages: generations.pages,
      generationTimeMs: generations.generationTimeMs,
      createdAt: generations.createdAt,
    })
    .from(generations)
    .where(eq(generations.userId, userId))
    .orderBy(desc(generations.createdAt))
    .limit(limit);

  return results;
}

/**
 * All generations with pagination.
 */
export async function getAllGenerations(
  userId: string,
  opts: { limit?: number; offset?: number; status?: string } = {},
) {
  const limit = opts.limit || 50;
  const offset = opts.offset || 0;

  const conditions = [eq(generations.userId, userId)];
  if (opts.status && opts.status !== 'all') {
    conditions.push(eq(generations.status, opts.status as any));
  }

  const results = await db
    .select()
    .from(generations)
    .where(and(...conditions))
    .orderBy(desc(generations.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(generations)
    .where(and(...conditions));

  return { data: results, total: countResult?.total || 0 };
}

/**
 * Get a single generation by ID.
 */
export async function getGenerationById(userId: string, generationId: string) {
  const [gen] = await db
    .select()
    .from(generations)
    .where(and(eq(generations.id, generationId), eq(generations.userId, userId)))
    .limit(1);
  return gen || null;
}

/**
 * List API keys (no hashes).
 */
export async function getUserApiKeys(userId: string) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt));
}

/**
 * List templates.
 */
export async function getUserTemplates(userId: string) {
  return db
    .select({
      id: templates.id,
      name: templates.name,
      version: templates.version,
      isPublic: templates.isPublic,
      createdAt: templates.createdAt,
      updatedAt: templates.updatedAt,
    })
    .from(templates)
    .where(eq(templates.userId, userId))
    .orderBy(desc(templates.createdAt));
}

/**
 * Get a single template by ID.
 */
export async function getTemplate(userId: string, templateId: string) {
  const [tmpl] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, templateId), eq(templates.userId, userId)))
    .limit(1);
  return tmpl || null;
}

/**
 * Daily generation counts for charts (last 30 days).
 */
export async function getDailyUsage(userId: string, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const start = startDate.toISOString().split('T')[0];

  const results = await db
    .select({
      date: usageDaily.date,
      count: usageDaily.generationCount,
    })
    .from(usageDaily)
    .where(and(eq(usageDaily.userId, userId), gte(usageDaily.date, start)))
    .orderBy(usageDaily.date);

  // Fill in missing days with 0
  const map = new Map(results.map((r) => [r.date, r.count]));
  const filled: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    filled.push(map.get(key) || 0);
  }

  return filled;
}

/**
 * Get usage limits for the current plan.
 */
const PLAN_LIMITS: Record<string, number> = {
  free: 1000,
  starter: 10000,
  pro: 100000,
  enterprise: Infinity,
};

export function getPlanLimit(plan: string) {
  return PLAN_LIMITS[plan] || 1000;
}
