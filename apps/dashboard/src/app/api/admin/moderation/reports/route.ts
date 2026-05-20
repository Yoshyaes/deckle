import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { listOpenReports, getModerationStats } from '@/lib/moderation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50') || 50, 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0') || 0, 0);
  const includeStats = url.searchParams.get('stats') === '1';

  const reports = await listOpenReports({ limit, offset });
  const stats = includeStats ? await getModerationStats() : undefined;

  return NextResponse.json({
    data: reports.map((r) => ({
      id: r.id,
      template_id: r.templateId,
      template_name: r.templateName,
      template_is_public: r.templateIsPublic,
      reason: r.reason,
      notes: r.notes,
      status: r.status,
      reporter_id: r.reporterId,
      reporter_email: r.reporterEmail,
      created_at: r.createdAt,
    })),
    ...(stats ? { stats } : {}),
  });
}
