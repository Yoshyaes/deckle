/**
 * Dashboard-side mirror of apps/api/src/services/moderation.ts.
 *
 * The dashboard talks to the same Postgres directly (same pattern as
 * marketplace clone), so we duplicate the small amount of moderation
 * logic instead of routing through the API server. Behaviour MUST
 * stay in sync with the API copy — the schema and threshold live in
 * exactly one place per app, but the SQL is small enough to maintain
 * twice. If this drifts, the integration tests on the API side will
 * still cover the SDK-facing surface.
 */
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, templates, templateReports, users } from './db';

export const AUTO_UNPUBLISH_THRESHOLD = 3;

export type TemplateReportReason =
  | 'spam'
  | 'malicious'
  | 'copyright'
  | 'inappropriate'
  | 'other';

export interface CreateReportInput {
  templateId: string;
  reporterId: string;
  reason: TemplateReportReason;
  notes?: string;
}

export interface CreateReportResult {
  reportId: string;
  autoActioned: boolean;
}

export class ModerationError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'SELF_REPORT' | 'DUPLICATE' | 'ALREADY_RESOLVED',
    message: string,
  ) {
    super(message);
  }
}

export async function createTemplateReport(
  input: CreateReportInput,
): Promise<CreateReportResult> {
  const [tmpl] = await db
    .select({ id: templates.id, userId: templates.userId, isPublic: templates.isPublic })
    .from(templates)
    .where(eq(templates.id, input.templateId))
    .limit(1);
  if (!tmpl || !tmpl.isPublic) {
    throw new ModerationError('NOT_FOUND', 'Template not found');
  }
  if (tmpl.userId === input.reporterId) {
    throw new ModerationError(
      'SELF_REPORT',
      'You cannot report your own template. Unpublish it instead.',
    );
  }

  return db.transaction(async (tx) => {
    let inserted: { id: string } | undefined;
    try {
      const rows = await tx
        .insert(templateReports)
        .values({
          templateId: input.templateId,
          reporterId: input.reporterId,
          reason: input.reason,
          notes: input.notes ?? null,
        })
        .returning({ id: templateReports.id });
      inserted = rows[0];
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === '23505') {
        throw new ModerationError(
          'DUPLICATE',
          'You already reported this template. A moderator will review it.',
        );
      }
      throw err;
    }

    const [openCount] = await tx
      .select({ n: count() })
      .from(templateReports)
      .where(
        and(
          eq(templateReports.templateId, input.templateId),
          inArray(templateReports.status, ['open', 'auto_actioned']),
        ),
      );

    let autoActioned = false;
    if ((openCount?.n ?? 0) >= AUTO_UNPUBLISH_THRESHOLD) {
      await tx
        .update(templates)
        .set({ isPublic: false, updatedAt: new Date() })
        .where(eq(templates.id, input.templateId));
      await tx
        .update(templateReports)
        .set({ status: 'auto_actioned' })
        .where(
          and(
            eq(templateReports.templateId, input.templateId),
            eq(templateReports.status, 'open'),
          ),
        );
      autoActioned = true;
    }

    return { reportId: inserted!.id, autoActioned };
  });
}

export interface ReportWithContext {
  id: string;
  templateId: string;
  templateName: string | null;
  templateIsPublic: boolean;
  reason: TemplateReportReason;
  notes: string | null;
  status: 'open' | 'auto_actioned' | 'dismissed' | 'actioned';
  reporterId: string;
  reporterEmail: string | null;
  createdAt: Date;
}

export async function listOpenReports(opts: {
  limit?: number;
  offset?: number;
}): Promise<ReportWithContext[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const rows = await db
    .select({
      id: templateReports.id,
      templateId: templateReports.templateId,
      templateName: templates.name,
      templateIsPublic: templates.isPublic,
      reason: templateReports.reason,
      notes: templateReports.notes,
      status: templateReports.status,
      reporterId: templateReports.reporterId,
      reporterEmail: users.email,
      createdAt: templateReports.createdAt,
    })
    .from(templateReports)
    .leftJoin(templates, eq(templates.id, templateReports.templateId))
    .leftJoin(users, eq(users.id, templateReports.reporterId))
    .where(inArray(templateReports.status, ['open', 'auto_actioned']))
    .orderBy(desc(templateReports.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    id: r.id,
    templateId: r.templateId,
    templateName: r.templateName,
    templateIsPublic: r.templateIsPublic ?? false,
    reason: r.reason as TemplateReportReason,
    notes: r.notes,
    status: r.status as ReportWithContext['status'],
    reporterId: r.reporterId,
    reporterEmail: r.reporterEmail,
    createdAt: r.createdAt,
  }));
}

export async function dismissReport(
  reportId: string,
  moderatorId: string,
  notes?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [report] = await tx
      .select()
      .from(templateReports)
      .where(eq(templateReports.id, reportId))
      .limit(1);
    if (!report) throw new ModerationError('NOT_FOUND', 'Report not found');
    if (report.status === 'dismissed' || report.status === 'actioned') {
      throw new ModerationError('ALREADY_RESOLVED', 'Report has already been resolved.');
    }

    await tx
      .update(templateReports)
      .set({
        status: 'dismissed',
        resolverId: moderatorId,
        resolverNotes: notes ?? null,
        resolvedAt: new Date(),
      })
      .where(eq(templateReports.id, reportId));

    if (report.status === 'auto_actioned') {
      await tx
        .update(templates)
        .set({ isPublic: true, updatedAt: new Date() })
        .where(eq(templates.id, report.templateId));
      await tx
        .update(templateReports)
        .set({
          status: 'dismissed',
          resolverId: moderatorId,
          resolverNotes: notes ?? 'Auto-action reversed',
          resolvedAt: new Date(),
        })
        .where(
          and(
            eq(templateReports.templateId, report.templateId),
            eq(templateReports.status, 'auto_actioned'),
          ),
        );
    }
  });
}

export async function actionReport(
  reportId: string,
  moderatorId: string,
  notes?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [report] = await tx
      .select()
      .from(templateReports)
      .where(eq(templateReports.id, reportId))
      .limit(1);
    if (!report) throw new ModerationError('NOT_FOUND', 'Report not found');
    if (report.status === 'dismissed' || report.status === 'actioned') {
      throw new ModerationError('ALREADY_RESOLVED', 'Report has already been resolved.');
    }

    await tx
      .update(templates)
      .set({ isPublic: false, updatedAt: new Date() })
      .where(eq(templates.id, report.templateId));

    await tx
      .update(templateReports)
      .set({
        status: 'actioned',
        resolverId: moderatorId,
        resolverNotes: notes ?? null,
        resolvedAt: new Date(),
      })
      .where(
        and(
          eq(templateReports.templateId, report.templateId),
          inArray(templateReports.status, ['open', 'auto_actioned']),
        ),
      );
  });
}

export async function getModerationStats(): Promise<{ open: number; autoActioned: number }> {
  const [row] = await db
    .select({
      open: sql<number>`COUNT(*) FILTER (WHERE ${templateReports.status} = 'open')`,
      autoActioned: sql<number>`COUNT(*) FILTER (WHERE ${templateReports.status} = 'auto_actioned')`,
    })
    .from(templateReports);
  return { open: Number(row?.open ?? 0), autoActioned: Number(row?.autoActioned ?? 0) };
}
