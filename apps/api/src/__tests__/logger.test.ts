import { describe, it, expect } from 'vitest';
import { logger, createRequestLogger } from '../lib/logger.js';

describe('logger', () => {
  it('exports a pino logger instance with standard level methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.fatal).toBe('function');
  });

  it('logger calls do not throw for any level', () => {
    expect(() => logger.info('test')).not.toThrow();
    expect(() => logger.error({ err: new Error('x') }, 'test')).not.toThrow();
    expect(() => logger.warn('warning')).not.toThrow();
    expect(() => logger.debug({ a: 1 }, 'debug')).not.toThrow();
  });
});

describe('createRequestLogger', () => {
  it('returns a child logger', () => {
    const child = createRequestLogger('req_123');
    expect(typeof child.info).toBe('function');
    expect(typeof child.error).toBe('function');
  });

  it('child logger calls do not throw', () => {
    const child = createRequestLogger('req_abc');
    expect(() => child.info({ user: 'u1' }, 'request')).not.toThrow();
  });

  it('different request IDs produce different child instances', () => {
    const a = createRequestLogger('req_1');
    const b = createRequestLogger('req_2');
    expect(a).not.toBe(b);
  });
});
