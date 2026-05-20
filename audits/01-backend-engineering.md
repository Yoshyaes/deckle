# Backend Engineering & Architecture — Teardown

## TL;DR
- The `generate` route and `queue` worker are 95% copy-pasted clones. Every change to one must be remembered in the other. This is the worst piece of debt in the API.
- Env validation exists (`lib/env.ts`) but is *unused*. Every service reads `process.env.*` directly, with three different defaulting strategies, contradictory provider detection logic, and runtime non-null assertions (`!`). Adding env vars is hazardous.
- Error contract is inconsistent: routes mix `throw new ValidationError(...)`, `return c.json({ error: { code, message } }, 503)`, and (in `routes/webhooks.ts`) `return c.json({ error: 'string' }, 400)`. Three shapes leaking out of the API.
- Storage configuration is duplicated across `services/storage.ts` and `services/fonts.ts` (the entire S3 client/bucket/url switch is rewritten). `fonts.ts` even branches on the same `STORAGE_PROVIDER` env three separate times in one file.
- The "browser pool" is a round-robin counter with no concurrency control: `getBrowser()` increments a usage count and immediately hands the same browser to N concurrent generations. Worse, recycling reassigns `this.browsers[index]` while requests can still be holding a reference to the old browser.

## What's actually good
- `lib/errors.ts` — clean `AppError` hierarchy with `errorResponse()` centralized in `app.onError`. The shape is the right one; routes just don't all use it.
- `services/api-errors.ts` — disciplined fire-and-forget with bounded path/message lengths and a void-discarded promise. The right way to do an "observability sidecar".
- `services/webhooks.ts` — solid SSRF guards (private-IP check, IPv4-mapped-IPv6 handling, DNS-resolve check) and proper HMAC signing. The retry/backoff loop is clean.
- `lib/utils.ts` `sanitizeDataKeys` / `validateObjectDepth` / `escapeHtml` — small, focused, reused (mostly). Good defense-in-depth primitives.
- `middleware/rateLimit.ts` — the `consecutiveFailures > 10` circuit breaker fail-closed switch over fail-open is one of the more thoughtful pieces of error handling in the codebase.

## Findings

### P0 — ship-blockers

- **`BrowserPool` recycle races with in-flight requests** — `apps/api/src/services/renderer.ts:60-97`
  - Finding: `getBrowser()` returns `entry.browser` to the caller, then fires `recycleBrowser(idx)` which calls `await old.browser.close()` *while the caller is still using it*. The caller holds the `Browser` reference, but the pool kicks off a `browser.close()` on it concurrently. Long-running PDF renders will randomly fail with "Target closed" once a browser hits 100 uses.
  - Recommendation: use lease/return semantics (track in-flight contexts per browser, recycle only when in-flight=0 after threshold). Or simply do not call `close()` on the old browser if any context is open.

- **Browser pool has no concurrency control** — `apps/api/src/services/renderer.ts:60-78`
  - Finding: `getBrowser()` is `currentIndex++` round-robin with no queueing. Under load, the same `Browser` is handed to dozens of concurrent `renderPdf` calls. Chromium can handle multiple contexts but you've capped at 2-3 browsers with no upper bound on concurrent contexts per browser, no semaphore, and no backpressure. With the BullMQ worker concurrency=5 and the sync /v1/generate endpoint accepting arbitrary parallel load, this melts.
  - Recommendation: introduce a real semaphore/queue around browser-context acquisition with a max-concurrency bound.

- **Generate route and queue worker are duplicated logic** — `apps/api/src/routes/generate.ts:68-252` vs `apps/api/src/services/queue.ts:69-200`
  - Finding: 100+ lines of "resolve html → render → upload → update generation row → increment usage → webhook" are forked between sync and async paths. Already drifted: the sync path runs `processBarcodes`, applies watermark, injects `getFontCssForUser`; the queue path runs `processBarcodes` but skips watermark and font injection. Batch users get a different rendering pipeline than sync users and don't know it.
  - Recommendation: extract `generatePdf({ userId, html|react|template, data, options, watermark, webhook, output })` into a single service used by both paths. The route/worker should only differ in transport.

