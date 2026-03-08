import bcrypt from 'bcryptjs';
import { db } from '../lib/db.js';
import { apiKeys } from '../schema/db.js';
import { apiKeyId } from '../lib/id.js';
import { eq, and } from 'drizzle-orm';

/**
 * Create a new API key for a user.
 * Returns the raw key (shown once to the user) and the DB record.
 */
export async function createApiKey(userId: string, name = 'Default') {
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
