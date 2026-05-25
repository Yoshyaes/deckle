import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Order of Promise.all in analytics.ts:
//   0: topTemplates  1: errorStats  2: avgLatency  3: typeBreakdown
//   4: dailyGens     5: peakHours
const dbState = {
  rows: [[], [], [], [], [], []] as Array<Array<Record<string, unknown>>>,
  call: 0,
};

vi.mock('../lib/db.js', () => {
  // Drizzle returns thenable chains — each method can be awaited OR chained.
  // We build a Proxy that resolves to a row array whenever awaited.
  const make = () => {
    const ret = dbState.rows[dbState.call++] || [];
    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => unknown) => resolve(ret);
        }
        // Any chain method just returns the same thenable proxy.
        return () => new Proxy({}, handler);
      },
    };
    return new Proxy({}, handler);
  };
  return { db: { select: make } };
});

vi.mock('../schema/db.js', () => ({
  generations: {
    id: 'id', userId: 'userId', templateId: 'templateId',
    status: 'status', inputType: 'inputType',
    createdAt: 'createdAt', generationTimeMs: 'generationTimeMs',
  },
  usageDaily: { userId: 'userId', date: 'date', generationCount: 'generationCount' },
  templates: { id: 'id', name: 'name' },
}));

const { default: analyticsRoute } = await import('../routes/analytics.js');

function createApp() {
  const app = new Hono();
  app.use('/*', async (c, next) => {
    c.set('user', { id: 'usr_1', email: 'a@b.com', plan: 'pro' });
    await next();
  });
  app.route('/analytics', analyticsRoute);
  return app;
}

describe('GET /analytics', () => {
  beforeEach(() => {
    dbState.rows = [[], [], [], [], [], []];
    dbState.call = 0;
  });

  it('returns an empty shape when no data exists', async () => {
    const res = await createApp().request('/analytics');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.top_templates).toEqual([]);
    expect(body.error_rate).toBe(0);
    expect(body.total_generations).toBe(0);
    expect(body.daily_generations).toEqual([]);
    expect(body.peak_hours).toEqual([]);
  });

  it('computes error_rate as (failed/total)*100 with one decimal', async () => {
    dbState.rows = [
      [], // topTemplates
      [{ total: 50, failed: 5 }], // errorStats → 10.0%
      [], [], [], [],
    ];
    const res = await createApp().request('/analytics');
    const body = await res.json();
    expect(body.error_rate).toBe(10);
    expect(body.total_generations).toBe(50);
    expect(body.failed_generations).toBe(5);
  });

  it('returns 0 error rate when total is 0 (no divide-by-zero)', async () => {
    dbState.rows = [
      [],
      [{ total: 0, failed: 0 }],
      [], [], [], [],
    ];
    const res = await createApp().request('/analytics');
    const body = await res.json();
    expect(body.error_rate).toBe(0);
  });

  it('falls back to "Deleted template" when template name is null', async () => {
    dbState.rows = [
      [{ templateId: 'tmpl_x', templateName: null, count: 7 }],
      [{ total: 7, failed: 0 }],
      [], [], [], [],
    ];
    const res = await createApp().request('/analytics');
    const body = await res.json();
    expect(body.top_templates[0].template_name).toBe('Deleted template');
  });

  it('maps daily_generations from usageDaily rows', async () => {
    dbState.rows = [
      [],
      [{ total: 3, failed: 0 }],
      [],
      [],
      [
        { date: '2026-04-01', count: 1 },
        { date: '2026-04-02', count: 2 },
      ],
      [],
    ];
    const res = await createApp().request('/analytics');
    const body = await res.json();
    expect(body.daily_generations).toEqual([
      { date: '2026-04-01', count: 1 },
      { date: '2026-04-02', count: 2 },
    ]);
  });
});
