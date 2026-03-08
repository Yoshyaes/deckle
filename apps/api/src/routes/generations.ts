import { Hono } from 'hono';
import { db } from '../lib/db.js';
import { generations } from '../schema/db.js';
import { eq, and, desc } from 'drizzle-orm';
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
  const offset = safeParseInt(c.req.query('offset'), 0, 10000);

  const results = await db
    .select()
    .from(generations)
    .where(eq(generations.userId, user.id))
    .orderBy(desc(generations.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    data: results.map((gen) => ({
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
    has_more: results.length === limit,
  });
});

export default app;
