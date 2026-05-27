/**
 * Stripe webhook integration tests.
 *
 * The unit tests in `stripe-dedup.test.ts` mock Redis and exercise pure
 * functions. These ones spin up a real Postgres (deckle_test) and
 * call `handleWebhookEvent` end-to-end so the transactions, FK
 * cascades, and ON CONFLICT clauses are actually exercised.
 *
 * The tests SKIP cleanly if no local Postgres is reachable. CI is
 * expected to provide one via TEST_DATABASE_URL or the docker-compose
 * stack. See helpers/test-db.ts for the connection rules.
 *
 * Outbound Stripe API calls (subscriptions.retrieve) are stubbed via
 * vi.mock so the test never hits real Stripe — the goal is to verify
 * our handler's behavior against synthetic events.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';

import {
  setupTestDatabase,
  isTestDbReachable,
  type TestDatabase,
} from './helpers/test-db.js';

// Set env vars BEFORE importing the stripe service, since PRICE_PLAN_MAP
// is built at module-load time. Same dance as stripe-dedup.test.ts.
process.env.STRIPE_STARTER_PRICE_ID = 'price_starter_int';
process.env.STRIPE_PRO_PRICE_ID = 'price_pro_int';
process.env.STRIPE_SECRET_KEY = 'sk_test_int';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_int';

// Stub Redis to always say "first time seeing this event" so the dedup
// guard never blocks our tests. Specific tests that want to simulate a
// duplicate retry override this per-test.
const redisSetMock = vi.fn().mockResolvedValue('OK');
vi.mock('../lib/redis.js', () => ({
  redis: { set: redisSetMock },
}));

// Stub Stripe SDK so checkout.session.completed's subscriptions.retrieve
// returns a deterministic value without a network round trip.
const subscriptionsRetrieveMock = vi.fn<(id: string) => Promise<Stripe.Subscription>>();
vi.mock('stripe', () => {
  return {
    default: class FakeStripe {
      subscriptions = { retrieve: subscriptionsRetrieveMock };
      webhooks = {
        constructEvent: () => {
          throw new Error('not used in these tests');
        },
      };
      customers = { create: vi.fn() };
      checkout = { sessions: { create: vi.fn() } };
      billingPortal = { sessions: { create: vi.fn() } };
    },
  };
});

const reachablePromise = isTestDbReachable();
const reachable = await reachablePromise;

let testDb: TestDatabase | null = null;

// Import the stripe service AFTER mocks + env are set. The service
// captures `db` from `../lib/db.js` at module load — we redirect that
// module to use the test pool further down.
let users: typeof import('../schema/db.js').users;
let stripeCustomers: typeof import('../schema/db.js').stripeCustomers;
let stripeSubscriptions: typeof import('../schema/db.js').stripeSubscriptions;
let handleWebhookEvent: typeof import('../services/stripe.js').handleWebhookEvent;

beforeAll(async () => {
  if (!reachable) return;
  testDb = await setupTestDatabase('stripe');

  // Redirect the production db.ts singleton to the test pool. Done by
  // vi.mock with a factory that returns the test pool/handle.
  vi.doMock('../lib/db.js', () => ({
    pool: testDb!.pool,
    db: testDb!.db,
  }));

  // Now safe to import the schema + service.
  const dbSchema = await import('../schema/db.js');
  users = dbSchema.users;
  stripeCustomers = dbSchema.stripeCustomers;
  stripeSubscriptions = dbSchema.stripeSubscriptions;

  const stripeService = await import('../services/stripe.js');
  handleWebhookEvent = stripeService.handleWebhookEvent;
}, 60_000);

beforeEach(async () => {
  if (!testDb) return;
  await testDb.reset();
  redisSetMock.mockClear();
  redisSetMock.mockResolvedValue('OK');
  subscriptionsRetrieveMock.mockReset();
});

afterAll(async () => {
  if (testDb) await testDb.close();
});

// ---------- Synthetic-event builders ----------

function makeCheckoutEvent(opts: {
  eventId?: string;
  userId: string;
  sessionSubId?: string;
  metadataPlan?: string;
}): Stripe.Event {
  return {
    id: opts.eventId ?? 'evt_checkout_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        subscription: opts.sessionSubId ?? 'sub_test_1',
        metadata: {
          userId: opts.userId,
          ...(opts.metadataPlan ? { plan: opts.metadataPlan } : {}),
        },
      },
    },
  } as unknown as Stripe.Event;
}

function makeSubscriptionUpdateEvent(opts: {
  eventId?: string;
  subscriptionId: string;
  priceId: string;
  status: Stripe.Subscription.Status;
}): Stripe.Event {
  return {
    id: opts.eventId ?? 'evt_sub_upd_1',
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: opts.subscriptionId,
        status: opts.status,
        items: { data: [{ price: { id: opts.priceId } }] },
        current_period_start: 1_700_000_000,
        current_period_end: 1_702_000_000,
        cancel_at_period_end: false,
      },
    },
  } as unknown as Stripe.Event;
}

function makeSubscriptionDeleteEvent(subscriptionId: string): Stripe.Event {
  return {
    id: 'evt_sub_del_1',
    type: 'customer.subscription.deleted',
    data: { object: { id: subscriptionId } },
  } as unknown as Stripe.Event;
}

function makeInvoicePaymentFailedEvent(subscriptionId: string): Stripe.Event {
  return {
    id: 'evt_inv_fail_1',
    type: 'invoice.payment_failed',
    data: { object: { subscription: subscriptionId } },
  } as unknown as Stripe.Event;
}

function makeStripeSubscription(opts: {
  id: string;
  priceId: string;
  status?: Stripe.Subscription.Status;
}): Stripe.Subscription {
  return {
    id: opts.id,
    status: opts.status ?? 'active',
    items: { data: [{ price: { id: opts.priceId } }] },
    current_period_start: 1_700_000_000,
    current_period_end: 1_702_000_000,
    cancel_at_period_end: false,
  } as unknown as Stripe.Subscription;
}

async function seedUser(userId: string, email = 'tester@example.com'): Promise<void> {
  await testDb!.pool.query(
    `INSERT INTO users (id, email, plan) VALUES ($1, $2, 'free')`,
    [userId, email],
  );
}

// ---------- Tests ----------

describe.skipIf(!reachable)(
  'Stripe webhook integration (requires local Postgres)',
  () => {
    it('checkout.session.completed: upgrades plan AND inserts subscription atomically', async () => {
      const userId = '00000000-0000-0000-0000-000000000001';
      await seedUser(userId);
      subscriptionsRetrieveMock.mockResolvedValueOnce(
        makeStripeSubscription({ id: 'sub_test_1', priceId: 'price_pro_int' }),
      );

      await handleWebhookEvent(
        makeCheckoutEvent({ userId, sessionSubId: 'sub_test_1' }),
      );

      const [user] = await testDb!.db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      expect(user?.plan).toBe('pro');

      const [sub] = await testDb!.db
        .select()
        .from(stripeSubscriptions)
        .where(eq(stripeSubscriptions.stripeSubscriptionId, 'sub_test_1'));
      expect(sub).toBeDefined();
      expect(sub!.status).toBe('active');
      expect(sub!.stripePriceId).toBe('price_pro_int');
      expect(sub!.userId).toBe(userId);
    });

    it('checkout.session.completed: ignores attacker-tampered metadata.plan, uses price-id', async () => {
      // The audit's P0: never trust session.metadata.plan; resolve plan
      // from the actual price on the subscription instead. This is the
      // regression test for that.
      const userId = '00000000-0000-0000-0000-000000000002';
      await seedUser(userId);
      subscriptionsRetrieveMock.mockResolvedValueOnce(
        makeStripeSubscription({ id: 'sub_attack_1', priceId: 'price_starter_int' }),
      );

      await handleWebhookEvent(
        makeCheckoutEvent({
          userId,
          sessionSubId: 'sub_attack_1',
          metadataPlan: 'pro', // attacker claim
        }),
      );

      const [user] = await testDb!.db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      // Resolved from price_starter_int, NOT the metadata claim.
      expect(user?.plan).toBe('starter');
    });

    it('checkout.session.completed: skips when price-id is not in our plan map', async () => {
      const userId = '00000000-0000-0000-0000-000000000003';
      await seedUser(userId);
      subscriptionsRetrieveMock.mockResolvedValueOnce(
        makeStripeSubscription({
          id: 'sub_unknown_1',
          priceId: 'price_made_up_by_attacker',
        }),
      );

      await handleWebhookEvent(makeCheckoutEvent({ userId, sessionSubId: 'sub_unknown_1' }));

      const [user] = await testDb!.db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      expect(user?.plan).toBe('free'); // unchanged

      const subs = await testDb!.db.select().from(stripeSubscriptions);
      expect(subs).toHaveLength(0); // nothing inserted
    });

    it('checkout.session.completed: idempotent — duplicate event.id is dropped', async () => {
      const userId = '00000000-0000-0000-0000-000000000004';
      await seedUser(userId);
      subscriptionsRetrieveMock.mockResolvedValue(
        makeStripeSubscription({ id: 'sub_idem_1', priceId: 'price_pro_int' }),
      );

      // First delivery: SET NX returns 'OK' (event is new).
      await handleWebhookEvent(
        makeCheckoutEvent({ eventId: 'evt_idem_1', userId, sessionSubId: 'sub_idem_1' }),
      );
      // Retry: SET NX returns null (already seen).
      redisSetMock.mockResolvedValueOnce(null);
      await handleWebhookEvent(
        makeCheckoutEvent({ eventId: 'evt_idem_1', userId, sessionSubId: 'sub_idem_1' }),
      );

      const subs = await testDb!.db
        .select()
        .from(stripeSubscriptions)
        .where(eq(stripeSubscriptions.stripeSubscriptionId, 'sub_idem_1'));
      // Exactly one row — onConflictDoUpdate would have updated, but the
      // dedup short-circuits before any work happens at all.
      expect(subs).toHaveLength(1);
      // And stripe.subscriptions.retrieve was only called once.
      expect(subscriptionsRetrieveMock).toHaveBeenCalledTimes(1);
    });

    it('customer.subscription.updated: reflects price change in both subscription and user plan', async () => {
      const userId = '00000000-0000-0000-0000-000000000005';
      await seedUser(userId);
      // Seed a starter subscription.
      await testDb!.pool.query(
        `INSERT INTO stripe_subscriptions (
           user_id, stripe_subscription_id, stripe_price_id, status,
           current_period_start, current_period_end, cancel_at_period_end
         ) VALUES ($1, $2, $3, 'active', NOW(), NOW() + interval '30 days', false)`,
        [userId, 'sub_upgrade_1', 'price_starter_int'],
      );
      await testDb!.pool.query(`UPDATE users SET plan='starter' WHERE id=$1`, [userId]);

      await handleWebhookEvent(
        makeSubscriptionUpdateEvent({
          subscriptionId: 'sub_upgrade_1',
          priceId: 'price_pro_int',
          status: 'active',
        }),
      );

      const [user] = await testDb!.db.select().from(users).where(eq(users.id, userId));
      expect(user?.plan).toBe('pro');

      const [sub] = await testDb!.db
        .select()
        .from(stripeSubscriptions)
        .where(eq(stripeSubscriptions.stripeSubscriptionId, 'sub_upgrade_1'));
      expect(sub?.stripePriceId).toBe('price_pro_int');
    });

    it('customer.subscription.deleted: marks subscription canceled and drops user back to free', async () => {
      const userId = '00000000-0000-0000-0000-000000000006';
      await seedUser(userId);
      await testDb!.pool.query(
        `INSERT INTO stripe_subscriptions (
           user_id, stripe_subscription_id, stripe_price_id, status,
           current_period_start, current_period_end, cancel_at_period_end
         ) VALUES ($1, $2, $3, 'active', NOW(), NOW() + interval '30 days', false)`,
        [userId, 'sub_del_1', 'price_pro_int'],
      );
      await testDb!.pool.query(`UPDATE users SET plan='pro' WHERE id=$1`, [userId]);

      await handleWebhookEvent(makeSubscriptionDeleteEvent('sub_del_1'));

      const [user] = await testDb!.db.select().from(users).where(eq(users.id, userId));
      expect(user?.plan).toBe('free');

      const [sub] = await testDb!.db
        .select()
        .from(stripeSubscriptions)
        .where(eq(stripeSubscriptions.stripeSubscriptionId, 'sub_del_1'));
      expect(sub?.status).toBe('canceled');
    });

    it('invoice.payment_failed: flips status to past_due (and leaves the plan alone)', async () => {
      const userId = '00000000-0000-0000-0000-000000000007';
      await seedUser(userId);
      await testDb!.pool.query(
        `INSERT INTO stripe_subscriptions (
           user_id, stripe_subscription_id, stripe_price_id, status,
           current_period_start, current_period_end, cancel_at_period_end
         ) VALUES ($1, $2, $3, 'active', NOW(), NOW() + interval '30 days', false)`,
        [userId, 'sub_failed_1', 'price_pro_int'],
      );
      await testDb!.pool.query(`UPDATE users SET plan='pro' WHERE id=$1`, [userId]);

      await handleWebhookEvent(makeInvoicePaymentFailedEvent('sub_failed_1'));

      const [user] = await testDb!.db.select().from(users).where(eq(users.id, userId));
      // Plan is preserved — past_due gives the customer time to fix billing
      // before we degrade their access. That's policy, not a bug.
      expect(user?.plan).toBe('pro');

      const [sub] = await testDb!.db
        .select()
        .from(stripeSubscriptions)
        .where(eq(stripeSubscriptions.stripeSubscriptionId, 'sub_failed_1'));
      expect(sub?.status).toBe('past_due');
    });

    it('subscription.updated: onConflict logic upserts cleanly on re-delivery', async () => {
      // Stripe will re-fire customer.subscription.updated when minor
      // fields change (e.g., default_payment_method). The handler should
      // tolerate seeing the same subscription_id repeatedly.
      const userId = '00000000-0000-0000-0000-000000000008';
      await seedUser(userId);
      await testDb!.pool.query(
        `INSERT INTO stripe_subscriptions (
           user_id, stripe_subscription_id, stripe_price_id, status,
           current_period_start, current_period_end, cancel_at_period_end
         ) VALUES ($1, $2, $3, 'active', NOW(), NOW() + interval '30 days', false)`,
        [userId, 'sub_resend_1', 'price_pro_int'],
      );

      // Two distinct events, both with status=active. (Each must have a
      // fresh event.id or the dedup blocks the second.)
      await handleWebhookEvent(
        makeSubscriptionUpdateEvent({
          eventId: 'evt_resend_a',
          subscriptionId: 'sub_resend_1',
          priceId: 'price_pro_int',
          status: 'active',
        }),
      );
      await handleWebhookEvent(
        makeSubscriptionUpdateEvent({
          eventId: 'evt_resend_b',
          subscriptionId: 'sub_resend_1',
          priceId: 'price_pro_int',
          status: 'active',
        }),
      );

      const rows = await testDb!.db
        .select()
        .from(stripeSubscriptions)
        .where(eq(stripeSubscriptions.stripeSubscriptionId, 'sub_resend_1'));
      expect(rows).toHaveLength(1);
    });
  },
);
