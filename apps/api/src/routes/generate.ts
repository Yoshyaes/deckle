import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { generations, templates } from '../schema/db.js';
import { genId } from '../lib/id.js';
import { renderPdf } from '../services/renderer.js';
import { uploadPdf } from '../services/storage.js';
import { mergeTemplate } from '../services/templates.js';
import { checkUsageLimit, incrementUsage } from '../services/usage.js';
import { ValidationError, NotFoundError, UsageLimitError } from '../lib/errors.js';
import { deliverWebhook } from '../services/webhooks.js';
import { renderReactToHtml } from '../services/react-renderer.js';
import { processBarcodes } from '../services/barcodes.js';
import { eq, and } from 'drizzle-orm';
import { escapeHtml, sanitizeCssValue } from '../lib/utils.js';
import { getFontCssForUser } from '../services/fonts.js';

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

const MAX_HTML_SIZE = 5_242_880; // 5MB
const MAX_REACT_SIZE = 5_242_880; // 5MB

const generateSchema = z.object({
  html: z.string().max(MAX_HTML_SIZE).optional(),
  react: z.string().max(MAX_REACT_SIZE).optional(),
  template: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  styles: z.string().optional(),
  watermark: z
    .object({
      text: z.string().optional(),
      color: z.string().optional(),
      opacity: z.number().min(0).max(1).optional(),
      angle: z.number().optional(),
      fontSize: z.number().optional(),
    })
    .optional(),
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

const app = new Hono();

app.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = generateSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues.map((i) => i.message).join(', '));
  }

  const { html, react, template: templateId, data, styles, watermark, options, output, webhook } = parsed.data;
  const user = c.get('user');

  // Validate: must provide one of html, react, or template
  if (!html && !react && !templateId) {
    throw new ValidationError('One of "html", "react", or "template" must be provided');
  }

  // Check usage limits
  const withinLimit = await checkUsageLimit(user.id, user.plan);
  if (!withinLimit) {
    throw new UsageLimitError();
  }

  let finalHtml: string;
  let inputType: 'html' | 'template' | 'react' = 'html';
  let resolvedTemplateId: string | null = null;

  if (templateId) {
    // Template mode
    inputType = 'template';
    resolvedTemplateId = templateId;

    const [tmpl] = await db
      .select()
      .from(templates)
      .where(
        and(
          eq(templates.id, templateId),
          eq(templates.userId, user.id),
        ),
      )
      .limit(1);

    if (!tmpl) {
      throw new NotFoundError('Template');
    }

    finalHtml = mergeTemplate(tmpl.htmlContent, data || {});
  } else if (react) {
    // React component mode
    inputType = 'react';
    finalHtml = renderReactToHtml(react, data || {}, styles);
  } else {
    finalHtml = html!;
  }

  // Inject watermark overlay if requested
  if (watermark?.text) {
    const wColor = watermark.color || 'rgba(0,0,0,0.08)';
    const wOpacity = watermark.opacity ?? 0.08;
    const wAngle = watermark.angle ?? -45;
    const wSize = watermark.fontSize ?? 72;
    const safeText = escapeHtml(watermark.text);
    const safeColor = sanitizeCssValue(wColor);
    const watermarkHtml = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:9999"><span style="font-size:${wSize}px;color:${safeColor};opacity:${wOpacity};transform:rotate(${wAngle}deg);white-space:nowrap;font-family:Arial,sans-serif;font-weight:bold;user-select:none">${safeText}</span></div>`;
    finalHtml = finalHtml.replace(/<\/body>/i, `${watermarkHtml}</body>`);
    if (!finalHtml.includes(watermarkHtml)) {
      finalHtml += watermarkHtml;
    }
  }

  // Inject custom fonts if user has any uploaded
  const fontCss = await getFontCssForUser(user.id);
  if (fontCss) {
    const fontStyle = `<style>${fontCss}</style>`;
    if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', `${fontStyle}</head>`);
    } else if (finalHtml.includes('<body')) {
      finalHtml = finalHtml.replace('<body', `${fontStyle}<body`);
    } else {
      finalHtml = fontStyle + finalHtml;
    }
  }

  // Process QR code and barcode placeholders
  finalHtml = await processBarcodes(finalHtml);

  const generationId = genId();
  const startTime = Date.now();

  // Create generation record
  await db.insert(generations).values({
    id: generationId,
    userId: user.id,
    templateId: resolvedTemplateId,
    inputType,
    status: 'processing',
  });

  try {
    // Render PDF
    const result = await renderPdf(finalHtml, {
      format: options?.format,
      margin: options?.margin,
      orientation: options?.orientation,
      header: options?.header,
      footer: options?.footer,
      printBackground: options?.printBackground,
    });

    const generationTimeMs = Date.now() - startTime;

    if (output === 'base64') {
      // Update generation record
      await db
        .update(generations)
        .set({
          status: 'completed',
          fileSizeBytes: result.fileSize,
          pages: result.pages,
          generationTimeMs,
        })
        .where(eq(generations.id, generationId));

      // Increment usage
      await incrementUsage(user.id, result.pages, result.fileSize);

      return c.json({
        id: generationId,
        status: 'completed',
        data: result.buffer.toString('base64'),
        pages: result.pages,
        file_size: result.fileSize,
        generation_time_ms: generationTimeMs,
      }, 201);
    }

    // Upload to storage
    const pdfUrl = await uploadPdf(generationId, result.buffer);

    // Update generation record
    await db
      .update(generations)
      .set({
        status: 'completed',
        pdfUrl,
        fileSizeBytes: result.fileSize,
        pages: result.pages,
        generationTimeMs,
      })
      .where(eq(generations.id, generationId));

    // Increment usage
    await incrementUsage(user.id, result.pages, result.fileSize);

    const response = {
      id: generationId,
      status: 'completed' as const,
      url: pdfUrl,
      pages: result.pages,
      file_size: result.fileSize,
      generation_time_ms: generationTimeMs,
    };

    // Fire webhook async with retries if provided
    if (webhook) {
      deliverWebhook(webhook, response);
    }

    return c.json(response, 201);
  } catch (err) {
    // Update generation as failed
    await db
      .update(generations)
      .set({
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
        generationTimeMs: Date.now() - startTime,
      })
      .where(eq(generations.id, generationId));

    throw err;
  }
});

export default app;
