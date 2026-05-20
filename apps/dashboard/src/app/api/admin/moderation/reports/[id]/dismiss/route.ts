import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { assertSameOrigin } from '@/lib/csrf';
import { dismissReport, ModerationError } from '@/lib/moderation';

export const dynamic = 'force-dynamic';

const schema = z.object({ notes: z.string().trim().max(1000).optional() });

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const csrf = assertSameOrigin(request);
  if (!csrf.ok) {
    return NextResponse.json(
      { error: { message: 'Forbidden', reason: csrf.reason } },
      { status: 403 },
    );
  }
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues.map((i) => i.message).join(', ') } },
      { status: 400 },
    );
  }

  try {
    await dismissReport(params.id, admin.id, parsed.data.notes);
    return NextResponse.json({ ok: true, status: 'dismissed' });
  } catch (err) {
    if (err instanceof ModerationError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status },
      );
    }
    throw err;
  }
}
