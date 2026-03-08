import { NextRequest, NextResponse } from 'next/server';
import { db, templates, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getUserId } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, html_content, sample_data } = body;

  if (!name || !html_content) {
    return NextResponse.json({ error: { message: 'Missing name or html_content' } }, { status: 400 });
  }

  const id = `tmpl_${nanoid(16)}`;

  const [template] = await db
    .insert(templates)
    .values({
      id,
      userId,
      name,
      htmlContent: html_content,
      schema: sample_data || null,
    })
    .returning();

  return NextResponse.json(
    { id: template.id, name: template.name, version: template.version },
    { status: 201 },
  );
}
