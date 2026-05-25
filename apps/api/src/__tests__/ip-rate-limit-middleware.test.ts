import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const mockPipeline = {
  zremrangebyscore: vi.fn(),
  zadd: vi.fn(),
  zcard: vi.fn(),
  expire: vi.fn(),
  exec: vi.fn(),
};

vi.mock('../lib/redis.js', () => ({
  redis: { pipeline: () => mockPipeline },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

const { ipRateLimitMiddleware } = await import('../middleware/ipRateLimit.js');
const { errorResponse } = await import('../lib/errors.js');

function createApp() {
  const app = new Hono();
  app.use('/*', ipRateLimitMiddleware);
  app.get('/test', (c) => c.json({ ok: true }));
  app.onError((err, c) => {
    const { status, body } = errorResponse(err);
    return c.json(body, status as any);
  });
  return app;
}

describe('IP rate limit middleware (request flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows requests under the per-IP limit (60/min)', async () => {
    mockPipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 5],
      [null, 1],
    ]);
    const res = await createApp().request('/test', { headers: { 'x-real-ip': '1.2.3.4' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('55');
  });

  it('blocks requests over the per-IP limit with 429', async () => {
    mockPipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 61],
      [null, 1],
    ]);
    const res = await createApp().request('/test', { headers: { 'x-real-ip': '1.2.3.4' } });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('reports zero remaining once limit is hit exactly', async () => {
    mockPipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 60],
      [null, 1],
    ]);
    const res = await createApp().request('/test', { headers: { 'x-real-ip': '1.2.3.4' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('fails open when Redis errors (public-route safety)', async () => {
    mockPipeline.exec.mockRejectedValue(new Error('redis down'));
    const res = await createApp().request('/test', { headers: { 'x-real-ip': '1.2.3.4' } });
    expect(res.status).toBe(200);
  });

  it('does not block when pipeline returns null (defensive ?? 0)', async () => {
    mockPipeline.exec.mockResolvedValue(null);
    const res = await createApp().request('/test', { headers: { 'x-real-ip': '1.2.3.4' } });
    expect(res.status).toBe(200);
  });

  it('writes to a per-IP key (zadd called)', async () => {
    mockPipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 1],
    ]);
    await createApp().request('/test', { headers: { 'x-real-ip': '8.8.8.8' } });
    expect(mockPipeline.zadd).toHaveBeenCalled();
  });
});
