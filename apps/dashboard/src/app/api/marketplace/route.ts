import { NextRequest, NextResponse } from 'next/server';
import { db, templates } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const results = await db
    .select({
      id: templates.id,
      name: templates.name,
      version: templates.version,
      isPublic: templates.isPublic,
      createdAt: templates.createdAt,
      updatedAt: templates.updatedAt,
    })
    .from(templates)
    .where(eq(templates.isPublic, true))
    .orderBy(desc(templates.createdAt))
    .limit(50);

  return NextResponse.json({
    data: results.map((t) => ({
      id: t.id,
      name: t.name,
      version: t.version,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    })),
  });
}
