import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const loggerInfo = vi.fn();
const loggerError = vi.fn();

vi.mock('../lib/logger.js', () => ({
  logger: {
    info: loggerInfo,
    error: loggerError,
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

const { loggingMiddleware } = await import('../middleware/logging.js');

function createApp() {
  const app = new Hono();
  app.use('/*', loggingMiddleware);
  app.get('/ok', (c) => c.json({ ok: true }));
  app.get('/boom', () => {
    throw new Error('boom');
  });
  app.get('/long', async (c) => {
    await new Promise((r) => setTimeout(r, 10));
    return c.json({ ok: true });
  });
  app.get('/use-id', (c) => c.json({ id: c.get('requestId') as string }));
  return app;
}

describe('Logging middleware', () => {
  beforeEach(() => {
    loggerInfo.mockClear();
    loggerError.mockClear();
  });

  it('logs every request with method, path, status, duration, requestId', async () => {
    const res = await createApp().request('/ok');
    expect(res.status).toBe(200);
    expect(loggerInfo).toHaveBeenCalledTimes(1);
    const [meta, msg] = loggerInfo.mock.calls[0] as [Record<string, unknown>, string];
    expect(meta.method).toBe('GET');
    expect(meta.path).toBe('/ok');
    expect(meta.status).toBe(200);
    expect(typeof meta.duration).toBe('number');
    expect(typeof meta.requestId).toBe('string');
    expect(msg).toMatch(/GET \/ok 200/);
  });

  it('attaches a requestId to context that route handlers can read', async () => {
    const res = await createApp().request('/use-id');
    const body = (await res.json()) as { id: string };
    expect(body.id).toBeDefined();
    expect(body.id.length).toBeGreaterThan(0);
  });

  it('generates a unique requestId per request', async () => {
    const app = createApp();
    const r1 = await (await app.request('/use-id')).json();
    const r2 = await (await app.request('/use-id')).json();
    expect((r1 as any).id).not.toBe((r2 as any).id);
  });

  it('measures duration as a non-negative number', async () => {
    await createApp().request('/long');
    const [meta] = loggerInfo.mock.calls[0] as [Record<string, unknown>];
    expect(meta.duration).toBeGreaterThanOrEqual(0);
  });

  it('logs 500 status when a route throws', async () => {
    const app = createApp();
    app.onError((_err, c) => c.json({ error: 'boom' }, 500));
    const res = await app.request('/boom');
    expect(res.status).toBe(500);
    expect(loggerInfo).toHaveBeenCalled();
    const [meta] = loggerInfo.mock.calls[0] as [Record<string, unknown>];
    expect(meta.status).toBe(500);
  });
});
