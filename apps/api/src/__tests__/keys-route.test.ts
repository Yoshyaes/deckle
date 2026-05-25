import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const createApiKeyMock = vi.fn();
const listApiKeysMock = vi.fn();
const revokeApiKeyMock = vi.fn();

vi.mock('../services/apikeys.js', () => ({
  createApiKey: (...args: unknown[]) => createApiKeyMock(...args),
  listApiKeys: (...args: unknown[]) => listApiKeysMock(...args),
  revokeApiKey: (...args: unknown[]) => revokeApiKeyMock(...args),
}));

const { default: keysRoute } = await import('../routes/keys.js');
const { errorResponse } = await import('../lib/errors.js');

function createApp() {
  const app = new Hono();
  app.use('/*', async (c, next) => {
    c.set('user', { id: 'usr_1', email: 'a@b.com', plan: 'free' });
    await next();
  });
  app.route('/keys', keysRoute);
  app.onError((err, c) => {
    const { status, body } = errorResponse(err);
    return c.json(body, status as any);
  });
  return app;
}

describe('POST /keys', () => {
  beforeEach(() => {
    createApiKeyMock.mockReset();
  });

  it('creates a key with default name when none provided', async () => {
    createApiKeyMock.mockResolvedValue({
      id: 'key_1',
      key: 'df_live_xxxxx',
      name: 'Default',
      prefix: 'df_live_xxxxx...abcd',
      created_at: new Date(),
    });

    const res = await createApp().request('/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Default');
    expect(body.key).toMatch(/^df_live_/);
    expect(createApiKeyMock).toHaveBeenCalledWith('usr_1', 'Default');
  });

  it('creates a key with custom name', async () => {
    createApiKeyMock.mockResolvedValue({
      id: 'key_2',
      key: 'df_live_yyy',
      name: 'CI Token',
      prefix: 'df_live_yyy...zzzz',
      created_at: new Date(),
    });

    const res = await createApp().request('/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'CI Token' }),
    });
    expect(res.status).toBe(201);
    expect(createApiKeyMock).toHaveBeenCalledWith('usr_1', 'CI Token');
  });

  it('returns 400 for empty name', async () => {
    const res = await createApp().request('/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for name over 255 chars', async () => {
    const res = await createApp().request('/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'x'.repeat(256) }),
    });
    expect(res.status).toBe(400);
  });

  it('handles malformed JSON body gracefully', async () => {
    // schema applies default name when body is {}
    createApiKeyMock.mockResolvedValue({
      id: 'key_3',
      key: 'df_live_zzz',
      name: 'Default',
      prefix: 'df_live_zzz...wwww',
      created_at: new Date(),
    });
    const res = await createApp().request('/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    });
    // c.req.json().catch(() => ({})) → defaults applied
    expect(res.status).toBe(201);
  });

  it('propagates 422 KEY_LIMIT_REACHED from the service', async () => {
    const { AppError } = await import('../lib/errors.js');
    createApiKeyMock.mockRejectedValue(
      new AppError(422, 'KEY_LIMIT_REACHED', 'too many'),
    );
    const res = await createApp().request('/keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('KEY_LIMIT_REACHED');
  });
});

describe('GET /keys', () => {
  beforeEach(() => {
    listApiKeysMock.mockReset();
  });

  it('returns keys wrapped in { data: [...] }', async () => {
    listApiKeysMock.mockResolvedValue([
      { id: 'k1', name: 'a', prefix: 'p...' },
      { id: 'k2', name: 'b', prefix: 'q...' },
    ]);

    const res = await createApp().request('/keys');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
  });

  it('returns empty array when no keys exist', async () => {
    listApiKeysMock.mockResolvedValue([]);
    const res = await createApp().request('/keys');
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it('scopes lookup to current user', async () => {
    listApiKeysMock.mockResolvedValue([]);
    await createApp().request('/keys');
    expect(listApiKeysMock).toHaveBeenCalledWith('usr_1');
  });
});

describe('DELETE /keys/:id', () => {
  beforeEach(() => {
    revokeApiKeyMock.mockReset();
  });

  it('returns 200 with { deleted: true } when key is revoked', async () => {
    revokeApiKeyMock.mockResolvedValue(true);
    const res = await createApp().request('/keys/key_abc', { method: 'DELETE' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(revokeApiKeyMock).toHaveBeenCalledWith('usr_1', 'key_abc');
  });

  it('returns 404 when key does not exist (or not owned by user)', async () => {
    revokeApiKeyMock.mockResolvedValue(false);
    const res = await createApp().request('/keys/key_missing', { method: 'DELETE' });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
