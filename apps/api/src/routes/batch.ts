import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { generations } from '../schema/db.js';
import { genId } from '../lib/id.js';
import { generationQueue } from '../services/queue.js';
import { checkAndReserveUsage } from '../services/usage.js';
import { ValidationError, UsageLimitError } from '../lib/errors.js';
import { nanoid } from 'nanoid';
import { redis } from '../lib/redis.js';

const marginSchema = z.union([
  z.string(),
  z.object({
    top: z.string().optional(),
    right: z.string().optional(),
    bottom: z.string().optional(),
    left: z.string().optional(),
  }),
]);

const formatSchema = z.union([
  z.enum(['A4', 'Letter', 'Legal']),
  z.object({ width: z.string(), height: z.string() }),
]);

const batchItemSchema = z.object({
  html: z.string().optional(),
  react: z.string().optional(),
  template: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  styles: z.string().optional(),
  options: z
    .object({
      format: formatSchema.optional(),
      margin: marginSchema.optional(),
      orientation: z.enum(['portrait', 'landscape']).optional(),
      header: z.string().optional(),
      footer: z.string().optional(),
      printBackground: z.boolean().optional(),
    })
    .optional(),
  output: z.enum(['url', 'base64']).default('url'),
});

const batchSchema = z.object({
  items: z.array(batchItemSchema).min(1).max(100),
  webhook: z.string().url().optional(),
});

const app = new Hono();

/**
 * POST /v1/generate/batch
 * Submit multiple PDF generation jobs to the async queue.
 */
app.post('/', async (c) => {
  // Idempotency key support — return cached response if key seen within 24h
  const idempotencyKey = c.req.header('Idempotency-Key');
  if (idempotencyKey) {
    const cacheKey = `idempotency:batch:${idempotencyKey}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return c.json(JSON.parse(cached as string), 202);
      }
    } catch {
      // Ignore Redis errors for idempotency — proceed with new request
    }
  }

  const body = await c.req.json();
  const parsed = batchSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }

  const { items, webhook } = parsed.data;
  const user = c.get('user');

  // Atomically check and reserve usage slots for the batch.
  // We reserve one slot upfront to prevent concurrent batch submissions from
  // all passing the limit check simultaneously.
  const withinLimit = await checkAndReserveUsage(user.id, user.plan);
  if (!withinLimit) {
    throw new UsageLimitError();
  }

  // Validate each item has at least one input
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.html && !item.react && !item.template) {
      throw new ValidationError(`Item ${i}: one of "html", "react", or "template" must be provided`);
    }
  }

  const batchId = `batch_${nanoid(16)}`;
  const results: { id: string; index: number }[] = [];

  // Create generation records and enqueue jobs
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const generationId = genId();

    await db.insert(generations).values({
      id: generationId,
      userId: user.id,
      templateId: item.template || null,
      inputType: item.template ? 'template' : item.react ? 'react' : 'html',
      status: 'queued',
    });

    await generationQueue.add(`gen-${generationId}`, {
      generationId,
      userId: user.id,
      html: item.html,
      react: item.react,
      templateId: item.template,
      data: item.data,
      styles: item.styles,
      options: item.options,
      output: item.output,
      webhook: i === items.length - 1 ? webhook : undefined, // webhook on last item
      batchId,
    });

    results.push({ id: generationId, index: i });
  }

  const responseBody = {
    batch_id: batchId,
    total: items.length,
    generations: results,
    status: 'queued',
  };

  // Cache response for idempotency key
  if (idempotencyKey) {
    const cacheKey = `idempotency:batch:${idempotencyKey}`;
    try {
      await redis.set(cacheKey, JSON.stringify(responseBody), 'EX', 86400); // 24h TTL
    } catch {
      // Ignore Redis errors for idempotency caching
    }
  }

  return c.json(responseBody, 202);
});

export default app;
