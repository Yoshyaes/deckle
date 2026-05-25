import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock('../lib/db.js', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock('../schema/db.js', () => ({
  users: { id: 'id', clerkId: 'clerkId', email: 'email', plan: 'plan' },
}));

vi.mock('../services/apikeys.js', () => ({
  createApiKey: vi.fn().mockResolvedValue({ key: 'df_live_x', id: 'key_1' }),
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const webhooksRoute = (await import('../routes/webhooks.js')).default;

// Svix secret (base64 of "supersecret-32bytes-padding-1234")
const SECRET = 'whsec_' + Buffer.from('test-secret-bytes-padded-to-32!').toString('base64');

function signSvix(secret: string, id: string, timestamp: string, body: string): string {
  const raw = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const keyBytes = Buffer.from(raw, 'base64');
  const signed = `${id}.${timestamp}.${body}`;
  const sig = crypto.createHmac('sha256', keyBytes).update(signed).digest('base64');
  return `v1,${sig}`;
}

describe('Clerk webhook handler', () => {
  const originalSecret = process.env.CLERK_WEBHOOK_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.CLERK_WEBHOOK_SECRET = SECRET;
    mockSelect.mockReset();
    mockInsert.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CLERK_WEBHOOK_SECRET;
    } else {
      process.env.CLERK_WEBHOOK_SECRET = originalSecret;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('returns 400 when svix headers are missing', async () => {
    const res = await webhooksRoute.request('/clerk', {
      method: 'POST',
      body: '{}',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing Svix headers/);
  });

  it('returns 400 when svix-timestamp is older than 5 minutes (replay)', async () => {
    const id = 'msg_old';
    const timestamp = Math.floor(Date.now() / 1000) - 600; // 10 min old
    const body = JSON.stringify({ type: 'user.created', data: { id: 'u_1' } });
    const signature = signSvix(SECRET, id, String(timestamp), body);

    const res = await webhooksRoute.request('/clerk', {
      method: 'POST',
      body,
      headers: {
        'svix-id': id,
        'svix-timestamp': String(timestamp),
        'svix-signature': signature,
      },
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/timestamp/i);
  });

  it('returns 400 when svix-timestamp is in the future beyond tolerance', async () => {
    const id = 'msg_future';
    const timestamp = Math.floor(Date.now() / 1000) + 600; // 10 min ahead
    const body = JSON.stringify({ type: 'user.created', data: { id: 'u_1' } });
    const signature = signSvix(SECRET, id, String(timestamp), body);

    const res = await webhooksRoute.request('/clerk', {
      method: 'POST',
      body,
      headers: {
        'svix-id': id,
        'svix-timestamp': String(timestamp),
        'svix-signature': signature,
      },
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when svix-timestamp is not parseable', async () => {
    const id = 'msg_nan';
    const timestamp = 'not-a-number';
    const body = JSON.stringify({ type: 'user.created', data: { id: 'u_1' } });

    const res = await webhooksRoute.request('/clerk', {
      method: 'POST',
      body,
      headers: {
        'svix-id': id,
        'svix-timestamp': timestamp,
        'svix-signature': 'v1,whatever',
      },
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 when signature is invalid', async () => {
    const id = 'msg_badsig';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ type: 'user.created', data: { id: 'u_1' } });

    const res = await webhooksRoute.request('/clerk', {
      method: 'POST',
      body,
      headers: {
        'svix-id': id,
        'svix-timestamp': timestamp,
        'svix-signature': 'v1,' + Buffer.from('wrong').toString('base64'),
      },
    });
    expect(res.status).toBe(401);
  });

  it('accepts a fresh, signed user.created event', async () => {
    const id = 'msg_ok';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({
      type: 'user.created',
      data: { id: 'clerk_user_1', email_addresses: [{ email_address: 'a@b.com' }] },
    });
    const signature = signSvix(SECRET, id, timestamp, body);

    // db.select() for existing-user check → none
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    });
    // db.insert(users) → returning new user
    mockInsert.mockReturnValueOnce({
      values: () => ({
        returning: () => Promise.resolve([{ id: 'usr_1', email: 'a@b.com' }]),
      }),
    });

    const res = await webhooksRoute.request('/clerk', {
      method: 'POST',
      body,
      headers: {
        'svix-id': id,
        'svix-timestamp': timestamp,
        'svix-signature': signature,
      },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
  });

  it('idempotently no-ops when user.created arrives for an existing clerkId', async () => {
    const id = 'msg_dup';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({
      type: 'user.created',
      data: { id: 'clerk_user_2', email_addresses: [{ email_address: 'x@y.com' }] },
    });
    const signature = signSvix(SECRET, id, timestamp, body);

    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([{ id: 'usr_existing' }]) }),
      }),
    });

    const res = await webhooksRoute.request('/clerk', {
      method: 'POST',
      body,
      headers: {
        'svix-id': id,
        'svix-timestamp': timestamp,
        'svix-signature': signature,
      },
    });
    expect(res.status).toBe(200);
    // Should NOT call insert since the user already exists
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns 500 in production when CLERK_WEBHOOK_SECRET is missing', async () => {
    delete process.env.CLERK_WEBHOOK_SECRET;
    process.env.NODE_ENV = 'production';

    const res = await webhooksRoute.request('/clerk', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(500);
  });
});