- **`finalHtml.includes(watermarkHtml)` check is broken** — `apps/api/src/routes/generate.ts:132-135`
  - Finding: `finalHtml.replace(/<\/body>/i, watermarkHtml + '</body>')` is followed by `if (!finalHtml.includes(watermarkHtml)) finalHtml += watermarkHtml;`. If the replace succeeded, `.includes()` is always true; if it failed, the string is appended outside any `<body>` tag — which is what should be the only-branch. The whole construct is a confused tautology. Effectively works for "well-formed HTML" but explodes for the case it was meant to defend.
  - Recommendation: `if (/<\/body>/i.test(finalHtml)) finalHtml = finalHtml.replace(...); else finalHtml += watermarkHtml;`

### P1 — significant

- **`env.ts` is validated but completely unused** — `apps/api/src/lib/env.ts:1-29`
  - Finding: Schema validates `DATABASE_URL`, `REDIS_URL`, `STORAGE_PROVIDER`, etc., then `export const env = validateEnv()`. Grep across `apps/api/src` for `import { env }`: zero hits. Every consumer reads `process.env.X` raw, with redundant defaults and `!` assertions. The validation runs (good) but downstream code is unaware of any of the typed values.
  - Recommendation: replace every `process.env.X` in `services/*` and `middleware/*` with `env.X`. Move `REDIS_URL`, `R2_*`, `AWS_*`, `GCS_*`, `STRIPE_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `WEBHOOK_SIGNING_SECRET`, `CLERK_WEBHOOK_SECRET`, `DASHBOARD_URL`, `DASHBOARD_SERVICE_SECRET`, `FOUNDER_EMAIL` into the schema.

- **S3 client wiring duplicated between storage and fonts** — `apps/api/src/services/storage.ts:23-82` and `apps/api/src/services/fonts.ts:85-135, 175-204`
  - Finding: The whole "switch on provider → build S3Client → resolve bucket → resolve public URL" block exists in two places with subtle differences (storage caches `s3` at module top; fonts calls `getS3Uploader()` lazily inside each upload/delete). `fonts.ts` has the provider branch repeated three more times (lines 56, 86, 160, 183).
  - Recommendation: extract `getStorageClient()`/`getBucket()`/`getPublicUrl()` into `lib/storage.ts` and have both PDFs and fonts consume it.

- **`parseRedisConnection` is duplicated verbatim across queue and drip** — `apps/api/src/services/queue.ts:20-30` and `apps/api/src/services/drip.ts:26-38`
  - Finding: Two byte-identical implementations of the same URL parser. If a `rediss://` edge case surfaces, you fix it in one place and forget the other.
  - Recommendation: move to `lib/redis.ts` (single source of truth) and export.

