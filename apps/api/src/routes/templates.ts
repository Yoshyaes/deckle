import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { templates, templateVersions, generations } from '../schema/db.js';
import { tmplId } from '../lib/id.js';
import { eq, and, desc } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '../lib/errors.js';

const MAX_TEMPLATE_HTML_SIZE = 10_485_760; // 10MB

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  html_content: z.string().min(1).max(MAX_TEMPLATE_HTML_SIZE),
  schema: z.record(z.unknown()).optional(),
  is_public: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  html_content: z.string().min(1).max(MAX_TEMPLATE_HTML_SIZE).optional(),
  schema: z.record(z.unknown()).optional(),
  is_public: z.boolean().optional(),
});

const app = new Hono();

app.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = createTemplateSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }

  const user = c.get('user');
  const id = tmplId();

  const [template] = await db
    .insert(templates)
    .values({
      id,
      userId: user.id,
      name: parsed.data.name,
      htmlContent: parsed.data.html_content,
      schema: parsed.data.schema || null,
      isPublic: parsed.data.is_public || false,
    })
    .returning();

  return c.json(
    {
      id: template.id,
      name: template.name,
      html_content: template.htmlContent,
      schema: template.schema,
      version: template.version,
      is_public: template.isPublic,
      created_at: template.createdAt,
    },
    201,
  );
});

app.get('/', async (c) => {
  const user = c.get('user');

  const results = await db
    .select()
    .from(templates)
    .where(eq(templates.userId, user.id))
    .orderBy(desc(templates.createdAt))
    .limit(100);

  return c.json({
    data: results.map((t) => ({
      id: t.id,
      name: t.name,
      version: t.version,
      is_public: t.isPublic,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
    })),
  });
});

app.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const [tmpl] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.userId, user.id)))
    .limit(1);

  if (!tmpl) throw new NotFoundError('Template');

  return c.json({
    id: tmpl.id,
    name: tmpl.name,
    html_content: tmpl.htmlContent,
    schema: tmpl.schema,
    version: tmpl.version,
    is_public: tmpl.isPublic,
    created_at: tmpl.createdAt,
    updated_at: tmpl.updatedAt,
  });
});

app.put('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateTemplateSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }

  const [existing] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.userId, user.id)))
    .limit(1);

  if (!existing) throw new NotFoundError('Template');

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name) updateData.name = parsed.data.name;
  if (parsed.data.html_content) {
    // Save current version to history before overwriting
    await db.insert(templateVersions).values({
      templateId: id,
      version: existing.version,
      htmlContent: existing.htmlContent,
      schema: existing.schema,
    });
    updateData.htmlContent = parsed.data.html_content;
    updateData.version = existing.version + 1;
  }
  if (parsed.data.schema !== undefined) updateData.schema = parsed.data.schema;
  if (parsed.data.is_public !== undefined) updateData.isPublic = parsed.data.is_public;

  const [updated] = await db
    .update(templates)
    .set(updateData)
    .where(eq(templates.id, id))
    .returning();

  return c.json({
    id: updated.id,
    name: updated.name,
    html_content: updated.htmlContent,
    schema: updated.schema,
    version: updated.version,
    is_public: updated.isPublic,
    created_at: updated.createdAt,
    updated_at: updated.updatedAt,
  });
});

// List version history for a template
app.get('/:id/versions', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const [tmpl] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.userId, user.id)))
    .limit(1);

  if (!tmpl) throw new NotFoundError('Template');

  const versions = await db
    .select()
    .from(templateVersions)
    .where(eq(templateVersions.templateId, id))
    .orderBy(desc(templateVersions.version))
    .limit(100);

  return c.json({
    current_version: tmpl.version,
    data: versions.map((v) => ({
      id: v.id,
      version: v.version,
      created_at: v.createdAt,
    })),
  });
});

// Get a specific version's content
app.get('/:id/versions/:versionId', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const versionId = c.req.param('versionId');

  const [tmpl] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.userId, user.id)))
    .limit(1);

  if (!tmpl) throw new NotFoundError('Template');

  const [ver] = await db
    .select()
    .from(templateVersions)
    .where(eq(templateVersions.id, versionId))
    .limit(1);

  if (!ver || ver.templateId !== id) throw new NotFoundError('Version');

  return c.json({
    id: ver.id,
    version: ver.version,
    html_content: ver.htmlContent,
    schema: ver.schema,
    created_at: ver.createdAt,
  });
});

// Restore a template to a previous version
app.post('/:id/restore', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = z.object({ version_id: z.string() }).safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }
  const { version_id } = parsed.data;

  const [existing] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.userId, user.id)))
    .limit(1);

  if (!existing) throw new NotFoundError('Template');

  const [ver] = await db
    .select()
    .from(templateVersions)
    .where(eq(templateVersions.id, version_id))
    .limit(1);

  if (!ver || ver.templateId !== id) throw new NotFoundError('Version');

  // Save current version to history
  await db.insert(templateVersions).values({
    templateId: id,
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
    .where(eq(templates.id, id))
    .returning();

  return c.json({
    id: updated.id,
    name: updated.name,
    html_content: updated.htmlContent,
    version: updated.version,
    restored_from: ver.version,
  });
});

app.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const [existing] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.userId, user.id)))
    .limit(1);

  if (!existing) throw new NotFoundError('Template');

  // Nullify templateId on related generations to avoid FK constraint
  await db
    .update(generations)
    .set({ templateId: null })
    .where(eq(generations.templateId, id));

  await db.delete(templates).where(eq(templates.id, id));

  return c.json({ deleted: true });
});

export default app;
