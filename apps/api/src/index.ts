import 'dotenv/config';
import './lib/env.js';
import { initSentry, captureException } from './lib/sentry.js';

// Sentry must initialize before any code that throws so error capture is
// active for module-load errors and the BullMQ workers below.
initSentry();

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { logger } from './lib/logger.js';

import { loggingMiddleware } from './middleware/logging.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { ipRateLimitMiddleware } from './middleware/ipRateLimit.js';
import { AppError, errorResponse } from './lib/errors.js';
import { browserPool } from './services/renderer.js';
import { recordApiError } from './services/api-errors.js';

import healthRoutes from './routes/health.js';
import generateRoutes from './routes/generate.js';
import generationsRoutes from './routes/generations.js';
import templatesRoutes from './routes/templates.js';
import usageRoutes from './routes/usage.js';
import keysRoutes from './routes/keys.js';
import webhookRoutes from './routes/webhooks.js';
import starterTemplatesRoutes from './routes/starter-templates.js';
import batchRoutes from './routes/batch.js';
import pdfToolsRoutes from './routes/pdf-tools.js';
import aiRoutes from './routes/ai.js';
import marketplaceRoutes from './routes/marketplace.js';
import integrationsRoutes from './routes/integrations.js';
import billingRoutes, { billingWebhookApp } from './routes/billing.js';
import fontsRoutes from './routes/fonts.js';
import analyticsRoutes from './routes/analytics.js';
import { startWorker, stopWorker } from './services/queue.js';
import { startDripWorker, stopDripWorker, scheduleDripTick } from './services/drip.js';

const app = new Hono();

// Global middleware
app.use('*', cors({
  origin: process.env.DASHBOARD_URL || 'http://localhost:3001',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
}));
app.use('*', loggingMiddleware);

// IP-based rate limiting for public routes
app.use('/v1/starter-templates/*', ipRateLimitMiddleware);
app.use('/llms.txt', ipRateLimitMiddleware);
app.use('/llms-full.txt', ipRateLimitMiddleware);

// Public routes
app.route('/health', healthRoutes);
app.route('/webhooks', webhookRoutes);
app.route('/v1/billing/webhooks', billingWebhookApp);

// Serve local PDFs in development
app.use(
  '/files/*',
  serveStatic({
    root: '.storage/pdfs',
    rewriteRequestPath: (path) => path.replace('/files', ''),
  }),
);

// Serve local fonts in development
app.use(
  '/fonts/*',
  serveStatic({
    root: '.storage/fonts',
    rewriteRequestPath: (path) => path.replace('/fonts', ''),
  }),
);

// Serve AI discoverability assets
app.use('/llms.txt', serveStatic({ root: '../../public', path: '/llms.txt' }));
app.use('/llms-full.txt', serveStatic({ root: '../../public', path: '/llms-full.txt' }));

// Public starter templates browser
app.route('/v1/starter-templates', starterTemplatesRoutes);

// Protected routes
const v1 = new Hono();
// Body size limit: 10MB
v1.use('*', async (c, next) => {
  const contentLength = c.req.header('content-length');
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
    return c.json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds 10MB limit' } }, 413);
  }
  return next();
});
v1.use('*', authMiddleware);
v1.use('*', rateLimitMiddleware);

v1.route('/generate', generateRoutes);
v1.route('/generations', generationsRoutes);
v1.route('/templates', templatesRoutes);
v1.route('/usage', usageRoutes);
v1.route('/keys', keysRoutes);
v1.route('/generate/batch', batchRoutes);
v1.route('/pdf', pdfToolsRoutes);
v1.route('/ai', aiRoutes);
v1.route('/marketplace', marketplaceRoutes);
v1.route('/integrations', integrationsRoutes);
v1.route('/billing', billingRoutes);
v1.route('/fonts', fontsRoutes);
v1.route('/analytics', analyticsRoutes);

// Clone requires auth — mount under protected v1
v1.post('/starter-templates/:slug/clone', async (c) => {
  const { starterTemplates } = await import('./scripts/starter-templates.js');
  const { templates } = await import('./schema/db.js');
  const { tmplId } = await import('./lib/id.js');
  const slug = c.req.param('slug');
  const starter = starterTemplates.find((t) => t.slug === slug);
  if (!starter) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Starter template not found' } }, 404);
  }
  const user = c.get('user');
  const { db } = await import('./lib/db.js');
  const id = tmplId();
  const [template] = await db
    .insert(templates)
    .values({ id, userId: user.id, name: starter.name, htmlContent: starter.htmlContent, schema: starter.sampleData })
    .returning();
  return c.json({ id: template.id, name: template.name, version: template.version, created_at: template.createdAt }, 201);
});

app.route('/v1', v1);

// Global error handler
app.onError((err, c) => {
  const { status, body } = errorResponse(err);

  // Send 5xx errors to Sentry (when configured). 4xx are expected
  // validation/auth failures and would drown the signal.
  if (status >= 500) {
    captureException(err, {
      method: c.req.method,
      path: c.req.path,
      code: body.error.code,
    });
  }

  // Record /v1/* errors so the admin dashboard can see them. Fire-and-forget.
  const path = c.req.path;
  if (path.startsWith('/v1/')) {
    const user = c.get('user') as { id: string } | undefined;
    const authHeader = c.req.header('Authorization');
    let keyPrefix: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (token.startsWith('df_live_')) {
        keyPrefix = token.slice(0, 16);
      }
    }

    recordApiError({
      userId: user?.id ?? null,
      apiKeyPrefix: keyPrefix,
      method: c.req.method,
      path,
      errorCode: body.error.code,
      errorMessage: body.error.message,
      statusCode: status,
    });
  }

  return c.json(body, status as any);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404);
});

const port = parseInt(process.env.PORT || '3000');

let httpServer: ReturnType<typeof serve> | null = null;
let shuttingDown = false;

// Initialize browser pool and job worker, then start server
async function start() {
  await browserPool.initialize();
  logger.info('Browser pool initialized');
  startWorker();
  startDripWorker();
  await scheduleDripTick();

  httpServer = serve(
    { fetch: app.fetch, port },
    (info) => {
      logger.info(`DocuForge API running on http://localhost:${info.port}`);
    },
  );
}

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

// Graceful shutdown: stop accepting new HTTP requests, drain in-flight
// renders, then close DB/Redis. Bounded so a stuck request can't keep
// the process alive forever.
const SHUTDOWN_TIMEOUT_MS = 35_000;

const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down...');

  const hardExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  hardExit.unref();

  // 1. Stop accepting new HTTP connections.
  if (httpServer) {
    await new Promise<void>((resolve) => {
      httpServer!.close(() => resolve());
    });
  }

  // 2. Stop BullMQ workers (drains in-flight jobs internally).
  await stopWorker();
  await stopDripWorker();

  // 3. Drain in-flight Playwright renders, then close browsers.
  await browserPool.shutdown();

  // 4. Close DB + Redis connections.
  const { pool } = await import('./lib/db.js');
  const { redis } = await import('./lib/redis.js');
  await pool.end().catch((err) => logger.warn({ err }, 'pool.end() failed'));
  await redis.quit().catch((err) => logger.warn({ err }, 'redis.quit() failed'));

  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
  captureException(reason, { source: 'unhandledRejection' });
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  captureException(err, { source: 'uncaughtException' });
  void shutdown('uncaughtException');
});