- **Three different error response shapes leak out of the API** — `apps/api/src/routes/webhooks.ts:25, 51, 60`, vs `apps/api/src/routes/billing.ts:17, 35, 71, 76, 87, 95`, vs the canonical `{ error: { code, message } }` in `lib/errors.ts`
  - Finding: `routes/webhooks.ts` returns bare `{ error: 'Missing Svix headers' }` (string, not object). `routes/billing.ts` short-circuits with manual `{ error: { code, message } }` literals instead of throwing `new ServiceUnavailableError(...)` (which doesn't exist). The canonical pattern is `throw new ValidationError(...)` and let `errorResponse()` shape it — billing ignores this completely.
  - Recommendation: add `ServiceUnavailableError extends AppError(503, 'NOT_CONFIGURED', ...)` and `BadRequestError`; convert all hand-rolled `c.json({ error: ... }, status)` to throws.

- **`process.exit(1)` inside `validateEnv` makes the binary untestable** — `apps/api/src/lib/env.ts:24`
  - Finding: A library file calls `process.exit(1)` on parse failure. Any test that imports `env.ts` indirectly will kill the test runner if env is missing.
  - Recommendation: throw, let the caller in `index.ts` log and exit.

- **`startWorker()` is fire-and-forget but mutates a module-level singleton** — `apps/api/src/services/queue.ts:67-200`
  - Finding: `let worker: Worker | null = null;` plus `startWorker()` reassigns it. If `startWorker` is called twice (which `index.ts:173` does once, but the test setup or worker-restart scenarios will trip on), the previous worker is never closed and leaks Redis connections. Same pattern in `drip.ts:136-214` (two singletons, no idempotency).
  - Recommendation: idempotency guard (`if (worker) return`) plus a proper restart helper.

- **`renderer.ts` page count via byte-string regex over PDF body** — `apps/api/src/services/renderer.ts:166-168`
  - Finding: `pdfContent = buffer.toString('latin1'); (pdfContent.match(/\/Type\s*\/Page[^s]/g) || []).length` — this is a heuristic that breaks on PDFs with compressed object streams (default in modern PDF output) where `/Type /Page` lives inside a compressed stream and won't match the regex. It also forces a full byte→string copy of the PDF for every render. With page counts wrong, usage tracking and per-doc analytics drift.
  - Recommendation: use `pdf-lib`'s `PDFDocument.load(buffer).getPageCount()` — it's already a runtime dependency.

- **Dead/unused exports across `lib/`** — `apps/api/src/lib/logger.ts:10-12`, `apps/api/src/lib/redis.ts:18-25`
  - Finding: `createRequestLogger(requestId)` is defined but never imported. `connectRedis()` is exported but never called — Redis is initialized eagerly at module load. `requestId` is set on the Hono context in `middleware/logging.ts:11` but never read back to scope child loggers, so it's effectively orphan state.
  - Recommendation: either wire `createRequestLogger` into the logging middleware (`c.set('logger', createRequestLogger(requestId))`) and consume it everywhere, or delete both.

- **`react-renderer.ts` allows component source up to 5MB at the route layer, 1MB inside the service** — `apps/api/src/routes/generate.ts:35` vs `apps/api/src/services/react-renderer.ts:91`
  - Finding: Two contradictory size limits. Routing schema rejects >5MB, then the renderer rejects >1MB. So 1–5MB always fails with a confusing `VALIDATION_ERROR` at the renderer layer instead of the input layer.
  - Recommendation: pick one limit and surface it at the input schema.

- **Unbounded numeric fields in generate watermark CSS** — `apps/api/src/routes/generate.ts:124-131`
  - Finding: `watermark.opacity`, `watermark.angle`, `watermark.fontSize` are validated as numbers (opacity has 0–1, others have nothing). `fontSize: 1e9` or `angle: 1e9` is interpolated raw into a CSS `transform: rotate(${wAngle}deg)` and `font-size:${wSize}px`. Not security-impactful (CSS is safe-ish, sanitized color), but bad input goes through unbounded.
  - Recommendation: bound `fontSize` to e.g. 8–500 and `angle` to -360..360.

- **Watermark color sanitization is incomplete** — `apps/api/src/lib/utils.ts:30-32` vs `apps/api/src/routes/generate.ts:130`
  - Finding: `sanitizeCssValue` strips `;{}\\` but allows `*/...` and CSS function calls (`expression(...)` is legacy IE but `url(javascript:...)` style values are theoretically still parseable in printing contexts). Watermark color goes through `sanitizeCssValue` only.
  - Recommendation: validate that color matches a strict allowlist (`#hex`, `rgb()`, `rgba()`, named) via regex instead of strip-list.

- **`marketplace.ts` `has_more` lies** — `apps/api/src/routes/marketplace.ts:48`
  - Finding: `has_more: results.length === limit` is true when the page is exactly full, even if it was the last page. Compare with `generations.ts:54-59` which correctly fetches `limit + 1` to detect.
  - Recommendation: fetch `limit + 1` and slice, like the generations route.

- **`integrations.ts` polling triggers return raw arrays** — `apps/api/src/routes/integrations.ts:39-52, 69-78`
  - Finding: Every other list endpoint returns `{ data: [...] }`. Zapier polling triggers return a bare top-level array. Inconsistent with the API's own conventions; harder to evolve (you can never add metadata fields).
  - Recommendation: wrap in `{ data: [...] }` to match other list endpoints, or document why Zapier specifically needs the bare-array shape.

- **`integrations.ts` generate action bypasses watermark, fonts, react, barcodes, and webhooks** — `apps/api/src/routes/integrations.ts:93-154`
  - Finding: Third PDF-generation code path in addition to `generate.ts` and `queue.ts` — also drifted. Doesn't process barcode placeholders, doesn't inject user fonts, doesn't honor watermarks, doesn't deliver webhooks. A user who sets up a custom font in the dashboard will find Zapier ignores it.
  - Recommendation: route through the same shared `generatePdf()` service after extracting it (see P1 duplication above).

- **`routes/webhooks.ts` does `await import('../lib/logger.js')` at runtime** — `apps/api/src/routes/webhooks.ts:112, 116`, also `routes/billing.ts:85, 93`
  - Finding: Dynamic imports of a stateless logger module on every error path. There's zero reason for this — the logger is module-level and side-effect-free at top level. This is cargo-culting around (likely) circular-import fears.
  - Recommendation: top-level `import { logger } from '../lib/logger.js'`.

- **`routes/webhooks.ts` Svix signature parsing breaks if Svix changes format** — `apps/api/src/routes/webhooks.ts:41-48`
  - Finding: Hand-rolled `svixSignature.split(' ').map((s) => s.split(',')[1])` instead of using the `svix` npm package. The package is the source of truth for the format; this regex will silently fail on any format addition.
  - Recommendation: add `svix` dependency, use `Webhook.verify()`.

- **Mixed pagination styles across list routes** — `routes/generations.ts:38-76` (cursor + offset), `routes/templates.ts:64-72` (offset-less, capped at 100), `routes/marketplace.ts:18-50` (offset-only with broken has_more), `routes/integrations.ts:30-37` (no pagination, capped at 100)
  - Finding: Four different pagination conventions in the same API. SDK users have to handle each route differently.
  - Recommendation: pick one (cursor-based, the most modern one already in generations.ts) and apply uniformly.

- **`renderer.ts` imports `BrowserContext` but never uses it** — `apps/api/src/services/renderer.ts:1`
  - Finding: `import { chromium, Browser, BrowserContext } from 'playwright';` — `BrowserContext` is unused. Minor but indicative.
  - Recommendation: remove.

- **Dead `bars` computation in `replaceBarcodesSync`** — `apps/api/src/services/barcodes.ts:61-78`
  - Finding: `const bars = value.split('').map(...).join('');` — 18 lines of work, then `bars` is never used. The actual barcode rendering is in the loop starting line 81.
  - Recommendation: delete lines 60-78.

- **Comment lies: "Code128-like"** — `apps/api/src/services/barcodes.ts:80`
  - Finding: The "barcode" pattern is `(code * 3) % 3`, `(code * 11) % 3`, etc. — pure hash bits, not a Code128 encoding at all. No reader will decode this. Marketing this as a barcode is dishonest.
  - Recommendation: either use a real Code128 lib (`jsbarcode`) and document, or rename to "visual barcode-style decoration" and document.

- **`pdf-tools.ts:121-152 /protect` does NOT protect the PDF** — `apps/api/src/routes/pdf-tools.ts:103-152`
  - Finding: Route is called `protect`, schema requires `owner_password`, response returns `protected: true`. The implementation only sets the document title, producer, and creator — it never encrypts, never sets a password, never sets permissions. Returns `protected: true` to caller anyway.
  - Recommendation: either remove the route, or rename it and remove the password fields, or wire up actual `qpdf` encryption. Returning `protected: true` for an unprotected PDF is fraud.

- **`base64Size` math is wrong** — `apps/api/src/routes/pdf-tools.ts:21-26`
  - Finding: `validateBase64Size` computes `estimatedBytes = Math.ceil(b64.length * 0.75)` and compares to `MAX_PDF_BASE64_SIZE * 0.75` (where `MAX_PDF_BASE64_SIZE = 50_000_000`). The threshold becomes `37_500_000` decoded bytes — but the schema separately enforces `b64.length <= 50_000_000`. The user can submit a 50MB base64 string (decodes to ~37MB) and pass the schema, then this fn checks `Math.ceil(50_000_000 * 0.75) = 37,500,000 > 37,500,000`? No, it's `>`, so 50MB base64 just barely passes. The math is so convoluted that the actual enforced limit isn't obvious to anyone reading.
  - Recommendation: state the intent: max decoded size = N bytes, max base64 size = ceil(N * 4/3). One constant.

- **AI route uses `as any` to discard Claude response type** — `apps/api/src/routes/ai.ts:80-99`
  - Finding: `const result = await response.json() as any; const content = result.content?.[0]?.text || '';` — no schema validation of the API response, so a Claude response shape change silently returns empty string instead of erroring. The detected-vars regex also misses Handlebars block helpers like `{{#each items}}` and just blacklists `#each` / `/each` strings after the dot-path regex strips them.
  - Recommendation: parse with Zod, treat shape mismatch as `AI_ERROR`.

- **`@font-face` CSS injection from `font.family`** — `apps/api/src/services/fonts.ts:196-200`
  - Finding: `font-family: '${font.family.replace(/'/g, "\\'")}';` — only escapes single quotes. A `family` value containing `;` or newline injects arbitrary CSS. Family is user-controlled (form input in `routes/fonts.ts`).
  - Recommendation: validate family at upload (regex `[\w\s\-]+`).

- **`createPortalSession` throws `Error` instead of a typed `AppError`** — `apps/api/src/services/stripe.ts:96` (also lines 21, 69, 123)
  - Finding: Bare `throw new Error('No Stripe customer found for this user')` falls through to `errorResponse()` and becomes a 500 `INTERNAL_ERROR` — when it's really a 404 / 400. Same with "STRIPE_SECRET_KEY is not configured" (should be 503).
  - Recommendation: throw `NotFoundError('Stripe customer')` and `AppError(503, ...)`.

- **`stripe.ts` `as any` swallows plan type** — `apps/api/src/services/stripe.ts:139, 201`
  - Finding: `.set({ plan: plan as any })` discards type safety on a column with a strict pg enum. If Stripe metadata gets a typo'd plan, the DB will reject at runtime with a generic error.
  - Recommendation: narrow plan via a `parsePlan(string): Plan | null` helper.

- **Stripe `customer.subscription.updated` is silent if subscription was never inserted** — `apps/api/src/services/stripe.ts:172-205`
  - Finding: `db.update(stripeSubscriptions).set(...).where(eq(...))` updates zero rows if the `checkout.session.completed` event hadn't been processed yet (out-of-order delivery, retries, partial state). Then the `select ... where stripeSubscriptionId = sub.id` returns no rows and the user's plan never syncs.
  - Recommendation: `onConflictDoUpdate` upsert on the subscription, then sync plan.

- **`apikeys.ts` calls function `apiKeyId()` to mint the *raw key string*, not the row id** — `apps/api/src/services/apikeys.ts:12, 14, 16-24`
  - Finding: `apiKeyId()` from `lib/id.ts:8` generates `df_live_<nanoid>`. In `createApiKey`, `rawKey = apiKeyId()` is the user-facing secret. The DB row `apiKeys.id` is a UUID (auto-generated by schema). So the `apiKeyId` name implies it's the id of an `apiKey` row but it's actually the raw secret token.
  - Recommendation: rename to `apiKeyToken()` or `generateApiKey()`.

- **`safeParseInt` defaults silently when input is invalid** — `apps/api/src/lib/utils.ts:20-24`
  - Finding: For `?limit=foo`, returns the default (50) instead of throwing 400 — debugging is harder because the caller never knows the input was bad.
  - Recommendation: at least log; ideally surface as ValidationError when query param is present-but-malformed.

- **`generate.ts` UPDATE+INSERT pattern races on concurrent generation** — `apps/api/src/routes/generate.ts:158-218`
  - Finding: `db.insert(generations).values({ status: 'processing' })` → render → `db.update(... status: 'completed')`. If render takes 30s and the DB connection drops mid-render, the generation row sticks at `processing` forever. No reconciliation worker, no TTL.
  - Recommendation: add a cleanup job to mark stale `processing` rows as `failed` after N minutes.

- **`mergeTemplate` recompiles the Handlebars template on every call** — `apps/api/src/services/templates.ts:7-9`
  - Finding: `Handlebars.compile(htmlContent, { knownHelpersOnly: true })` runs on every PDF generation, even though most users generate the same template thousands of times. Templates have stable `id+version` — cacheable.
  - Recommendation: LRU cache keyed by `(templateId, version)`.

- **`react-renderer.ts` hard-codes a `Helvetica Neue, Arial` fallback into every component** — `apps/api/src/services/react-renderer.ts:113-115`
  - Finding: The renderer injects a global CSS reset + font into every React-rendered document. There's no opt-out. If a user uploads a custom font and uses React mode, the injected `body { font-family: ... }` overrides nothing because of specificity but the comment doesn't make that promise clear.
  - Recommendation: make the wrap configurable, or just emit the body markup and let the user supply the HTML scaffold via `styles`.

### P2 — polish

- **Implicit `parseInt` in body size check** — `apps/api/src/index.ts:87`
  - Finding: `parseInt(contentLength)` without radix and without NaN handling. Malformed `content-length: 0x100` parses to 0 and bypasses the 10MB guard.
  - Recommendation: `parseInt(contentLength, 10)` and reject NaN.

- **`stripe.ts` API version cast as `any`** — `apps/api/src/services/stripe.ts:23`
  - Finding: `apiVersion: '2025-01-27.acacia' as any` — Stripe SDK has typed `StripeAPIVersion` literals. Today's `as any` will hide a breaking-change incident tomorrow.
  - Recommendation: pin to the typed literal and bump alongside SDK upgrades.

- **Body-size middleware lives inline in `index.ts`** — `apps/api/src/index.ts:85-91`
  - Finding: Body-size enforcement is a 6-line inline middleware in the router, not a named middleware in `middleware/`. The 10MB limit is also magic.
  - Recommendation: extract to `middleware/bodySize.ts` with the limit as a constant.

- **`generate.ts` watermark uses bold sans-serif hardcoded** — `apps/api/src/routes/generate.ts:131`
  - Finding: `font-family:Arial,sans-serif;font-weight:bold` is hardcoded into the watermark, ignoring the user's `watermark` config (no `fontFamily` / `fontWeight` options).
  - Recommendation: add options or document the restriction.

- **`generations.ts` keeps `offset` as "backward compat"** — `apps/api/src/routes/generations.ts:42`
  - Finding: Comment says "kept for backward compat" but the comment doesn't say when it'll be removed, and the SDK code likely still uses it. Tech debt with no expiration.
  - Recommendation: remove or commit to a deprecation date.

- **Three different `plan` allowlists** — `apps/api/src/middleware/rateLimit.ts:6-11`, `apps/api/src/services/usage.ts:5-10`, `apps/api/src/routes/billing.ts:23`
  - Finding: `PLAN_RATE_LIMITS`, `PLAN_LIMITS`, and the billing checkout validator each maintain their own plan name lists. Adding a `team` plan means editing three files.
  - Recommendation: centralize in `lib/plans.ts` (rates, monthly limits, displayable names, Stripe price ids).

- **`scheduleDripTick` may double-schedule on restart** — `apps/api/src/services/drip.ts:322-332`
  - Finding: `dripTickQueue.add('tick', ..., { jobId: 'drip-tick-scheduler', repeat: { pattern: '0 * * * *' } })` — `jobId` prevents duplicates of the *delayed* job, but the repeatable job's underlying scheduled keys aren't always idempotent across BullMQ versions if the pattern changes. Comment doesn't note this.
  - Recommendation: call `queue.removeRepeatableByKey()` before re-adding on startup, or document the version assumption.

- **`integrations.ts` `parseInt` without radix** — `apps/api/src/routes/integrations.ts:30, 60`
  - Finding: `parseInt(c.req.query('limit') || '10')` — see `safeParseInt`, which already exists in `lib/utils.ts`. Same in `routes/marketplace.ts:19-20`.
  - Recommendation: use `safeParseInt` everywhere.

- **`webhooks.ts` (Clerk handler) creates new pino logger child via dynamic import** — `apps/api/src/routes/webhooks.ts:112-117`
  - Finding: Already covered above; specifically the `as { id: string } | undefined` casts in `index.ts:138` are a sign that `ContextVariableMap` types aren't pulled into all files (Hono context augmentation works only if `middleware/auth.ts` is imported in the file, which it isn't in `index.ts`).
  - Recommendation: declare the context augmentation in a `types.d.ts` once and reference globally.

