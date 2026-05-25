import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const getUsageStatsMock = vi.fn();
vi.mock('../services/usage.js', () => ({
  getUsageStats: (...args: unknown[]) => getUsageStatsMock(...args),
}));

const { default: usageRoute } = await import('../routes/usage.js');

function createApp() {
  const app = new Hono();
  app.use('/*', async (c, next) => {
    c.set('user', { id: 'usr_1', email: 'a@b.com', plan: 'pro' });
    await next();
  });
  app.route('/usage', usageRoute);
  return app;
}

describe('GET /usage', () => {
  beforeEach(() => {
    getUsageStatsMock.mockReset();
  });

  it('returns the stats object from the service', async () => {
    getUsageStatsMock.mockResolvedValue({
      period_start: '2026-04-01',
      period_end: '2026-04-30',
      generation_count: 42,
      total_pages: 100,
      total_bytes: 1024,
      plan: 'pro',
      limit: 100000,
    });
    const res = await createApp().request('/usage');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.generation_count).toBe(42);
    expect(body.plan).toBe('pro');
    expect(body.limit).toBe(100000);
  });

  it('passes the current user id and plan to getUsageStats', async () => {
    getUsageStatsMock.mockResolvedValue({});
    await createApp().request('/usage');
    expect(getUsageStatsMock).toHaveBeenCalledWith('usr_1', 'pro');
  });
});
