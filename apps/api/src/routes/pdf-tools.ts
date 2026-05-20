/**
 * PDF manipulation endpoints: merge, split, info.
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { mergePdfs, splitPdf, getPdfInfo } from '../services/pdf-utils.js';
import { fillFormFields, addFormFields, listFormFields } from '../services/pdf-forms.js';
import { addSignature } from '../services/pdf-sign.js';
import { makePdfA } from '../services/pdf-a.js';
import { protectPdf, isQpdfAvailable } from '../services/pdf-protect.js';
import { uploadPdf } from '../services/storage.js';
import { genId } from '../lib/id.js';
import { ValidationError } from '../lib/errors.js';

const app = new Hono();

const MAX_PDF_BASE64_SIZE = 50_000_000; // ~37MB decoded

/**
 * Estimate decoded size from base64 and reject oversized inputs.
 */
function validateBase64Size(b64: string, label = 'PDF'): void {
  const estimatedBytes = Math.ceil(b64.length * 0.75);
  if (estimatedBytes > MAX_PDF_BASE64_SIZE * 0.75) {
    throw new ValidationError(`${label} exceeds maximum size of ${Math.floor(MAX_PDF_BASE64_SIZE * 0.75 / 1_048_576)}MB`);
  }
}

/**
 * POST /merge - Merge multiple PDFs into one.
 * Accepts base64-encoded PDF buffers.
 */
const mergeSchema = z.object({
  pdfs: z.array(z.string().max(MAX_PDF_BASE64_SIZE)).min(2, 'At least 2 PDFs required'),
  output: z.enum(['url', 'base64']).default('url'),
});

app.post('/merge', async (c) => {
  const body = await c.req.json();
  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }

  parsed.data.pdfs.forEach((b64, i) => validateBase64Size(b64, `PDF #${i + 1}`));
  const buffers = parsed.data.pdfs.map((b64) => Buffer.from(b64, 'base64'));
  const merged = await mergePdfs(buffers);

  if (parsed.data.output === 'base64') {
    return c.json({
      data: merged.toString('base64'),
      file_size: merged.length,
    });
  }

  const id = genId();
  const url = await uploadPdf(id, merged);
  return c.json({ url, file_size: merged.length });
});

/**
 * POST /split - Split a PDF by page ranges.
 * Each range is [start] or [start, end] (1-indexed, inclusive).
 */
const splitSchema = z.object({
  pdf: z.string().max(MAX_PDF_BASE64_SIZE),
  ranges: z.array(z.array(z.number().int().positive()).min(1).max(2)).optional(),
  output: z.enum(['url', 'base64']).default('url'),
});

app.post('/split', async (c) => {
  const body = await c.req.json();
  const parsed = splitSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }

  validateBase64Size(parsed.data.pdf);
  const buffer = Buffer.from(parsed.data.pdf, 'base64');
  const parts = await splitPdf(buffer, parsed.data.ranges);

  if (parsed.data.output === 'base64') {
    return c.json({
      parts: parts.map((buf) => ({
        data: buf.toString('base64'),
        file_size: buf.length,
      })),
      total: parts.length,
    });
  }

  const results = await Promise.all(
    parts.map(async (buf) => {
      const id = genId();
      const url = await uploadPdf(id, buf);
      return { url, file_size: buf.length };
    }),
  );

  return c.json({ parts: results, total: results.length });
});

/**
 * POST /protect - AES-256 encrypt a PDF with a user and/or owner password.
 *
 * Real encryption via qpdf. Provide `user_password` (required to open),
 * `owner_password` (required to strip restrictions), or both. If only one
 * is given the other is mirrored so the protection cannot be trivially
 * bypassed by leaving the owner password empty.
 *
 * Permission flags map to PDF spec restrictions. Defaults: full-resolution
 * print allowed, no modification, copy allowed, no annotation.
 */
const protectSchema = z
  .object({
    pdf: z.string().max(MAX_PDF_BASE64_SIZE),
    user_password: z.string().min(1).max(127).optional(),
    owner_password: z.string().min(1).max(127).optional(),
    permissions: z
      .object({
        print: z.enum(['none', 'low', 'full']).optional(),
        modify: z.boolean().optional(),
        copy: z.boolean().optional(),
        annotate: z.boolean().optional(),
      })
      .optional(),
    output: z.enum(['url', 'base64']).default('url'),
  })
  .refine((d) => Boolean(d.user_password || d.owner_password), {
    message: 'Either user_password or owner_password (or both) is required',
    path: ['user_password'],
  });