- **Renderer JSON-parses the PDF page count via a regex over binary** — see P1 above (page count). Severity-overlap.

- **No request-id propagation** — `apps/api/src/middleware/logging.ts:5-19`
  - Finding: `requestId` is logged on the request-completion line only. It is never set as a header (`X-Request-Id`) on the response and never threaded through error logs in `app.onError`.
  - Recommendation: set `c.header('X-Request-Id', requestId)` and include it in `recordApiError` plus the `errorResponse` body.

- **Inline IP parsing repeated** — `apps/api/src/middleware/ipRateLimit.ts:13-15`
  - Finding: `x-forwarded-for` parsing is reasonable but only lives here. There's no shared `getClientIp(c)` helper. If you later add IP-based abuse blocking elsewhere, the parsing will diverge.
  - Recommendation: `lib/request.ts` with `getClientIp(c)`.

- **`@font-face` URL path constructed differently for local vs cloud** — `apps/api/src/services/fonts.ts:191-194`
  - Finding: Local URL embeds `font.userId` in the path (`/fonts/${font.userId}/${font.id}.${format}`), cloud URL uses `font.storageKey` which is `fonts/${userId}/${id}.${format}`. They happen to align, but a refactor that touches one will silently break the other.
  - Recommendation: share a `getFontPublicUrl(font)` helper.

