import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// State for DB mock
const dbState = {
  rows: [] as Array<Record<string, unknown>>,
  capturedConditions: [] as unknown[],
  capturedLimit: 0,
  capturedOffset: 0,
};

vi.mock('../lib/db.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (cond: unknown) => {
          dbState.capturedConditions.push(cond);
          const result: any = {
            limit: (n: number) => {
              dbState.capturedLimit = n;
              return Object.assign(Promise.resolve(dbState.rows), {
                offset: (o: number) => {
                  dbState.capturedOffset = o;
                  return Promise.resolve(dbState.rows);
                },
              });
            },
            orderBy: () => ({
              limit: (n: number) => {
                dbState.capturedLimit = n;
                return {
                  offset: (o: number) => {
                    dbState.capturedOffset = o;
                    return Promise.resolve(dbState.rows);
                  },
                };
              },
            }),
          };
          return result;
        },
      }),
    }),
  },
}));

vi.mock('../schema/db.js', () => ({
  generations: { id: 'id', userId: 'userId', createdAt: 'createdAt' },
}));

const { default: genRoute } = await import('../routes/generations.js');
const { errorResponse } = await import('../lib/errors.js');

function createApp() {
  const app = new Hono();
  app.use('/*', async (c, next) => {
    c.set('user', { id: 'usr_1', email: 'a@b.com', plan: 'free' });
    await next();
  });
  app.route('/generations', genRoute);
  app.onError((err, c) => {
    const { status, body } = errorResponse(err);
    return c.json(body, status as any);
  });
  return app;
}

describe('GET /generations/:id', () => {
  beforeEach(() => {
    dbState.rows = [];
  });

  it('returns 404 when generation does not exist', async () => {
    dbState.rows = [];
    const res = await createApp().request('/generations/gen_missing');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns formatted generation when found', async () => {
    dbState.rows = [
      {
        id: 'gen_1',
        templateId: 'tmpl_x',
        inputType: 'template',
        status: 'completed',
        pdfUrl: 'https://x.com/y.pdf',
        pages: 3,
        fileSizeBytes: 1024,
        generationTimeMs: 250,
        error: null,
        createdAt: new Date('2026-04-01T00:00:00Z'),
      },
    ];
    const res = await createApp().request('/generations/gen_1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('gen_1');
    expect(body.template_id).toBe('tmpl_x');
    expect(body.url).toBe('https://x.com/y.pdf');
    expect(body.pages).toBe(3);
    expect(body.file_size).toBe(1024);
    expect(body.generation_time_ms).toBe(250);
  });
});

describe('GET /generations', () => {
  beforeEach(() => {
    dbState.rows = [];
    dbState.capturedLimit = 0;
    dbState.capturedOffset = 0;
  });

  it('returns empty list when no generations', async () => {
    dbState.rows = [];
    const res = await createApp().request('/generations');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.has_more).toBe(false);
    expect(body.next_cursor).toBeUndefined();
  });

  it('paginates with default limit of 50 (asks for limit+1 to detect more)', async () => {
    dbState.rows = Array.from({ length: 10 }, (_, i) => ({
      id: `gen_${i}`,
      templateId: null,
      inputType: 'html',
      status: 'completed',
      pdfUrl: null,
      pages: 1,
      fileSizeBytes: 100,
      generationTimeMs: 10,
      createdAt: new Date(),
    }));
    await createApp().request('/generations');
    expect(dbState.capturedLimit).toBe(51); // limit (50) + 1
    expect(dbState.capturedOffset).toBe(0);
  });

  it('uses custom limit when provided (capped at 100)', async () => {
    dbState.rows = [];
    await createApp().request('/generations?limit=20');
    expect(dbState.capturedLimit).toBe(21);
    await createApp().request('/generations?limit=500');
    expect(dbState.capturedLimit).toBe(101); // capped to max 100 + 1
  });

  it('returns has_more=true and next_cursor when results exceed limit', async () => {
    dbState.rows = Array.from({ length: 51 }, (_, i) => ({
      id: `gen_${i}`,
      templateId: null,
      inputType: 'html',
      status: 'completed',
      pdfUrl: null,
      pages: 1,
      fileSizeBytes: 100,
      generationTimeMs: 10,
      createdAt: new Date('2026-04-01T00:00:00Z'),
    }));
    const res = await createApp().request('/generations');
    const body = await res.json();
    expect(body.has_more).toBe(true);
    expect(body.data).toHaveLength(50);
    expect(body.next_cursor).toBeDefined();
  });

  it('honors cursor query param (overrides offset behavior)', async () => {
    dbState.rows = [];
    await createApp().request('/generations?cursor=2026-04-01T00:00:00Z');
    expect(dbState.capturedOffset).toBe(0);
  });

  it('returns has_more=false when results <= limit', async () => {
    dbState.rows = Array.from({ length: 5 }, (_, i) => ({
      id: `gen_${i}`,
      templateId: null,
      inputType: 'html',
      status: 'completed',
      pdfUrl: null,
      pages: 1,
      fileSizeBytes: 100,
      generationTimeMs: 10,
      createdAt: new Date(),
    }));
    const res = await createApp().request('/generations');
    const body = await res.json();
    expect(body.has_more).toBe(false);
    expect(body.next_cursor).toBeUndefined();
  });
});
