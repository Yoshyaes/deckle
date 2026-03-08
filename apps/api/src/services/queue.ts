/**
 * BullMQ-based job queue for async/batch PDF generation.
 */
import { Queue, Worker, Job } from 'bullmq';
import { db } from '../lib/db.js';
import { generations, templates } from '../schema/db.js';
import { renderPdf } from './renderer.js';
import { uploadPdf } from './storage.js';
import { mergeTemplate } from './templates.js';
import { renderReactToHtml } from './react-renderer.js';
import { processBarcodes } from './barcodes.js';
import { incrementUsage } from './usage.js';
import { deliverWebhook } from './webhooks.js';
import { eq, and } from 'drizzle-orm';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function parseRedisConnection() {
  const url = new URL(REDIS_URL);
  const conn: Record<string, unknown> = {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
  };
  if (url.password) conn.password = decodeURIComponent(url.password);
  if (url.username && url.username !== 'default') conn.username = decodeURIComponent(url.username);
  if (url.protocol === 'rediss:') conn.tls = {};
  return conn;
}

const connection = parseRedisConnection();

export interface GenerationJob {
  generationId: string;
  userId: string;
  html?: string;
  react?: string;
  templateId?: string;
  data?: Record<string, unknown>;
  styles?: string;
  options?: {
    format?: any;
    margin?: any;
    orientation?: 'portrait' | 'landscape';
    header?: string;
    footer?: string;
    printBackground?: boolean;
  };
  output: 'url' | 'base64';
  webhook?: string;
  batchId?: string;
}

// Queue for PDF generation jobs
export const generationQueue = new Queue<GenerationJob>('pdf-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

// Worker processes jobs
let worker: Worker<GenerationJob> | null = null;

export function startWorker() {
  worker = new Worker<GenerationJob>(
    'pdf-generation',
    async (job: Job<GenerationJob>) => {
      const {
        generationId,
        userId,
        html,
        react,
        templateId,
        data,
        styles,
        options,
        output,
        webhook,
      } = job.data;

      const startTime = Date.now();

      try {
        let finalHtml: string;

        if (templateId) {
          const [tmpl] = await db
            .select()
            .from(templates)
            .where(and(eq(templates.id, templateId), eq(templates.userId, userId)))
            .limit(1);

          if (!tmpl) throw new Error('Template not found');
          finalHtml = mergeTemplate(tmpl.htmlContent, data || {});
        } else if (react) {
          finalHtml = renderReactToHtml(react, data || {}, styles);
        } else {
          finalHtml = html!;
        }

        // Process QR code and barcode placeholders
        finalHtml = await processBarcodes(finalHtml);

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
          await db
            .update(generations)
            .set({
              status: 'completed',
              fileSizeBytes: result.fileSize,
              pages: result.pages,
              generationTimeMs,
            })
            .where(eq(generations.id, generationId));

          await incrementUsage(userId, result.pages, result.fileSize);

          const response = {
            id: generationId,
            status: 'completed' as const,
            data: result.buffer.toString('base64'),
            pages: result.pages,
            file_size: result.fileSize,
            generation_time_ms: generationTimeMs,
          };

          if (webhook) deliverWebhook(webhook, response);
          return response;
        }

        // Upload to storage
        const pdfUrl = await uploadPdf(generationId, result.buffer);

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

        await incrementUsage(userId, result.pages, result.fileSize);

        const response = {
          id: generationId,
          status: 'completed' as const,
          url: pdfUrl,
          pages: result.pages,
          file_size: result.fileSize,
          generation_time_ms: generationTimeMs,
        };

        if (webhook) deliverWebhook(webhook, response);
        return response;
      } catch (err) {
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
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  console.log('PDF generation worker started');
}

export function stopWorker() {
  return worker?.close();
}
