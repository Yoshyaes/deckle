/**
 * Template marketplace endpoints.
 * Public templates can be browsed, cloned, and rated by any authenticated user.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { templates, users } from '../schema/db.js';
import { tmplId } from '../lib/id.js';
import { eq, and, desc } from 'drizzle-orm';
import { ValidationError, NotFoundError, AppError } from '../lib/errors.js';
import {
  createTemplateReport,
  listOpenReports,
  dismissReport,
  actionReport,
  getModerationStats,
} from '../services/moderation.js';

const app = new Hono();

/**
 * GET / - Browse public templates in the marketplace.
 */
app.get('/', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '20') || 20, 100);
  const offset = Math.max(parseInt(c.req.query('offset') || '0') || 0, 0);
  const category = c.req.query('category');

  let query = db
    .select({
      id: templates.id,
      name: templates.name,
      version: templates.version,
      isPublic: templates.isPublic,
      createdAt: templates.createdAt,
      updatedAt: templates.updatedAt,
    })
    .from(templates)
    .where(eq(templates.isPublic, true))
    .orderBy(desc(templates.createdAt))
    .limit(limit)
    .offset(offset);

  const results = await query;

  return c.json({
    data: results.map((t) => ({
      id: t.id,
      name: t.name,
      version: t.version,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    })),
    has_more: results.length === limit,
  });
});

/**
 * GET /:id - Get a public template's details.
 */
app.get('/:id', async (c) => {
  const id = c.req.param('id');

  const [tmpl] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.isPublic, true)))
    .limit(1);

  if (!tmpl) throw new NotFoundError('Template');

  return c.json({
    id: tmpl.id,
    name: tmpl.name,
    html_content: tmpl.htmlContent,
    schema: tmpl.schema,
    version: tmpl.version,
    created_at: tmpl.createdAt,
    updated_at: tmpl.updatedAt,
  });
});

/**
 * POST /:id/clone - Clone a marketplace template into the user's account.
 */
app.post('/:id/clone', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  const [source] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.isPublic, true)))
    .limit(1);

  if (!source) throw new NotFoundError('Template');

  const newId = tmplId();
  const [cloned] = await db
    .insert(templates)
    .values({
      id: newId,
      userId: user.id,
      name: `${source.name} (copy)`,
      htmlContent: source.htmlContent,
      schema: source.schema,
      isPublic: false,
    })
    .returning();

  return c.json(
    {
      id: cloned.id,
      name: cloned.name,
      version: cloned.version,
      created_at: cloned.createdAt,
    },
    201,
  );
});

/**
 * POST /:id/publish - Publish one of the user's templates to the marketplace.
 */
app.post('/:id/publish', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  const [existing] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.userId, user.id)))
    .limit(1);

  if (!existing) throw new NotFoundError('Template');

  const [updated] = await db
    .update(templates)
    .set({ isPublic: true, updatedAt: new Date() })
    .where(eq(templates.id, id))
    .returning();

  return c.json({
    id: updated.id,
    name: updated.name,
    is_public: updated.isPublic,
  });
});

/**
 * POST /:id/unpublish - Remove a template from the marketplace.
 */
app.post('/:id/unpublish', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  const [existing] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.userId, user.id)))
    .limit(1);

  if (!existing) throw new NotFoundError('Template');

  const [updated] = await db
    .update(templates)
    .set({ isPublic: false, updatedAt: new Date() })
    .where(eq(templates.id, id))
    .returning();

  return c.json({
    id: updated.id,
    name: updated.name,
    is_public: updated.isPublic,
  });
});

// ── Abuse reporting ──────────────────────────────────────────────────────

const reportSchema = z.object({
  reason: z.enum(['spam', 'malicious', 'copyright', 'inappropriate', 'other']),
  notes: z.string().trim().max(1000).optional(),
});

/**
 * POST /:id/report - Flag a public template for moderator review.
 * Per-user rate limited; self-reports refused; duplicate open reports
 * from the same user collapse to a single record.
 */
app.post('/:id/report', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }

  const result = await createTemplateReport({
    templateId: id,
    reporterId: user.id,
    reason: parsed.data.reason,
    notes: parsed.data.notes,
  });

  return c.json(
    {
      report_id: result.reportId,
      auto_actioned: result.autoActioned,
    },
    201,
  );
});

// ── Admin-only moderation ────────────────────────────────────────────────

/**
 * Require the caller to be a workspace admin. The auth middleware has
 * already verified the bearer token; we just gate by `users.role`.
 */
async function requireAdmin(c: { get: (k: 'user') => { id: string } }): Promise<{ id: string }> {
  const user = c.get('user');
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row || row.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Admin role required');
  }
  return user;
}

/**
 * GET /admin/reports - List open + auto-actioned reports.
 */
app.get('/admin/reports', async (c) => {
  await requireAdmin(c);
  const limit = Math.min(parseInt(c.req.query('limit') || '50') || 50, 200);
  const offset = Math.max(parseInt(c.req.query('offset') || '0') || 0, 0);
  const rows = await listOpenReports({ limit, offset });
  return c.json({
    data: rows.map((r) => ({
      id: r.id,
      template_id: r.templateId,
      template_name: r.templateName,
      template_is_public: r.templateIsPublic,
      reason: r.reason,
      notes: r.notes,
      status: r.status,
      reporter_id: r.reporterId,
      created_at: r.createdAt,
    })),
  });
});

/**
 * GET /admin/reports/stats - Counts for the moderation badge.
 */
app.get('/admin/reports/stats', async (c) => {
  await requireAdmin(c);
  return c.json(await getModerationStats());
});

const resolutionSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
});

/**
 * POST /admin/reports/:reportId/dismiss - Close a report as a false positive.
 * If the report had auto-unpublished the template, this reverses that.
 */
app.post('/admin/reports/:reportId/dismiss', async (c) => {
  const moderator = await requireAdmin(c);
  const reportId = c.req.param('reportId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = resolutionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }
  await dismissReport(reportId, moderator.id, parsed.data.notes);
  return c.json({ ok: true, status: 'dismissed' });
});

/**
 * POST /admin/reports/:reportId/action - Confirm the report: unpublish the
 * template and close every open report on it.
 */
app.post('/admin/reports/:reportId/action', async (c) => {
  const moderator = await requireAdmin(c);
  const reportId = c.req.param('reportId');
  const body = await c.req.json().catch(() => ({}));
  const parsed = resolutionSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }
  await actionReport(reportId, moderator.id, parsed.data.notes);
  return c.json({ ok: true, status: 'actioned' });
});

export default app;