app.post('/protect', async (c) => {
  if (!(await isQpdfAvailable())) {
    return c.json(
      {
        error: {
          code: 'NOT_AVAILABLE',
          message:
            'PDF protection is not available on this server: the qpdf binary is missing. Contact support if this persists.',
        },
      },
      503,
    );
  }

  const body = await c.req.json();
  const parsed = protectSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }

  validateBase64Size(parsed.data.pdf);
  const buffer = Buffer.from(parsed.data.pdf, 'base64');

  const result = await protectPdf(buffer, {
    userPassword: parsed.data.user_password,
    ownerPassword: parsed.data.owner_password,
    permissions: parsed.data.permissions,
  });

  if (parsed.data.output === 'base64') {
    return c.json({
      data: result.toString('base64'),
      file_size: result.length,
      encrypted: true,
      encryption: 'AES-256',
    });
  }

  const id = genId();
  const url = await uploadPdf(id, result);
  return c.json({
    url,
    file_size: result.length,
    encrypted: true,
    encryption: 'AES-256',
  });
});

/**
 * POST /info - Get PDF metadata.
 */
app.post('/info', async (c) => {
  const body = await c.req.json();
  const parsed = z.object({ pdf: z.string().max(MAX_PDF_BASE64_SIZE) }).safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }
  validateBase64Size(parsed.data.pdf);
  const buffer = Buffer.from(parsed.data.pdf, 'base64');
  const info = await getPdfInfo(buffer);
  return c.json(info);
});

/**
 * POST /forms/fill - Fill form fields in an existing PDF.
 */
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

app.post('/forms/fill', async (c) => {
  const body = await c.req.json();
  const parsed = fillSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }

  validateBase64Size(parsed.data.pdf);
  const buffer = Buffer.from(parsed.data.pdf, 'base64');
  const result = await fillFormFields(buffer, parsed.data.fields, {
    flatten: parsed.data.flatten,
  });

  if (parsed.data.output === 'base64') {
    return c.json({ data: result.toString('base64'), file_size: result.length });
  }

  const id = genId();
  const url = await uploadPdf(id, result);
  return c.json({ url, file_size: result.length });
});

/**
 * POST /forms/add-fields - Add form fields to a PDF.
 */
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

app.post('/forms/add-fields', async (c) => {
  const body = await c.req.json();
  const parsed = addFieldsSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }

  validateBase64Size(parsed.data.pdf);
  const buffer = Buffer.from(parsed.data.pdf, 'base64');
  const result = await addFormFields(buffer, parsed.data.fields);

  if (parsed.data.output === 'base64') {
    return c.json({ data: result.toString('base64'), file_size: result.length });
  }

  const id = genId();
  const url = await uploadPdf(id, result);
  return c.json({ url, file_size: result.length });
});

/**
 * POST /forms/list-fields - List form fields in a PDF.
 */
app.post('/forms/list-fields', async (c) => {
  const body = await c.req.json();
  const parsed = z.object({ pdf: z.string().max(MAX_PDF_BASE64_SIZE) }).safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }
  validateBase64Size(parsed.data.pdf);
  const buffer = Buffer.from(parsed.data.pdf, 'base64');
  const fields = await listFormFields(buffer);
  return c.json({ fields, total: fields.length });
});

/**
 * POST /sign - Add a visual signature annotation to a PDF.
 *
 * This is a visual overlay (signature image + reason/location/contact
 * metadata) — NOT a cryptographic digital signature. The response field
 * `signature_annotation_added` reflects that. Cryptographic PAdES/CAdES
 * signing requires a separate code path that is not yet implemented.
 */
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

app.post('/sign', async (c) => {
  const body = await c.req.json();
  const parsed = signSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }

  const { pdf, output, ...signOpts } = parsed.data;
  validateBase64Size(pdf);
  const buffer = Buffer.from(pdf, 'base64');
  const result = await addSignature(buffer, signOpts);

  if (output === 'base64') {
    return c.json({
      data: result.toString('base64'),
      file_size: result.length,
      signature_annotation_added: true,
    });
  }

  const id = genId();
  const url = await uploadPdf(id, result);
  return c.json({
    url,
    file_size: result.length,
    signature_annotation_added: true,
  });
});

/**
 * POST /pdfa - Convert a PDF to PDF/A-1b format.
 */
const pdfaSchema = z.object({
  pdf: z.string().max(MAX_PDF_BASE64_SIZE),
  title: z.string().optional(),
  author: z.string().optional(),
  subject: z.string().optional(),
  output: z.enum(['url', 'base64']).default('url'),
});

app.post('/pdfa', async (c) => {
  const body = await c.req.json();
  const parsed = pdfaSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }

  validateBase64Size(parsed.data.pdf);
  const buffer = Buffer.from(parsed.data.pdf, 'base64');
  const result = await makePdfA(buffer, {
    title: parsed.data.title,
    author: parsed.data.author,
    subject: parsed.data.subject,
  });

  if (parsed.data.output === 'base64') {
    return c.json({ data: result.toString('base64'), file_size: result.length, pdfa: true });
  }

  const id = genId();
  const url = await uploadPdf(id, result);
  return c.json({ url, file_size: result.length, pdfa: true });
});

export default app;
