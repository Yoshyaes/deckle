import { NextRequest, NextResponse } from 'next/server';
import { db, templates, templateVersions, users } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const body = await request.json();
  const versionId = body.version_id;
  if (!versionId) {
    return NextResponse.json({ error: { message: 'version_id required' } }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, params.id), eq(templates.userId, userId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: { message: 'Template not found' } }, { status: 404 });
  }

  const [ver] = await db
    .select()
    .from(templateVersions)
    .where(eq(templateVersions.id, versionId))
    .limit(1);

  if (!ver || ver.templateId !== params.id) {
    return NextResponse.json({ error: { message: 'Version not found' } }, { status: 404 });
  }

  // Save current version to history
  await db.insert(templateVersions).values({
    templateId: params.id,
    version: existing.version,
    htmlContent: existing.htmlContent,
    schema: existing.schema,
  });

  // Restore
  const [updated] = await db
    .update(templates)
    .set({
      htmlContent: ver.htmlContent,
      schema: ver.schema,
      version: existing.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(templates.id, params.id))
    .returning();

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    version: updated.version,
    restored_from: ver.version,
  });
}
