import { NextRequest, NextResponse } from 'next/server';
import { db, templates, templateVersions, users } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const [tmpl] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, params.id), eq(templates.userId, userId)))
    .limit(1);

  if (!tmpl) {
    return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 });
  }

  const versions = await db
    .select()
    .from(templateVersions)
    .where(eq(templateVersions.templateId, params.id))
    .orderBy(desc(templateVersions.version));

  return NextResponse.json({
    current_version: tmpl.version,
    data: versions.map((v) => ({
      id: v.id,
      version: v.version,
      created_at: v.createdAt,
    })),
  });
}
