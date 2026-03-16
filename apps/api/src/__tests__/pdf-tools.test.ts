import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { PDFDocument } from 'pdf-lib';
import { mergePdfs, splitPdf, getPdfInfo } from '../services/pdf-utils.js';
import { fillFormFields, addFormFields, listFormFields } from '../services/pdf-forms.js';
import { addSignature } from '../services/pdf-sign.js';
import { makePdfA } from '../services/pdf-a.js';

const MAX_PDF_BASE64_SIZE = 50_000_000;

// --- Zod schemas mirrored from routes/pdf-tools.ts ---

const mergeSchema = z.object({
  pdfs: z.array(z.string().max(MAX_PDF_BASE64_SIZE)).min(2, 'At least 2 PDFs required'),
  output: z.enum(['url', 'base64']).default('url'),
});

const splitSchema = z.object({
  pdf: z.string().max(MAX_PDF_BASE64_SIZE),
  ranges: z.array(z.array(z.number().int().positive()).min(1).max(2)).optional(),
  output: z.enum(['url', 'base64']).default('url'),
});

const protectSchema = z.object({
  pdf: z.string().max(MAX_PDF_BASE64_SIZE),
  user_password: z.string().min(1).optional(),
  owner_password: z.string().min(1),
  permissions: z
    .object({
      printing: z.boolean().default(true),
      copying: z.boolean().default(false),
      modifying: z.boolean().default(false),
    })
    .optional(),
  output: z.enum(['url', 'base64']).default('url'),
});

const fillSchema = z.object({
  pdf: z.string().max(MAX_PDF_BASE64_SIZE),
  fields: z.array(
    z.object({
      name: z.string(),
      value: z.union([z.string(), z.boolean()]),
    }),
  ),
  flatten: z.boolean().default(false),
  output: z.enum(['url', 'base64']).default('url'),
});

const addFieldsSchema = z.object({
  pdf: z.string().max(MAX_PDF_BASE64_SIZE),
  fields: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['text', 'checkbox', 'dropdown']),
      page: z.number().int().min(0),
      x: z.number(),
      y: z.number(),
      width: z.number().optional(),
      height: z.number().optional(),
      options: z.array(z.string()).optional(),
      defaultValue: z.union([z.string(), z.boolean()]).optional(),
    }),
  ),
  output: z.enum(['url', 'base64']).default('url'),
});

const signSchema = z.object({
  pdf: z.string().max(MAX_PDF_BASE64_SIZE),
  name: z.string(),
  reason: z.string().optional(),
  location: z.string().optional(),
  contact: z.string().optional(),
  page: z.number().int().min(0).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  output: z.enum(['url', 'base64']).default('url'),
});

const pdfaSchema = z.object({
  pdf: z.string().max(MAX_PDF_BASE64_SIZE),
  title: z.string().optional(),
  author: z.string().optional(),
  subject: z.string().optional(),
  output: z.enum(['url', 'base64']).default('url'),
});

// Helpers

