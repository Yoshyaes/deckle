import { describe, it, expect, vi, beforeEach } from 'vitest';

const stripeMock = {
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
  subscriptions: { retrieve: vi.fn() },
  webhooks: { constructEvent: vi.fn() },
};

vi.mock('stripe', () => {
  // The Stripe SDK is exposed as a default-exported class — the source uses `new Stripe(...)`.
  function StripeCtor(this: unknown) {
    return stripeMock;
  }
  return { default: StripeCtor };
});

// State the DB mock will reflect
const dbState = {
  existingCustomers: [] as Array<Record<string, unknown>>,
  existingSubs: [] as Array<Record<string, unknown>>,
  customerInserts: [] as Array<Record<string, unknown>>,
  userUpdates: [] as Array<Record<string, unknown>>,
  subInserts: [] as Array<Record<string, unknown>>,
  subUpdates: [] as Array<Record<string, unknown>>,
};

vi.mock('../lib/db.js', () => {
  // The chain that `select().from(...).where(...).limit(N)` produces.
  const selectChain = (rowsRef: () => Array<Record<string, unknown>>) => ({
    from: () => ({
      where: () => {
        const r = rowsRef();
        // Some callsites use .limit, some don't.
        return Object.assign(Promise.resolve(r), {
          limit: () => Promise.resolve(r),
        });
      },
    }),
  });

  // Track which table the latest .select is for. We can't know the table directly
  // (drizzle passes column maps), so we just alternate or check by use-case.
  let selectMode: 'customers' | 'subs' = 'customers';
  return {
    db: {
      select: () => {
        const mode = selectMode;
        return selectChain(() =>
          mode === 'customers' ? dbState.existingCustomers : dbState.existingSubs,
        );
      },
      insert: (table: unknown) => ({
        values: (v: Record<string, unknown>) => {
          // Identify table by which schema object was passed
          const tableStr = String((table as Record<string, unknown>)?.id);
          if (tableStr.includes('stripeCustomer') || dbState.existingCustomers.length === 0) {
            dbState.customerInserts.push(v);
          } else {
            dbState.subInserts.push(v);
          }
          const chain = {
            returning: () => Promise.resolve([{ ...v, id: 'id_1' }]),
            onConflictDoUpdate: (_arg: unknown) => Promise.resolve(),
          };
          return chain;
        },
      }),
      update: () => ({
        set: (v: Record<string, unknown>) => ({
          where: () => {
            dbState.userUpdates.push(v);
            return Promise.resolve();
          },
        }),
      }),
      // Switch select mode for the subs path
      __setSelectMode(mode: 'customers' | 'subs') {
        selectMode = mode;
      },
    },
  };
});

vi.mock('../schema/db.js', () => ({
  users: { id: 'id' },
  stripeCustomers: { id: 'stripeCustomer.id', userId: 'userId', stripeCustomerId: 'stripeCustomerId' },
  stripeSubscriptions: {
    id: 'stripeSubscription.id',
    userId: 'userId',
    stripeSubscriptionId: 'stripeSubscriptionId',
    stripePriceId: 'stripePriceId',
    status: 'status',
    currentPeriodStart: 'currentPeriodStart',
    currentPeriodEnd: 'currentPeriodEnd',
    cancelAtPeriodEnd: 'cancelAtPeriodEnd',
  },
}));

describe('isStripeConfigured', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns false when STRIPE_SECRET_KEY is unset', async () => {
    const originalKey = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    const { isStripeConfigured } = await import('../services/stripe.js');
    expect(isStripeConfigured()).toBe(false);
    if (originalKey) process.env.STRIPE_SECRET_KEY = originalKey;
  });

  it('returns true when STRIPE_SECRET_KEY is set', async () => {
    const original = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    const { isStripeConfigured } = await import('../services/stripe.js');
    expect(isStripeConfigured()).toBe(true);
    if (original === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = original;
  });
});

describe('getOrCreateCustomer', () => {
  beforeEach(() => {
    dbState.existingCustomers = [];
    dbState.customerInserts.length = 0;
    stripeMock.customers.create.mockReset();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  });

  it('returns existing customer id without calling Stripe', async () => {
    dbState.existingCustomers = [{ stripeCustomerId: 'cus_existing', userId: 'usr_1' }];
    const { getOrCreateCustomer } = await import('../services/stripe.js');
    const id = await getOrCreateCustomer('usr_1', 'a@b.com');
    expect(id).toBe('cus_existing');
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
  });

  it('creates Stripe customer and persists when none exists', async () => {
    dbState.existingCustomers = [];
    stripeMock.customers.create.mockResolvedValue({ id: 'cus_new' });
    const { getOrCreateCustomer } = await import('../services/stripe.js');
    const id = await getOrCreateCustomer('usr_new', 'new@b.com');
    expect(id).toBe('cus_new');
    expect(stripeMock.customers.create).toHaveBeenCalledWith({
      email: 'new@b.com',
      metadata: { userId: 'usr_new' },
    });
    expect(dbState.customerInserts.length).toBeGreaterThan(0);
    expect(dbState.customerInserts[0]).toMatchObject({
      userId: 'usr_new',
      stripeCustomerId: 'cus_new',
    });
  });
});

describe('constructWebhookEvent', () => {
  beforeEach(() => {
    stripeMock.webhooks.constructEvent.mockReset();
  });

  it('throws when STRIPE_WEBHOOK_SECRET is unset', async () => {
    vi.resetModules();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    const { constructWebhookEvent } = await import('../services/stripe.js');
    expect(() => constructWebhookEvent('payload', 'sig')).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });

  it('delegates to Stripe.webhooks.constructEvent when secret is set', async () => {
    vi.resetModules();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    stripeMock.webhooks.constructEvent.mockReturnValue({ type: 'checkout.session.completed' });
    const { constructWebhookEvent } = await import('../services/stripe.js');
    const evt = constructWebhookEvent('payload', 'sig');
    expect(evt).toEqual({ type: 'checkout.session.completed' });
    expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith('payload', 'sig', 'whsec_test');
  });
});

describe('handleWebhookEvent dispatch (smoke)', () => {
  beforeEach(() => {
    dbState.existingSubs = [];
    dbState.userUpdates.length = 0;
    dbState.subInserts.length = 0;
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  });

  it('checkout.session.completed without metadata is a no-op', async () => {
    const { handleWebhookEvent } = await import('../services/stripe.js');
    await handleWebhookEvent({
      type: 'checkout.session.completed',
      data: { object: { metadata: {} } },
    } as any);
    // No update should have been recorded
    expect(dbState.userUpdates.find((u) => 'plan' in u)).toBeUndefined();
  });

  it('checkout.session.completed updates user plan when metadata is present', async () => {
    const { handleWebhookEvent } = await import('../services/stripe.js');
    await handleWebhookEvent({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { userId: 'usr_42', plan: 'pro' },
          subscription: null,
        },
      },
    } as any);
    expect(dbState.userUpdates.some((u) => u.plan === 'pro')).toBe(true);
  });

  it('ignores unknown event types silently', async () => {
    const { handleWebhookEvent } = await import('../services/stripe.js');
    await expect(
      handleWebhookEvent({ type: 'made.up.event', data: { object: {} } } as any),
    ).resolves.toBeUndefined();
  });
});
