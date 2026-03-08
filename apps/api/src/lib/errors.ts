import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Invalid API key') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class RateLimitError extends AppError {
  constructor(public retryAfter: number) {
    super(429, 'RATE_LIMITED', 'Rate limit exceeded');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class UsageLimitError extends AppError {
  constructor() {
    super(403, 'USAGE_LIMIT_EXCEEDED', 'Monthly usage limit exceeded. Upgrade your plan.');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      body: {
        error: {
          code: err.code,
          message: err.message,
          ...(err instanceof RateLimitError ? { retry_after: err.retryAfter } : {}),
        },
      },
    };
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: err.issues.map((i) => i.message).join(', '),
        },
      },
    };
  }

  console.error('Unexpected error:', err);
  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
  };
}
