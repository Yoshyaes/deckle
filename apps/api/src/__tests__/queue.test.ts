import { describe, it, expect, vi } from 'vitest';

// Mock bullmq so importing queue.ts doesn't open a real Redis connection.
vi.mock('bullmq', () => {
  class Queue {
    name: string;
    opts: unknown;
    constructor(name: string, opts: unknown) {
      this.name = name;
      this.opts = opts;
    }
  }
  class Worker {
    name: string;
    processor: unknown;
    opts: unknown;
    handlers: Record<string, Function> = {};
    constructor(name: string, processor: unknown, opts: unknown) {
      this.name = name;
      this.processor = processor;
      this.opts = opts;
    }
    on(event: string, handler: Function) {
      this.handlers[event] = handler;
      return this;
    }
    close() {
      return Promise.resolve();
    }
  }
  return { Queue, Worker };
});

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../lib/db.js', () => ({ db: {} }));
vi.mock('../schema/db.js', () => ({ generations: {}, templates: {} }));
vi.mock('../services/renderer.js', () => ({ renderPdf: vi.fn() }));
vi.mock('../services/storage.js', () => ({ uploadPdf: vi.fn() }));
vi.mock('../services/templates.js', () => ({ mergeTemplate: vi.fn() }));
vi.mock('../services/react-renderer.js', () => ({ renderReactToHtml: vi.fn() }));
vi.mock('../services/barcodes.js', () => ({ processBarcodes: vi.fn() }));
vi.mock('../services/usage.js', () => ({ incrementUsage: vi.fn() }));
vi.mock('../services/webhooks.js', () => ({ deliverWebhook: vi.fn() }));

const { parseRedisConnection, generationQueue, startWorker, stopWorker } =
  await import('../services/queue.js');

describe('parseRedisConnection', () => {
  it('parses host and port from a basic redis:// URL', () => {
    const conn = parseRedisConnection('redis://localhost:6379');
    expect(conn).toEqual({ host: 'localhost', port: 6379 });
  });

  it('defaults the port to 6379 when omitted', () => {
    const conn = parseRedisConnection('redis://example.com');
    expect(conn.port).toBe(6379);
  });

  it('extracts the password when present and URL-decodes it', () => {
    const conn = parseRedisConnection('redis://:p%40ss@example.com:6379');
    expect(conn.password).toBe('p@ss');
  });

  it('extracts a non-"default" username', () => {
    const conn = parseRedisConnection('redis://alice:pw@example.com:6379');
    expect(conn.username).toBe('alice');
    expect(conn.password).toBe('pw');
  });

  it('omits the username when it is the literal "default" (ioredis convention)', () => {
    const conn = parseRedisConnection('redis://default:pw@example.com:6379');
    expect(conn.username).toBeUndefined();
    expect(conn.password).toBe('pw');
  });

  it('enables TLS for rediss:// URLs', () => {
    const conn = parseRedisConnection('rediss://example.com:6380');
    expect(conn.tls).toEqual({});
  });

  it('does not enable TLS for plain redis://', () => {
    const conn = parseRedisConnection('redis://example.com:6379');
    expect(conn.tls).toBeUndefined();
  });

  it('omits password when none is provided', () => {
    const conn = parseRedisConnection('redis://example.com:6379');
    expect(conn.password).toBeUndefined();
  });

  it('handles URL-encoded passwords with special characters', () => {
    const conn = parseRedisConnection('redis://:%23%24%25@example.com:6379');
    expect(conn.password).toBe('#$%');
  });
});

describe('queue module exports', () => {
  it('exports generationQueue as a Queue with the right name', () => {
    expect(generationQueue).toBeDefined();
    expect((generationQueue as any).name).toBe('pdf-generation');
  });

  it('configures sensible defaultJobOptions (retries + backoff)', () => {
    const opts = (generationQueue as any).opts as {
      defaultJobOptions: { attempts: number; backoff: { type: string; delay: number } };
    };
    expect(opts.defaultJobOptions.attempts).toBe(3);
    expect(opts.defaultJobOptions.backoff.type).toBe('exponential');
    expect(opts.defaultJobOptions.backoff.delay).toBe(1000);
  });

  it('startWorker / stopWorker do not throw and stopWorker is safe before start', async () => {
    // stopWorker before start: returns undefined (worker?.close())
    expect(stopWorker()).toBeUndefined();
    expect(() => startWorker()).not.toThrow();
    // After start, stopWorker returns a Promise from the mocked Worker.close()
    await expect(stopWorker()).resolves.toBeUndefined();
  });
});
