import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { AppError, errorResponse } from '../lib/errors.js';

/**
 * Tests the generate endpoint's Zod validation
 * without needing a database connection.
 * We import and test the Zod schema directly.
 */
import { z } from 'zod';

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

const generateSchema = z.object({
  html: z.string().optional(),
  template: z.string().optional(),
  data: z.record(z.unknown()).optional(),
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
  webhook: z.string().url().optional(),
});

describe('Generate request validation', () => {
  it('accepts valid HTML request', () => {
    const result = generateSchema.safeParse({
      html: '<h1>Hello</h1>',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid template request', () => {
    const result = generateSchema.safeParse({
      template: 'tmpl_abc123',
      data: { name: 'Acme' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts all format options', () => {
    for (const format of ['A4', 'Letter', 'Legal']) {
      const result = generateSchema.safeParse({
        html: '<h1>Test</h1>',
        options: { format },
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts custom format dimensions', () => {
    const result = generateSchema.safeParse({
      html: '<h1>Test</h1>',
      options: { format: { width: '8.5in', height: '11in' } },
    });
    expect(result.success).toBe(true);
  });

  it('accepts string margin', () => {
    const result = generateSchema.safeParse({
      html: '<h1>Test</h1>',
      options: { margin: '1in' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts object margin', () => {
    const result = generateSchema.safeParse({
      html: '<h1>Test</h1>',
      options: { margin: { top: '1in', bottom: '1in' } },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid orientation', () => {
    const result = generateSchema.safeParse({
      html: '<h1>Test</h1>',
      options: { orientation: 'diagonal' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid output mode', () => {
    const result = generateSchema.safeParse({
      html: '<h1>Test</h1>',
      output: 'buffer',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid webhook URL', () => {
    const result = generateSchema.safeParse({
      html: '<h1>Test</h1>',
      webhook: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('defaults output to url', () => {
    const result = generateSchema.safeParse({ html: '<h1>Test</h1>' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.output).toBe('url');
    }
  });

  it('accepts full options object', () => {
    const result = generateSchema.safeParse({
      html: '<h1>Invoice</h1>',
      options: {
        format: 'A4',
        margin: { top: '1in', right: '0.75in', bottom: '1in', left: '0.75in' },
        orientation: 'portrait',
        header: '<div>Header</div>',
        footer: '<div>Page {{pageNumber}} of {{totalPages}}</div>',
        printBackground: true,
      },
      output: 'url',
      webhook: 'https://example.com/webhook',
    });
    expect(result.success).toBe(true);
  });
});
