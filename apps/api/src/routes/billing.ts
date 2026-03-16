import { Hono } from 'hono';
import {
  isStripeConfigured,
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  constructWebhookEvent,
  handleWebhookEvent,
} from '../services/stripe.js';
import { ValidationError } from '../lib/errors.js';

// Authenticated billing routes
const app = new Hono();

app.post('/checkout', async (c) => {
  if (!isStripeConfigured()) {
    return c.json({ error: { code: 'NOT_CONFIGURED', message: 'Stripe is not configured' } }, 503);
  }

  const body = await c.req.json();
  const plan = body.plan;

  if (!plan || !['starter', 'pro'].includes(plan)) {
    throw new ValidationError('Plan must be "starter" or "pro"');
  }

  const user = c.get('user');
  const url = await createCheckoutSession(user.id, user.email, plan);

  return c.json({ url });
});

app.post('/portal', async (c) => {
  if (!isStripeConfigured()) {
    return c.json({ error: { code: 'NOT_CONFIGURED', message: 'Stripe is not configured' } }, 503);
  }

  const user = c.get('user');
  const url = await createPortalSession(user.id);

  return c.json({ url });
});

app.get('/subscription', async (c) => {
  const user = c.get('user');
  const sub = await getSubscription(user.id);

  if (!sub) {
    return c.json({ subscription: null, plan: user.plan });
  }

  return c.json({
    subscription: {
      id: sub.stripeSubscriptionId,
      status: sub.status,
      current_period_start: sub.currentPeriodStart,
      current_period_end: sub.currentPeriodEnd,
      cancel_at_period_end: sub.cancelAtPeriodEnd,
    },
    plan: user.plan,
  });
});

export default app;

// Separate webhook handler (public, no auth)
export const billingWebhookApp = new Hono();

billingWebhookApp.post('/', async (c) => {
  if (!isStripeConfigured()) {
    return c.json({ error: { code: 'NOT_CONFIGURED', message: 'Stripe is not configured' } }, 503);
  }

  const signature = c.req.header('stripe-signature');
  if (!signature) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing stripe-signature header' } }, 400);
  }

  const rawBody = await c.req.text();

  let event;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (err) {
    const { logger } = await import('../lib/logger.js');
    logger.error({ err }, 'Stripe webhook signature verification failed');
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid signature' } }, 400);
  }

  try {
    await handleWebhookEvent(event);
  } catch (err) {
    const { logger: log } = await import('../lib/logger.js');
    log.error({ err }, 'Error handling Stripe webhook');
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed' } }, 500);
  }

  return c.json({ received: true });
});