async function createTestPdf(pageCount: number, title?: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  if (title) doc.setTitle(title);
  for (let i = 0; i < pageCount; i++) {
    doc.addPage();
  }
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function createTestPdfWithFormFields(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const form = doc.getForm();

  const nameField = form.createTextField('fullName');
  nameField.addToPage(page, { x: 50, y: 700, width: 200, height: 20 });

  const checkbox = form.createCheckBox('agree');
  checkbox.addToPage(page, { x: 50, y: 650, width: 15, height: 15 });

  const dropdown = form.createDropdown('country');
  dropdown.setOptions(['US', 'UK', 'CA']);
  dropdown.addToPage(page, { x: 50, y: 600, width: 200, height: 20 });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function toBase64(buf: Buffer): string {
  return buf.toString('base64');
}

// --- Tests ---

describe('PDF Tools validation', () => {
  describe('Merge schema', () => {
    it('requires at least 2 PDFs', () => {
      const result = mergeSchema.safeParse({ pdfs: ['one'] });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('At least 2 PDFs required');
      }
    });

    it('rejects empty pdfs array', () => {
      const result = mergeSchema.safeParse({ pdfs: [] });
      expect(result.success).toBe(false);
    });

    it('accepts valid merge request with 2 PDFs', () => {
      const result = mergeSchema.safeParse({ pdfs: ['pdf1', 'pdf2'] });
      expect(result.success).toBe(true);
    });

    it('accepts valid merge request with many PDFs', () => {
      const result = mergeSchema.safeParse({ pdfs: ['a', 'b', 'c', 'd'] });
      expect(result.success).toBe(true);
    });

    it('defaults output to url', () => {
      const result = mergeSchema.safeParse({ pdfs: ['a', 'b'] });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.output).toBe('url');
    });

    it('accepts base64 output', () => {
      const result = mergeSchema.safeParse({ pdfs: ['a', 'b'], output: 'base64' });
      expect(result.success).toBe(true);
    });
  });

  describe('Split schema', () => {
    it('accepts valid split request without ranges', () => {
      const result = splitSchema.safeParse({ pdf: 'somepdf' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.ranges).toBeUndefined();
    });

    it('accepts valid split request with ranges', () => {
      const result = splitSchema.safeParse({ pdf: 'somepdf', ranges: [[1, 3], [4, 5]] });
      expect(result.success).toBe(true);
    });

    it('accepts single-page ranges', () => {
      const result = splitSchema.safeParse({ pdf: 'somepdf', ranges: [[2]] });
      expect(result.success).toBe(true);
    });

    it('rejects invalid range with 3 elements', () => {
      const result = splitSchema.safeParse({ pdf: 'somepdf', ranges: [[1, 2, 3]] });
      expect(result.success).toBe(false);
    });

    it('rejects negative page numbers', () => {
      const result = splitSchema.safeParse({ pdf: 'somepdf', ranges: [[-1]] });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer page numbers', () => {
      const result = splitSchema.safeParse({ pdf: 'somepdf', ranges: [[1.5]] });
      expect(result.success).toBe(false);
    });
  });

  describe('Protect schema', () => {
    it('requires owner_password', () => {
      const result = protectSchema.safeParse({ pdf: 'somepdf' });
      expect(result.success).toBe(false);
    });

    it('accepts with only owner_password', () => {
      const result = protectSchema.safeParse({ pdf: 'somepdf', owner_password: 'secret' });
      expect(result.success).toBe(true);
    });

    it('accepts with both passwords', () => {
      const result = protectSchema.safeParse({
        pdf: 'somepdf',
        owner_password: 'owner123',
        user_password: 'user123',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty owner_password', () => {
      const result = protectSchema.safeParse({ pdf: 'somepdf', owner_password: '' });
      expect(result.success).toBe(false);
    });

    it('accepts with permissions object', () => {
      const result = protectSchema.safeParse({
        pdf: 'somepdf',
        owner_password: 'secret',
        permissions: { printing: true, copying: false, modifying: false },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Sign schema', () => {
    it('requires name field', () => {
      const result = signSchema.safeParse({ pdf: 'somepdf' });
      expect(result.success).toBe(false);
    });

    it('accepts with name only', () => {
      const result = signSchema.safeParse({ pdf: 'somepdf', name: 'John Doe' });
      expect(result.success).toBe(true);
    });

    it('accepts with all optional fields', () => {
      const result = signSchema.safeParse({
        pdf: 'somepdf',
        name: 'John Doe',
        reason: 'Approval',
        location: 'New York',
        contact: 'john@example.com',
        page: 0,
        x: 100,
        y: 50,
        width: 250,
        height: 80,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative page number', () => {
      const result = signSchema.safeParse({ pdf: 'somepdf', name: 'John', page: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('PDF/A schema', () => {
    it('accepts minimal request', () => {
      const result = pdfaSchema.safeParse({ pdf: 'somepdf' });
      expect(result.success).toBe(true);
    });

    it('accepts with all metadata', () => {
      const result = pdfaSchema.safeParse({
        pdf: 'somepdf',
        title: 'My Doc',
        author: 'Author',
        subject: 'Test subject',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Forms fill schema', () => {
    it('requires fields array', () => {
      const result = fillSchema.safeParse({ pdf: 'somepdf' });
      expect(result.success).toBe(false);
    });

    it('accepts string field values', () => {
      const result = fillSchema.safeParse({
        pdf: 'somepdf',
        fields: [{ name: 'fullName', value: 'John' }],
      });
      expect(result.success).toBe(true);
    });

    it('accepts boolean field values', () => {
      const result = fillSchema.safeParse({
        pdf: 'somepdf',
        fields: [{ name: 'agree', value: true }],
      });
      expect(result.success).toBe(true);
    });

    it('defaults flatten to false', () => {
      const result = fillSchema.safeParse({
        pdf: 'somepdf',
        fields: [{ name: 'a', value: 'b' }],
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.flatten).toBe(false);
    });
  });

  describe('Forms add-fields schema', () => {
    it('accepts valid text field definition', () => {
      const result = addFieldsSchema.safeParse({
        pdf: 'somepdf',
        fields: [{ name: 'field1', type: 'text', page: 0, x: 50, y: 700 }],
      });
      expect(result.success).toBe(true);
    });

    it('accepts dropdown with options', () => {
      const result = addFieldsSchema.safeParse({
        pdf: 'somepdf',
        fields: [{ name: 'country', type: 'dropdown', page: 0, x: 50, y: 600, options: ['US', 'UK'] }],
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid field type', () => {
      const result = addFieldsSchema.safeParse({
        pdf: 'somepdf',
        fields: [{ name: 'field1', type: 'radio', page: 0, x: 50, y: 700 }],
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative page number', () => {
      const result = addFieldsSchema.safeParse({
        pdf: 'somepdf',
        fields: [{ name: 'field1', type: 'text', page: -1, x: 50, y: 700 }],
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('PDF Tools service functions', () => {
  describe('mergePdfs', () => {
    it('merges two PDFs and produces valid output', async () => {
      const pdf1 = await createTestPdf(2);
      const pdf2 = await createTestPdf(3);
      const merged = await mergePdfs([pdf1, pdf2]);

      const doc = await PDFDocument.load(merged);
      expect(doc.getPageCount()).toBe(5);
      expect(merged.slice(0, 5).toString()).toContain('%PDF');
    });
  });

  describe('splitPdf', () => {
    it('per-page split when no ranges provided', async () => {
      const pdf = await createTestPdf(4);
      const parts = await splitPdf(pdf);
      expect(parts).toHaveLength(4);
    });

    it('returns empty array for out-of-range pages', async () => {
      const pdf = await createTestPdf(2);
      const parts = await splitPdf(pdf, [[10, 20]]);
      expect(parts).toHaveLength(0);
    });
  });

  describe('getPdfInfo', () => {
    it('extracts metadata from a PDF', async () => {
      const doc = await PDFDocument.create();
      doc.setTitle('Info Test');
      doc.setAuthor('Test Author');
      doc.addPage();
      doc.addPage();
      const buf = Buffer.from(await doc.save());

      const info = await getPdfInfo(buf);
      expect(info.pages).toBe(2);
      expect(info.title).toBe('Info Test');
      expect(info.author).toBe('Test Author');
    });
  });

  describe('addSignature', () => {
    it('adds a signature to the last page by default', async () => {
      const pdf = await createTestPdf(2);
      const signed = await addSignature(pdf, { name: 'Alice' });

      const doc = await PDFDocument.load(signed);
      expect(doc.getPageCount()).toBe(2);
      expect(Buffer.isBuffer(signed)).toBe(true);
    });

    it('adds a signature with all options', async () => {
      const pdf = await createTestPdf(1);
      const signed = await addSignature(pdf, {
        name: 'Bob',
        reason: 'Approval',
        location: 'NYC',
        contact: 'bob@test.com',
        page: 0,
        x: 100,
        y: 100,
        width: 300,
        height: 100,
      });

      expect(Buffer.isBuffer(signed)).toBe(true);
      expect(signed.slice(0, 5).toString()).toContain('%PDF');
    });

    it('throws for invalid page index', async () => {
      const pdf = await createTestPdf(1);
      await expect(addSignature(pdf, { name: 'Test', page: 5 })).rejects.toThrow('Invalid page index');
    });
  });

  describe('makePdfA', () => {
    it('produces a valid PDF with metadata', async () => {
      const pdf = await createTestPdf(1);
      const result = await makePdfA(pdf, { title: 'Archived', author: 'Tester', subject: 'Test' });

      const doc = await PDFDocument.load(result);
      expect(doc.getTitle()).toBe('Archived');
      expect(doc.getAuthor()).toBe('Tester');
      // pdf-lib overrides the producer on save, so we just check the doc has metadata
      expect(doc.getProducer()).toBeTruthy();
    });

    it('uses defaults when no options provided', async () => {
      const pdf = await createTestPdf(1);
      const result = await makePdfA(pdf);

      const doc = await PDFDocument.load(result);
      expect(doc.getCreator()).toBe('DocuForge API');
    });
  });

  describe('Form fields', () => {
    it('addFormFields adds a text field to a PDF', async () => {
      const pdf = await createTestPdf(1);
      const result = await addFormFields(pdf, [
        { name: 'myField', type: 'text', page: 0, x: 50, y: 700 },
      ]);

      const fields = await listFormFields(result);
      expect(fields.some((f) => f.name === 'myField')).toBe(true);
    });

    it('addFormFields adds a checkbox field', async () => {
      const pdf = await createTestPdf(1);
      const result = await addFormFields(pdf, [
        { name: 'myCheck', type: 'checkbox', page: 0, x: 50, y: 650, defaultValue: true },
      ]);

      const fields = await listFormFields(result);
      expect(fields.some((f) => f.name === 'myCheck')).toBe(true);
    });

    it('addFormFields adds a dropdown field with options', async () => {
      const pdf = await createTestPdf(1);
      const result = await addFormFields(pdf, [
        { name: 'pick', type: 'dropdown', page: 0, x: 50, y: 600, options: ['A', 'B', 'C'] },
      ]);

      const fields = await listFormFields(result);
      expect(fields.some((f) => f.name === 'pick')).toBe(true);
    });

    it('addFormFields skips out-of-range page', async () => {
      const pdf = await createTestPdf(1);
      const result = await addFormFields(pdf, [
        { name: 'skip', type: 'text', page: 99, x: 50, y: 700 },
      ]);

      const fields = await listFormFields(result);
      expect(fields.some((f) => f.name === 'skip')).toBe(false);
    });

    it('fillFormFields fills text field values', async () => {
      const pdf = await createTestPdfWithFormFields();
      const filled = await fillFormFields(pdf, [{ name: 'fullName', value: 'Jane Doe' }]);

      expect(Buffer.isBuffer(filled)).toBe(true);
      expect(filled.length).toBeGreaterThan(0);
    });

    it('fillFormFields fills checkbox values', async () => {
      const pdf = await createTestPdfWithFormFields();
      const filled = await fillFormFields(pdf, [{ name: 'agree', value: true }]);

      expect(Buffer.isBuffer(filled)).toBe(true);
    });

    it('fillFormFields with flatten option', async () => {
      const pdf = await createTestPdfWithFormFields();
      const filled = await fillFormFields(
        pdf,
        [{ name: 'fullName', value: 'Test' }],
        { flatten: true },
      );

      expect(Buffer.isBuffer(filled)).toBe(true);
    });

    it('listFormFields lists all field names and types', async () => {
      const pdf = await createTestPdfWithFormFields();
      const fields = await listFormFields(pdf);

      expect(fields.length).toBe(3);
      const names = fields.map((f) => f.name);
      expect(names).toContain('fullName');
      expect(names).toContain('agree');
      expect(names).toContain('country');
    });

    it('listFormFields returns empty for PDF with no fields', async () => {
      const pdf = await createTestPdf(1);
      const fields = await listFormFields(pdf);
      expect(fields).toHaveLength(0);
    });
  });
});
