import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const stripeMocks = {
  isStripeConfigured: vi.fn(),
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  getSubscription: vi.fn(),
  constructWebhookEvent: vi.fn(),
  handleWebhookEvent: vi.fn(),
};

vi.mock('../services/stripe.js', () => stripeMocks);

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

const { default: billingRoute, billingWebhookApp } = await import('../routes/billing.js');
const { errorResponse } = await import('../lib/errors.js');

function createApp() {
  const app = new Hono();
  app.use('/*', async (c, next) => {
    c.set('user', { id: 'usr_1', email: 'a@b.com', plan: 'free' });
    await next();
  });
  app.route('/billing', billingRoute);
  app.route('/webhook', billingWebhookApp);
  app.onError((err, c) => {
    const { status, body } = errorResponse(err);
    return c.json(body, status as any);
  });
  return app;
}

describe('POST /billing/checkout', () => {
  beforeEach(() => {
    Object.values(stripeMocks).forEach((m) => m.mockReset());
  });

  it('returns 503 when Stripe is not configured', async () => {
    stripeMocks.isStripeConfigured.mockReturnValue(false);
    const res = await createApp().request('/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'pro' }),
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_CONFIGURED');
  });

  it('returns 400 for missing plan', async () => {
    stripeMocks.isStripeConfigured.mockReturnValue(true);
    const res = await createApp().request('/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid plan value', async () => {
    stripeMocks.isStripeConfigured.mockReturnValue(true);
    const res = await createApp().request('/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'enterprise' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns checkout URL for valid plan', async () => {
    stripeMocks.isStripeConfigured.mockReturnValue(true);
    stripeMocks.createCheckoutSession.mockResolvedValue('https://checkout.stripe.com/abc');
    const res = await createApp().request('/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: 'starter' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://checkout.stripe.com/abc');
    expect(stripeMocks.createCheckoutSession).toHaveBeenCalledWith(
      'usr_1',
      'a@b.com',
      'starter',
    );
  });
});

describe('POST /billing/portal', () => {
  beforeEach(() => {
    Object.values(stripeMocks).forEach((m) => m.mockReset());
  });

  it('returns 503 when Stripe is not configured', async () => {
    stripeMocks.isStripeConfigured.mockReturnValue(false);
    const res = await createApp().request('/billing/portal', { method: 'POST' });
    expect(res.status).toBe(503);
  });

  it('returns portal URL for authenticated user', async () => {
    stripeMocks.isStripeConfigured.mockReturnValue(true);
    stripeMocks.createPortalSession.mockResolvedValue('https://billing.stripe.com/portal/x');
    const res = await createApp().request('/billing/portal', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://billing.stripe.com/portal/x');
  });
});

describe('GET /billing/subscription', () => {
  beforeEach(() => {
    Object.values(stripeMocks).forEach((m) => m.mockReset());
  });

  it('returns { subscription: null, plan } when no subscription exists', async () => {
    stripeMocks.getSubscription.mockResolvedValue(null);
    const res = await createApp().request('/billing/subscription');
    const body = await res.json();
    expect(body.subscription).toBeNull();
    expect(body.plan).toBe('free');
  });

  it('returns formatted subscription when one exists', async () => {
    stripeMocks.getSubscription.mockResolvedValue({
      stripeSubscriptionId: 'sub_1',
      status: 'active',
      currentPeriodStart: new Date('2026-04-01'),
      currentPeriodEnd: new Date('2026-05-01'),
      cancelAtPeriodEnd: false,
    });
    const res = await createApp().request('/billing/subscription');
    const body = await res.json();
    expect(body.subscription.id).toBe('sub_1');
    expect(body.subscription.status).toBe('active');
    expect(body.subscription.cancel_at_period_end).toBe(false);
  });
});

describe('POST /webhook (Stripe)', () => {
  beforeEach(() => {
    Object.values(stripeMocks).forEach((m) => m.mockReset());
  });

  it('returns 503 when Stripe is not configured', async () => {
    stripeMocks.isStripeConfigured.mockReturnValue(false);
    const res = await createApp().request('/webhook', { method: 'POST' });
    expect(res.status).toBe(503);
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    stripeMocks.isStripeConfigured.mockReturnValue(true);
    const res = await createApp().request('/webhook', {
      method: 'POST',
      body: '{}',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when signature verification fails', async () => {
    stripeMocks.isStripeConfigured.mockReturnValue(true);
    stripeMocks.constructWebhookEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });
    const res = await createApp().request('/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=bad' },
      body: '{}',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe('Invalid signature');
  });

  it('returns 200 { received: true } when handler succeeds', async () => {
    stripeMocks.isStripeConfigured.mockReturnValue(true);
    stripeMocks.constructWebhookEvent.mockReturnValue({ type: 'checkout.session.completed' });
    stripeMocks.handleWebhookEvent.mockResolvedValue(undefined);
    const res = await createApp().request('/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=good' },
      body: '{}',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });

  it('returns 500 when the handler throws', async () => {
    stripeMocks.isStripeConfigured.mockReturnValue(true);
    stripeMocks.constructWebhookEvent.mockReturnValue({ type: 'whatever' });
    stripeMocks.handleWebhookEvent.mockRejectedValue(new Error('db down'));
    const res = await createApp().request('/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=good' },
      body: '{}',
    });
    expect(res.status).toBe(500);
  });
});
