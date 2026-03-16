import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Tests the integration route Zod schemas
 * without needing database or service connections.
 */

const zapierGenerateSchema = z.object({
  html: z.string().optional(),
  template_id: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  format: z.enum(['A4', 'Letter', 'Legal']).default('A4'),
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
});

describe('Integration route validation', () => {
  describe('Zapier generate action schema', () => {
    it('accepts request with html', () => {
      const result = zapierGenerateSchema.safeParse({ html: '<h1>Test</h1>' });
      expect(result.success).toBe(true);
    });

    it('accepts request with template_id', () => {
      const result = zapierGenerateSchema.safeParse({
        template_id: 'tmpl_abc123',
        data: { name: 'Acme' },
      });
      expect(result.success).toBe(true);
    });

    it('accepts request with both html and template_id', () => {
      const result = zapierGenerateSchema.safeParse({
        html: '<h1>Test</h1>',
        template_id: 'tmpl_abc',
      });
      expect(result.success).toBe(true);
    });

    it('defaults format to A4', () => {
      const result = zapierGenerateSchema.safeParse({ html: '<p>test</p>' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.format).toBe('A4');
    });

    it('defaults orientation to portrait', () => {
      const result = zapierGenerateSchema.safeParse({ html: '<p>test</p>' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.orientation).toBe('portrait');
    });

    it('accepts Letter format', () => {
      const result = zapierGenerateSchema.safeParse({ html: '<p>test</p>', format: 'Letter' });
      expect(result.success).toBe(true);
    });

    it('accepts Legal format', () => {
      const result = zapierGenerateSchema.safeParse({ html: '<p>test</p>', format: 'Legal' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid format', () => {
      const result = zapierGenerateSchema.safeParse({ html: '<p>test</p>', format: 'Tabloid' });
      expect(result.success).toBe(false);
    });

    it('accepts landscape orientation', () => {
      const result = zapierGenerateSchema.safeParse({
        html: '<p>test</p>',
        orientation: 'landscape',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid orientation', () => {
      const result = zapierGenerateSchema.safeParse({
        html: '<p>test</p>',
        orientation: 'diagonal',
      });
      expect(result.success).toBe(false);
    });

    it('accepts data as a record', () => {
      const result = zapierGenerateSchema.safeParse({
        html: '<p>{{name}}</p>',
        data: { name: 'Test', amount: 100, items: [1, 2, 3] },
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object (all optional)', () => {
      const result = zapierGenerateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});
