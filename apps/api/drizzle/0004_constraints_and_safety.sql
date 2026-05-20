-- Data integrity hardening.
-- 1. Add UNIQUE constraints that turn application-level race conditions
--    into DB-enforced invariants.
-- 2. Change Stripe foreign keys from CASCADE to RESTRICT so deleting
--    a user can no longer silently vaporize billing history while
--    Stripe keeps charging the saved customer.
--
-- Run with: psql $DATABASE_URL -f drizzle/0004_constraints_and_safety.sql

-- ── 1. Drip idempotency: at most one welcome/nudge/last_call/first_pdf
--      per (user, campaign). reengagement is intentionally re-sendable,
--      so it's excluded via a partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS "email_events_one_per_campaign_idx"
  ON "email_events" ("user_id", "campaign")
  WHERE "campaign" <> 'reengagement';

-- ── 2. Template version monotonicity: no two rows with the same
--      template_id can share a version number.
CREATE UNIQUE INDEX IF NOT EXISTS "template_versions_template_id_version_idx"
  ON "template_versions" ("template_id", "version");

-- ── 3. Stripe FK: CASCADE → RESTRICT. Try both possible existing
--      constraint names (Postgres-auto from 0003 raw SQL, or
--      drizzle-style) so this migration is safe on either history.
ALTER TABLE "stripe_customers"
  DROP CONSTRAINT IF EXISTS "stripe_customers_user_id_fkey",
  DROP CONSTRAINT IF EXISTS "stripe_customers_user_id_users_id_fk";

ALTER TABLE "stripe_customers"
  ADD CONSTRAINT "stripe_customers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;

ALTER TABLE "stripe_subscriptions"
  DROP CONSTRAINT IF EXISTS "stripe_subscriptions_user_id_fkey",
  DROP CONSTRAINT IF EXISTS "stripe_subscriptions_user_id_users_id_fk";

ALTER TABLE "stripe_subscriptions"
  ADD CONSTRAINT "stripe_subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
