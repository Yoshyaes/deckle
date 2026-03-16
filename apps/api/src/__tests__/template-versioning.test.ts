import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Tests the template versioning and restore Zod schemas
 * without needing database connections.
 */

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  html_content: z.string().min(1),
  schema: z.record(z.unknown()).optional(),
  is_public: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  html_content: z.string().min(1).optional(),
  schema: z.record(z.unknown()).optional(),
  is_public: z.boolean().optional(),
});

const restoreSchema = z.object({
  version_id: z.string(),
});

describe('Template schema validation', () => {
  describe('createTemplateSchema', () => {
    it('accepts valid template', () => {
      const result = createTemplateSchema.safeParse({
        name: 'Invoice',
        html_content: '<h1>Invoice</h1>',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = createTemplateSchema.safeParse({
        name: '',
        html_content: '<h1>Test</h1>',
      });
      expect(result.success).toBe(false);
    });

    it('rejects name over 255 chars', () => {
      const result = createTemplateSchema.safeParse({
        name: 'x'.repeat(256),
        html_content: '<h1>Test</h1>',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty html_content', () => {
      const result = createTemplateSchema.safeParse({
        name: 'Test',
        html_content: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing name', () => {
      const result = createTemplateSchema.safeParse({
        html_content: '<h1>Test</h1>',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing html_content', () => {
      const result = createTemplateSchema.safeParse({
        name: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('accepts optional schema field', () => {
      const result = createTemplateSchema.safeParse({
        name: 'Test',
        html_content: '<h1>Test</h1>',
        schema: { name: { type: 'string' } },
      });
      expect(result.success).toBe(true);
    });

    it('accepts optional is_public field', () => {
      const result = createTemplateSchema.safeParse({
        name: 'Test',
        html_content: '<h1>Test</h1>',
        is_public: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateTemplateSchema', () => {
    it('accepts partial update with name only', () => {
      const result = updateTemplateSchema.safeParse({ name: 'New Name' });
      expect(result.success).toBe(true);
    });

    it('accepts partial update with html_content only', () => {
      const result = updateTemplateSchema.safeParse({ html_content: '<p>Updated</p>' });
      expect(result.success).toBe(true);
    });

    it('accepts empty object (no fields to update)', () => {
      const result = updateTemplateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects empty name string', () => {
      const result = updateTemplateSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('rejects empty html_content string', () => {
      const result = updateTemplateSchema.safeParse({ html_content: '' });
      expect(result.success).toBe(false);
    });

    it('accepts is_public toggle', () => {
      const result = updateTemplateSchema.safeParse({ is_public: false });
      expect(result.success).toBe(true);
    });

    it('accepts full update', () => {
      const result = updateTemplateSchema.safeParse({
        name: 'Updated Invoice',
        html_content: '<h1>Updated</h1>',
        schema: { amount: { type: 'number' } },
        is_public: true,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Restore schema', () => {
    it('accepts valid version_id', () => {
      const result = restoreSchema.safeParse({ version_id: 'ver_abc123' });
      expect(result.success).toBe(true);
    });

    it('rejects missing version_id', () => {
      const result = restoreSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects non-string version_id', () => {
      const result = restoreSchema.safeParse({ version_id: 123 });
      expect(result.success).toBe(false);
    });
  });
});
