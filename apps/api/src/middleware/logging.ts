import { createMiddleware } from 'hono/factory';
import { logger } from '../lib/logger.js';
import { randomUUID } from 'crypto';

export const loggingMiddleware = createMiddleware(async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const requestId = randomUUID();

  c.set('requestId', requestId);

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  logger.info({ method, path, status, duration, requestId }, `${method} ${path} ${status} ${duration}ms`);
});
