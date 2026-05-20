# Test Coverage & QA — Teardown

Scope: `apps/api/src/__tests__/` (18 files), `vitest.config.ts`, `.github/workflows/` (2 files), `apps/dashboard/`, and `packages/sdk-*` (4 SDKs) + `packages/react`, `packages/mcp-server`.

---

## TL;DR

DocuForge has the *shape* of test coverage — 18 test files, a green CI badge, a recent "+137 tests" commit — and almost none of the *substance*. The suite is overwhelmingly weighted toward Zod-schema validation, and many of those Zod tests are validating **schemas the test file copy-pasted from the route**, not the schemas the route actually uses. That means the schema can drift in production and the tests will stay green forever.

The headline gaps:

- **Zero end-to-end tests.** Nothing fires Playwright, writes a PDF, and reads it back. The product is a PDF API and the renderer (`services/renderer.ts`, ~180 lines, browser pool, header/footer interpolation, page counting via regex on `latin1` bytes) is entirely uncovered.
- **Zero tests for billing.** `routes/billing.ts`, `services/stripe.ts`, the Stripe webhook handler with signature verification — the revenue path — has no test file at all.
- **Zero tests for `routes/keys.ts` or `services/apikeys.ts`.** The thing that mints `df_live_...` tokens with bcrypt hashing is untested. So is revocation. So is `listApiKeys` and its no-hash-leak guarantee.
- **Zero tests for the Clerk webhook (`routes/webhooks.ts`).** Signature verification, replay defense, idempotency on `user.created`, cascade delete — all of it untested. (`webhooks.test.ts` is about *outbound* delivery, not the inbound Clerk handler. Naming collision masks the gap.)
- **Zero tests for `services/drip.ts`.** The drip campaign system added in the last commit (welcome / nudge1 / nudge2 / last_call / first_pdf / reengagement) has none of its idempotency, scheduling, or worker behavior covered.
- **Zero tests for `services/api-errors.ts`, `services/email.ts`, `services/usage.ts`, `services/queue.ts`, `services/fonts.ts`, `routes/marketplace.ts`, `routes/analytics.ts`, `routes/generations.ts`, `routes/fonts.ts`, `routes/usage.ts`**.
- **Zero tests for `lib/utils.ts`** — `escapeHtml`, `sanitizeCssValue`, `validateObjectDepth`, `sanitizeDataKeys`. These are all XSS / prototype-pollution / DoS defenses called from the generate path.
- **Zero tests for the admin dashboard auth path** (`apps/dashboard/src/lib/admin.ts` → `requireAdmin`).
- **Zero tests across all SDKs** — `sdk-typescript`, `sdk-python`, `sdk-go`, `sdk-ruby`. The Go and Python CI jobs only run `go vet` / `py_compile`, not `go test` / `pytest`. (`sdk-checks.yml:26` literally runs `go test ./...` but there are no `*_test.go` files in the module.)
- **Zero tests for the dashboard.** No `__tests__/`, no `.test.tsx`, no Playwright UI tests. The admin panel renders Stripe billing state, user impersonation, error breakdowns — none verified.
- **No test setup file.** No `setup.ts`, no fixtures, no factories, no test DB harness. Every test mocks `db` from scratch or runs against whatever DB is in `DATABASE_URL`.
- **CI runs the test job against a real Postgres + Redis but the tests don't use them.** `ci.yml:35-59` spins up postgres:16 and redis:7 services — and then every test file mocks the DB and Redis manually. The services are decoration; deleting them wouldn't fail a single test.

The 137 new tests in the QA-remediation commit are mostly more Zod assertions and pure-function PDF helpers. They didn't move the needle on integration coverage.

---

## What's actually good

- `pdf-utils.test.ts` + the `service functions` block in `pdf-tools.test.ts` create real PDFs with `pdf-lib` and assert against re-parsed output. That's actual behavior testing — concrete page counts, real metadata round-trips, form-field name lookups. Best work in the repo.
- `react-renderer.test.ts:72-91` explicitly probes the sandbox: `process` undefined, `require('fs')` throws, `require('react')` works. That's the only place I see security boundary tests written.
- `webhooks.test.ts` uses `vi.useFakeTimers()` to deterministically drive the exponential-backoff retry loop in a few hundred ms. That's the right pattern.
- `barcodes.test.ts:46-51` asserts the `<script>` escaping. Small but real XSS coverage.
- `auth.test.ts` covers service-to-service auth (the `X-Service-Secret` path) — uncommon to remember to test.
- `errors.test.ts` exercises every error subclass and the `errorResponse` formatter.

That's the whole "good" list. It would fit on a sticky note.

---

## Findings

### P0 — Critical path entirely untested