- **`pdf-lib` dynamic-imported in protect route only** — `apps/api/src/routes/pdf-tools.ts:128`
  - Finding: Every other handler in the file imports `pdf-lib` indirectly via services, but `/protect` does `const { PDFDocument } = await import('pdf-lib');` inline. Inconsistent and adds latency.
  - Recommendation: top-level import or move logic to `services/pdf-utils.ts`.

- **`drip.ts` `enqueued` accumulator uses Record keyed by string union** — `apps/api/src/services/drip.ts:251-258`
  - Finding: Six campaigns enumerated but `welcome` and `first_pdf` are never incremented inside `runDripTick`. The shape implies all are tracked; misleading.
  - Recommendation: narrow to the campaigns the tick actually enqueues, or document the asymmetry.

- **Hard-coded production fallback URL in service code** — `apps/api/src/services/drip.ts:78`
  - Finding: `return process.env.DASHBOARD_URL || 'https://app.getdocuforge.dev';` — a production URL baked into a fallback is a source of bugs (sending real emails with prod links from a dev box that forgot the env var).
  - Recommendation: in non-prod, throw if `DASHBOARD_URL` is unset.

- **Hard-coded fallback Stripe price IDs** — `apps/api/src/services/stripe.ts:11-12`
  - Finding: `process.env.STRIPE_STARTER_PRICE_ID || 'price_starter'` — the fallback is a literal-string price ID that won't exist in Stripe. Better to throw than to call Stripe with garbage.
  - Recommendation: refuse to start if Stripe is configured but prices aren't.

