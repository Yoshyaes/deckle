/**
 * Marketplace abuse-reporting + moderation primitives.
 *
 * The flow:
 *   1. A logged-in user reports a public template via /v1/marketplace/:id/report.
 *      We block self-reports, double-reports (the partial unique index
 *      on (reporter_id, template_id) WHERE open/auto_actioned does the
 *      real enforcement; the app layer just produces a friendlier error).
 *   2. After each insert we count open reports for the template. If it
 *      crosses AUTO_UNPUBLISH_THRESHOLD, we flip the template to
 *      `is_public = false` in the same transaction and mark its open
 *      reports as `auto_actioned`. A moderator confirms or reverses.
 *   3. Admins list open + auto_actioned reports, dismiss false positives,
 *      or escalate a dismissal back to an active unpublish.
 *
 * Per-user submit rate limit lives in Redis (sliding window), not the DB,
 * because storms of report submits would otherwise hammer Postgres.
 */
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { templates, templateReports } from '../schema/db.js';
import { ValidationError, NotFoundError } from '../lib/errors.js';

export const AUTO_UNPUBLISH_THRESHOLD = 3;

const RATE_LIMIT_WINDOW_S = 60 * 60 * 24; // 1 day
const RATE_LIMIT_MAX_PER_USER = 20; // 20 reports/user/day — generous; spammers will trip it

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

/**
 * Submit a report. Returns the new report id and a flag indicating whether
 * this submission tripped the auto-unpublish threshold.
 *
 * Throws:
 *   - NotFoundError if the template doesn't exist or isn't public
 *   - ValidationError on self-report, duplicate report, or rate-limit hit
 */
export async function createTemplateReport(
  input: CreateReportInput,
): Promise<CreateReportResult> {
  // Sliding-window per-user rate limit. Stored as a list of timestamps.
  const rlKey = `marketplace:report-rl:${input.reporterId}`;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_S * 1000;
  await redis.zremrangebyscore(rlKey, 0, windowStart);
  const recent = await redis.zcard(rlKey);
  if (recent >= RATE_LIMIT_MAX_PER_USER) {
    throw new ValidationError(
      `You've reported ${recent} templates in the last 24 hours. Wait before submitting more.`,
    );
  }

  // Look up the template; refuse if it doesn't exist, isn't public,
  // or belongs to the reporter.
  const [tmpl] = await db
    .select({ id: templates.id, userId: templates.userId, isPublic: templates.isPublic })
    .from(templates)
    .where(eq(templates.id, input.templateId))
    .limit(1);

  if (!tmpl || !tmpl.isPublic) {
    throw new NotFoundError('Template');
  }
  if (tmpl.userId === input.reporterId) {
    throw new ValidationError('You cannot report your own template. Unpublish it instead.');
  }

  // Insert the report + count + maybe auto-action in a single transaction
  // so a race between two final-straw reports can't auto-action twice.
  const result = await db.transaction(async (tx) => {
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
      // Postgres unique_violation on the partial index = duplicate report.
      const code = (err as { code?: string }).code;
      if (code === '23505') {
        throw new ValidationError(
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
      // Crossed the threshold — hide the template and flag every open
      // report on it as auto_actioned so the admin queue surfaces the
      // pre-decided state instead of re-counting on every load.
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

  // Only record the rate-limit entry on a successful insert.
  await redis
    .pipeline()
    .zadd(rlKey, now, `${now}-${result.reportId}`)
    .expire(rlKey, RATE_LIMIT_WINDOW_S)
    .exec();

  return result;
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
  createdAt: Date;
}

/**
 * List open/auto-actioned reports for the moderation queue. Newest first.
 */
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
      createdAt: templateReports.createdAt,
    })
    .from(templateReports)
    .leftJoin(templates, eq(templates.id, templateReports.templateId))
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
    createdAt: r.createdAt,
  }));
}

/**
 * Mark a report as dismissed. If the report was auto-actioned, we re-publish
 * the template (false positive) and clear the auto-action on every report
 * tied to that template.
 */
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
    if (!report) throw new NotFoundError('Report');
    if (report.status === 'dismissed' || report.status === 'actioned') {
      throw new ValidationError('Report has already been resolved.');
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
      // Restore the template — dismissal of an auto-action means the
      // moderator decided the reports were not actionable.
      await tx
        .update(templates)
        .set({ isPublic: true, updatedAt: new Date() })
        .where(eq(templates.id, report.templateId));
      // Clear remaining auto_actioned reports on the same template so
      // they don't trigger again immediately.
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

/**
 * Confirm the report: unpublish the template (if still public) and mark
 * every open/auto_actioned report on it as actioned.
 */
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
    if (!report) throw new NotFoundError('Report');
    if (report.status === 'dismissed' || report.status === 'actioned') {
      throw new ValidationError('Report has already been resolved.');
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

/**
 * Quick stats for the admin dashboard badge.
 */
export async function getModerationStats(): Promise<{ open: number; autoActioned: number }> {
  const [row] = await db
    .select({
      open: sql<number>`COUNT(*) FILTER (WHERE ${templateReports.status} = 'open')`,
      autoActioned: sql<number>`COUNT(*) FILTER (WHERE ${templateReports.status} = 'auto_actioned')`,
    })
    .from(templateReports);
  return { open: Number(row?.open ?? 0), autoActioned: Number(row?.autoActioned ?? 0) };
}
