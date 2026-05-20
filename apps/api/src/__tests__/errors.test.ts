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
    expect(err.message).toMatch(/Invalid API key/);
    expect(err.message).toMatch(/df_live_/);
  });

  it('AuthError gives the user a hint about the header format', () => {
    expect(new AuthError().message).toMatch(/Authorization:\s*Bearer/);
  });

  it('RateLimitError includes the retry-after seconds in the message', () => {
    expect(new RateLimitError(42).message).toMatch(/Retry after 42s/);
  });

  it('NotFoundError supports an optional hint', () => {
    expect(new NotFoundError('Template').message).toBe('Template not found');
    expect(new NotFoundError('Template', 'List with GET /v1/templates.').message).toBe(
      'Template not found. List with GET /v1/templates.',
    );
  });

  it('UsageLimitError names the upgrade path', () => {
    expect(new UsageLimitError().message).toMatch(/Upgrade to Starter or Pro/);
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
    // RateLimitError-shaped branch carries retry_after.
    expect((body.error as { retry_after?: number }).retry_after).toBe(3);
  });

  it('echoes the request_id back in every error response', () => {
    const id = '11111111-2222-3333-4444-555555555555';
    expect(errorResponse(new AuthError(), id).body.error.request_id).toBe(id);
    expect(errorResponse(new Error('boom'), id).body.error.request_id).toBe(id);
  });

  it('handles unknown errors as 500', () => {
    const err = new Error('random');
    const { status, body } = errorResponse(err);
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
