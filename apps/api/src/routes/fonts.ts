import { Hono } from 'hono';
import { uploadFont, getUserFonts, deleteFont } from '../services/fonts.js';
import { ValidationError, NotFoundError } from '../lib/errors.js';

const app = new Hono();

app.post('/', async (c) => {
  const user = c.get('user');

  const contentType = c.req.header('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const family = formData.get('family') as string | null;

    if (!file) throw new ValidationError('Missing "file" in form data');
    if (!family) throw new ValidationError('Missing "family" name in form data');

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadFont(user.id, buffer, file.name, file.type, family);
    return c.json(result, 201);
  }

  throw new ValidationError('Content-Type must be multipart/form-data');
});

app.get('/', async (c) => {
  const user = c.get('user');
  const fonts = await getUserFonts(user.id);
  return c.json({ fonts });
});

app.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const deleted = await deleteFont(user.id, id);

  if (!deleted) throw new NotFoundError('Font');

  return c.json({ deleted: true });
});

export default app;
