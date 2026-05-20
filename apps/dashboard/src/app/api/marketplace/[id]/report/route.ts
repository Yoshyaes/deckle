import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/data';
import { assertSameOrigin } from '@/lib/csrf';
import { createTemplateReport, ModerationError } from '@/lib/moderation';

export const dynamic = 'force-dynamic';

const reportSchema = z.object({
  reason: z.enum(['spam', 'malicious', 'copyright', 'inappropriate', 'other']),
  notes: z.string().trim().max(1000).optional(),
});

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
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues.map((i) => i.message).join(', ') } },
      { status: 400 },
    );
  }

  try {
    const result = await createTemplateReport({
      templateId: params.id,
      reporterId: user.id,
      reason: parsed.data.reason,
      notes: parsed.data.notes,
    });
    return NextResponse.json(
      { report_id: result.reportId, auto_actioned: result.autoActioned },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ModerationError) {
      const status =
        err.code === 'NOT_FOUND' ? 404 :
        err.code === 'DUPLICATE' ? 409 :
        err.code === 'SELF_REPORT' ? 400 : 400;
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status },
      );
    }
    throw err;
  }
}
