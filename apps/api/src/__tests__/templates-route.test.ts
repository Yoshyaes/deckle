import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const dbState = {
  oneTemplate: [] as Array<Record<string, unknown>>,
  list: [] as Array<Record<string, unknown>>,
  oneVersion: [] as Array<Record<string, unknown>>,
  versions: [] as Array<Record<string, unknown>>,
  insertReturned: [] as Array<Record<string, unknown>>,
  updateReturned: [] as Array<Record<string, unknown>>,
  versionInsertReceived: [] as unknown[],
  selectCalls: 0,
};

vi.mock('../lib/db.js', () => {
  // We dispatch reads based on call order:
  //   1st select: one-template lookup OR list, depending on which method (.limit vs .orderBy)
  //   subsequent selects on a route: one-version etc.
  const buildSelect = () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve(dbState.selectCalls++ === 0 ? dbState.oneTemplate : dbState.oneVersion),
        orderBy: () => ({
          limit: () => Promise.resolve(dbState.list.length > 0 ? dbState.list : dbState.versions),
        }),
      }),
    }),
  });

  return {
    db: {
      select: () => buildSelect(),
      insert: (table: unknown) => ({
        values: (v: unknown) => {
          // The route inserts template versions before updating the template.
          dbState.versionInsertReceived.push(v);
          return Object.assign(Promise.resolve(), {
            returning: () => Promise.resolve(dbState.insertReturned),
          });
        },
      }),
      update: () => ({
        set: () => ({
          where: () => Object.assign(Promise.resolve(), {
            returning: () => Promise.resolve(dbState.updateReturned),
          }),
        }),
      }),
      delete: () => ({
        where: () => Promise.resolve(),
      }),
    },
  };
});

vi.mock('../schema/db.js', () => ({
  templates: {
    id: 'id', userId: 'userId', name: 'name', htmlContent: 'htmlContent',
    schema: 'schema', version: 'version', isPublic: 'isPublic',
    createdAt: 'createdAt', updatedAt: 'updatedAt',
  },
  templateVersions: {
    id: 'id', templateId: 'templateId', version: 'version',
    htmlContent: 'htmlContent', schema: 'schema', createdAt: 'createdAt',
  },
  generations: { id: 'id', templateId: 'templateId' },
}));

const { default: tmplRoute } = await import('../routes/templates.js');
const { errorResponse } = await import('../lib/errors.js');

function resetDb() {
  dbState.oneTemplate = [];
  dbState.list = [];
  dbState.oneVersion = [];
  dbState.versions = [];
  dbState.insertReturned = [];
  dbState.updateReturned = [];
  dbState.versionInsertReceived = [];
  dbState.selectCalls = 0;
}

function createApp() {
  const app = new Hono();
  app.use('/*', async (c, next) => {
    c.set('user', { id: 'usr_1', email: 'a@b.com', plan: 'free' });
    await next();
  });
  app.route('/templates', tmplRoute);
  app.onError((err, c) => {
    const { status, body } = errorResponse(err);
    return c.json(body, status as any);
  });
  return app;
}

describe('POST /templates', () => {
  beforeEach(resetDb);

  it('returns 400 for missing required fields', async () => {
    const res = await createApp().request('/templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty name', async () => {
    const res = await createApp().request('/templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', html_content: '<h1>x</h1>' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when html_content exceeds size cap', async () => {
    const huge = 'x'.repeat(10_485_761);
    const res = await createApp().request('/templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'X', html_content: huge }),
    });
    expect(res.status).toBe(400);
  });

  it('creates template and returns 201', async () => {
    dbState.insertReturned = [{
      id: 'tmpl_1',
      name: 'Inv',
      htmlContent: '<h1>x</h1>',
      schema: null,
      version: 1,
      isPublic: false,
      createdAt: new Date(),
    }];
    const res = await createApp().request('/templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Inv', html_content: '<h1>x</h1>' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('tmpl_1');
    expect(body.version).toBe(1);
  });
});

describe('GET /templates and /:id', () => {
  beforeEach(resetDb);

  it('list returns wrapped data array', async () => {
    dbState.list = [
      { id: 'tmpl_1', name: 'a', version: 1, isPublic: false, createdAt: new Date(), updatedAt: new Date() },
      { id: 'tmpl_2', name: 'b', version: 2, isPublic: true, createdAt: new Date(), updatedAt: new Date() },
    ];
    const res = await createApp().request('/templates');
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });

  it('get returns 404 for missing template', async () => {
    dbState.oneTemplate = [];
    const res = await createApp().request('/templates/tmpl_missing');
    expect(res.status).toBe(404);
  });

  it('get returns full template payload', async () => {
    dbState.oneTemplate = [{
      id: 'tmpl_1', name: 'x', htmlContent: '<p>', schema: { a: 'b' },
      version: 3, isPublic: false, createdAt: new Date(), updatedAt: new Date(),
    }];
    const res = await createApp().request('/templates/tmpl_1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.html_content).toBe('<p>');
    expect(body.schema).toEqual({ a: 'b' });
  });
});

describe('PUT /templates/:id', () => {
  beforeEach(resetDb);

  it('returns 404 for missing template', async () => {
    dbState.oneTemplate = [];
    const res = await createApp().request('/templates/tmpl_missing', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'new' }),
    });
    expect(res.status).toBe(404);
  });

  it('saves a version snapshot when html_content changes', async () => {
    dbState.oneTemplate = [{
      id: 'tmpl_1', name: 'x', htmlContent: '<old>', schema: {},
      version: 1, isPublic: false, userId: 'usr_1',
    }];
    dbState.updateReturned = [{
      id: 'tmpl_1', name: 'x', htmlContent: '<new>', schema: {},
      version: 2, isPublic: false, createdAt: new Date(), updatedAt: new Date(),
    }];
    const res = await createApp().request('/templates/tmpl_1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ html_content: '<new>' }),
    });
    expect(res.status).toBe(200);
    expect(dbState.versionInsertReceived.length).toBe(1);
    const snapshot = dbState.versionInsertReceived[0] as Record<string, unknown>;
    expect(snapshot.htmlContent).toBe('<old>');
    expect(snapshot.version).toBe(1);
  });

  it('does NOT snapshot version when only name changes', async () => {
    dbState.oneTemplate = [{
      id: 'tmpl_1', name: 'x', htmlContent: '<old>', schema: {}, version: 5,
    }];
    dbState.updateReturned = [{
      id: 'tmpl_1', name: 'y', htmlContent: '<old>', schema: {},
      version: 5, isPublic: false, createdAt: new Date(), updatedAt: new Date(),
    }];
    await createApp().request('/templates/tmpl_1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'y' }),
    });
    expect(dbState.versionInsertReceived.length).toBe(0);
  });
});

describe('DELETE /templates/:id', () => {
  beforeEach(resetDb);

  it('returns 404 when template does not exist', async () => {
    dbState.oneTemplate = [];
    const res = await createApp().request('/templates/tmpl_x', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('returns { deleted: true } on success', async () => {
    dbState.oneTemplate = [{ id: 'tmpl_1', userId: 'usr_1' }];
    const res = await createApp().request('/templates/tmpl_1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
  });
});

describe('POST /templates/:id/restore', () => {
  beforeEach(resetDb);

  it('returns 400 when version_id is missing', async () => {
    const res = await createApp().request('/templates/tmpl_1/restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
