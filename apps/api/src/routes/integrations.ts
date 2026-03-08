/**
 * Integration endpoints for Zapier, Make (Integromat), and n8n.
 *
 * Provides:
 * - Webhook subscription management (subscribe/unsubscribe)
 * - Polling trigger endpoint for platforms that use polling
 * - Action endpoints (generate PDF, create template)
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { generations, templates } from '../schema/db.js';
import { genId, tmplId } from '../lib/id.js';
import { renderPdf } from '../services/renderer.js';
import { uploadPdf } from '../services/storage.js';
import { mergeTemplate } from '../services/templates.js';
import { eq, desc, and, gt } from 'drizzle-orm';
import { ValidationError, NotFoundError, UsageLimitError } from '../lib/errors.js';
import { checkUsageLimit, incrementUsage } from '../services/usage.js';

const app = new Hono();

/**
 * GET /triggers/new-generation - Polling trigger for new generations.
 * Returns the most recent generations, ordered by creation time.
 * Zapier uses this to detect new items.
 */
app.get('/triggers/new-generation', async (c) => {
  const user = c.get('user');
  const limit = Math.min(parseInt(c.req.query('limit') || '10') || 10, 100);

  const results = await db
    .select()
    .from(generations)
    .where(eq(generations.userId, user.id))
    .orderBy(desc(generations.createdAt))
    .limit(limit);

  return c.json(
    results.map((g) => ({
      id: g.id,
      template_id: g.templateId,
      input_type: g.inputType,
      status: g.status,
      url: g.pdfUrl,
      pages: g.pages,
      file_size: g.fileSizeBytes,
      generation_time_ms: g.generationTimeMs,
      error: g.error,
      created_at: g.createdAt,
    })),
  );
});

/**
 * GET /triggers/new-template - Polling trigger for new templates.
 */
app.get('/triggers/new-template', async (c) => {
  const user = c.get('user');
  const limit = Math.min(parseInt(c.req.query('limit') || '10') || 10, 100);

  const results = await db
    .select()
    .from(templates)
    .where(eq(templates.userId, user.id))
    .orderBy(desc(templates.createdAt))
    .limit(limit);

  return c.json(
    results.map((t) => ({
      id: t.id,
      name: t.name,
      version: t.version,
      is_public: t.isPublic,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    })),
  );
});

/**
 * POST /actions/generate - Simplified generate action for Zapier/Make.
 * Accepts flat parameters instead of nested objects.
 */
const zapierGenerateSchema = z.object({
  html: z.string().optional(),
  template_id: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  format: z.enum(['A4', 'Letter', 'Legal']).default('A4'),
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
});

app.post('/actions/generate', async (c) => {
  const body = await c.req.json();
  const parsed = zapierGenerateSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }

  const user = c.get('user');
  let finalHtml: string;

  if (parsed.data.template_id) {
    const [tmpl] = await db
      .select()
      .from(templates)
      .where(
        and(eq(templates.id, parsed.data.template_id), eq(templates.userId, user.id)),
      )
      .limit(1);

    if (!tmpl) {
      throw new NotFoundError('Template');
    }
    finalHtml = mergeTemplate(tmpl.htmlContent, parsed.data.data || {});
  } else if (parsed.data.html) {
    finalHtml = parsed.data.html;
  } else {
    throw new ValidationError('Either html or template_id is required');
  }

  const withinLimit = await checkUsageLimit(user.id, user.plan);
  if (!withinLimit) throw new UsageLimitError();

  const generationId = genId();
  const startTime = Date.now();
  const result = await renderPdf(finalHtml, {
    format: parsed.data.format,
    orientation: parsed.data.orientation,
  });

  const pdfUrl = await uploadPdf(generationId, result.buffer);

  await db.insert(generations).values({
    id: generationId,
    userId: user.id,
    templateId: parsed.data.template_id || null,
    inputType: parsed.data.template_id ? 'template' : 'html',
    status: 'completed',
    pdfUrl,
    fileSizeBytes: result.fileSize,
    pages: result.pages,
    generationTimeMs: Date.now() - startTime,
  });

  await incrementUsage(user.id, result.pages, result.fileSize);

  return c.json({
    id: generationId,
    url: pdfUrl,
    pages: result.pages,
    file_size: result.fileSize,
  });
});

/**
 * GET /auth/test - Auth test endpoint for Zapier connection setup.
 */
app.get('/auth/test', async (c) => {
  const user = c.get('user');
  return c.json({
    authenticated: true,
    email: user.email,
    plan: user.plan,
  });
});

export default app;
