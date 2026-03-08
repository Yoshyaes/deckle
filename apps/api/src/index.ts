import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';

import { loggingMiddleware } from './middleware/logging.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { AppError, errorResponse } from './lib/errors.js';
import { browserPool } from './services/renderer.js';

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

const app = new Hono();

// Global middleware
app.use('*', cors({
  origin: process.env.DASHBOARD_URL || 'http://localhost:3001',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
}));
app.use('*', loggingMiddleware);

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
  return c.json(body, status as any);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404);
});

const port = parseInt(process.env.PORT || '3000');

// Initialize browser pool and job worker
browserPool.initialize().then(() => {
  console.log('Browser pool initialized');
  startWorker();
});

serve(
  { fetch: app.fetch, port },
  (info) => {
    console.log(`DocuForge API running on http://localhost:${info.port}`);
  },
);

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down...');
  await stopWorker();
  await browserPool.shutdown();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown();
});
