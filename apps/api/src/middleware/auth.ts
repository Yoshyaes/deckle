import { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import bcrypt from 'bcryptjs';
import { db } from '../lib/db.js';
import { apiKeys, users } from '../schema/db.js';
import { eq } from 'drizzle-orm';
import { AuthError } from '../lib/errors.js';

export type AuthUser = {
  id: string;
  email: string;
  plan: string;
};

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header');
  }

  const token = authHeader.slice(7);
  if (!token || !token.startsWith('df_live_')) {
    throw new AuthError();
  }

  // Look up key by prefix (first 16 chars) to narrow search, then verify hash
  const prefix = token.slice(0, 16);

  const keyRecords = await db
    .select({
      keyId: apiKeys.id,
      keyHash: apiKeys.keyHash,
      userId: apiKeys.userId,
      email: users.email,
      plan: users.plan,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(eq(apiKeys.keyPrefix, prefix))
    .limit(5);

  for (const record of keyRecords) {
    const isValid = await bcrypt.compare(token, record.keyHash);
    if (isValid) {
      // Update last_used_at (fire and forget)
      db.update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, record.keyId))
        .catch((err: Error) => console.error('Failed to update lastUsedAt:', err.message));

      c.set('user', {
        id: record.userId,
        email: record.email,
        plan: record.plan,
      });

      return next();
    }
  }

  throw new AuthError();
});
