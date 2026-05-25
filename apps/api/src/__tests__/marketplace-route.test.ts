import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const dbState = {
  publicTemplates: [] as Array<Record<string, unknown>>,
  oneTemplate: [] as Array<Record<string, unknown>>,
  insertReturned: [] as Array<Record<string, unknown>>,
  updateReturned: [] as Array<Record<string, unknown>>,
};

vi.mock('../lib/db.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({
              offset: () => Promise.resolve(dbState.publicTemplates),
            }),
          }),
          limit: () => Promise.resolve(dbState.oneTemplate),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve(dbState.insertReturned),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve(dbState.updateReturned),
        }),
      }),
    }),
  },
}));

vi.mock('../schema/db.js', () => ({
  templates: {
    id: 'id',
    name: 'name',
    userId: 'userId',
    htmlContent: 'htmlContent',
    schema: 'schema',
    version: 'version',
    isPublic: 'isPublic',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

const { default: mpRoute } = await import('../routes/marketplace.js');
const { errorResponse } = await import('../lib/errors.js');

function createApp() {
  const app = new Hono();
  app.use('/*', async (c, next) => {
    c.set('user', { id: 'usr_1', email: 'a@b.com', plan: 'free' });
    await next();
  });
  app.route('/marketplace', mpRoute);
  app.onError((err, c) => {
    const { status, body } = errorResponse(err);
    return c.json(body, status as any);
  });
  return app;
}

describe('GET /marketplace', () => {
  beforeEach(() => {
    dbState.publicTemplates = [];
  });

  it('returns empty list', async () => {
    const res = await createApp().request('/marketplace');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(body.has_more).toBe(false);
  });

  it('returns formatted list', async () => {
    dbState.publicTemplates = [
      {
        id: 'tmpl_1',
        name: 'Invoice',
        version: 2,
        isPublic: true,
        createdAt: new Date('2026-04-01'),
        updatedAt: new Date('2026-04-02'),
      },
    ];
    const res = await createApp().request('/marketplace');
    const body = await res.json();
    expect(body.data[0].id).toBe('tmpl_1');
    expect(body.data[0].name).toBe('Invoice');
    expect(body.data[0].version).toBe(2);
  });

  it('has_more=true when result count equals limit', async () => {
    dbState.publicTemplates = Array.from({ length: 20 }, (_, i) => ({
      id: `tmpl_${i}`,
      name: `t${i}`,
      version: 1,
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const res = await createApp().request('/marketplace?limit=20');
    const body = await res.json();
    expect(body.has_more).toBe(true);
  });
});

describe('GET /marketplace/:id', () => {
  beforeEach(() => {
    dbState.oneTemplate = [];
  });

  it('returns 404 when template is not public or missing', async () => {
    dbState.oneTemplate = [];
    const res = await createApp().request('/marketplace/tmpl_missing');
    expect(res.status).toBe(404);
  });

  it('returns full template when public', async () => {
    dbState.oneTemplate = [
      {
        id: 'tmpl_1',
        name: 'Invoice',
        htmlContent: '<h1>Invoice</h1>',
        schema: { name: 'string' },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const res = await createApp().request('/marketplace/tmpl_1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.html_content).toBe('<h1>Invoice</h1>');
  });
});

describe('POST /marketplace/:id/clone', () => {
  beforeEach(() => {
    dbState.oneTemplate = [];
    dbState.insertReturned = [];
  });

  it('returns 404 when source template is not public', async () => {
    dbState.oneTemplate = [];
    const res = await createApp().request('/marketplace/tmpl_x/clone', { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('clones into the current user with " (copy)" suffix', async () => {
    dbState.oneTemplate = [
      {
        id: 'tmpl_orig',
        name: 'Invoice',
        htmlContent: '<h1>x</h1>',
        schema: {},
        isPublic: true,
      },
    ];
    dbState.insertReturned = [
      {
        id: 'tmpl_new',
        name: 'Invoice (copy)',
        version: 1,
        createdAt: new Date(),
      },
    ];
    const res = await createApp().request('/marketplace/tmpl_orig/clone', { method: 'POST' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Invoice (copy)');
  });
});

describe('POST /marketplace/:id/publish and /unpublish', () => {
  beforeEach(() => {
    dbState.oneTemplate = [];
    dbState.updateReturned = [];
  });

  it('publish returns 404 when template is not owned by user', async () => {
    dbState.oneTemplate = [];
    const res = await createApp().request('/marketplace/tmpl_x/publish', { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('publish flips is_public=true', async () => {
    dbState.oneTemplate = [{ id: 'tmpl_1', name: 't', userId: 'usr_1' }];
    dbState.updateReturned = [{ id: 'tmpl_1', name: 't', isPublic: true }];
    const res = await createApp().request('/marketplace/tmpl_1/publish', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_public).toBe(true);
  });

  it('unpublish flips is_public=false', async () => {
    dbState.oneTemplate = [{ id: 'tmpl_1', name: 't', userId: 'usr_1' }];
    dbState.updateReturned = [{ id: 'tmpl_1', name: 't', isPublic: false }];
    const res = await createApp().request('/marketplace/tmpl_1/unpublish', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_public).toBe(false);
  });
});