**P0-1 — Stripe billing flow has no tests at all.**
`apps/api/src/routes/billing.ts`, `apps/api/src/services/stripe.ts`. No test verifies that `createCheckoutSession` rejects unknown plans, that `constructWebhookEvent` rejects bad signatures (`routes/billing.ts:83-88`), that `handleWebhookEvent` is idempotent on duplicate Stripe deliveries, that `getOrCreateCustomer` doesn't double-create when called concurrently, or that `getStripe()` throws clearly when `STRIPE_SECRET_KEY` is unset. Production scenario that breaks: a Stripe webhook replay creates a duplicate `stripe_customers` row, the next checkout sees two rows, throws, and the user's subscription dangles in `incomplete` status with money already taken.

**P0-2 — API key minting and revocation have no tests.**
`apps/api/src/services/apikeys.ts:11-69` and `apps/api/src/routes/keys.ts`. No assertion that `createApiKey` (a) produces a bcrypt hash, (b) the `keyPrefix` matches the bcrypt'd key's first 16 chars, (c) the raw key is only returned once. No test for `revokeApiKey`'s tenant scoping (the `userId` clause in the `where`). No test that `listApiKeys` never returns `keyHash`. Production scenario: a refactor accidentally returns `keyHash` from `listApiKeys` and ships — every customer's bcrypt hash is now exposed via `GET /v1/keys`.

**P0-3 — Clerk webhook (`routes/webhooks.ts`) signature verification is untested.**
`apps/api/src/routes/webhooks.ts:30-52`. The Svix signature verification uses `crypto.timingSafeEqual` with a length check first (good), splits on space, parses `v1,signature` pairs — none of this has a test. Production scenario: an attacker forges a `user.created` event with `email: attacker@evil.com` and `clerk_id: <victim's clerk id>`, the unsigned/wrongly-signed event creates a phantom row, login mapping breaks, the next real signup is rejected as duplicate. There is also no test that NODE_ENV=production refuses unsigned events (`routes/webhooks.ts:59-61`).

**P0-4 — There is no E2E test that produces a real PDF.**
The renderer is the product. `apps/api/src/services/renderer.ts` is uncovered — the browser pool, the round-robin selection, the `usageCount >= 100` recycle path, the `interpolatePageVars` substitution, the `pageCount` regex on `latin1`-encoded buffer (line 168, which is fragile — a `/Type /Pageblah` literal in a content stream would inflate the count), the `javaScriptEnabled: false` constraint. There is no integration test that posts to `/v1/generate`, gets a URL back, downloads the bytes, and confirms `%PDF` plus a non-zero page count. CI provisions Chromium (`ci.yml:71`) but no test uses it.

**P0-5 — Drip campaign system added last commit is entirely untested.**
`apps/api/src/services/drip.ts` — 332 lines, idempotency via `email_events` row, BullMQ worker, hourly cron tick, `runDripTick` SQL with date-window logic for `nudge1/nudge2/last_call/reengagement`, `maybeCelebrateFirstPdf`. No test. Production scenario: the `silentUsersFor(14)` query in `runDripTick:274-285` is missing a `NOT EXISTS` guard against `email_events` for `reengagement` (it relies entirely on `enqueueDripEmail`'s row-existence check). The first time the tick runs, every active user with >14d silence gets a re-engagement email; the second run does the right thing — but if a future change resets `email_events.status='failed'` for retry, every silent user gets re-emailed. Nothing would catch that.

**P0-6 — No tests touch the BullMQ batch worker (`services/queue.ts`).**
`generationQueue` + `startWorker` (205 lines). Concurrency, retries with exponential backoff, job-failure handler, the duplicate render-pipeline (basically a copy of `routes/generate.ts`). `batch.test.ts` only tests the local-copy Zod schema. Production scenario: a refactor changes `mergeTemplate` signature, `routes/generate.ts` is updated, `services/queue.ts:99` is missed (no compile error because `data: data || {}` is `Record<string, unknown>`). All synchronous generations work; every batch silently produces blank PDFs. Tests stay green.

**P0-7 — Dashboard admin auth path untested.**
`apps/dashboard/src/lib/admin.ts:3-9` is a 6-line gate that returns `null` for non-admins, but every admin route (`/admin`, `/api/admin/users`, `/api/admin/funnel`, etc.) relies on it. No test. Production scenario: someone changes `user.role !== 'admin'` to `user.role === 'admin'` (negation bug, easy code-review miss in TS), every signed-in user becomes admin.

**P0-8 — `services/api-errors.ts` is untested despite being newly added.**
`apps/api/src/services/api-errors.ts` records errors for every `/v1/*` failure. Fire-and-forget, swallows errors. No test for: the `if (!input.path.startsWith('/v1/')) return` gate (regression risk: someone removes the gate and we log every health-check 404), the truncation behavior (`path.slice(0, 255)`, `errorMessage.slice(0, 2000)`), or that a DB outage in this function doesn't propagate to the caller. The `app.onError` in `index.ts:148-156` is the only consumer and *also* has no test.

---

### P1 — Important path untested or test gives false confidence

**P1-9 — Schema tests test a copy of the schema, not the actual schema.**
`generate-validation.test.ts:12-43`, `batch.test.ts:9-49`, `template-versioning.test.ts:9-25`, `ai.test.ts:9-14`, `integrations.test.ts:9-15`, `pdf-tools.test.ts:13-89`. Every one of these files inlines a Zod schema as a "mirror" of the route's schema, then tests *that*. If `routes/generate.ts:37` adds a new field, removes a constraint, or changes a max length (e.g. `MAX_HTML_SIZE = 5_242_880` at `routes/generate.ts:34` — this `.max()` constraint is *not* in the test's mirrored schema), the tests stay green. The whole class of tests is theater. Fix: import the actual schema from the route module.

