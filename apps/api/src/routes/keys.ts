import { Hono } from 'hono';
import { z } from 'zod';
import { createApiKey, listApiKeys, revokeApiKey } from '../services/apikeys.js';
import { ValidationError, NotFoundError } from '../lib/errors.js';

const app = new Hono();

const createKeySchema = z.object({
  name: z.string().min(1).max(255).default('Default'),
});

app.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError('Invalid key name');
  }

  const user = c.get('user');
  const result = await createApiKey(user.id, parsed.data.name);

  return c.json(result, 201);
});

app.get('/', async (c) => {
  const user = c.get('user');
  const keys = await listApiKeys(user.id);
  return c.json({ data: keys });
});

app.delete('/:id', async (c) => {
  const user = c.get('user');
  const keyId = c.req.param('id');
  const deleted = await revokeApiKey(user.id, keyId);

  if (!deleted) {
    throw new NotFoundError('API key');
  }

  return c.json({ deleted: true });
});

export default app;
