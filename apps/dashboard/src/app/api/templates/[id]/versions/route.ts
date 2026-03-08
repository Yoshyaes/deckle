import { NextRequest, NextResponse } from 'next/server';
import { db, templates, templateVersions, users } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }
  const userId = user.id;

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
