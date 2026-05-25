import { describe, it, expect } from 'vitest';
import {
  AppError,
  AuthError,
  RateLimitError,
  NotFoundError,
  UsageLimitError,
  ValidationError,
  errorResponse,
} from '../lib/errors.js';

describe('Error classes', () => {
  it('AuthError has correct status and code', () => {
    const err = new AuthError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Invalid API key');
  });

  it('AuthError accepts custom message', () => {
    const err = new AuthError('Missing header');
    expect(err.message).toBe('Missing header');
  });

  it('RateLimitError includes retryAfter', () => {
    const err = new RateLimitError(5);
    expect(err.statusCode).toBe(429);
    expect(err.retryAfter).toBe(5);
  });

  it('NotFoundError includes resource name', () => {
    const err = new NotFoundError('Template');
    expect(err.message).toBe('Template not found');
    expect(err.statusCode).toBe(404);
  });

  it('UsageLimitError is 403', () => {
    const err = new UsageLimitError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('USAGE_LIMIT_EXCEEDED');
  });

  it('ValidationError is 400', () => {
    const err = new ValidationError('Bad input');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Bad input');
  });
});

describe('errorResponse', () => {
  it('formats AppError correctly', () => {
    const err = new AuthError();
    const { status, body } = errorResponse(err);
    expect(status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('formats RateLimitError with retry_after', () => {
    const err = new RateLimitError(3);
    const { status, body } = errorResponse(err);
    expect(status).toBe(429);
    expect(body.error.retry_after).toBe(3);
  });

  it('handles unknown errors as 500', () => {
    const err = new Error('random');
    const { status, body } = errorResponse(err);
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('does not leak internal error messages in 500 body', () => {
    const err = new Error('db connection string was postgres://user:secret@db');
    const { body } = errorResponse(err);
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain('postgres');
  });

  it('formats ValidationError', () => {
    const err = new ValidationError('field x is required');
    const { status, body } = errorResponse(err);
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('field x is required');
  });

  it('formats NotFoundError', () => {
    const err = new NotFoundError('User');
    const { status, body } = errorResponse(err);
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('User not found');
  });

  it('formats UsageLimitError', () => {
    const err = new UsageLimitError();
    const { status, body } = errorResponse(err);
    expect(status).toBe(403);
    expect(body.error.code).toBe('USAGE_LIMIT_EXCEEDED');
  });

  it('non-rate-limit AppError does not include retry_after', () => {
    const err = new AuthError();
    const { body } = errorResponse(err);
    expect((body.error as Record<string, unknown>).retry_after).toBeUndefined();
  });

  it('formats ZodError as 400 with combined messages', async () => {
    const { z } = await import('zod');
    const schema = z.object({ name: z.string(), count: z.number() });
    const result = schema.safeParse({ name: 42, count: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const { status, body } = errorResponse(result.error);
      expect(status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toContain(',');
    }
  });

  it('handles thrown strings or non-Error throwables', () => {
    const { status, body } = errorResponse('something broke');
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('handles null', () => {
    const { status, body } = errorResponse(null);
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('AppError inheritance', () => {
  it('subclasses are instanceof AppError', () => {
    expect(new AuthError() instanceof AppError).toBe(true);
    expect(new RateLimitError(1) instanceof AppError).toBe(true);
    expect(new NotFoundError('x') instanceof AppError).toBe(true);
    expect(new UsageLimitError() instanceof AppError).toBe(true);
    expect(new ValidationError('y') instanceof AppError).toBe(true);
  });

  it('subclasses are instanceof Error', () => {
    expect(new AuthError() instanceof Error).toBe(true);
  });

  it('AppError name is set', () => {
    const err = new AuthError();
    expect(err.name).toBe('AppError');
  });
});
