import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

/**
 * Focused tests for the timing-safe service-secret comparison path in the
 * auth middleware (C-1 fix). The base auth.test.ts already covers the happy
 * path and bearer-token flow; this file targets the timing-safe specifics.
 */

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn() },
}));

const mockLimit = vi.fn();

vi.mock('../lib/db.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
        where: () => ({ limit: () => mockLimit._returnValue }),
      }),
    }),
    update: () => ({ set: () => ({ where: () => ({ catch: () => {} }) }) }),
  },
}));

vi.mock('../schema/db.js', () => ({
  apiKeys: { id: 'id', keyHash: 'keyHash', userId: 'userId', keyPrefix: 'keyPrefix', lastUsedAt: 'lastUsedAt' },
  users: { id: 'id', email: 'email', plan: 'plan' },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

const { authMiddleware } = await import('../middleware/auth.js');
const { errorResponse } = await import('../lib/errors.js');

function createApp() {
  const app = new Hono();
  app.use('/*', authMiddleware);
  app.get('/test', (c) => c.json({ ok: true, user: c.get('user') }));
  app.onError((err, c) => {
    const { status, body } = errorResponse(err);
    return c.json(body, status as any);
  });
  return app;
}

describe('Auth service-secret timing-safe comparison (C-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockLimit as any)._returnValue = Promise.resolve([]);
  });

  it('rejects a service secret of different length without throwing (length-check guard)', async () => {
    // timingSafeEqual would throw RangeError if called on buffers of different length —
    // the auth middleware must check length equality first.
    process.env.DASHBOARD_SERVICE_SECRET = 'a-32-byte-string-padded-to-32abc'; // 32 chars
    const app = createApp();
    const res = await app.request('/test', {
      headers: {
        'X-Service-Secret': 'short',
        'X-Service-User-Id': 'usr_1',
      },
    });
    // Should be a clean 401, not a 500
    expect(res.status).toBe(401);
    delete process.env.DASHBOARD_SERVICE_SECRET;
  });

  it('rejects when secret matches but X-Service-User-Id is missing', async () => {
    process.env.DASHBOARD_SERVICE_SECRET = 'svc_secret_123';
    const app = createApp();
    const res = await app.request('/test', {
      headers: {
        'X-Service-Secret': 'svc_secret_123',
        // no X-Service-User-Id
      },
    });
    expect(res.status).toBe(401);
    delete process.env.DASHBOARD_SERVICE_SECRET;
  });

  it('rejects when secret matches and user-id is supplied but user is not found in DB', async () => {
    process.env.DASHBOARD_SERVICE_SECRET = 'svc_secret_123';
    (mockLimit as any)._returnValue = Promise.resolve([]); // no rows

    const app = createApp();
    const res = await app.request('/test', {
      headers: {
        'X-Service-Secret': 'svc_secret_123',
        'X-Service-User-Id': 'usr_nonexistent',
      },
    });
    expect(res.status).toBe(401);
    delete process.env.DASHBOARD_SERVICE_SECRET;
  });

  it('does not fall through to bearer flow when X-Service-Secret is present but wrong', async () => {
    process.env.DASHBOARD_SERVICE_SECRET = 'svc_secret_123';
    const app = createApp();
    const res = await app.request('/test', {
      headers: {
        'X-Service-Secret': 'wrong',
        'X-Service-User-Id': 'usr_1',
        Authorization: 'Bearer df_live_validkeyrest1234567', // ignored
      },
    });
    // Per impl: if X-Service-Secret is present, we never fall through —
    // we throw AuthError directly. (Defence against attackers smuggling
    // bearer tokens past the service-secret check.)
    expect(res.status).toBe(401);
    delete process.env.DASHBOARD_SERVICE_SECRET;
  });

  it('succeeds with byte-identical secret of correct length', async () => {
    const secret = 'sv_secret_with_exact_match_value';
    process.env.DASHBOARD_SERVICE_SECRET = secret;
    (mockLimit as any)._returnValue = Promise.resolve([
      { id: 'usr_svc', email: 'svc@d.com', plan: 'enterprise' },
    ]);

    const app = createApp();
    const res = await app.request('/test', {
      headers: {
        'X-Service-Secret': secret,
        'X-Service-User-Id': 'usr_svc',
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe('usr_svc');
    delete process.env.DASHBOARD_SERVICE_SECRET;
  });
});
