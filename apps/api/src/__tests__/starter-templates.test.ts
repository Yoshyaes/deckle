import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import starterTemplateRoutes from '../routes/starter-templates.js';
import { starterTemplates } from '../scripts/starter-templates.js';

describe('Starter templates endpoint', () => {
  const app = new Hono();
  app.route('/v1/starter-templates', starterTemplateRoutes);

  it('GET /v1/starter-templates returns all templates', async () => {
    const res = await app.request('/v1/starter-templates');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(starterTemplates.length);
  });

  it('each template has required fields', async () => {
    const res = await app.request('/v1/starter-templates');
    const body = await res.json();

    for (const tmpl of body.data) {
      expect(tmpl.slug).toBeDefined();
      expect(tmpl.name).toBeDefined();
      expect(tmpl.description).toBeDefined();
      expect(tmpl.category).toBeDefined();
      expect(tmpl.sample_data).toBeDefined();
      expect(['business', 'finance', 'legal', 'marketing']).toContain(tmpl.category);
    }
  });

  it('does not expose htmlContent in list endpoint', async () => {
    const res = await app.request('/v1/starter-templates');
    const body = await res.json();

    for (const tmpl of body.data) {
      expect(tmpl.html_content).toBeUndefined();
      expect(tmpl.htmlContent).toBeUndefined();
    }
  });

  it('GET /v1/starter-templates/:slug returns full template with HTML', async () => {
    const slug = starterTemplates[0].slug;
    const res = await app.request(`/v1/starter-templates/${slug}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.slug).toBe(slug);
    expect(body.name).toBe(starterTemplates[0].name);
    expect(body.html_content).toBeDefined();
    expect(body.html_content).toContain('<!DOCTYPE html>');
    expect(body.sample_data).toBeDefined();
  });

  it('GET /v1/starter-templates/:slug returns 404 for unknown slug', async () => {
    const res = await app.request('/v1/starter-templates/nonexistent-template');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('all templates have valid HTML content', () => {
    for (const tmpl of starterTemplates) {
      expect(tmpl.htmlContent).toContain('<!DOCTYPE html>');
      expect(tmpl.htmlContent).toContain('</html>');
      expect(tmpl.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('all slugs are unique', () => {
    const slugs = starterTemplates.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('all templates have non-empty sample data', () => {
    for (const tmpl of starterTemplates) {
      expect(Object.keys(tmpl.sampleData).length).toBeGreaterThan(0);
    }
  });
});