**P1-10 — `auth.test.ts` doesn't cover the timing-attack-resistant path because there isn't one.**
The audit prompt asked about timing-attack resistance — there isn't any. `middleware/auth.ts:69-86` loops over up to 5 candidate records and `bcrypt.compare`s each. Bcrypt comparisons are constant-time per-call but the loop short-circuits on first match (line 71's `return next()`), which leaks "this prefix has N candidates and the right one is at position K" via timing. No test asserts behavior here. Also missing: token-with-NUL-byte test, token containing `Bearer ` literal, `Authorization` header with multiple values, case sensitivity of `Bearer`, the side-channel "what if two prefixes collide on `slice(0,16)`" path. The `auth.test.ts:166-218` service-to-service block doesn't test the constant-time comparison either — it uses `===` (`middleware/auth.ts:26`) which is timing-leaky on the secret.

**P1-11 — `rate-limit.test.ts` doesn't cover the circuit-breaker.**
`middleware/rateLimit.ts:13` declares a module-level `consecutiveFailures` counter and `:50-53` throws `503 SERVICE_UNAVAILABLE` after 10 consecutive failures. **No test for this path.** Worse: because the counter is module-level, a test that triggers a failure leaks state into the next test. `rate-limit.test.ts:132-141` runs one failing call ("fails open") but never asserts the counter increments, never asserts the 503 trip, never asserts recovery (the `consecutiveFailures = 0` reset at line 36). Production scenario: Redis flaps for 30 seconds, the counter hits 11, every authenticated request returns 503, the counter never decrements because each rejected request bypasses the reset.

**P1-12 — `rate-limit.test.ts` has no isolation between tests.**
`consecutiveFailures` persists across tests in the same file because it's module-scoped state in `rateLimit.ts`. If `pipeline.exec.mockRejectedValue` is called in test 6, the next test inherits a non-zero counter. The current tests happen to work because the order keeps it under 10, but adding a new failing test in the middle silently breaks unrelated tests.

**P1-13 — `webhooks.test.ts` doesn't cover signature replay or SSRF.**
The outbound webhook test asserts a signature is *included* but never asserts (a) a downstream replay of the same signature is rejected (timestamp is in a separate header, no clock-skew window is asserted), (b) the SSRF guard in `services/webhooks.ts:45-66` actually blocks `localhost`, `127.0.0.1`, `169.254.169.254` (the AWS metadata service), an IPv6 `::1`, a DNS-rebinding domain that resolves to `192.168.x.x`. The `vi.mock('dns/promises')` at `webhooks.test.ts:5-7` *unconditionally* returns a public IP — defeating the SSRF code entirely so the tests can run, then never testing it. Production scenario: an attacker registers `evil-rebinding.com` to resolve to `127.0.0.1` after first query, posts a webhook URL, exfiltrates internal API responses. Nothing in the test suite catches it.

**P1-14 — `webhooks.test.ts` retry timing not asserted.**
The test counts attempts (`expect(mockFetch).toHaveBeenCalledTimes(4)`) but doesn't assert the *delays* (1s, 2s, 4s). `services/webhooks.ts:140` uses `BASE_DELAY_MS * Math.pow(2, attempt)` — if someone refactors to `Math.pow(2, attempt - 1)` or changes the base, the test stays green. Use `vi.advanceTimersByTimeAsync` granularly.

**P1-15 — Webhook missing-secret path tested wrong.**
`services/webhooks.ts:110-117` has a production guard: if `WEBHOOK_SIGNING_SECRET` is unset and `NODE_ENV=production`, return without delivering. **Zero tests for this** — including the dev-fallback `'whsec_dev_only'` value being used as the HMAC key.

**P1-16 — `storage.test.ts` is 1 test for 1 of 4 providers.**
`apps/api/src/__tests__/storage.test.ts:25-46` tests the local-fs path only. R2, S3, GCS branches in `services/storage.ts:23-54` are completely uncovered. So is the `S3Client.send` failure path, the `CacheControl` header, the URL-construction logic (`getPublicUrl`), and the `STORAGE_PROVIDER=r2` env override that bypasses the auto-detection at `storage.ts:21`. Production scenario: an R2 credential rotation goes through, `R2_ACCESS_KEY_ID` typo in deploy, every upload fails silently in `s3.send` (which throws), `routes/generate.ts:206` re-throws, generation marked `failed`, no test would catch the typo.