- **`generate.ts` constants live inline** — `apps/api/src/routes/generate.ts:34-35`
  - Finding: `MAX_HTML_SIZE` and `MAX_REACT_SIZE` are both `5_242_880` and duplicate the body-size cap math in `index.ts`. Three independent size constants govern the same data flow.
  - Recommendation: pull into a `lib/limits.ts`.

- **`/generations` route includes `error` only on single-get, not on list** — `apps/api/src/routes/generations.ts:25-35` vs `61-72`
  - Finding: The single-get returns `error: gen.error`; the list omits `error`. Users querying for failed generations have to fetch each individually.
  - Recommendation: include `error` on the list response too.

- **`mergeTemplate` re-sanitizes & re-validates every call** — `apps/api/src/services/templates.ts:5-6`
  - Finding: For batch flows that share `data`, you re-walk the object on every render. Negligible for small payloads, but tiny duplication.
  - Recommendation: low priority — accept.

- **`apikeys.ts` `listApiKeys` always returns `${prefix}...`** — `apps/api/src/services/apikeys.ts:53`
  - Finding: List shows `prefix...` but does NOT include the last-4 like `createApiKey` does (line 30: `${keyPrefix}...${rawKey.slice(-4)}`). After creation users see a "df_live_abcd...wxyz" indicator; after refresh they see "df_live_abcd..." — they can no longer disambiguate.
  - Recommendation: store the last-4 alongside the prefix in the DB.

