import { Hono } from 'hono';
import { starterTemplates } from '../scripts/starter-templates.js';

const app = new Hono();

// List all starter templates (public, no auth)
app.get('/', (c) => {
  return c.json({
    data: starterTemplates.map((t) => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      category: t.category,
      sample_data: t.sampleData,
    })),
  });
});

// Get a single starter template with full HTML (public, no auth)
app.get('/:slug', (c) => {
  const slug = c.req.param('slug');
  const tmpl = starterTemplates.find((t) => t.slug === slug);
  if (!tmpl) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Starter template not found' } }, 404);
  }
  return c.json({
    slug: tmpl.slug,
    name: tmpl.name,
    description: tmpl.description,
    category: tmpl.category,
    html_content: tmpl.htmlContent,
    sample_data: tmpl.sampleData,
  });
});

export default app;
