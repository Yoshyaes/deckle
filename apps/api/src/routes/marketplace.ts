/**
 * Template marketplace endpoints.
 * Public templates can be browsed, cloned, and rated by any authenticated user.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { templates } from '../schema/db.js';
import { tmplId } from '../lib/id.js';
import { eq, and, desc } from 'drizzle-orm';
import { ValidationError, NotFoundError } from '../lib/errors.js';

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

export default app;
