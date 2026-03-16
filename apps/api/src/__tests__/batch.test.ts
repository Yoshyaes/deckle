import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Tests the batch endpoint's Zod validation schemas
 * without needing database or queue connections.
 */

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

describe('Batch request validation', () => {
  it('accepts valid batch with one HTML item', () => {
    const result = batchSchema.safeParse({
      items: [{ html: '<h1>Hello</h1>' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid batch with multiple items', () => {
    const result = batchSchema.safeParse({
      items: [
        { html: '<h1>Doc 1</h1>' },
        { template: 'tmpl_abc', data: { name: 'Test' } },
        { react: 'export default function() { return <div/>; }' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty items array', () => {
    const result = batchSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });

  it('rejects more than 100 items', () => {
    const items = Array.from({ length: 101 }, () => ({ html: '<p>x</p>' }));
    const result = batchSchema.safeParse({ items });
    expect(result.success).toBe(false);
  });

  it('accepts items with options', () => {
    const result = batchSchema.safeParse({
      items: [
        {
          html: '<h1>Test</h1>',
          options: {
            format: 'A4',
            margin: '1in',
            orientation: 'landscape',
            printBackground: true,
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts items with custom format dimensions', () => {
    const result = batchSchema.safeParse({
      items: [
        {
          html: '<h1>Test</h1>',
          options: { format: { width: '8.5in', height: '11in' } },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts webhook URL', () => {
    const result = batchSchema.safeParse({
      items: [{ html: '<p>test</p>' }],
      webhook: 'https://example.com/callback',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid webhook URL', () => {
    const result = batchSchema.safeParse({
      items: [{ html: '<p>test</p>' }],
      webhook: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('defaults output to url for each item', () => {
    const result = batchSchema.safeParse({
      items: [{ html: '<p>test</p>' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].output).toBe('url');
    }
  });

  it('accepts base64 output per item', () => {
    const result = batchSchema.safeParse({
      items: [{ html: '<p>test</p>', output: 'base64' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid output mode', () => {
    const result = batchSchema.safeParse({
      items: [{ html: '<p>test</p>', output: 'buffer' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts items with styles', () => {
    const result = batchSchema.safeParse({
      items: [{ react: 'export default () => <div/>;', styles: 'body { color: red; }' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts object margin', () => {
    const result = batchSchema.safeParse({
      items: [
        {
          html: '<p>test</p>',
          options: { margin: { top: '1cm', bottom: '1cm' } },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid orientation', () => {
    const result = batchSchema.safeParse({
      items: [{ html: '<p>test</p>', options: { orientation: 'diagonal' } }],
    });
    expect(result.success).toBe(false);
  });
});
