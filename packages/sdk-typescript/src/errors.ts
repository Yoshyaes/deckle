export class DocuForgeError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);
    this.name = 'DocuForgeError';
  }
}

export class AuthenticationError extends DocuForgeError {
  constructor(message = 'Invalid API key') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class RateLimitError extends DocuForgeError {
  constructor(
    public retryAfter: number,
    message = 'Rate limit exceeded',
  ) {
    super(message, 429, 'RATE_LIMITED');
  }
}

export class ValidationError extends DocuForgeError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}
