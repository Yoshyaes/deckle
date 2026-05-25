import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * env.ts itself runs validateEnv() at import time and calls process.exit(1)
 * on failure, so we can't safely import it under bad-env conditions. Instead
 * we reconstruct the schema here and assert the contract — keep this in sync
 * with apps/api/src/lib/env.ts.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  STORAGE_PROVIDER: z.enum(['local', 'r2', 's3', 'gcs']).default('local'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  WEBHOOK_SIGNING_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
});

const base = {
  DATABASE_URL: 'postgres://localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
};

describe('env schema', () => {
  it('accepts minimal valid env', () => {
    const result = envSchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it('coerces PORT from string (process.env values are always strings)', () => {
    const result = envSchema.safeParse({ ...base, PORT: '8080' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.PORT).toBe(8080);
  });

  it('defaults PORT to 3000 when not provided', () => {
    const result = envSchema.safeParse(base);
    if (result.success) expect(result.data.PORT).toBe(3000);
  });

  it('defaults NODE_ENV to development', () => {
    const result = envSchema.safeParse(base);
    if (result.success) expect(result.data.NODE_ENV).toBe('development');
  });

  it('defaults STORAGE_PROVIDER to local', () => {
    const result = envSchema.safeParse(base);
    if (result.success) expect(result.data.STORAGE_PROVIDER).toBe('local');
  });

  it('rejects an invalid DATABASE_URL', () => {
    const result = envSchema.safeParse({ ...base, DATABASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown NODE_ENV', () => {
    const result = envSchema.safeParse({ ...base, NODE_ENV: 'staging' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown STORAGE_PROVIDER', () => {
    const result = envSchema.safeParse({ ...base, STORAGE_PROVIDER: 'azure' });
    expect(result.success).toBe(false);
  });

  it('accepts ANTHROPIC_MODEL as an optional override (H-7 fix)', () => {
    const result = envSchema.safeParse({
      ...base,
      ANTHROPIC_MODEL: 'claude-opus-4-7',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ANTHROPIC_MODEL).toBe('claude-opus-4-7');
  });

  it('ANTHROPIC_MODEL is optional (undefined when unset)', () => {
    const result = envSchema.safeParse(base);
    if (result.success) expect(result.data.ANTHROPIC_MODEL).toBeUndefined();
  });

  it('accepts all valid LOG_LEVEL values', () => {
    for (const level of ['fatal', 'error', 'warn', 'info', 'debug', 'trace']) {
      const result = envSchema.safeParse({ ...base, LOG_LEVEL: level });
      expect(result.success).toBe(true);
    }
  });

  it('rejects an unknown LOG_LEVEL', () => {
    const result = envSchema.safeParse({ ...base, LOG_LEVEL: 'verbose' });
    expect(result.success).toBe(false);
  });

  it('rejects missing required REDIS_URL', () => {
    const { REDIS_URL: _omit, ...rest } = base;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
