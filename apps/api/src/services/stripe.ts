import Stripe from 'stripe';
import { db } from '../lib/db.js';
import { users, stripeCustomers, stripeSubscriptions } from '../schema/db.js';
import { eq } from 'drizzle-orm';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Plan-to-Stripe price mapping (configure these in your Stripe dashboard)
const PLAN_PRICE_MAP: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID || 'price_starter',
  pro: process.env.STRIPE_PRO_PRICE_ID || 'price_pro',
};

const PRICE_PLAN_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(PLAN_PRICE_MAP).map(([plan, priceId]) => [priceId, plan]),
);

function getStripe(): Stripe {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-01-27.acacia' as any });
}

export function isStripeConfigured(): boolean {
  return !!STRIPE_SECRET_KEY;
}

export async function getOrCreateCustomer(
  userId: string,
  email: string,
): Promise<string> {
  // Check if customer already exists
  const [existing] = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, userId))
    .limit(1);

  if (existing) return existing.stripeCustomerId;

  // Create in Stripe
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  // Save to DB
  await db.insert(stripeCustomers).values({
    userId,
    stripeCustomerId: customer.id,
  });

  return customer.id;
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  plan: 'starter' | 'pro',
): Promise<string> {
  const stripe = getStripe();
  const customerId = await getOrCreateCustomer(userId, email);
  const priceId = PLAN_PRICE_MAP[plan];

  if (!priceId) {
    throw new Error(`No Stripe price configured for plan: ${plan}`);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.DASHBOARD_URL || 'http://localhost:3001'}/settings?billing=success`,
    cancel_url: `${process.env.DASHBOARD_URL || 'http://localhost:3001'}/settings?billing=canceled`,
    metadata: { userId, plan },
  });

  return session.url!;
}

export async function createPortalSession(
  userId: string,
): Promise<string> {
  const stripe = getStripe();

  const [customer] = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, userId))
    .limit(1);

  if (!customer) {
    throw new Error('No Stripe customer found for this user');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.stripeCustomerId,
    return_url: `${process.env.DASHBOARD_URL || 'http://localhost:3001'}/settings`,
  });

  return session.url;
}

export async function getSubscription(userId: string) {
  const [sub] = await db
    .select()
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.userId, userId))
    .limit(1);

  return sub || null;
}

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  const stripe = getStripe();
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;
      if (!userId || !plan) break;

      // Update user plan
      await db
        .update(users)
        .set({ plan: plan as any })
        .where(eq(users.id, userId));

      // If there's a subscription, record it
      if (session.subscription) {
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await db
          .insert(stripeSubscriptions)
          .values({
            userId,
            stripeSubscriptionId: sub.id,
            stripePriceId: sub.items.data[0]?.price.id || '',
            status: sub.status,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          })
          .onConflictDoUpdate({
            target: stripeSubscriptions.stripeSubscriptionId,
            set: {
              status: sub.status,
              stripePriceId: sub.items.data[0]?.price.id || '',
              currentPeriodStart: new Date(sub.current_period_start * 1000),
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
              updatedAt: new Date(),
            },
          });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id;
      const newPlan = PRICE_PLAN_MAP[priceId] || null;

      // Update subscription record
      await db
        .update(stripeSubscriptions)
        .set({
          status: sub.status,
          stripePriceId: priceId,
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          updatedAt: new Date(),
        })
        .where(eq(stripeSubscriptions.stripeSubscriptionId, sub.id));

      // Sync plan if price changed
      if (newPlan) {
        const [subRecord] = await db
          .select()
          .from(stripeSubscriptions)
          .where(eq(stripeSubscriptions.stripeSubscriptionId, sub.id))
          .limit(1);

        if (subRecord) {
          await db
            .update(users)
            .set({ plan: newPlan as any })
            .where(eq(users.id, subRecord.userId));
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;

      // Mark subscription as canceled
      await db
        .update(stripeSubscriptions)
        .set({ status: 'canceled', updatedAt: new Date() })
        .where(eq(stripeSubscriptions.stripeSubscriptionId, sub.id));

      // Downgrade user to free
      const [subRecord] = await db
        .select()
        .from(stripeSubscriptions)
        .where(eq(stripeSubscriptions.stripeSubscriptionId, sub.id))
        .limit(1);

      if (subRecord) {
        await db
          .update(users)
          .set({ plan: 'free' })
          .where(eq(users.id, subRecord.userId));
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        await db
          .update(stripeSubscriptions)
          .set({ status: 'past_due', updatedAt: new Date() })
          .where(eq(stripeSubscriptions.stripeSubscriptionId, invoice.subscription as string));
      }
      break;
    }
  }
}
