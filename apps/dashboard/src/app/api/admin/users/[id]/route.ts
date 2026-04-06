import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { db, users, generations, apiKeys, templates, usageDaily } from '@/lib/db';
import { eq, desc, sql, gte } from 'drizzle-orm';

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

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [userGenerations, userKeys, userTemplates, [usageResult], [genStats]] = await Promise.all([
    db.select({
      id: generations.id,
      inputType: generations.inputType,
      status: generations.status,
      pages: generations.pages,
      generationTimeMs: generations.generationTimeMs,
      fileSizeBytes: generations.fileSizeBytes,
      error: generations.error,
      createdAt: generations.createdAt,
    })
      .from(generations)
      .where(eq(generations.userId, id))
      .orderBy(desc(generations.createdAt))
      .limit(50),

    db.select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
      .from(apiKeys)
      .where(eq(apiKeys.userId, id))
      .orderBy(desc(apiKeys.createdAt)),

    db.select({
      id: templates.id,
      name: templates.name,
      version: templates.version,
      isPublic: templates.isPublic,
      createdAt: templates.createdAt,
    })
      .from(templates)
      .where(eq(templates.userId, id))
      .orderBy(desc(templates.createdAt)),

    db.select({
      count: sql<number>`COALESCE(SUM(${usageDaily.generationCount}), 0)`,
      pages: sql<number>`COALESCE(SUM(${usageDaily.totalPages}), 0)`,
      bytes: sql<number>`COALESCE(SUM(${usageDaily.totalBytes}), 0)`,
    })
      .from(usageDaily)
      .where(eq(usageDaily.userId, id)),

    db.select({
      total: sql<number>`COUNT(*)`,
      completed: sql<number>`COUNT(*) FILTER (WHERE ${generations.status} = 'completed')`,
      failed: sql<number>`COUNT(*) FILTER (WHERE ${generations.status} = 'failed')`,
    })
      .from(generations)
      .where(eq(generations.userId, id)),
  ]);

  return NextResponse.json({
    user,
    generations: userGenerations,
    keys: userKeys,
    templates: userTemplates,
    usage: {
      totalGenerations: usageResult.count,
      totalPages: usageResult.pages,
      totalBytes: usageResult.bytes,
      completed: genStats.completed,
      failed: genStats.failed,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, any> = {};
  if (body.plan && ['free', 'starter', 'pro', 'enterprise'].includes(body.plan)) {
    updates.plan = body.plan;
  }
  if (body.role && ['user', 'admin'].includes(body.role)) {
    updates.role = body.role;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  // Don't allow deleting yourself
  if (id === admin.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
  if (!deleted) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
