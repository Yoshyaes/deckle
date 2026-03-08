import { NextRequest, NextResponse } from 'next/server';
import { db, templates, templateVersions } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { getUserId } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const body = await request.json();

  const [existing] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, params.id), eq(templates.userId, userId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: { message: 'Template not found' } }, { status: 404 });
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name) updateData.name = body.name;
  if (body.html_content) {
    // Save current version to history
    await db.insert(templateVersions).values({
      templateId: params.id,
      version: existing.version,
      htmlContent: existing.htmlContent,
      schema: existing.schema,
    });
    updateData.htmlContent = body.html_content;
    updateData.version = existing.version + 1;
  }

  const [updated] = await db
    .update(templates)
    .set(updateData)
    .where(eq(templates.id, params.id))
    .returning();

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    version: updated.version,
  });
}

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

  return NextResponse.json({
    id: tmpl.id,
    name: tmpl.name,
    html_content: tmpl.htmlContent,
    version: tmpl.version,
  });
}
