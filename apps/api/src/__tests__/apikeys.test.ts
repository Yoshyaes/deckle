import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (raw: string) => `hash(${raw})`),
  },
}));

// Mock id generator to make assertions deterministic.
vi.mock('../lib/id.js', () => ({
  apiKeyId: vi.fn(() => 'df_live_abcdefghijklmnoplastfour'),
}));

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

vi.mock('../lib/db.js', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock('../schema/db.js', () => ({
  apiKeys: { id: 'id', userId: 'userId', keyHash: 'keyHash', keyPrefix: 'keyPrefix', name: 'name', createdAt: 'createdAt', lastUsedAt: 'lastUsedAt' },
}));

const { createApiKey, listApiKeys, revokeApiKey } = await import('../services/apikeys.js');
const { AppError } = await import('../lib/errors.js');

describe('createApiKey', () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockInsert.mockReset();
    mockDelete.mockReset();
  });

  function arrangeCountAndInsert(currentKeyCount: number) {
    // First db call: SELECT count(*) FROM apiKeys WHERE userId = X
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([{ value: currentKeyCount }]),
      }),
    });
    // Second db call: INSERT ... RETURNING
    mockInsert.mockReturnValueOnce({
      values: () => ({
        returning: () =>
          Promise.resolve([
            {
              id: 'key_1',
              name: 'Default',
              createdAt: new Date('2026-01-01T00:00:00Z'),
            },
          ]),
      }),
    });
  }

  it('creates a key when user is under the 20-key cap', async () => {
    arrangeCountAndInsert(0);

    const result = await createApiKey('usr_1');
    expect(result.key).toMatch(/^df_live_/);
    expect(result.id).toBe('key_1');
    expect(result.name).toBe('Default');
    // Prefix is first-16 + last-4 of the raw key
    expect(result.prefix).toMatch(/^df_live_.{8}\.\.\.[a-zA-Z0-9]{4}$/);
  });

  it('passes the supplied name through to the DB layer', async () => {
    arrangeCountAndInsert(5);

    // Capture the values() arg to assert the name field is forwarded.
    const captured: { values?: Record<string, unknown> } = {};
    mockInsert.mockReset();
    mockInsert.mockReturnValueOnce({
      values: (v: Record<string, unknown>) => {
        captured.values = v;
        return {
          returning: () =>
            Promise.resolve([
              { id: 'key_2', name: 'Production', createdAt: new Date() },
            ]),
        };
      },
    });

    await createApiKey('usr_1', 'Production');
    expect(captured.values?.name).toBe('Production');
    expect(captured.values?.userId).toBe('usr_1');
  });

  it('rejects when user has reached MAX_KEYS_PER_USER (20)', async () => {
    arrangeCountAndInsert(20);

    let caught: unknown;
    try {
      await createApiKey('usr_1');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect(caught).toMatchObject({
      code: 'KEY_LIMIT_REACHED',
      statusCode: 422,
    });
  });

  it('rejects when user is over MAX_KEYS_PER_USER (defence in depth)', async () => {
    arrangeCountAndInsert(25);

    await expect(createApiKey('usr_1')).rejects.toThrow(AppError);
  });

  it('does not call insert when the cap is reached', async () => {
    arrangeCountAndInsert(20);
    await expect(createApiKey('usr_1')).rejects.toThrow();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('hashes the raw key with bcrypt before storing', async () => {
    arrangeCountAndInsert(0);
    const captured: { values?: Record<string, unknown> } = {};
    mockInsert.mockReset();
    mockInsert.mockReturnValueOnce({
      values: (v: Record<string, unknown>) => {
        captured.values = v;
        return {
          returning: () =>
            Promise.resolve([
              { id: 'key_3', name: 'Default', createdAt: new Date() },
            ]),
        };
      },
    });

    const result = await createApiKey('usr_1');
    // hash() should NOT equal the raw key
    expect(captured.values?.keyHash).not.toBe(result.key);
    expect(captured.values?.keyHash).toBe(`hash(${result.key})`);
  });

  it('stores only the prefix (first 16 chars) in keyPrefix', async () => {
    arrangeCountAndInsert(0);
    const captured: { values?: Record<string, unknown> } = {};
    mockInsert.mockReset();
    mockInsert.mockReturnValueOnce({
      values: (v: Record<string, unknown>) => {
        captured.values = v;
        return {
          returning: () =>
            Promise.resolve([
              { id: 'key_4', name: 'Default', createdAt: new Date() },
            ]),
        };
      },
    });

    const result = await createApiKey('usr_1');
    expect(captured.values?.keyPrefix).toBe(result.key.slice(0, 16));
    expect((captured.values?.keyPrefix as string).length).toBe(16);
  });
});

describe('listApiKeys', () => {
  beforeEach(() => {
    mockSelect.mockReset();
  });

  it('returns the user-visible shape (no hashes)', async () => {
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () =>
          Promise.resolve([
            {
              id: 'key_1',
              name: 'Default',
              keyPrefix: 'df_live_abcdefgh',
              lastUsedAt: null,
              createdAt: new Date('2026-01-01T00:00:00Z'),
            },
          ]),
      }),
    });

    const result = await listApiKeys('usr_1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'key_1',
      name: 'Default',
      prefix: 'df_live_abcdefgh...',
    });
    expect(result[0]).not.toHaveProperty('keyHash');
  });

  it('returns empty array when user has no keys', async () => {
    mockSelect.mockReturnValueOnce({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    });

    expect(await listApiKeys('usr_0')).toEqual([]);
  });
});

describe('revokeApiKey', () => {
  beforeEach(() => {
    mockDelete.mockReset();
  });

  it('returns true when a key is deleted', async () => {
    mockDelete.mockReturnValueOnce({
      where: () => ({
        returning: () => Promise.resolve([{ id: 'key_1' }]),
      }),
    });

    expect(await revokeApiKey('usr_1', 'key_1')).toBe(true);
  });

  it('returns false when no matching key exists for the user', async () => {
    mockDelete.mockReturnValueOnce({
      where: () => ({
        returning: () => Promise.resolve([]),
      }),
    });

    expect(await revokeApiKey('usr_1', 'key_missing')).toBe(false);
  });
});
