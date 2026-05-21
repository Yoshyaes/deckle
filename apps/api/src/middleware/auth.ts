import { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import { db } from '../lib/db.js';
import { apiKeys, users } from '../schema/db.js';
import { eq } from 'drizzle-orm';
import { AuthError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

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

/**
 * Constant-time comparison of two strings. Returns false (without
 * leaking length) if either side is empty or the lengths differ.
 */
function safeEqual(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const authMiddleware = createMiddleware(async (c, next) => {
  // Service-to-service auth from dashboard playground. Constant-time
  // compare on the secret; a non-empty secret is required (an empty
  // env var must NOT match an empty header).
  const serviceSecret = c.req.header('X-Service-Secret');
  const expectedSecret = process.env.DASHBOARD_SERVICE_SECRET;
  if (serviceSecret && expectedSecret && expectedSecret.length >= 16) {
    if (safeEqual(serviceSecret, expectedSecret)) {
      const serviceUserId = c.req.header('X-Service-User-Id');
      if (serviceUserId) {
        const [user] = await db
          .select({ id: users.id, email: users.email, plan: users.plan })
          .from(users)
          .where(eq(users.id, serviceUserId))
          .limit(1);
        if (user) {
          c.set('user', user);
          return next();
        }
      }
    }
    throw new AuthError();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError(
      "Missing or invalid Authorization header. Add: Authorization: Bearer dk_live_… (must start with dk_live_ or df_live_).",
    );
  }

  const token = authHeader.slice(7);
  // Accept both prefixes during the DocuForge → Deckle transition.
  // Why: existing df_live_ keys (stored in the DB) must keep working after
  // the rebrand. New keys get dk_live_. Plan to drop df_live_ acceptance
  // after a 30+ day transition window.
  if (!token || (!token.startsWith('dk_live_') && !token.startsWith('df_live_'))) {
    throw new AuthError(
      "API key has the wrong format. It should start with dk_live_ (32+ chars). Find or create one at https://app.getdeckle.dev/keys.",
    );
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
        .catch((err: Error) => logger.error({ err: err.message }, 'Failed to update lastUsedAt'));

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