**P1-17 — `templates.test.ts` tests 6 lines of `mergeTemplate` and nothing else.**
`mergeTemplate` calls `sanitizeDataKeys` and `validateObjectDepth` first (`services/templates.ts:5-6`). Neither defense is tested through this path. Production scenario: a payload `{ "__proto__": { "isAdmin": true } }` — `templates.test.ts` doesn't verify this is stripped. The `validateObjectDepth` 10-level cap also untested through this path. The Handlebars `knownHelpersOnly: true` constraint at line 7 — untested. Try passing `{{#exec 'rm -rf /'}}`; no test guards against a future change that turns this off.

**P1-18 — Template route has no tests, only schema tests.**
`apps/api/src/routes/templates.ts` (302 lines: CRUD, versioning, restore, delete-with-FK-nullify) — every behavior is uncovered. `template-versioning.test.ts` tests local schema copies, not the route. The version-restore path at `templates.ts:224-277` (which writes a *new* version row to preserve current state before restoring) has subtle ordering — no test. Production scenario: restore is interrupted between the `insert(templateVersions)` and `update(templates)`, no transaction wraps them (line 251 vs 259), state is inconsistent.

**P1-19 — Marketplace routes entirely untested.**
`routes/marketplace.ts` (172 lines). No test for: `category` query param filtering (line 21 reads it then never uses it — a bug actually, but no test would catch), browse pagination edge cases (`limit > 100` cap at line 19), publish/unpublish authz (the `userId` scope at line 126 — what if it's removed? Anyone can unpublish anyone's template).

**P1-20 — Analytics route uncovered, all queries raw SQL.**
`routes/analytics.ts` has 6 parallel raw-SQL aggregations (line 24-120). Any column rename breaks them at runtime; no test catches it before deploy. The `error_rate` calculation at line 122 divides by `total` — division-by-zero handled but never asserted. Off-by-one on the 30-day window untested.

**P1-21 — Integrations route only schema-tested.**
`integrations.test.ts` only tests `zapierGenerateSchema` (the copy). The `/triggers/new-generation`, `/triggers/new-template`, `/actions/generate`, `/auth/test` routes themselves are untested. Production scenario: `/triggers/new-generation` returns deleted-user data because the `userId` filter is on the `users` join, not `generations.user_id` — no test would catch a wrong-column refactor.

**P1-22 — `health.test.ts` doesn't check DB / Redis health.**
The health endpoint returns `{ status: 'ok' }` unconditionally regardless of database or Redis availability. That's the kind of health check that lets your liveness probe stay green while every request is 500-ing. No test calls it out as a defect, no test exists to detect when a real-readiness check is added.

**P1-23 — `react-renderer.test.ts` sandbox-escape coverage is incomplete.**
Tests cover `require('fs')` throwing but not: `require('child_process')`, dynamic `import()`, `globalThis.process`, `Object.constructor.constructor('return process')()`, `this.constructor.constructor('...')`, `vm` access via prototype walk. The sandbox uses `new Function`, which is not actually a sandbox — any of the above bypasses give access to the outer scope. No test asserts that they fail.

**P1-24 — IP rate limit middleware (`middleware/ipRateLimit.ts`) untested.**
60 rpm per IP. No test for: missing IP header (falls through to literal string `'unknown'` at line 15 — meaning every unidentifiable client shares one rate-limit bucket; a single misbehaving proxy DoS's all others), `x-forwarded-for` parsing (the `.split(',')[0]` trusts the first hop without sanitization — spoofable if the proxy doesn't strip it), fail-open behavior on Redis errors.

**P1-25 — Body size limit middleware untested.**
`index.ts:85-91` enforces 10MB via `content-length`. No test. Production bypass: send `Transfer-Encoding: chunked` with no `content-length`; the check is skipped, no upper bound is enforced anywhere downstream, OOM is reachable.

**P1-26 — `lib/utils.ts` security helpers entirely untested.**
`escapeHtml`, `sanitizeCssValue`, `validateObjectDepth`, `sanitizeDataKeys`. Each one is a security boundary called from the generate path. Zero coverage. `sanitizeCssValue` strips `;{}\\` but not `</style>` or `expression()` or `url(javascript:)` — and there's no test to lock in the current behavior or document the limitation. `sanitizeDataKeys` only blocks `__proto__`, `constructor`, `prototype` — does it handle nested arrays with poison? Untested.

**P1-27 — Email service (`services/email.ts`) untested.**
The skip-when-unconfigured path, the `stripHtml` HTML-to-text fallback (regex-based, will mangle nested `<style>` or `<script>` tags), the failure-mode return shape (`{ id: null, skipped: false, error }`). The drip worker relies on `result.error` to mark `email_events.status = 'failed'` — if the email service silently swallows errors and returns `{ id: null, skipped: false }`, status flips to `sent` even though nothing went out.

