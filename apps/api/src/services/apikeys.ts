import bcrypt from 'bcryptjs';
import { db } from '../lib/db.js';
import { apiKeys } from '../schema/db.js';
import { apiKeyId } from '../lib/id.js';
import { eq, and, count } from 'drizzle-orm';
import { AppError } from '../lib/errors.js';

/** Maximum number of API keys a single user may hold. */
const MAX_KEYS_PER_USER = 20;

/**
 * Create a new API key for a user.
 * Enforces a per-user cap to prevent bcrypt DoS via unbounded prefix collisions.
 * Returns the raw key (shown once to the user) and the DB record.
 */
export async function createApiKey(userId: string, name = 'Default') {
  // Enforce per-user key count limit
  const [{ value: keyCount }] = await db
    .select({ value: count() })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));

  if (keyCount >= MAX_KEYS_PER_USER) {
    throw new AppError(
      422,
      'KEY_LIMIT_REACHED',
      `You can have at most ${MAX_KEYS_PER_USER} API keys. Delete an existing key before creating a new one.`,
    );
  }
  const rawKey = apiKeyId();
  const keyHash = await bcrypt.hash(rawKey, 10);
  const keyPrefix = rawKey.slice(0, 16);

  const [record] = await db
    .insert(apiKeys)
    .values({
      userId,
      keyHash,
      keyPrefix,
      name,
    })
    .returning();

  return {
    key: rawKey,
    id: record.id,
    name: record.name,
    prefix: `${keyPrefix}...${rawKey.slice(-4)}`,
    created_at: record.createdAt,
  };
}

/**
 * List API keys for a user (never returns hashes).
 */
export async function listApiKeys(userId: string) {
  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));

  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: `${k.keyPrefix}...`,
    last_used_at: k.lastUsedAt,
    created_at: k.createdAt,
  }));
}

/**
 * Revoke (delete) an API key.
 */
export async function revokeApiKey(userId: string, keyId: string) {
  const result = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
    .returning();

  return result.length > 0;
}
