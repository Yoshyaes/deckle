import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { generations } from '../schema/db.js';
import { eq, and, desc, lt } from 'drizzle-orm';
import { NotFoundError } from '../lib/errors.js';
import { safeParseInt } from '../lib/utils.js';

const app = new Hono();

app.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const [gen] = await db
    .select()
    .from(generations)
    .where(and(eq(generations.id, id), eq(generations.userId, user.id)))
    .limit(1);

  if (!gen) {
    throw new NotFoundError('Generation');
  }

  return c.json({
    id: gen.id,
    template_id: gen.templateId,
    input_type: gen.inputType,
    status: gen.status,
    url: gen.pdfUrl,
    pages: gen.pages,
    file_size: gen.fileSizeBytes,
    generation_time_ms: gen.generationTimeMs,
    error: gen.error,
    created_at: gen.createdAt,
  });
});

app.get('/', async (c) => {
  const user = c.get('user');
  const limit = safeParseInt(c.req.query('limit'), 50, 100);
  const cursor = c.req.query('cursor'); // ISO date string for cursor-based pagination
  const offset = safeParseInt(c.req.query('offset'), 0, 10000); // kept for backward compat

  const conditions = [eq(generations.userId, user.id)];
  if (cursor) {
    conditions.push(lt(generations.createdAt, new Date(cursor)));
  }

  const results = await db
    .select()
    .from(generations)
    .where(and(...conditions))
    .orderBy(desc(generations.createdAt))
    .limit(limit + 1) // fetch one extra to detect has_more
    .offset(cursor ? 0 : offset);

  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].createdAt?.toISOString() : undefined;

  return c.json({
    data: data.map((gen) => ({
      id: gen.id,
      template_id: gen.templateId,
      input_type: gen.inputType,
      status: gen.status,
      url: gen.pdfUrl,
      pages: gen.pages,
      file_size: gen.fileSizeBytes,
      generation_time_ms: gen.generationTimeMs,
      created_at: gen.createdAt,
    })),
    has_more: hasMore,
    next_cursor: nextCursor,
  });
});

export default app;