---

### P2 — Gap worth filling

**P2-28 — `auth.test.ts` mocks are absurdly brittle.**
The hand-rolled chainable mock (`auth.test.ts:17-70`) is 50+ lines of fragility. Adding a `.orderBy` call to the auth middleware would explode the mock. Use a real in-memory DB (pglite, better-sqlite3 with pg compatibility shim, or pg-mem) or testcontainers.

**P2-29 — `vi.useFakeTimers()` + module-scoped state interplay.**
Multiple tests use fake timers without resetting. The drip-tick scheduler (`drip.ts:323`) registers a BullMQ repeat job on module import — any test that imports `drip.ts` schedules a hourly job against the real Redis (if any). Cross-test pollution waiting to happen.

**P2-30 — No test setup file.**
There's no `apps/api/vitest.setup.ts`, no `globalSetup`, no fixtures directory, no factories. Every test file has to invent its own mocking pattern. Compare `auth.test.ts` (lines 18-79 to mock the DB) with `storage.test.ts` (lines 5-16 to mock fs and S3) — completely different patterns, no shared helper.

**P2-31 — `vitest.config.ts` is minimal.**
9 lines. No `coverage` config, no `pool: 'threads'`, no `isolate: true` (default is `true` but worth being explicit), no `testTimeout` (defaults to 5s — the Playwright integration tests we don't have would need 30s+), no `retry: 0` lock (some teams default to retries on CI, hiding flakes). No setupFiles. No globalSetup for shared fixtures. No `env` block so tests inherit whatever Postgres URL is in the shell.

**P2-32 — CI test job's services are unused.**
`.github/workflows/ci.yml:37-59` provisions postgres:16 and redis:7. Every test mocks both. The services are wasted minutes per CI run.

**P2-33 — CI doesn't run lint or coverage.**
No `eslint`, no `prettier --check`, no `vitest --coverage`. The "Lint & Type Check" job (`ci.yml:14-29`) only runs `tsc --noEmit`. Type errors are caught but style drift isn't.

**P2-34 — SDK CI is type-checking, not testing.**
`sdk-checks.yml:25-26` runs `go vet` and `go test`, but there are no `*_test.go` files (`packages/sdk-go/` has only `docuforge.go`, `templates.go`, `types.go`). The `go test` command silently passes with "no test files". `sdk-checks.yml:39-41` only `py_compile`s — that's a syntax check, not a test.

**P2-35 — Dashboard has no test job in CI.**
`ci.yml` builds the dashboard via `pnpm build` (which compiles), but never runs a test command. No Playwright UI tests, no Jest/Vitest unit tests, no axe-core a11y, nothing.

**P2-36 — `id.test.ts` doesn't probe collision resistance.**
`Math.set(..., 100)` is a smoke test for 100 IDs. Doesn't probe the actual nanoid distribution. The `apiKeyId` is 32-char nanoid (~190 bits), `genId` is unspecified length — no test pins the length or asserts the URL-safe alphabet.

**P2-37 — `starter-templates.test.ts` is structural only.**
Asserts shape, category enum, slug regex. Does not render any starter template through the renderer to confirm it produces a valid PDF. Drift between "I changed the invoice template HTML and broke it" and "tests still green" is 100%.

**P2-38 — `pdf-tools.test.ts` doesn't cover malformed inputs.**
The `mergePdfs` function call surface assumes `Buffer`. What happens with a non-PDF buffer? A PDF with an encrypted password header? A PDF >50MB? No test passes garbage bytes through these functions.

**P2-39 — `pdf-utils.test.ts` duplicates `pdf-tools.test.ts` service-level tests.**
Both files create test PDFs and call `mergePdfs`, `splitPdf`, `getPdfInfo`. Pick one or factor out the shared `createTestPdf` helper.

**P2-40 — `errors.test.ts` doesn't cover the `errorResponse` Zod-error path.**
`AppError` subclasses are tested but `errorResponse` likely has a branch for `ZodError` (validation paths frequently throw them) that goes untested. If not, that's a separate latent bug.

**P2-41 — No test asserts the worker handles `templateId` for a deleted template.**
`services/queue.ts:91-99` throws "Template not found"; the job retries 3× and dies. Nothing asserts the eventual `status = 'failed'` write or the lack of dangling queue entries.

**P2-42 — `routes/usage.ts` and `services/usage.ts` untested.**
`checkUsageLimit` / `incrementUsage` are called from every generate path. If they're wrong, every customer is mis-billed. No tests.

**P2-43 — Idempotency-Key path in batch route untested.**
`routes/batch.ts:58-70` reads `Idempotency-Key`, caches the response in Redis for 24h. `batch.test.ts` doesn't exercise this at all. A re-submission with the same key should return the cached batch_id; no test guards against a future "fix" that re-creates jobs anyway.

**P2-44 — Webhook event types missing default-case behavior.**
`routes/webhooks.ts:142` returns `{ received: true }` for unknown event types. No test that an unsupported event doesn't 500. (Stripe sends event types we may not have handlers for.)

**P2-45 — No tests for input sources interacting.**
The validation `if (!html && !react && !templateId)` at `routes/generate.ts:80-82` runs *after* the Zod parse. But what if all three are provided? The route picks `templateId` first (line 94), then `react`, then `html`. No test asserts this precedence. If a customer sends both `html` and `template`, they'll be silently confused which one was used.

---

### P3 — Nit

**P3-46 — `tsconfig.tsbuildinfo` committed to repo (and modified per `git status`).**
Build artifact in version control. Not a test issue per se but it's QA hygiene.

**P3-47 — `vitest` v4.0.18 in `apps/api/package.json:53` is *recent*.**
Likely a 4.0 alpha/RC. Pin it tighter or document why.

**P3-48 — `health.test.ts` hardcodes version `'0.1.0'`.**
Brittle — bumping the package version requires updating the test.

**P3-49 — Network mocking inconsistency.**
`webhooks.test.ts` uses `vi.stubGlobal('fetch', ...)`, `storage.test.ts` mocks the SDK directly. No shared HTTP-mock helper.

**P3-50 — Test file naming.**
`webhooks.test.ts` is about outbound webhook delivery, not the `routes/webhooks.ts` Clerk inbound handler. The shared filename is a footgun for the next developer who assumes both are covered. Rename to `webhook-delivery.test.ts`.

---

## Coverage matrix

| Module | Test file? | What's covered | What's NOT covered |
|---|---|---|---|
| `routes/health.ts` | health.test.ts | 200 OK, version, timestamp | DB/Redis readiness (which the route doesn't check anyway) |
| `routes/generate.ts` | (generate-validation.test.ts) | Local copy of Zod schema | Real schema; full request path; watermark injection; font CSS injection; barcode processing; webhook firing; usage limit; React vs template vs html precedence; failure DB writes |
| `routes/generations.ts` | NONE | — | List, get-by-id, cursor pagination, `lt(createdAt, cursor)`, tenant scoping |
| `routes/templates.ts` | (templates.test.ts + template-versioning.test.ts) | `mergeTemplate` happy paths; local copies of Zod schemas | Full CRUD; version history; restore (no transaction); delete-with-FK-nullify; `is_public` toggle; authz scoping on PUT/DELETE; concurrent updates; the actual route Zod schemas |
| `routes/usage.ts` | NONE | — | Everything |
| `routes/keys.ts` | NONE | — | Create (bcrypt, prefix), list (no-hash-leak), revoke (tenant scope) |
| `routes/webhooks.ts` (Clerk inbound) | NONE (despite confusing name) | — | Svix signature verification, timing-safe equal, replay, idempotency on user.created, cascade delete, NODE_ENV=production guard |
| `routes/starter-templates.ts` | starter-templates.test.ts | Structural shape, slug regex, 404 on bad slug | Cloning flow (in `index.ts:110-127`); IP rate-limit |
| `routes/batch.ts` | (batch.test.ts) | Local copy of Zod schema | Real route; idempotency key (Redis caching); per-item validation; queue enqueue; usage-limit gate; webhook attachment to last item |
| `routes/pdf-tools.ts` | pdf-tools.test.ts | Local copy of Zod; pdf-lib roundtrips for merge/split/sign/pdfa/forms | Route-level HTTP behavior; auth; rate-limit; protect endpoint; the `MAX_PDF_BASE64_SIZE` enforcement at HTTP layer |
| `routes/ai.ts` | ai.test.ts | Local schema; 503 when ANTHROPIC_API_KEY unset | Anthropic API success path; prompt construction; response shape; retry; rate limit |
| `routes/marketplace.ts` | NONE | — | Browse, get, clone, publish/unpublish; authz; pagination |
| `routes/integrations.ts` | integrations.test.ts | Local copy of Zapier schema | All 4 actual routes; trigger polling; auth/test |
| `routes/billing.ts` | NONE | — | Checkout, portal, subscription get, **Stripe webhook signature verification**, handlers for `checkout.session.completed`, `subscription.updated`, `subscription.deleted` |
| `routes/fonts.ts` | NONE | — | Upload (multipart), list, delete |
| `routes/analytics.ts` | NONE | — | All 6 aggregations |
| `middleware/auth.ts` | auth.test.ts | Missing header, bad scheme, bad prefix, bcrypt fail/succeed, service-secret happy/sad paths | Timing-attack resistance of bcrypt loop short-circuit; collision on 16-char prefix; `lastUsedAt` fire-and-forget never observed; Authorization with NUL bytes; case sensitivity |
| `middleware/rateLimit.ts` | rate-limit.test.ts | Per-plan limits; under/over; fail-open on Redis error; null-pipeline edge | **Circuit breaker (>10 failures → 503); counter reset on success; test isolation (module-level state)** |
| `middleware/ipRateLimit.ts` | NONE | — | All of it: IP parsing, 'unknown' bucket pooling, fail-open |
| `middleware/logging.ts` | NONE | — | Everything |
| `services/renderer.ts` | NONE (no E2E) | — | **Browser pool init / round-robin / recycle at 100 uses; PDF rendering itself; page-count regex on latin1; header/footer interpolation `{{pageNumber}}` `{{totalPages}}`; format/margin/orientation mapping; networkidle waiting; concurrent rendering** |
| `services/storage.ts` | storage.test.ts | Local fs path (1 test) | R2, S3, GCS branches; S3 send error; URL construction; STORAGE_PROVIDER override |
| `services/templates.ts` | templates.test.ts | 6 happy-path mergeTemplate cases | `sanitizeDataKeys` prototype-pollution defense in this path; `validateObjectDepth` 10-level cap; `knownHelpersOnly` constraint; malicious Handlebars (`{{this}}` injection, `lookup`, etc.) |
| `services/webhooks.ts` (outbound) | webhooks.test.ts | Success, retry, exhaustion, signature *presence* | **SSRF guard (dns mock defeats it); replay defense; timestamp-skew window; exact retry delays; missing-secret production guard; URL parsing edge cases (userinfo @, IPv6 brackets)** |
| `services/queue.ts` | NONE | — | **All of it: worker execution, retries, failure DB writes, batch processing** |
| `services/drip.ts` | NONE | — | **Idempotency via email_events; first-PDF celebration; runDripTick window queries; reengagement re-trigger; worker error → status='failed'; tick scheduler dedup; first_pdf only on `n === 1`** |
| `services/api-errors.ts` | NONE | — | The `/v1/` gate; truncation; DB-down swallow |
| `services/email.ts` | NONE | — | Skip-when-unconfigured; success shape; HTTP error parsing; stripHtml fallback; replyTo |
| `services/stripe.ts` | NONE | — | **getOrCreateCustomer concurrency; createCheckoutSession plan validation; constructWebhookEvent signature; handleWebhookEvent idempotency; price-to-plan reverse mapping** |
| `services/apikeys.ts` | NONE | — | **All of it: bcrypt round-trip, no-hash-leak, tenant scoping, revoke false-when-foreign** |
| `services/usage.ts` | NONE | — | All of it |
| `services/fonts.ts` | NONE | — | All of it |
| `services/react-renderer.ts` | react-renderer.test.ts | Render, props, sandbox (`process` undef, `fs` throws), size limit | `child_process` access; dynamic `import()`; `this.constructor.constructor`; prototype-walk escapes; styles XSS; non-default exports; circular components |
| `services/barcodes.ts` | barcodes.test.ts | QR replace, barcode replace, count, simple HTML escape | Malformed payloads (binary, very long, with `{{` recursion); barcode format edge cases (Code 128 with non-ASCII); SVG injection via the data string |
| `services/pdf-utils.ts` | pdf-utils.test.ts + pdf-tools.test.ts | merge, split, info | Encrypted PDFs as input; corrupted bytes; >50MB; concurrent merges |
| `services/pdf-forms.ts` | pdf-tools.test.ts | add/fill/list happy paths | Duplicate field names; invalid options; flatten on PDFs without AcroForm |
| `services/pdf-sign.ts` | pdf-tools.test.ts | Signature add | Invalid page index already covered; signature on encrypted PDF |
| `services/pdf-a.ts` | pdf-tools.test.ts | makePdfA with/without options | Actual PDF/A-1b conformance (the test only checks metadata round-trip — does **not** verify the output is actually PDF/A) |
| `lib/id.ts` | id.test.ts | Prefixes, uniqueness, length | Alphabet (URL-safe?); collision probability |
| `lib/errors.ts` | errors.test.ts | All subclasses, errorResponse | ZodError handling; unknown-error stack-trace leakage |
| `lib/utils.ts` | NONE | — | **`escapeHtml`, `sanitizeCssValue`, `validateObjectDepth`, `sanitizeDataKeys` — all security-critical** |
| `lib/redis.ts` | NONE | — | Connection-string parsing; TLS for rediss:// |
| `lib/db.ts` | NONE | — | n/a (mostly drizzle wiring) |
| `index.ts` body-size middleware | NONE | — | 10MB enforcement; chunked-encoding bypass |
| `index.ts` global onError | NONE | — | The `recordApiError` integration; key-prefix extraction; tenant attribution |
| `apps/dashboard/**/*` | NONE (no test infra at all) | — | **Everything**: admin gate, billing UI, generation table, settings, marketplace browse, playground, server actions, API routes including `/api/admin/*` |
| `packages/sdk-typescript` | NONE | — | DocuForge client class, generate, fromTemplate, fromReact, batch, templates namespace |
| `packages/sdk-python` | NONE (CI only `py_compile`s) | — | Pydantic models, httpx integration, error mapping |
| `packages/sdk-go` | NONE (CI runs `go test` but no test files exist) | — | Functional options, context cancellation, response decoding |
| `packages/sdk-ruby` | NONE | — | Faraday integration, retry, idiomatic errors |
| `packages/react` | NONE | — | All components: Document, Page, Header, Footer, Table, Grid, Watermark, Barcode, Signature |
| `packages/mcp-server` | NONE | — | All 7 MCP tools, schema validation, MCP protocol responses |

---

## Cross-cutting themes

**Theme A — "Schema mirror" anti-pattern.**
Six test files (`generate-validation`, `batch`, `template-versioning`, `ai`, `integrations`, `pdf-tools`) inline a Zod schema and test it. They never import the route's actual schema. This is *worse than no tests* because it signals coverage that doesn't exist. The fix is straightforward: export each schema from its route module and import it in the test. The fact that no one has done this across 18 test files suggests there's no architectural review for tests — the test was written and merged without anyone asking "does this assert something about production?"

**Theme B — Validation-only coverage.**
Roughly half of all assertions in the suite are "this Zod schema rejects bad input". Validation is the cheapest, least-bug-prone layer in the codebase. Almost no tests cover the *behavior after* validation passes: DB writes, side effects, response shapes, error propagation, transactions, idempotency. The 137-test commit added depth in the cheapest layer and zero depth in the layers that ship bugs.

**Theme C — Mocks defeat the test.**
`webhooks.test.ts:5-7` mocks `dns/promises` to return a public IP — disabling the SSRF guard the test is supposed to cover. `auth.test.ts:18-79` hand-rolls a chainable DB mock so brittle that touching the auth middleware breaks dozens of lines of mock plumbing. `rate-limit.test.ts` mocks the entire Redis pipeline with literal return arrays that ossify the implementation detail of "results is `[[null, n], ...]`" — if ioredis ever changes its return shape, the mocks lie. Pattern: mocks here exist to make tests *run*, not to test the *behavior*. Use a real test DB and a real Redis (testcontainers, ioredis-mock with real semantics).

**Theme D — No integration / no E2E.**
There is not a single test that exercises more than one layer. The renderer is the product, Playwright is provisioned in CI (`ci.yml:71`), but no test produces a real PDF. This is the single most important gap. A minimum smoke test: spin up the API in-process, post `{ html: '<h1>x</h1>' }` to `/v1/generate`, GET the returned URL, assert bytes start with `%PDF`. That's 30 lines of code and would catch 80% of the bugs that schema tests don't.

**Theme E — Shared module-level state across tests.**
`middleware/rateLimit.ts:13` (`consecutiveFailures`), `services/queue.ts:67` (`worker` singleton), `services/drip.ts:55,68,136-137` (queue + worker singletons that connect to Redis on import), `services/storage.ts:56` (`s3` client created at module load) — none reset between tests. Tests that import these modules entangle. The current test order happens to be safe; any reorder may not be.

**Theme F — Test isolation in CI is implicit.**
No documentation of how tests run in parallel, no `--no-file-parallelism` flag, no DB-per-worker scheme, no Redis-per-worker namespacing. If/when the suite grows to actual integration tests, this will explode.

**Theme G — Drift between test files and code.**
`templates.test.ts` tests `mergeTemplate` but the production `mergeTemplate` calls `sanitizeDataKeys` and `validateObjectDepth` first — neither tested. The schema-mirror tests have likely already drifted from production (`routes/generate.ts:34-39` has `MAX_HTML_SIZE` and `MAX_REACT_SIZE`; the mirrored schema in `generate-validation.test.ts:27-43` does not).

**Theme H — Flakiness signals.**
- `setTimeout`-based retries in `services/webhooks.ts` are tested with fake timers (good) but timing assertions are coarse.
- `services/drip.ts` registers a cron repeat job on first import; if any test imports it without a Redis mock, it persists.
- No port handling in tests — but the moment an integration test is added, it will likely race on port 3000.
- `react-renderer.test.ts` size-limit test allocates a 1MB+1B string (line 52) — fine, but slows the suite. Cap once.

**Theme I — CI is a participation trophy.**
Type-check + build + a test job that doesn't use its provisioned services. No coverage report. No lint. No mutation testing. No load test. No E2E. No artifact check. The SDK matrix runs `go test` against a package with no test files (silent success).

**Theme J — The 18-file test count is misleading.**
By rough estimate of *behavior* tests vs *schema* tests: behavior ≈ pdf-utils (4) + pdf-tools service block (~15) + react-renderer (~12) + webhooks delivery (~5) + barcodes (~7) + starter-templates (~7) + errors (~9) + id (~4) = ~63 real behavior tests across ~225 total tests in the repo. The other ~160 are schema validation or trivial Hono-app shape assertions. The headline test count overstates real coverage by roughly 3-4×.
