import { Hono } from 'hono';
import crypto from 'crypto';
import { db } from '../lib/db.js';
import { users } from '../schema/db.js';
import { eq } from 'drizzle-orm';
import { createApiKey } from '../services/apikeys.js';

const app = new Hono();

/**
 * Clerk webhook handler.
 * Receives user.created, user.updated, user.deleted events.
 * Clerk signs webhooks with Svix — we verify the signature.
 */
app.post('/clerk', async (c) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  // In development without webhook secret, still process events
  if (webhookSecret) {
    const svixId = c.req.header('svix-id');
    const svixTimestamp = c.req.header('svix-timestamp');
    const svixSignature = c.req.header('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return c.json({ error: 'Missing Svix headers' }, 400);
    }

    const body = await c.req.text();

    // Verify signature
    const signedContent = `${svixId}.${svixTimestamp}.${body}`;
    const secret = webhookSecret.startsWith('whsec_')
      ? webhookSecret.slice(6)
      : webhookSecret;
    const secretBytes = Buffer.from(secret, 'base64');
    const signature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');

    const expectedSigs = svixSignature.split(' ').map((s) => s.split(',')[1]);
    const isValid = expectedSigs.some((s) => {
      if (!s) return false;
      const sigBuf = Buffer.from(s);
      const expectedBuf = Buffer.from(signature);
      if (sigBuf.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    });

    if (!isValid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    const event = JSON.parse(body);
    return handleClerkEvent(c, event);
  }

  // No secret configured — only allow in development
  if (process.env.NODE_ENV === 'production') {
    return c.json({ error: 'CLERK_WEBHOOK_SECRET is required in production' }, 500);
  }
  const event = await c.req.json();
  return handleClerkEvent(c, event);
});

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: { email_address: string }[];
  };
}

async function handleClerkEvent(c: { json: (body: unknown, status?: number) => Response }, event: ClerkWebhookEvent) {
  const { type, data } = event;

  switch (type) {
    case 'user.created': {
      const email =
        data.email_addresses?.[0]?.email_address || `${data.id}@clerk.user`;

      // Check if user already exists (idempotent)
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, data.id))
        .limit(1);

      if (existing.length > 0) {
        return c.json({ received: true });
      }

      // Create user
      const [user] = await db
        .insert(users)
        .values({
          email,
          clerkId: data.id,
          plan: 'free',
        })
        .returning();

      // Auto-create first API key
      await createApiKey(user.id, 'Default');

      console.log(`New user created: ${user.id} (${email})`);
      return c.json({ received: true });
    }

    case 'user.updated': {
      const email =
        data.email_addresses?.[0]?.email_address;

      if (email) {
        await db
          .update(users)
          .set({ email })
          .where(eq(users.clerkId, data.id));
      }

      return c.json({ received: true });
    }

    case 'user.deleted': {
      // Cascade delete handles api_keys, templates, generations
      await db.delete(users).where(eq(users.clerkId, data.id));
      return c.json({ received: true });
    }

    default:
      return c.json({ received: true });
  }
}

export default app;
