# Database & Data Integrity — Teardown

Scope: `apps/api/src/schema/db.ts`, `apps/api/drizzle/*.sql`, every service and route that hits Postgres. Drizzle ORM, `pg.Pool` (max 20), no migration runner — DDL is shipped as raw `.sql` files run by hand.

---

## TL;DR

The schema is naively correct but built on three load-bearing assumptions that all break under production load:

1. **The migration directory is a fiction.** Only three SQL files exist. The live schema in `db.ts` declares `role` enum, `template_versions`, `stripe_customers`, `stripe_subscriptions`, `email_events`, `api_errors`, `custom_fonts`, the `'react'` input type, and a half-dozen indexes that **have no corresponding migration**. Any environment that ran `0000_init.sql` and was never `db:push`'d will silently throw on auth (Drizzle selects `users.plan, users.role` — column doesn't exist), template versioning, billing, drip emails, error logging, and font uploads. This is the single biggest landmine in the repo.
2. **There is not a single `db.transaction(...)` call in the entire API.** Every multi-write path (template version + update, stripe webhook fan-out, user create + welcome email, generation + usage increment) is split across non-atomic statements. Drop the process at the wrong moment and you get drift between `templates.version`, `template_versions`, `users.plan`, `stripe_subscriptions.status`, and `usage_daily`.
3. **The drip "idempotency barrier" is a check-then-insert race.** Two `enqueueDripEmail` calls landing within ~10ms (welcome from Clerk webhook + first-PDF celebration from generation worker) both see "no existing row", both insert, and the worker sends two welcomes. There is no unique constraint on `(user_id, campaign)` to catch it.

On top of that: `apiKeys.lastUsedAt` is a lost-update buffet (every authenticated request fires a non-atomic UPDATE), the `apiKeys.keyPrefix` lookup is **not unique** so bcrypt is run in a loop (and an attacker who finds a prefix collision gets a timing side-channel for free), and the analytics route runs six `Promise.all`'d full table-scan aggregates per page-load with no materialized view. Several FKs have wildly inconsistent on-delete behavior (`stripe_subscriptions.user_id` cascades — you delete your account and lose your billing audit trail).

I count 36 findings below.

---

## What's actually good

