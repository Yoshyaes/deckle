import * as Sentry from '@sentry/node';
import { logger } from './logger.js';

let initialized = false;

/**
 * Initialize Sentry from the SENTRY_DSN env var. Safe to call multiple
 * times — the second call is a no-op. If SENTRY_DSN is unset, the
 * module behaves as a no-op so local dev does not need a DSN.
 */
export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('Sentry disabled: SENTRY_DSN is not set');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // Trace 10% of transactions in production by default. Override with
    // SENTRY_TRACES_SAMPLE_RATE if needed.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Don't send personal data unless the customer enables it explicitly.
    sendDefaultPii: false,
  });

  initialized = true;
  logger.info('Sentry initialized');
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export const sentry = Sentry;