### P3 — taste

- **`replaceQrCodes` `matches.length === 0` early-return is a micro-optim** — `apps/api/src/services/barcodes.ts:23-24`
  - Recommendation: keep, but inconsistent with `replaceBarcodesSync` which lets `replace()` no-op naturally.

- **`safeParseInt` allows zero but `parseInt(value || String(defaultVal))`** — `apps/api/src/lib/utils.ts:21`
  - Finding: `value || String(defaultVal)` — when value is `'0'`, it's truthy and the default isn't used; when value is `''`, falls back. Fine, but the logic is more legible as `value == null ? defaultVal : parseInt(value, 10)`.

- **`ipRateLimitMiddleware` doesn't expose `X-RateLimit-Reset`** — `apps/api/src/middleware/ipRateLimit.ts:31-32`
  - Finding: Authenticated rate limiter sets `X-RateLimit-Reset`, IP one doesn't.
  - Recommendation: match.

- **`templates.ts` PUT silently allows empty `html_content` only if schema has `min(1)`** — `apps/api/src/routes/templates.ts:20`
  - Finding: Update sets `html_content?` with `min(1)` — so passing `""` is rejected, but passing `undefined` doesn't update — fine. The version-bump only happens when `html_content` is set. If a user fixes a typo in `name`, version isn't bumped. Intentional? Document it.

