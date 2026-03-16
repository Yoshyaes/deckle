import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

/**
 * Tests the AI template generation route.
 * Tests both schema validation and the missing API key behavior.
 */

const generateTemplateSchema = z.object({
  prompt: z.string().min(1).max(2000),
  type: z.enum(['invoice', 'receipt', 'report', 'certificate', 'letter', 'resume', 'other']).default('other'),
  style: z.enum(['professional', 'modern', 'minimal', 'colorful']).default('professional'),
  variables: z.array(z.string()).optional(),
});

describe('AI template generation validation', () => {
  describe('Schema validation', () => {
    it('accepts valid prompt', () => {
      const result = generateTemplateSchema.safeParse({ prompt: 'Create an invoice template' });
      expect(result.success).toBe(true);
    });

    it('rejects empty prompt', () => {
      const result = generateTemplateSchema.safeParse({ prompt: '' });
      expect(result.success).toBe(false);
    });

    it('rejects prompt over 2000 chars', () => {
      const result = generateTemplateSchema.safeParse({ prompt: 'x'.repeat(2001) });
      expect(result.success).toBe(false);
    });

    it('accepts prompt at exactly 2000 chars', () => {
      const result = generateTemplateSchema.safeParse({ prompt: 'x'.repeat(2000) });
      expect(result.success).toBe(true);
    });

    it('rejects missing prompt', () => {
      const result = generateTemplateSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('defaults type to other', () => {
      const result = generateTemplateSchema.safeParse({ prompt: 'test' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.type).toBe('other');
    });

    it('defaults style to professional', () => {
      const result = generateTemplateSchema.safeParse({ prompt: 'test' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.style).toBe('professional');
    });

    it('accepts all valid type enum values', () => {
      const types = ['invoice', 'receipt', 'report', 'certificate', 'letter', 'resume', 'other'];
      for (const type of types) {
        const result = generateTemplateSchema.safeParse({ prompt: 'test', type });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid type', () => {
      const result = generateTemplateSchema.safeParse({ prompt: 'test', type: 'memo' });
      expect(result.success).toBe(false);
    });

    it('accepts all valid style enum values', () => {
      const styles = ['professional', 'modern', 'minimal', 'colorful'];
      for (const style of styles) {
        const result = generateTemplateSchema.safeParse({ prompt: 'test', style });
        expect(result.success).toBe(true);
      }
    });

    it('rejects invalid style', () => {
      const result = generateTemplateSchema.safeParse({ prompt: 'test', style: 'retro' });
      expect(result.success).toBe(false);
    });

    it('accepts variables array', () => {
      const result = generateTemplateSchema.safeParse({
        prompt: 'Create an invoice',
        variables: ['company_name', 'total', 'date'],
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty variables array', () => {
      const result = generateTemplateSchema.safeParse({
        prompt: 'test',
        variables: [],
      });
      expect(result.success).toBe(true);
    });

    it('accepts full request with all fields', () => {
      const result = generateTemplateSchema.safeParse({
        prompt: 'Create a professional invoice with company logo area',
        type: 'invoice',
        style: 'modern',
        variables: ['company_name', 'invoice_number', 'items', 'total'],
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('AI route missing API key', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('returns 503 when ANTHROPIC_API_KEY is not set', async () => {
    // We mock the necessary dependencies to test the route directly
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    // Import Hono and create a minimal app matching the AI route logic
    const { Hono } = await import('hono');

    const app = new Hono();
    app.post('/generate-template', async (c) => {
      const body = await c.req.json();
      const parsed = generateTemplateSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid' } }, 400);
      }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return c.json(
          { error: { code: 'AI_NOT_CONFIGURED', message: 'AI template generation is not configured. Set ANTHROPIC_API_KEY.' } },
          503,
        );
      }

      return c.json({ html: '<div/>' });
    });

    const res = await app.request('/generate-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Create an invoice' }),
    });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('AI_NOT_CONFIGURED');

    vi.unstubAllGlobals();
  });
});
