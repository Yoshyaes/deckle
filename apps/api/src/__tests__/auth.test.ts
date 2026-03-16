import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

/**
 * Tests the auth middleware logic by mocking the database and bcrypt.
 * We set up a minimal Hono app with the auth middleware to test
 * header parsing, service-to-service auth, and bearer token flow.
 */

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

// Mock database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockInnerJoin = vi.fn();
const mockLimit = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockCatch = vi.fn();

vi.mock('../lib/db.js', () => ({
  db: {
    select: () => {
      mockSelect();
      return {
        from: (...args: unknown[]) => {
          mockFrom(...args);
          return {
            where: (...a: unknown[]) => {
              mockWhere(...a);
              return {
                limit: (...b: unknown[]) => {
                  mockLimit(...b);
                  return mockLimit._returnValue;
                },
              };
            },
            innerJoin: (...a: unknown[]) => {
              mockInnerJoin(...a);
              return {
                where: (...b: unknown[]) => {
                  mockWhere(...b);
                  return {
                    limit: (...c: unknown[]) => {
                      mockLimit(...c);
                      return mockLimit._returnValue;
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    update: () => ({
      set: () => ({
        where: () => ({
          catch: () => {},
        }),
      }),
    }),
  },
}));

vi.mock('../schema/db.js', () => ({
  apiKeys: { id: 'id', keyHash: 'keyHash', userId: 'userId', keyPrefix: 'keyPrefix', lastUsedAt: 'lastUsedAt' },
  users: { id: 'id', email: 'email', plan: 'plan' },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

// Import after mocks
const bcrypt = (await import('bcryptjs')).default;
const { authMiddleware } = await import('../middleware/auth.js');
const { errorResponse } = await import('../lib/errors.js');

function createApp() {
  const app = new Hono();
  app.use('/*', authMiddleware);
  app.get('/test', (c) => c.json({ user: c.get('user') }));
  app.onError((err, c) => {
    const { status, body } = errorResponse(err);
    return c.json(body, status as any);
  });
  return app;
}

describe('Auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DASHBOARD_SERVICE_SECRET;
    // Default: no records found
    (mockLimit as any)._returnValue = Promise.resolve([]);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const app = createApp();
    const res = await app.request('/test');
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header is not Bearer', async () => {
    const app = createApp();
    const res = await app.request('/test', {
      headers: { Authorization: 'Basic abc123' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 when token does not start with df_live_', async () => {
    const app = createApp();
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer invalid_token_here' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 when token prefix not found in database', async () => {
    (mockLimit as any)._returnValue = Promise.resolve([]);
    const app = createApp();
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer df_live_abcdefgh12345678rest' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 when bcrypt compare fails', async () => {
    (mockLimit as any)._returnValue = Promise.resolve([
      { keyId: 'key1', keyHash: 'hash1', userId: 'usr_1', email: 'test@test.com', plan: 'free' },
    ]);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const app = createApp();
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer df_live_abcdefgh12345678rest' },
    });
    expect(res.status).toBe(401);
  });

  it('succeeds when bcrypt compare matches', async () => {
    (mockLimit as any)._returnValue = Promise.resolve([
      { keyId: 'key1', keyHash: 'hash1', userId: 'usr_1', email: 'test@test.com', plan: 'pro' },
    ]);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const app = createApp();
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer df_live_abcdefgh12345678rest' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe('usr_1');
    expect(body.user.email).toBe('test@test.com');
    expect(body.user.plan).toBe('pro');
  });

  describe('Service-to-service auth', () => {
    it('succeeds with valid service secret and user ID', async () => {
      process.env.DASHBOARD_SERVICE_SECRET = 'svc_secret_123';
      (mockLimit as any)._returnValue = Promise.resolve([
        { id: 'usr_svc', email: 'svc@test.com', plan: 'enterprise' },
      ]);

      const app = createApp();
      const res = await app.request('/test', {
        headers: {
          'X-Service-Secret': 'svc_secret_123',
          'X-Service-User-Id': 'usr_svc',
        },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user.id).toBe('usr_svc');
    });

    it('falls through to bearer auth when no X-Service-Secret header', async () => {
      process.env.DASHBOARD_SERVICE_SECRET = 'svc_secret_123';
      // No service header, no bearer => 401
      const app = createApp();
      const res = await app.request('/test');
      expect(res.status).toBe(401);
    });

    it('returns 401 when service secret is wrong', async () => {
      process.env.DASHBOARD_SERVICE_SECRET = 'svc_secret_123';

      const app = createApp();
      const res = await app.request('/test', {
        headers: {
          'X-Service-Secret': 'wrong_secret',
          'X-Service-User-Id': 'usr_svc',
        },
      });
      expect(res.status).toBe(401);
    });

    it('returns 401 when DASHBOARD_SERVICE_SECRET is not set but header is provided', async () => {
      // env var not set => serviceSecret && process.env.DASHBOARD_SERVICE_SECRET is falsy
      // So it falls through to bearer auth path, which will fail with no Authorization header
      const app = createApp();
      const res = await app.request('/test', {
        headers: {
          'X-Service-Secret': 'some_secret',
          'X-Service-User-Id': 'usr_1',
        },
      });
      expect(res.status).toBe(401);
    });
  });
});