- **Unused `BrowserContext`, unused `Hono` Next import** — covered

- **`route(...)` chain in `index.ts` has 14 lines of repetition** — `apps/api/src/index.ts:95-107`
  - Finding: An iteration over a `[path, app]` array would be tighter, but it's a wash. Pure taste.

- **`scripts/starter-templates.ts` dynamically imported in `index.ts` for one route** — `apps/api/src/index.ts:111-113`
  - Finding: Lazy-loading a static asset for a route that's hit by every cloning user is needless. The bundle benefit isn't real because every other route already pulls the whole codebase.
  - Recommendation: top-level import.

- **`marketplace.ts` `let query = db.select(...).where(...).orderBy(...).limit(...).offset(...)` and then `await query`** — `apps/api/src/routes/marketplace.ts:23-38`
  - Finding: The `category` query param is read but never used in the filter. Either implement category filtering or remove the param.

- **`api-errors.ts` truncates path but not method** — `apps/api/src/services/api-errors.ts:42`
  - Finding: `input.method.slice(0, 10)` — methods are <= 7 chars, the slice is dead.
  - Recommendation: drop it.

## Cross-cutting themes

- **Three-pipeline PDF generation drift.** `routes/generate.ts`, `services/queue.ts`, and `routes/integrations.ts:/actions/generate` all do "resolve input → render → upload → record → bill → webhook" with subtly different feature sets. Watermark, custom fonts, barcodes, and webhooks are present in different subsets of these three. The same PDF request returns different output depending on which endpoint took it.

- **Environment access is unstructured.** A typed `env` object exists in `lib/env.ts` but every consumer reads `process.env.*` ad-hoc. There are at least three "default if missing" idioms (`|| 'fallback'`, `?? null`, `!` non-null assertion). Adding a new env var has no canonical home.

- **Error handling inconsistent across routes.** Some routes throw typed `AppError`s and rely on `app.onError` (templates, generate, keys); others manually return `c.json({ error: { code, ... } }, statusCode)` (billing, starter-templates); one returns `{ error: 'string' }` (clerk webhook). For an HTTP API selling itself as "Stripe for PDFs", this is sloppy.

- **Pagination conventions are not unified.** Cursor vs offset vs nothing-at-all across list endpoints. `has_more` is computed correctly in one route and wrong in another. List response wrapper (`{ data: [...] }` vs bare array) varies.

- **Service modules embed their own configuration logic instead of accepting injected config.** `fonts.ts`, `storage.ts`, `stripe.ts`, `email.ts`, `drip.ts`, `queue.ts` each construct clients at module load using `process.env`. Side effects at import time make testing painful (see the `delete process.env.R2_ACCOUNT_ID` dance in `__tests__/storage.test.ts:29`). A small DI step — pass config in, return a factory — would remove the test hacks.

- **Code duplication across PDF/font storage paths.** Two complete S3 client wirings, two `parseRedisConnection` implementations, two `escapeHtml` variants (lib/utils + inline in barcodes.ts), three places where `STORAGE_PROVIDER` is branched.

- **Dynamic imports used to paper over architectural issues.** `await import('../lib/logger.js')` inside error handlers, lazy loading of `starter-templates` in `index.ts`, lazy `pdf-lib` import in one of many pdf-tools routes. None of these are needed; they suggest fear of (nonexistent) circular imports or premature lazy-loading.

- **Type-safety escape hatches in money-handling code.** `as any` on Stripe `apiVersion`, plan enum, and AI response shape. Each one is a place where a future SDK or API change won't get caught at build time.

- **"Fire-and-forget" used inconsistently.** `db.update(apiKeys).set({ lastUsedAt }).catch(...)` is the only Drizzle call I saw that does this correctly with a `.catch`. Many other `void someAsync()` calls (`maybeCelebrateFirstPdf`, webhook deliveries, idempotency cache puts) have no `.catch` on the underlying promise — relying on Node's unhandled-rejection handler to log, which is just `logger.error({ err })` and easy to miss.