- `usageDaily` uses `INSERT ... ON CONFLICT DO UPDATE` with `SET col = col + n` (`apps/api/src/services/usage.ts:39-55`). That's atomic at the row level — the only correctly-implemented counter in the codebase.
- `templates` and `generations` use prefixed string IDs (`tmpl_`, `gen_`) consistent with the spec in `apps/api/src/lib/id.ts`. Trivial improvement over bare UUIDs in logs.
- `apiKeys.keyPrefix` does have an index (`api_keys_key_prefix_idx`). Auth is at least not a sequential scan.
- `generations.template_id` is `ON DELETE SET NULL` (correctly recognizing that historical receipts shouldn't disappear when a template is removed). Analytics handles `'Deleted template'` gracefully.
- BullMQ + idempotency-key caching on batch (`apps/api/src/routes/batch.ts:60-70`) means double-submit is safe. The one place network retries were thought through.
- `stripe_subscriptions.stripeSubscriptionId` is `UNIQUE` and the webhook uses `onConflictDoUpdate` on it, so Stripe redelivery of `checkout.session.completed` won't insert duplicates.

That's the whole "what's good" list.

---

## Findings

### P0

- **Migrations directory is a lie — production deploys will fail at runtime** — `apps/api/drizzle/` (only 3 files), `apps/api/src/schema/db.ts:1-227`
  - Finding: The schema declares the following objects with **no migration file ever creating them**:
    - `users.role` column + `role` enum (`db.ts:18`, `db.ts:27`) — auth middleware selects this at `apps/api/src/middleware/auth.ts:30,62` and crashes with `column "role" does not exist` on a freshly migrated DB.
    - `input_type` enum value `'react'` (`db.ts:19`) — migration only has `('html', 'template')` (`0000_init.sql:10`). First `POST /v1/generate` with `react:` payload fails with `invalid input value for enum`.
    - `template_versions` table (`db.ts:63-74`) — entire versioning + restore feature broken in prod.
    - `stripe_customers`, `stripe_subscriptions` (`db.ts:114-144`) — checkout 500s.
    - `custom_fonts` (`db.ts:213-226`) — `getFontCssForUser` on every generation throws `relation does not exist`, breaking *all* PDF generation, not just font uploads.
    - `users.email UNIQUE`, `templates.is_public_idx`, `template_versions_template_id_idx`, `generations_status_idx`, `stripe_customers_*_idx`, `stripe_subs_*_idx`, `email_events_*_idx`, `api_errors_*_idx`, `custom_fonts_user_id_idx` — none exist in the SQL files.
    - The two existing followups (`0001_email_events.sql`, `0002_api_errors.sql`) cover only those tables, not the other drift.
  - Recommendation: Commit to `drizzle-kit generate` and ship one consolidated `0003_*.sql` (or repo-wide `0000_v2_init.sql`) that adds `role` enum + column, the `'react'` enum value, `template_versions`, `stripe_*`, `custom_fonts`, and every missing index. Then add a CI step that fails the build if `drizzle-kit generate` produces a non-empty diff against `apps/api/drizzle/`.

- **Zero database transactions across the entire API** — repo-wide, no `db.transaction(` call exists
  - Finding: I grepped `db\.transaction|\.transaction\(` across `apps/api/src` — **zero matches**. Every multi-write path runs as N independent statements. Failure modes:
    - `apps/api/src/routes/templates.ts:130-148` (PUT) — inserts a row into `template_versions` with the *old* content, then updates `templates`. If the UPDATE fails (CHECK constraint, replica disconnect), you've now got a `template_versions` row whose `version` collides with what `templates.version` still claims is current. The next read sees a stale "current" with a phantom history entry pointing at the same version number.
    - `apps/api/src/routes/templates.ts:251-268` (restore) — same pattern, same hazard.
    - `apps/api/src/routes/generate.ts:158-164` then `:181-189` then `:192` — insert generation, update generation, increment usage are three separate statements. Crash between insert and update leaves a `'processing'` row forever; crash before `incrementUsage` and the user gets a free PDF.
    - `apps/api/src/services/stripe.ts:137-167` — `users.plan` update and `stripe_subscriptions` insert are separate. Webhook timeout between them and the user has the right plan but no subscription record (or vice versa).
    - `apps/api/src/routes/webhooks.ts:94-114` (Clerk `user.created`) — inserts user, then enqueues welcome email. Welcome failure aborts the request, Clerk redelivers, user already exists, second branch returns `received:true` without enqueueing — welcome lost forever.
  - Recommendation: Wrap every multi-statement business operation in `db.transaction(async (tx) => { ... })`. For the stripe webhook in particular, do the user-plan + subscription upsert in one transaction, then commit, then ack the webhook.

- **Drip campaign idempotency is a check-then-insert race (lost-update + duplicate-send)** — `apps/api/src/services/drip.ts:101-131`
  - Finding: The code reads `email_events` WHERE `(user_id, campaign)`, then inserts or updates based on what it found. There is **no unique constraint on `(user_id, campaign)`** in the schema (`db.ts:181-184` is just an index, not unique). Two concurrent calls (Clerk webhook arrives just after `maybeCelebrateFirstPdf` enqueues `first_pdf`, or Clerk retries within the read window) both observe zero rows and both INSERT — the user receives the welcome twice and the message-ID column collects whichever write landed last. The comment claims the row is "the barrier" but the DB never enforces it.
  - Recommendation:
    1. `CREATE UNIQUE INDEX email_events_user_campaign_unique ON email_events (user_id, campaign);`
    2. Convert the check-then-insert to `INSERT ... ON CONFLICT (user_id, campaign) DO UPDATE SET status='queued', error_message=null WHERE email_events.status='failed' RETURNING id`. If `RETURNING` is empty, the row already existed in a non-failed state — skip enqueue.

- **Webhook `user.deleted` cascades through every billing record** — `apps/api/src/schema/db.ts:117-118,129-131`, `apps/api/src/routes/webhooks.ts:135-138`
  - Finding: `stripe_customers.userId` and `stripe_subscriptions.userId` are both `ON DELETE CASCADE`. When Clerk fires `user.deleted` (or an admin hits `DELETE /api/admin/users/[id]`), Postgres silently nukes the user's stripe customer + subscription records along with everything else. You lose the audit trail of what they paid you, the `stripeCustomerId` mapping needed to refund them, and the ability to debug billing disputes. Stripe will keep charging the (still live) Stripe subscription until you happen to find out.
  - Recommendation: Change `stripe_customers.userId` and `stripe_subscriptions.userId` to `ON DELETE SET NULL` (make userId nullable on those tables) or `ON DELETE RESTRICT`. Add a soft-delete pattern on `users` (`deleted_at timestamp`) so cascades never fire on a real account close.

- **Free PDF / unbilled usage on the failure path** — `apps/api/src/routes/generate.ts:239-251` + `:192`
  - Finding: `incrementUsage` is called *after* the generation completes and *after* `update generations set status='completed'`. If `uploadPdf` succeeds but the DB write fails (network blip), the catch block sets status='failed' and `incrementUsage` is never called — but the PDF is sitting in R2 and was returned to the user as base64. Equally: if the worker crashes after `uploadPdf` but before `incrementUsage`, same outcome. Net: usage limits are advisory; persistent users on `free` can drift over their 1000/mo cap.
  - Recommendation: Move the `incrementUsage` write inside the same transaction as the generation row update, *or* increment usage at request entry (then refund on failure). For the failure-path 500 case specifically, do a soft increment via the queue rather than relying on the request lifecycle.

### P1

- **`apiKeys.keyPrefix` is not unique — every auth request risks N bcrypt comparisons + timing leak** — `apps/api/src/schema/db.ts:42`, `apps/api/src/middleware/auth.ts:56-70`
  - Finding: `keyPrefix` is `varchar(16)` with only a non-unique B-tree index. The first 16 chars of a `df_live_` key are `nanoid(32)` output — 32^16 = ~10^24, collisions are unrealistic, but: (a) the schema allows them, (b) the middleware fetches up to **5** matches and `bcrypt.compare`s each one in a loop, multiplying p99 latency under collision. (c) The loop short-circuits on the first match, leaking a side-channel timing signal proportional to where the matching record sits in the result set (1× bcrypt vs 5× bcrypt).
  - Recommendation: Add `UNIQUE` to `keyPrefix`. Then change the lookup to `.limit(1)` and treat duplicate-key as an explicit error during key creation.

- **`apiKeys.lastUsedAt` is a lost-update fire-hose** — `apps/api/src/middleware/auth.ts:72-76`
  - Finding: Every authenticated request fires an `UPDATE api_keys SET last_used_at = NOW() WHERE id = ?` (fire-and-forget, no transaction). A burst of 100 RPS on one key issues 100 UPDATE statements per second, each acquiring a row lock, each producing a heap-tuple version, all to write essentially the same value. The pool maxes out at 20 connections — if `pg.Pool` ever blocks on the auth-side update, you backpressure the request itself. Also: `last_used_at` is monotonic but concurrent writers can land out of order.
  - Recommendation: Throttle the update — write `last_used_at` at most once per minute per key. Cheapest implementation: Redis `SET api_key:last_used:{id} ts NX EX 60` gate, only run the DB UPDATE when you win the gate. Or buffer into a Redis stream and flush every 30s.

- **`apiKeys.keyHash` is `varchar(255)` — should be `text`, and bcrypt cost factor 10 is mismatched with the request path** — `apps/api/src/schema/db.ts:36`, `apps/api/src/services/apikeys.ts:13`
  - Finding: bcrypt with cost 10 on every authenticated request, in a loop of up to 5, on the request-critical path. p99 ~80-120ms purely from auth. The cost factor is appropriate for passwords (rate-limited human input) but absurd for API tokens (a high-entropy 40-char random string). A SHA-256 + HMAC (with a secret pepper) is sufficient and runs in microseconds.
  - Recommendation: Drop bcrypt for API keys. Use `crypto.createHmac('sha256', PEPPER).update(rawKey).digest('hex')` for `keyHash` instead. Migrate by adding a new `key_hash_sha256` column, double-write on rotation, deprecate the bcrypt column. (Bcrypt remains correct for any future password feature.)

- **`generations` list query is going to choke at scale — no composite index** — `apps/api/src/schema/db.ts:90-94`, `apps/api/src/routes/generations.ts:38-55`
  - Finding: The query is `WHERE user_id = ? AND created_at < cursor ORDER BY created_at DESC LIMIT 51`. Two single-column indexes exist (`user_id`, `created_at`). Postgres will pick *one* — usually `user_id` for low-cardinality users — then sort the user's entire history in memory. Users with 100k+ generations (any pro customer after a quarter) blow this up. There is no composite `(user_id, created_at DESC)` index that supports the index-only ORDER BY.
  - Recommendation: `CREATE INDEX generations_user_id_created_at_desc_idx ON generations (user_id, created_at DESC);` and drop the standalone `generations_user_id_idx` (the composite covers it). Same query is used by `/v1/integrations/triggers/new-generation` (`routes/integrations.ts:32-37`) and admin user detail (`apps/dashboard/src/app/api/admin/users/[id]/route.ts:30-44`).

- **`usageDaily` PK + redundant index** — `apps/api/src/schema/db.ts:107-109`, `apps/api/drizzle/0000_init.sql:78`
  - Finding: The composite PK `(user_id, date)` already creates a unique B-tree on `(user_id, date)`. The migration *also* creates `idx_usage_daily_user_date` on the same columns. Pure waste — double the write amplification, double the storage.
  - Recommendation: Drop `idx_usage_daily_user_date`. Also, `checkUsageLimit` filters `WHERE user_id = ? AND date >= start_of_month` — the PK already supports this perfectly, no extra index needed.

- **`checkUsageLimit` race against itself — concurrent generations both pass** — `apps/api/src/services/usage.ts:12-30` + `apps/api/src/routes/generate.ts:85-87`
  - Finding: Two simultaneous `POST /v1/generate` calls for a user one request below limit. Both call `checkUsageLimit`, both read the same SUM, both pass, both proceed to generate. `incrementUsage` then atomically pushes them one over. Limit enforcement is best-effort; on a burst at the limit boundary, the user gets free generations equal to (concurrency - 1).
  - Recommendation: Either (a) increment-then-check inside a single SQL CTE that returns the new total and let the route reject when `new_total > limit` (with refund), or (b) hold a Redis advisory lock for the user during the increment, or (c) accept the race and accept a small over-counter as the price of cheap reads. Document the choice.

- **Stripe webhook re-delivery on `customer.subscription.updated` is not idempotent on `users.plan`** — `apps/api/src/services/stripe.ts:172-205`
  - Finding: Stripe retries webhooks aggressively. The handler updates `stripe_subscriptions` (safe, idempotent UPDATE WHERE), then *re-reads* the subscription, then unconditionally writes `users.plan`. The plan write itself is idempotent, but: there's no event-ID dedup table, so if events arrive out of order (a downgrade arriving after an upgrade because of a Stripe retry storm), you can re-apply the wrong plan.
  - Recommendation: Add a `stripe_webhook_events` table with `event.id` as PK. Insert at the top of the handler; on conflict, return 200 immediately (already processed). Or store `event.created` and refuse to apply events older than the latest already-applied one for the same subscription.

- **`templates.version++` is a read-modify-write race** — `apps/api/src/routes/templates.ts:130-148`
  - Finding: The handler reads `existing.version`, then writes `version: existing.version + 1`. Two PUTs racing on the same template both read `version = 5`, both write `6`, both insert `template_versions` rows with `version = 5` — collision-allowed because no unique index on `(template_id, version)`. Result: two distinct version-6 templates and two template_versions rows both labelled v5.
  - Recommendation: (a) `UPDATE templates SET version = version + 1 ... RETURNING version` then insert the version row with the *returned* old value — all inside a transaction. (b) Add `UNIQUE (template_id, version)` on `template_versions` so a collision throws instead of silently corrupting.

- **`email_events` lacks any uniqueness or partial index for the drip tick fan-out** — `apps/api/src/services/drip.ts:261-313`, `apps/api/src/schema/db.ts:181-186`
  - Finding: The hourly tick scans `users` (full table) joined with `NOT EXISTS (SELECT 1 FROM generations WHERE g.user_id = u.id)` — for every campaign window. With even 10k users, that's six `seq_scan + nested_loop_anti` queries per tick. No partial index on `(created_at) WHERE NOT exists ... ` to speed it up. The per-user `enqueueDripEmail` then issues one SELECT + one INSERT/UPDATE per candidate, serially in a for-loop (no batching, no `Promise.all`).
  - Recommendation: (a) Cache "users without a generation" in a materialized view refreshed every hour by the tick itself, or maintain a `users.has_first_generation` boolean updated by the generation success path. (b) Batch the `enqueueDripEmail` work into a single `INSERT ... SELECT ... ON CONFLICT DO NOTHING` per campaign window, then bulk-enqueue BullMQ jobs.

- **N+1 over-fetch in `getFontCssForUser` on every generation** — `apps/api/src/services/fonts.ts:175-203`, called from `apps/api/src/routes/generate.ts:139`
  - Finding: Every single PDF generation does `SELECT * FROM custom_fonts WHERE user_id = ?` and returns even when there are zero fonts. For users who never uploaded a font (the vast majority), that's a wasted round-trip on the hot path. The result is also not cached — same user hitting `/v1/generate` 100x/s issues 100 identical SELECT statements.
  - Recommendation: Cache `getFontCssForUser` in Redis with a 5-minute TTL keyed by `fonts:user:{id}`, invalidated on font upload/delete. Or: store font CSS as a denormalized column on `users` that the upload/delete path rewrites.

- **Analytics route fires six full-scan aggregates per page load** — `apps/api/src/routes/analytics.ts:23-120`
  - Finding: All six queries scan `generations` with `WHERE user_id = ? AND created_at >= NOW() - 30 days`. For a `pro` user with 100k/mo generations, each scan reads 100k rows. Six of them in parallel. No materialized rollup, no use of the existing `usage_daily` table (which has daily counts that would answer half the questions). The "peak hours" query is the worst — `GROUP BY EXTRACT(HOUR FROM ...)` forces a full sort.
  - Recommendation: Pre-aggregate. Extend `usage_daily` with `success_count`, `fail_count`, `avg_latency_ms`, `total_ms`, and a `usage_hourly` table for peak-hour analysis. Read these tables from analytics; only fall back to `generations` for the per-template breakdown.

- **Admin funnel/users routes scan `generations` and `templates` un-paginated** — `apps/dashboard/src/app/api/admin/users/route.ts:62-141`, `apps/dashboard/src/app/api/admin/funnel/route.ts:75-89`
  - Finding: Three `LEFT JOIN (SELECT ... GROUP BY user_id)` subqueries — full aggregation of the entire `generations` and `templates` and `api_keys` tables on **every admin pageview**. No materialization, no cache. As your user base grows past 10k, these queries lock up Postgres at 5-10s per request.
  - Recommendation: Build a `user_funnel_stats` summary table refreshed by a scheduled job (every 15 min) holding `user_id, gen_count, first_gen, last_gen, key_count, tpl_count, has_succeeded, first_error_text`. Admin routes read from it.

- **`generations` has no `idx_generations_user_status` for failure queries** — `apps/api/src/schema/db.ts:90-94`, `apps/dashboard/src/app/api/admin/users/[id]/errors/route.ts:20-34`, `drip.ts:226-235`
  - Finding: The "first_pdf celebration" check (`drip.ts:228-232`) does `WHERE user_id = ? AND status = 'completed'`. The admin error breakdown does `WHERE user_id = ? AND status = 'failed'`. Both fall back to `idx_generations_user` (a single-column user index) then filter on status in memory.
  - Recommendation: `CREATE INDEX generations_user_status_idx ON generations (user_id, status, created_at DESC);` covers the celebration count, the admin user errors, and the per-user funnel queries.

- **`templates.userId` has no `(user_id, updated_at)` composite, so dashboard listing isn't index-only** — `apps/api/src/schema/db.ts:58-61`, `apps/api/src/routes/templates.ts:64-72`
  - Finding: List queries `ORDER BY templates.createdAt DESC` (with `WHERE user_id = ?`), and the admin user detail orders by `desc(templates.createdAt)`. Same shape as generations — needs a composite to avoid a sort.
  - Recommendation: `CREATE INDEX templates_user_created_at_idx ON templates (user_id, created_at DESC);` Drop standalone `templates_user_id_idx`.

- **`apiErrors` table has no `(user_id, created_at DESC)` composite — admin per-user error query forces a sort** — `apps/api/src/schema/db.ts:204-208`, `apps/dashboard/src/app/api/admin/api-errors/route.ts:63-81`
  - Finding: Per-user filter is `WHERE e.user_id = ? AND e.created_at >= NOW() - interval`. Only `user_id`-alone and `created_at`-alone indexes exist (the latter not even on DESC). Postgres picks one, sorts the rest.
  - Recommendation: Composite `api_errors_user_created_at_idx ON (user_id, created_at DESC)`.

- **`recordApiError` is fire-and-forget on the same connection pool serving requests — under failure storms it self-DOSes** — `apps/api/src/services/api-errors.ts:36-50`
  - Finding: Every 4xx/5xx fires an extra INSERT to `api_errors` on the *same* `pg.Pool` (max 20) that serves API traffic. During an outage that produces 5xx storms, the error logger consumes connection slots and accelerates the outage. There's also no batching — 1000 errors/sec = 1000 INSERTs/sec.
  - Recommendation: (a) Batch via a `BatchingBuffer` that flushes every N rows or T ms with a single multi-row INSERT. (b) Use a separate, smaller pg.Pool dedicated to telemetry so it can't starve the primary.

- **Hard-delete of user wipes all blob storage references but never removes the blobs themselves** — `apps/api/src/routes/webhooks.ts:135-138`, `apps/api/src/services/storage.ts` (no delete function)
  - Finding: `DELETE FROM users WHERE clerk_id = ?` cascades through `generations`, leaving every PDF file in R2/S3 orphaned. The schema records `generations.pdfUrl` (`db.ts:84`) but there's no service method to delete the file. Same for `custom_fonts` rows that point to `storageKey` — the user.deleted webhook never calls `deleteFontFromS3`.
  - Recommendation: Either (a) implement a soft-delete with a periodic GC job that lists `pdfs/` and reconciles against the live `generations` table, or (b) wire a pre-delete trigger / explicit service call that iterates the user's generations and fonts and deletes the blobs first.

- **Template delete sets `generations.template_id = NULL` outside a transaction** — `apps/api/src/routes/templates.ts:291-297`
  - Finding: Two statements — `UPDATE generations SET template_id = NULL WHERE template_id = ?` then `DELETE FROM templates WHERE id = ?`. Crash between them and you have a live template whose every generation thinks it was orphaned. Even more dangerous: there's no row lock on the template — concurrent reads in `generate.ts` can still see the template, render with it, INSERT into generations, all *after* the nullify ran. Final state: a fresh generation row pointing at a deleted template, FK either rejects (if there's still an FK) or accepts (the FK is `ON DELETE SET NULL` so it'd just become NULL the next time someone touched it — except nothing touches it).
  - Recommendation: Wrap in a transaction with `SELECT ... FOR UPDATE` on the template. Better: rely on the FK's `ON DELETE SET NULL` and just `DELETE FROM templates`. Postgres does the cascade atomically; the manual UPDATE is redundant and racy.

### P2

- **`templates.id` is `varchar(64)` and used everywhere — no unique index on the `tmpl_` prefix means malformed clients can collide** — `apps/api/src/schema/db.ts:47`, `apps/api/src/lib/id.ts:7`
  - Finding: ID is generated as `tmpl_${nanoid(16)}`. `nanoid` is unique-ish but not collision-resistant under bad PRNG. Since PK is `varchar(64)` with no length floor and no regex CHECK, you can insert IDs like `'tmpl_'` (5 chars) or `''` if anyone bypasses the helper. The schema allows it.
  - Recommendation: Add `CHECK (id ~ '^tmpl_[A-Za-z0-9_-]{16,}$')` on `templates`, same pattern on `generations` (`gen_...`), `custom_fonts` (`font_...`). Cheap defense in depth.

- **`users.id` is UUID but the prefix spec says `usr_`** — `apps/api/src/lib/id.ts:9`, `apps/api/src/schema/db.ts:23`
  - Finding: The `userId()` helper exists but is never called. `users.id` is `uuid().defaultRandom()`. So all API responses, all logs, all dashboards expose bare UUIDs instead of `usr_xxx` IDs. The prefix system is broken for the entity that needs it most — users — and the inconsistency leaks abstractions (you can immediately tell which IDs were defined first).
  - Recommendation: Pick one. If you want prefixed user IDs, migrate to `varchar(64) PRIMARY KEY` and have Clerk webhook handler emit `userId()`. If you don't, delete `userId()` from `id.ts`.

- **`stripeSubscriptions` doesn't track money as numeric** — `apps/api/src/schema/db.ts:127-144`
  - Finding: There's no amount column at all. Plan + status + dates are stored, but if you ever need to reconcile or report MRR, you have to call Stripe for every record. Adding it later means a backfill from Stripe API for every historical subscription.
  - Recommendation: Add `amount_cents integer NOT NULL DEFAULT 0` and `currency varchar(3) NOT NULL DEFAULT 'usd'`. Populate from `sub.items.data[0]?.price.unit_amount` on every webhook upsert.

- **Timestamp columns are not `timestamptz`** — `apps/api/src/schema/db.ts` (every `timestamp(...)` call)
  - Finding: Drizzle's `timestamp()` without `{ withTimezone: true }` emits `timestamp without time zone`. Postgres stores wall-clock time in whatever zone the inserting session is in. The mixed Node/Postgres environment is going to drift the moment you have a worker in another region or your DB session sets `TIME ZONE`. All the ad-hoc `NOW() - interval '7 days'` filters in `funnel/route.ts`, `analytics.ts`, `drip.ts` assume UTC consistency that isn't enforced.
  - Recommendation: Convert every `timestamp(...)` to `timestamp(..., { withTimezone: true })`. Migration: `ALTER TABLE x ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';` for every timestamp column on every table.

- **`apiKeys.name` is `varchar(255) DEFAULT 'Default'` — every user has `n` keys all named "Default"** — `apps/api/src/schema/db.ts:38`
  - Finding: Not a uniqueness constraint, so duplicates are allowed and inevitable; the only `prefix` displayed is `prefix...` (no suffix in list, only on create), so users with two "Default" keys cannot tell them apart in the dashboard list (`apikeys.ts:50-56`).
  - Recommendation: Either enforce `UNIQUE (user_id, name)` to force unique names, or always show the last 4 chars in the list (`${prefix}...${lastFour}`) the same way creation does.

- **`emailEvents.providerMessageId` not unique — webhook double-delivery from email provider can corrupt status** — `apps/api/src/schema/db.ts:165-187`
  - Finding: Resend/Postmark/whoever delivers an `opened` or `clicked` callback referencing the provider's message ID. Schema doesn't enforce uniqueness so two delivery webhooks for the same message both write `opened_at = NOW()`. Lost-update on the *later* timestamp; correctness depends on whichever write wins.
  - Recommendation: `UNIQUE (provider_message_id) WHERE provider_message_id IS NOT NULL` (partial unique index).

- **`templates.htmlContent` is `text` with a 10MB cap enforced only in the route, not the DB** — `apps/api/src/schema/db.ts:52`, `apps/api/src/routes/templates.ts:9-15`
  - Finding: Limit lives in the Zod schema (`MAX_TEMPLATE_HTML_SIZE = 10_485_760`). Anyone who writes directly via Drizzle (jobs, the AI route, the marketplace clone path) can insert larger blobs. The marketplace clone path (`marketplace.ts:93-103`) inserts the source's `htmlContent` directly — if a malicious admin published a 100MB template, every clone copies it into the cloner's account.
  - Recommendation: Add a DB-level `CHECK (octet_length(html_content) <= 10485760)` on both `templates` and `template_versions`.

- **`generations.error` is unbounded text** — `apps/api/src/schema/db.ts:88`
  - Finding: A stack trace from `chromium` can be 50KB+. Multiply by 100k failed generations and the `generations` table tail bloats the working set. The analytics page also `ARRAY_AGG`s these (`first_error_breakdown/route.ts:40`), which means a single bad trace blows up the response payload.
  - Recommendation: `CHECK (octet_length(error) <= 4096)`, and truncate on write in `routes/generate.ts:245`.

- **`api_errors.error_message` truncated to 2000 in code but `text` in schema — silent inconsistency** — `apps/api/src/services/api-errors.ts:24,32`, `apps/api/src/schema/db.ts:200`
  - Finding: Code enforces `slice(0, 2000)`. Schema column is unbounded `text`. Any future code path that inserts without going through `recordApiError` (none yet, but...) can drop unbounded messages. Schema and code should agree.
  - Recommendation: Either declare `varchar(2000)` in the schema or document the cap with a column comment.

- **`role` enum has only `'user' | 'admin'`, no `'support'` or `'readonly'`** — `apps/api/src/schema/db.ts:18`
  - Finding: When you hire a support engineer, they need read-only access to the admin dashboard. The current enum forces you to either grant full admin (dangerous — they can change plans, delete users) or pretend they're a user (and they see nothing).
  - Recommendation: Add `'support'` and `'readonly'` to the role enum and gate destructive admin routes on `role === 'admin'`.

### P3

- **`generations.pdfUrl` is `text` not `varchar(N)`** — `apps/api/src/schema/db.ts:84`
  - Finding: Bounded URLs (R2 public URLs are ~120 chars) stored as unbounded text. Trivial nit but `text` columns don't get the same TOAST inline benefit as small varchars.
  - Recommendation: `varchar(1024)`.

- **`stripe_subscriptions.status` is `varchar(50)` not an enum** — `apps/api/src/schema/db.ts:134`
  - Finding: Stripe statuses are a closed set: `incomplete, incomplete_expired, trialing, active, past_due, canceled, unpaid, paused`. Storing as freeform varchar lets typos through (e.g., the handler writes the literal `'past_due'` and `'canceled'` — fine — but nothing prevents `'past due'` from a future PR).
  - Recommendation: `pgEnum('subscription_status', [...])`.

- **`generations.fileSizeBytes` is `integer` (32-bit), max 2GB — a single huge PDF overflows silently** — `apps/api/src/schema/db.ts:85`
  - Finding: 32-bit signed integer caps at 2,147,483,647 bytes (~2GB). A poster-sized photographic PDF can plausibly exceed this — and `pages` is also `integer` though that's safer.
  - Recommendation: `fileSizeBytes` → `bigint`. Same as you already did for `usage_daily.totalBytes`.

- **`usage_daily.totalPages` is `integer` — a pro user generating 200-page PDFs hits 2^31 around year 4** — `apps/api/src/schema/db.ts:104`
  - Finding: Same overflow risk if you sum many years of daily counts (`SUM(total_pages)` would already be `bigint`, but the per-row value is int). Low priority but bigint is free in Postgres.
  - Recommendation: `bigint`.

- **`api_keys.created_at` index missing for "show me oldest unused key" admin queries** — `apps/api/src/schema/db.ts:41-44`
  - Finding: The audit script (`scripts/audit-users.ts:222`) does `WHERE k.last_used_at IS NULL AND g.id IS NULL` — full scan. As `api_keys` grows past 100k rows this becomes a noticeable hit on the audit page.
  - Recommendation: Partial index `CREATE INDEX api_keys_unused_idx ON api_keys (created_at DESC) WHERE last_used_at IS NULL;`.

- **`templates.updatedAt` not auto-updated by Postgres trigger** — `apps/api/src/schema/db.ts:57`, `apps/api/src/routes/templates.ts:128`
  - Finding: Code remembers to set `updatedAt: new Date()` in every UPDATE handler. Easy to forget when a new endpoint touches the row. (`marketplace.ts:133` sets it; `marketplace.ts:161` sets it; admin PATCH could easily miss it.)
  - Recommendation: Postgres trigger: `CREATE TRIGGER templates_updated_at BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION set_updated_at()`.

---

## Cross-cutting themes

1. **No safety net between code and schema.** No CI step runs `drizzle-kit generate` to detect drift. No CI step runs the SQL migrations against a fresh DB and asserts the resulting schema matches `db.ts`. Every feature that landed since `0000_init.sql` (template versioning, billing, drip emails, error logging, fonts, the `react` input type, the `role` enum) lives only in the TypeScript schema definition. Anyone who deploys via `psql -f drizzle/*.sql` gets a broken DB.

2. **Atomicity is treated as someone else's problem.** Multi-write workflows assume the request lifecycle is the transaction. It is not. Drop the process at any point and you get user-plan vs subscription drift, template version drift, ghost `'processing'` generations, missed welcome emails, double-charged usage. Every multi-statement business operation needs an explicit `db.transaction`.

3. **"Idempotency via SELECT-then-INSERT" appears at least four times** (drip, stripe customer create, user create, template version write). It never works — race window is always nonzero. Either `INSERT ... ON CONFLICT` (the one place that gets it right — `usageDaily`) or `SELECT FOR UPDATE` inside a transaction. Pick one and apply it consistently.

4. **The hot read path is unindexed for the workloads it advertises.** Cursor pagination on `generations` claims to be efficient but lacks the `(user_id, created_at DESC)` composite it needs. Auth is the hottest path in the API and runs bcrypt + an extra UPDATE on every request. Analytics fans out six full-scan aggregates instead of reading the `usage_daily` rollup that already exists.

5. **Admin and analytics views scan the same hot tables on every page-load.** No materialized views, no scheduled rollup tables, no cache. This is fine for 100 users; it's a Postgres-locking event at 100k.

6. **FK on-delete behavior is inconsistent and dangerous.**
   - `generations.template_id` → `SET NULL` (correct, preserves audit trail).
   - `generations.user_id`, `templates.user_id`, `api_keys.user_id`, `template_versions.template_id`, `usage_daily.user_id`, `stripe_customers.user_id`, `stripe_subscriptions.user_id`, `email_events.user_id`, `api_errors.user_id`, `custom_fonts.user_id` → all `CASCADE`.
   - Deleting a user erases their PDFs (storage orphaned), their billing record (Stripe still charges them), their error history (impossible to debug after the fact), and their email history (cannot prove GDPR-relevant consent). Every CASCADE deserves an audit: should this row actually disappear, or should we soft-delete the user and keep these?

7. **Storage and DB are out of sync on delete.** Blob storage has no `deletePdf` function. There is no GC job. Every user deletion, every template delete, every regenerated-then-overwritten PDF leaves files in R2/S3 forever. Free disk = expensive in production.

8. **JSONB usage is permissive.** `templates.schema` and `template_versions.schema` are typed `Record<string, unknown>` with no runtime validation at the DB or insert boundary. No GIN index, so any future query like "find templates with a `customer.email` field" requires a full scan. The schema column was meant to describe the template's data shape — but nothing reads it for validation either (`mergeTemplate` doesn't check against it).

9. **No event-id idempotency table exists for any webhook source.** Clerk redelivers. Stripe redelivers. Resend redelivers. None of the three handlers persist `event.id` to dedupe. The only protection is the lucky structure of the SQL (e.g., `INSERT ... ON CONFLICT` on `stripeSubscriptionId`), and that's accidental — it only works for one of four Stripe event types.
