# Performance & Infrastructure — Teardown

Scope: runtime perf, scaling, infra config. Backend code quality, security, DB indexes, tests, and frontend bundle/perf are owned by other agents and out of scope here.

## TL;DR

This service will fall over at ~5–10 RPS sustained PDF generation on its current Fly box. The "2 Chromium browsers × 100 reuses, round-robin" pool advertised in CLAUDE.md is real, but it is:

- (a) shared by an HTTP handler with effectively unlimited per-request concurrency (Fly soft limit 80) AND a BullMQ worker with concurrency 5 in the SAME Node process — every queued and synchronous request fights over 2 browsers.
- (b) round-robin without idle/busy tracking — under load Playwright contexts pile up inside the same Browser, each spawning a Chromium renderer subprocess (~80–150MB), and 2GB of Fly RAM is gone in under a minute.
- (c) recycling races: `recycleBrowser` calls `browser.close()` on a Browser reference that was just handed out (line 77 returns `entry.browser` BEFORE the recycle decision could complete), so any concurrent `newContext()` against that handle will throw.
- `page.setContent(..., { waitUntil: 'networkidle' })` with NO timeout — a single user-supplied HTML with an unresolvable `<img src>` or a `keep-alive` SSE can hang a worker indefinitely. This is the biggest hot-path latency and reliability footgun in the codebase.

Other landmines:
- BullMQ jobs use default `lockDuration` of 30s; many PDF jobs (large templates, networkidle waits, retries) exceed 30s and will be marked stalled and re-executed — leading to **duplicate PDFs, duplicate usage charges, duplicate webhooks**.
- Drip tick runs every hour via BullMQ repeat with `attempts: 1` and no idempotency on the tick itself; concurrent ticks across rolling deploys will duplicate-enqueue. The enqueue path is idempotent at the per-(user,campaign) row level, so duplicates are caught — but the tick scans the full users table every hour with two big NOT EXISTS subqueries that are quadratic with table growth.
- Rate limit "circuit breaker" is a process-local counter (`consecutiveFailures`) that opens at 11 failures and never closes deterministically — it relies on the next successful Redis call to reset. While Redis is down, every concurrent request increments it and they all start rejecting at once. Fail-closed under partial Redis failure is the worst combination.
- Dockerfile (root) is single-stage, ships build toolchain + esbuild + tsx + pnpm cache + node_modules in the runtime image. Easily 1.5–2GB. `apps/api/Dockerfile` does multi-stage but is referenced only by `fly.toml`; `docker-compose.selfhost.yml` uses the bad one.
- Fly config has `auto_stop_machines = "suspend"` with `min_machines_running = 1` — Playwright + initial browser pool warmup is 3–8s, but `grace_period = "15s"` is barely adequate and the `/health` endpoint returns 200 the instant the HTTP listener starts (i.e. before the browser pool is ready). First request post-cold-start will hit a NOT-warm pool, trigger lazy `initialize()`, and serve a 30s+ response.
- No request-correlation IDs propagate into pino logs from downstream services (only the logging middleware emits one log line with the id). PDF gen time isn't exported as a metric anywhere; no histogram, no percentile tracking. Sentry DSN env is declared but `@sentry/node` is **not installed and never initialized** — observability is logs-only.
- Browser launch args do NOT include `--single-process`, `--no-zygote`, `--js-flags=--max-old-space-size=…`, font preloading, or `--disable-extensions`. Each Chromium uses 80–150MB resident; 2 browsers + Node ≈ 400–500MB baseline. Each concurrent render adds a renderer process (~80MB). At Fly's soft_limit 80 the box is dead.

This needs a hard cap on concurrent Playwright contexts, real timeouts, BullMQ `lockDuration` raised, and a separate worker process from the HTTP server.

## What's actually good

- Browser launch flags include `--disable-dev-shm-usage` (correct for containers — Chromium will OOM in /dev/shm otherwise).
- `javaScriptEnabled: false` on the rendering context (faster, safer, blocks the entire class of "fetch from your internal network" exploits via JS).
- Pages counted by regex on the PDF stream — cheap, no extra Playwright call.
- `usageCount` recycle threshold (100) exists and is async — the intent is right.
- BullMQ `removeOnComplete: { count: 1000 }` / `removeOnFail: { count: 500 }` caps keyspace growth.
- Webhook delivery has its own retry loop, timeout, SSRF protection, and signing.
- pg pool has `max: 20` and `connectionTimeoutMillis: 5000` — sane defaults.
- Idempotency caching uses Redis `EX 86400` — TTL is correct, won't leak.
- `apps/api/Dockerfile` is genuinely a 2-stage build with `--prod` install.
- Rate limit headers (`X-RateLimit-*`) exposed via CORS — good.
- Hourly drip tick is on a separate queue (`drip-tick`) from the sender queue (`drip-campaign`) so a slow tick can't block sends.
- `removeOnComplete` keeps queue keyspace bounded.
- `serveStatic` for PDFs/fonts is hidden behind explicit prefixes (`/files/*`, `/fonts/*`) — good.

## Findings

---

### P0 — Browser pool returns a stale reference at the moment of recycle (data race)
`apps/api/src/services/renderer.ts:66-77`
```ts
const entry = this.browsers[this.currentIndex % this.browsers.length];
this.currentIndex++;
entry.usageCount++;
if (entry.usageCount >= this.maxUsagePerBrowser) {
  this.recycleBrowser(idx).catch(...);   // closes entry.browser asynchronously
}
return entry.browser;                     // <-- returned BEFORE close races
```
`recycleBrowser` calls `await old.browser.close()` while the caller of `getBrowser` is about to `browser.newContext()` on that same handle. Under any concurrency, the 100th request to that browser will succeed in `getBrowser`, then immediately race with `close()` and throw `BrowserClosedError`. The user gets a 500.
Fix: take the entry out of the pool before recycling. Hand out from a free list, return-to-pool after `context.close()`, and recycle only after the entry is returned and refcount=0.

---

### P0 — `page.setContent` and `page.pdf` have no timeout — single bad input pegs a renderer thread
`apps/api/src/services/renderer.ts:133,164`
`waitUntil: 'networkidle'` blocks until there are zero in-flight requests for 500ms. A `<img src="https://slow-cdn/x">` with no upstream response, an SSE/`keep-alive` upstream, or a `<link rel="preconnect">` chain will hang for the global Playwright default (30s) — and there is no per-call override. Combined with the BullMQ default `lockDuration` of 30s (see P0 below), each hang gets re-tried 3× and burns a browser slot for 90+ seconds.
Fix: pass `{ waitUntil: 'load', timeout: 8000 }` to `setContent`, and `{ timeout: 15000 }` to `page.pdf`. Or call `page.setDefaultTimeout(15000)` after `newPage()`.

---

### P0 — BullMQ default `lockDuration` (30s) is shorter than realistic PDF gen for batch jobs
`apps/api/src/services/queue.ts:56-65,190`
A 10-page Handlebars template with QR + barcode + custom font + networkidle wait routinely takes 3–10s. Under concurrency 5 sharing 2 browsers, jobs queue inside the worker and easily exceed 30s wall time. BullMQ then re-delivers as "stalled" → **the job runs again**, which means:
- a second PDF render runs end-to-end
- `incrementUsage` runs twice → user is double-billed
- `deliverWebhook` fires twice
- the generation row gets two `update set status='completed'` writes
None of the side effects are idempotent.
Fix: set `lockDuration: 120_000` (or longer for batch), `maxStalledCount: 1`, and gate webhook + usage on `ON CONFLICT DO NOTHING` against a `(generation_id, side_effect)` table, or use `removeDependencyOnFailure` and wrap the side-effects in a `SELECT ... FOR UPDATE` on the generation row.

---

### P0 — HTTP path and BullMQ worker share the same in-process browser pool
`apps/api/src/index.ts:171-175`, `apps/api/src/services/queue.ts:191`
The same Node process runs (a) Hono accepting up to Fly's soft_limit=80 / hard_limit=100 concurrent HTTP requests, AND (b) a BullMQ worker with `concurrency: 5`. Both pull from a shared 2-browser pool. At 10 RPS the worker is already starved and the HTTP path latency p95 goes through the roof. There is no semaphore around the pool.
Fix: split into two services on Fly (`docuforge-api` + `docuforge-worker`), or at minimum add an explicit `Semaphore(MAX_CONCURRENT_RENDERS)` in `renderer.ts` so we never have more than N≈4 concurrent contexts. With 2 browsers and ~100MB per renderer process you cannot run more than ~12 in 2GB; 4 is a safe ceiling.

---

### P0 — Rate-limiter "circuit breaker" fails closed under partial Redis failure
`apps/api/src/middleware/rateLimit.ts:13,46-56`
`consecutiveFailures` is a module-level counter. The 12th call after Redis goes down throws 503 to **every** request, indefinitely, until exactly one Redis call succeeds. With concurrent requests, all in-flight calls increment the counter racily — the 503 cliff actually arrives faster than 11 sequential failures. Worse: when Redis returns, requests racing on a recovering Redis still see intermittent failures and the counter never gets to reset. This is the most dangerous fail-closed pattern: the moment Redis blips for 3 seconds during a normal restart, the API is **fully down** for every authed user, and stays down longer than the Redis outage itself.
Fix: replace with a proper rolling-window breaker (e.g. opossum, or a small "trip until next 30s window" timer). Fail-open is correct for a rate limiter — log loudly but allow traffic.

---

### P0 — Health check is "200 OK" before browser pool is warm; suspended machines have a 5–10s cold start
`apps/api/src/routes/health.ts:5-11`, `apps/api/src/index.ts:171-182`, `fly.toml:14,23-28`
`/health` returns 200 immediately when the HTTP listener binds. But the listener binds INSIDE `serve(...)` which is called AFTER `browserPool.initialize()` (good) — yet `min_machines_running = 1` plus `auto_stop_machines = "suspend"` means resumed machines re-execute the warm path lazily because `initialize()` is only called once on cold start, not on resume.

Worse, the very first `getBrowser()` call on a fresh machine triggers `initialize()` lazily if it wasn't pre-warmed (line 61–63), so request #1 on cold start eats the 2–3 second `chromium.launch()` cost twice. P95 cold-start TTFB is 5–10s and the user has no way to know.
Fix: have `/health` return 503 until `browserPool` exposes `isReady() === true`. Add a `/ready` distinct from `/health` and point Fly's health check at it. Raise `grace_period` to `45s`.

---

### P0 — Single-stage root `Dockerfile` ships pnpm + tsup + esbuild + full source in the runtime image
`Dockerfile:1-71`, `docker-compose.selfhost.yml:8`
Used by `docker-compose.selfhost.yml`. It does NOT do a multi-stage build, NOT prune dev deps, NOT exclude `apps/api/src/`. Final image will easily exceed 1.5GB plus the Playwright Chromium download (~280MB). Cold pulls in CI are slow, registry storage burns, and the attack surface includes the compiler. The good multi-stage Dockerfile is at `apps/api/Dockerfile` but is only used by Fly. Self-hosters get the heavy one.
Fix: either delete the root `Dockerfile` and point `docker-compose.selfhost.yml` at `apps/api/Dockerfile`, or rebuild the root one as multi-stage.

---

### P1 — Browser pool ignores busy/idle state — round-robin overloads the same instance
`apps/api/src/services/renderer.ts:60-78`
Round-robin assignment with no awareness of in-flight contexts means under N concurrent requests, both browsers each get N/2 simultaneous contexts. Chromium handles this by spawning N/2 renderer subprocesses per browser. At 10 concurrent requests on a 2-browser pool you have 10 renderer subprocesses across 2 browsers — `~80MB × 10 = 800MB` of renderer + 2×200MB of master Chromium = **1.2GB just for browsing**. Fly box has 2GB. Node, BullMQ, pg connection pool eat another 300MB. You will OOM.
Fix: use a free-list pattern — track which browser has zero in-flight contexts and prefer it; otherwise queue.

---

### P1 — Worker concurrency=5 with only 2 browsers means 2.5× contention
`apps/api/src/services/queue.ts:191`, `apps/api/src/services/renderer.ts:27`
Worker concurrency should not exceed available render slots. With `maxBrowsers = 3` (currently capped at 2 in `_init`), worker concurrency 5 means 5 contexts on 2 browsers → 2.5 contexts/browser, all racing. Either raise pool to 5 or lower concurrency to 2.
Fix: derive worker concurrency from pool size at runtime, or set `concurrency: Math.max(2, pool.size)` and never higher.

---

### P1 — `chromium.launch()` not configured for low-memory containers
`apps/api/src/services/renderer.ts:49-55,88-95`
Missing critical args for prod Chromium:
- `--no-zygote` (prevents extra fork)
- `--disable-extensions`
- `--disable-features=site-per-process,IsolateOrigins` (each origin = renderer process)
- `--js-flags=--max-old-space-size=512` (cap V8 heap per renderer)
- `--font-render-hinting=none` (smaller frames)
- `--mute-audio`, `--hide-scrollbars`
At 2GB Fly RAM you need every megabyte. `site-per-process` alone can 3× renderer count for any page with cross-origin iframes/images.
Fix: add the above flags. Document them in a comment.

---

### P1 — No graceful drain on SIGTERM — in-flight jobs lost
`apps/api/src/index.ts:191-197`
`shutdown()` calls `stopWorker()` (BullMQ `.close()`) then `browserPool.shutdown()` then `process.exit(0)`. But `serve()`'s HTTP server is never closed — in-flight `POST /v1/generate` requests get their browser yanked mid-render. On Fly, the default SIGTERM-to-SIGKILL is 5s; this process never tells Fly it needs more.
Fix: call `serve.close()` (or hold a ref to the server returned by `serve()`), `await worker.close()` (waits for in-flight jobs), then close pool, then `pool.end()` (pg), then redis.quit(). Also set Fly's `kill_timeout = "30s"` in `fly.toml`.

---

### P1 — pg pool: no `pool.end()` on shutdown, no idle reaper monitor
`apps/api/src/lib/db.ts:5-12`
`max: 20` is fine, but no `pool.end()` in `shutdown()` and no `application_name` set, so when Postgres has connection pressure you can't see which app holds them. `idleTimeoutMillis: 30000` is reasonable. Bigger concern: 20 connections per Node instance × N machines × Fly auto-scaler ceiling = potential `too many connections` against a small Postgres tier (default Supabase/Neon limit 100).
Fix: lower `max` to 10 (or read from env), set `application_name: 'docuforge-api'`, call `pool.end()` in shutdown.

---

### P1 — Drip tick is full table scan with two `NOT EXISTS` subqueries — quadratic with users
`apps/api/src/services/drip.ts:261-285`
Each hourly tick runs three `zeroGenUsersBetween` queries and one `silentUsersFor`, each of which is `SELECT u.id FROM users u WHERE ... AND NOT EXISTS (SELECT 1 FROM generations WHERE user_id = u.id ...)`. With 100k users and 10M generation rows, every tick is a multi-second sequential scan. At 1M users this exceeds 1 hour and the next tick starts before the previous one finished.
Fix: maintain `users.first_generation_at` and `users.last_generation_at` columns (cheap to maintain in the generation insert path with a trigger or a `UPDATE users SET first_generation_at = COALESCE(first_generation_at, NOW())`). Index them. Tick becomes `WHERE first_generation_at IS NULL AND created_at BETWEEN ...`. Also add a per-tick lock (`SET LOCAL lock_timeout` + advisory lock) so overlapping ticks don't double-do work.

---

### P1 — Tick has no overlap protection — repeating job at `0 * * * *` on multiple instances will duplicate
`apps/api/src/services/drip.ts:322-332`, `apps/api/src/index.ts:175`
`scheduleDripTick()` is called from EVERY API instance on startup. BullMQ's `jobId: 'drip-tick-scheduler'` deduplicates the *scheduler* registration, but the tick itself executes on the first available worker. With multiple API replicas (Fly autoscaler), the scheduler registration will replace earlier ones repeatedly, but only one tick will fire per cron interval. However: there is **no concurrency protection within a tick run** — `tickWorker` has `concurrency: 1` (good) — yet the worker is started on every instance, so up to N instances may pick up the tick concurrently across the cluster. Race fixed downstream by `enqueueDripEmail` idempotency, but each instance does the full table scan.
Fix: pin tickWorker to one instance (single-flight via Redis lock `SET NX EX 3600` keyed by the hour bucket) before doing the scan.

---

### P1 — `runDripTick` enqueues serially (`await enqueueDripEmail(...)` in a for-loop)
`apps/api/src/services/drip.ts:288-313`
For 10k matching users that is 10k sequential DB roundtrips + 10k Redis adds. At 5ms each you've burned 50 seconds — and your "hourly" tick now becomes a 50-second event for the rest of the process. Worse, the tick is a single BullMQ job; if it fails halfway through it has `attempts: 1` (line 73), so half the users never get queued.
Fix: process in batches (`Promise.all` chunks of 50), and either retry or persist a high-water-mark per campaign so a retry resumes.

---

### P1 — `maybeCelebrateFirstPdf` runs `COUNT(*)` on every successful generation
`apps/api/src/services/drip.ts:226-240`, called from `generate.ts:193,222` and `queue.ts:133,163`
`SELECT COUNT(*) FROM generations WHERE user_id = $1 AND status = 'completed'` is fired on **every** PDF for every user, forever. This is O(generations per user) per request. A power user with 10k PDFs pays 10k tuples per render. The hot path now has an unbounded query.
Fix: add `first_generation_at` column to users; set on insert only if NULL; check `users.first_generation_at == NOW()` in the same row update. One UPDATE returns the answer.

---

### P1 — Idempotency key cache is implicit-cooperative — only the `/batch` route checks it
`apps/api/src/routes/batch.ts:59-70,137-144`
The cache write happens AFTER the request fully succeeds (line 140). If two requests with the same `Idempotency-Key` arrive within ~50ms of each other (a retry from a flaky network), BOTH miss the cache, BOTH enqueue 100 batch jobs, BOTH cache their response — second response overwrites the first. User sees one batch but gets billed for two.
Fix: use `SET NX EX 86400` with a placeholder before processing; release the placeholder if the request fails. Or use Redis Lua to atomically claim+cache the request body hash.

---

### P1 — `getFontCssForUser` runs a DB query on the hot path of every generation
`apps/api/src/routes/generate.ts:139`, `apps/api/src/services/fonts.ts:175-204`
Every `POST /v1/generate` runs `SELECT ... FROM custom_fonts WHERE user_id = ?`. For users with zero fonts (the 99% case) you still pay one network roundtrip and one query. At 100 RPS that's 100 extra queries/s for zero benefit.
Fix: cache the result keyed by `user_id` in Redis with a 60s TTL, or in a process-local LRU with `customFonts` versioned in the user row.

---

### P1 — Local-storage `mkdir` runs on every PDF when STORAGE_PROVIDER=local
`apps/api/src/services/storage.ts:108-111`
`await mkdir(LOCAL_STORAGE_DIR, { recursive: true })` runs on every upload. It's idempotent but a syscall each time. Move to startup.
Fix: `ensureDir()` once at module load.

---

### P1 — `processBarcodes` runs `replace` once per QR match — N² in HTML size
`apps/api/src/services/barcodes.ts:24-46`
```ts
let result = html;
for (const match of matches) {
  ...
  result = result.replace(full, svg);  // each replace re-scans entire string
}
```
With M matches in an N-byte HTML this is O(N×M). For 50 QR codes in a 100KB invoice page that's 5MB of string scanning.
Fix: use a single `String.prototype.replace` with an async callback collected up front, or use `replaceAll` with a precomputed map and one pass.

---

### P1 — `Handlebars.compile` runs on every render, no template caching
`apps/api/src/services/templates.ts:7`
Every `POST /v1/generate?template=tmpl_xxx` recompiles the Handlebars template. Compile cost is non-trivial (esp. for large templates with helpers). With the same template being used 1000×/min, recompile is wasted CPU.
Fix: LRU cache keyed by `(templateId, version)` of the compiled `template` function. Cache size 100 with TTL 1h.

---

### P1 — JSON body parsing is unbounded until Hono returns from `c.req.json()` — content-length check only catches the cooperative case
`apps/api/src/index.ts:85-91`
`if (contentLength && parseInt(contentLength) > 10MB) return 413`. A client that does not send `Content-Length` (chunked encoding) bypasses the check entirely, then `c.req.json()` happily buffers gigabytes. Also `parseInt(contentLength)` silently passes `parseInt('abc')` (NaN, falsy) — header `Content-Length: 999999999999` from `"hello"` body bypasses.
Fix: use `hono/body-limit` middleware (`bodyLimit({ maxSize: 10 * 1024 * 1024 })`) which streams and aborts at the limit; trust the actual body size, not the declared header.

---

### P1 — pdf-tools `/merge` accepts 50MB base64 PDFs * up to N items but global limit is 10MB
`apps/api/src/routes/pdf-tools.ts:16,32`, `apps/api/src/index.ts:85-91`
`MAX_PDF_BASE64_SIZE = 50_000_000` (50MB base64 ≈ 37MB binary), but the v1 middleware caps the total body at 10MB. So no `/merge` request larger than 10MB total can ever succeed. Either the global limit is too small, or the per-item limit is misleading. The per-item check then runs `Math.ceil(b64.length * 0.75)` against `MAX_PDF_BASE64_SIZE * 0.75` (line 23) — that's checking estimated decoded bytes against 75% of the base64 limit. The math doesn't read right. Document the actual limit.
Fix: pick one. If we accept 50MB merges, raise body limit on `/v1/pdf/*` specifically; if not, lower `MAX_PDF_BASE64_SIZE`.

---

### P1 — `recordApiError` is fire-and-forget on the error path — silent drops
`apps/api/src/index.ts:148-156`
`recordApiError` returns a promise that is never awaited and never `.catch()`ed. If it throws (DB down during the error path, exactly when we need this most) the rejection becomes an unhandled promise. There's a global handler for that (line 202), but it just logs and continues.
Fix: `.catch((e) => logger.error({ e }, 'recordApiError failed'))`.

---

### P1 — Sentry DSN env var declared but `@sentry/node` is not installed or initialized
`apps/api/src/lib/env.ts:11`, search results show no `@sentry` imports anywhere in apps/api
Operators will set `SENTRY_DSN` thinking errors are reported. They aren't.
Fix: either install + wire `@sentry/node` (capture in `errorResponse`, set release/env, hook into `process.on('uncaughtException')`) or remove the env entry.

---

### P2 — `serveStatic` in production serves files directly from Node, no CDN, no Range support tuning
`apps/api/src/index.ts:58-77`
`/files/*` serves generated PDFs from `.storage/pdfs/` when `STORAGE_PROVIDER=local`. In prod this should never be the path, but if a misconfigured deploy lands with `local`, every PDF download is a Node syscall. Same for `/fonts/*`. Move PDFs to S3/R2 with a CDN in front (`Cache-Control: public, max-age=86400` is already set, good).
Fix: gate `serveStatic` on `NODE_ENV !== 'production'`.

---

### P2 — Logging middleware re-uses pino root logger; no child logger per request
`apps/api/src/middleware/logging.ts`, `apps/api/src/lib/logger.ts:10-12`
`createRequestLogger(requestId)` exists in `logger.ts` but is never used. Downstream services (renderer, storage, db) log via root `logger` without the requestId, so you cannot correlate a 30-second PDF render with the request that asked for it.
Fix: in `loggingMiddleware`, do `c.set('logger', createRequestLogger(requestId))`. Have downstream services accept an optional `log` param, defaulting to the root logger.

---

### P2 — Logging middleware logs every health check at INFO every 15s
`apps/api/src/middleware/logging.ts:18`, `fly.toml:23-28`
Fly hits `/health` every 15s on every machine. With min_machines_running=1 and any autoscale, you have a constant log fire-hose of `GET /health 200 1ms` lines, dominating your log volume and your bill.
Fix: skip the middleware for `/health` (and `/llms.txt`, `/llms-full.txt`), or log it at DEBUG.

---

### P2 — `loggingMiddleware` mounted with `app.use('*')` runs before route matching — runs for 404s too
`apps/api/src/index.ts:45`
Not a bug, but means every random scanner request to `/wp-login.php` gets a log line, an error log line, and an `app.notFound` call. Fine for low traffic; under a scanner storm you eat log bandwidth.
Fix: add a simple cheap denylist for common scanner paths in a static-return middleware before logging.

---

### P2 — Pages-counted-by-regex is O(N) on PDF size and misclassifies `/Pages` (object refs)
`apps/api/src/services/renderer.ts:166-168`
`pdfContent.match(/\/Type\s*\/Page[^s]/g)` runs over the whole PDF buffer as a string. For a 10MB PDF that's 10MB of latin1 string allocation, then regex over it. Also the `[^s]` lookahead is meant to exclude `/Pages` but will incidentally exclude `/Page<NUL>` boundaries.
Fix: use `pdf-lib`'s `PDFDocument.load(buffer).getPageCount()` — it's already loaded later in pdf-tools, and is O(parse time), not O(byte size).

---

### P2 — `c.set('requestId', ...)` but no `requestId` is sent back to the client
`apps/api/src/middleware/logging.ts:11`
Without `c.header('X-Request-Id', requestId)` in the response, users reporting bugs cannot give you a correlation handle. Cheap win.

---

### P2 — `expire` on rate-limit zset is set after `zadd` — TOCTOU between `expire` and `zcard`
`apps/api/src/middleware/rateLimit.ts:25-31`
Pipeline order: zremrangebyscore → zadd → zcard → expire. Pipeline is atomic via `MULTI/EXEC`-style ioredis pipeline, but `Random()` in member name (line 27) allocates one zset entry per request, never deduplicated. At 100 RPS for a hot user that's 100 set members/sec; the `zremrangebyscore` cleanup window is 1 second, so the zset can hold ~100 members at any time. Not a leak, but ~10KB of Redis RAM per active user.
Fix: use a fixed-size sliding-window counter (`INCRBY` on a key with sub-second bucket suffix) instead of a sorted-set sliding window. 10× cheaper.

---

### P2 — Redis client: no `lazyConnect: false` is the default but no `enableOfflineQueue: false` either
`apps/api/src/lib/redis.ts:6-12`
Default ioredis queues commands offline when disconnected. During Redis outage the rate-limit pipeline will queue, then flood Redis on reconnect, then time out via `maxRetriesPerRequest: 3` → throw, raise `consecutiveFailures` ten times faster than necessary. Set `enableOfflineQueue: false` so the breaker trips deterministically.

---

### P2 — `recycleBrowser` doesn't pre-warm — pool effectively shrinks during recycle window
`apps/api/src/services/renderer.ts:80-97`
`recycleBrowser` closes the old browser THEN launches a new one (`chromium.launch()` takes 1–2s). During that 1–2s window the pool size is effectively 1. Round-robin index still increments, so half the requests in that window hit a closed browser and throw.
Fix: launch the new browser first, swap atomically, then close the old one.

---

### P2 — `chromium.launch()` and `recycleBrowser` allocate args inline — no `executablePath` hint, relies on PATH+Playwright cache
`apps/api/src/services/renderer.ts:48-58`
Fine, but if Playwright cache moves or two Playwright versions are installed, launch will fail. Also no `chromiumSandbox: false` Playwright-level flag (the args `--no-sandbox` does it but the higher-level option is documented and survives Chromium version bumps).

---

### P2 — Worker startup happens before HTTP listener — slows cold start
`apps/api/src/index.ts:170-182`
Order: browser pool init → start worker → schedule drip tick → start HTTP listener. The worker is started but it's not on the request path. Moving it to AFTER `serve()` would let Fly hit `/health` ~200ms sooner.

---

### P2 — `--js-flags="--max-old-space-size"` not set on Node process either
None of the Docker images set `NODE_OPTIONS=--max-old-space-size=1536` or similar. With 2GB Fly RAM and ~500MB baseline for Chromium, Node's default heap of 1.4GB is too generous — the OS will OOM-kill Node before V8 actually frees.
Fix: `ENV NODE_OPTIONS="--max-old-space-size=1024"` in the runtime stage.

---

### P2 — Docker builds re-download Playwright Chromium on every prod image build
`apps/api/Dockerfile:48-50`
Multi-stage build is good, but `npx playwright install chromium` happens in the runtime stage, AFTER source copy invalidations. With a code-only change this re-pulls 280MB of Chromium.
Fix: do the `playwright install` immediately after `apt-get install` and before any `COPY` of source. The Chromium download is a function only of Playwright version (which is in package.json), not source code.

---

### P2 — Dockerfile installs prod deps via pnpm in BOTH stages — duplicates work
`apps/api/Dockerfile:14,62`
Builder runs `pnpm install --frozen-lockfile --filter @docuforge/api...` (line 14) — pulls all deps including dev. Runtime stage repeats with `--prod`. The builder install pulls dev deps you immediately throw away.
Fix: use `pnpm fetch` + `--offline` pattern, or copy `node_modules` selectively from builder.

---

### P2 — `docker-compose.selfhost.yml` has no Postgres backup, no Redis persistence
`docker-compose.selfhost.yml:73,87-90`
Redis is `--maxmemory 256mb --maxmemory-policy allkeys-lru` which means BullMQ jobs WILL be evicted under memory pressure. With `removeOnComplete: 1000`, the per-queue overhead is small, but a sustained job backlog under load can hit 256MB and start dropping jobs. Also no `--appendonly yes` — restart loses queued jobs.
Fix: bump `maxmemory` to 512MB or 1GB; enable `--appendonly yes` for BullMQ; use `noeviction` policy with a sane cap (BullMQ docs explicitly require `noeviction` to avoid losing jobs).

---

### P2 — Fly soft_limit 80 / hard_limit 100 is wildly too high for a Playwright host
`fly.toml:18-21`
With 2 browsers × ~10 concurrent contexts ceiling before OOM, the realistic concurrency is closer to 8–16. Fly's `hard_limit: 100` will let 100 requests pile into the same machine; the first 10 render, the other 90 wait, timeouts cascade.
Fix: `soft_limit: 8, hard_limit: 16`. Let Fly autoscale horizontally instead of stuffing one box.

---

### P2 — `fly.toml` health-check `interval: 15s, timeout: 5s, grace_period: 15s` is aggressive for a process that does GC under load
`fly.toml:23-28`
A node process under p99 GC pressure can pause 1–2s. With `timeout: 5s` and `retries: 3` (default) you mark unhealthy after 15s — but the load balancer rotates away faster. Combine with no `interval` backoff and you can get flapping under sustained load.
Fix: `timeout: 10s`, `interval: 30s`. Document the GC pause expectation.

---

### P2 — `auto_stop_machines = "suspend"` will eat first-request latency for cold tenants
`fly.toml:14`
"suspend" is faster to wake than "stop" but the Chromium re-attach is still 1–3s. For an API marketed as a low-latency PDF service, this hits SDK users with mysterious 3-second p95 spikes for the first request of the day.
Fix: keep "suspend" but document. Add a synthetic warmup ping every 4 minutes from outside (UptimeRobot, Cron job) to prevent suspension.

---

### P2 — `BUFFER_LATIN1` decode in `renderPdf` allocates twice the PDF size in memory
`apps/api/src/services/renderer.ts:167`
`buffer.toString('latin1')` creates a string that holds 2× bytes (each latin1 char is 2 bytes in V8 string storage). For a 20MB PDF that's 40MB string + 20MB original buffer = 60MB peak per render.
Fix: see "regex-based page count" — use pdf-lib or skim the buffer with `buffer.indexOf('/Type /Page')` directly without string conversion.

---

### P2 — No metrics endpoint, no Prometheus exporter, no histogram of `generation_time_ms`
Nothing exports the `generationTimeMs` field anywhere except as a DB column on success. There is no `/metrics` route, no StatsD client, no OpenTelemetry. P95 latency is unknowable without scraping the DB.
Fix: add `prom-client` and expose a histogram at `/metrics` with labels for `inputType`, `status`. Add a counter for `pdf_generated_total`.

---

### P3 — `interpolatePageVars` runs twice when both header and footer use page vars
`apps/api/src/services/renderer.ts:149-156`
Acceptable, but two separate `.replace` chains. Combine.

---

### P3 — `parseRedisConnection` is duplicated verbatim across `queue.ts:20-30` and `drip.ts:26-38`
`apps/api/src/services/queue.ts:20-30`, `apps/api/src/services/drip.ts:26-38`
Drift risk. Move into `lib/redis.ts`.

---

### P3 — `pdf-storage` Docker volume is bind to `/app/.storage` but app cwd is `/app/apps/api`
`docker-compose.selfhost.yml:26`, `apps/api/Dockerfile:77`
`process.cwd()` in storage.ts resolves to `/app/apps/api`, so PDFs are written to `/app/apps/api/.storage/pdfs/`. The compose volume mounts at `/app/.storage`. **They don't match.** PDFs in selfhost go to the container layer, not the volume — lost on restart.
Fix: mount the volume at `/app/apps/api/.storage` or set `STORAGE_LOCAL_DIR` env var consumed by storage.ts.

---

### P3 — `auto_stop_machines = "suspend"` + cold worker = drip tick can miss hours
If the only API instance suspends between :00:01 and :59:59, the hourly drip tick at `0 * * * *` runs… never. BullMQ repeat semantics will fire it on next worker availability, but the "every hour on the hour" cadence isn't honored.
Fix: ensure at least one machine is always running, or detach the tick worker into a separate "never suspended" service.

---

## Cross-cutting themes

1. **Shared in-process resources, no semaphores.** The browser pool, the BullMQ worker, and the HTTP handler all hammer 2 Chromium browsers from one Node process with zero concurrency control. Every P0 above traces back to this. Either separate worker process or add explicit `Semaphore(N)` around `getBrowser()`. Both ideally.

2. **No real timeouts on user-controlled work.** `setContent(networkidle)`, BullMQ `lockDuration`, the Fly health check, the Playwright defaults — none are configured. User HTML controls render time; we have to bound it everywhere.

3. **Idempotency is incomplete.** Webhook delivery is idempotent. Drip email enqueue is idempotent. But `/generate`, batch jobs (under stalled re-delivery), and `incrementUsage` are NOT idempotent. Any retry or stalled-job re-run double-counts revenue and double-fires webhooks. Pick a side-effect boundary and make it once-and-only-once.

4. **Hot-path DB queries that shouldn't exist.** `COUNT(*)` on `generations` per render, `customFonts` SELECT per render, `Handlebars.compile` per render, `templates SELECT` per render. Each is 1–5ms; cumulative they add 20–30ms to every request and 100+ queries/sec at 100 RPS.

5. **Observability is half-built.** `requestId` set but not propagated; Sentry env declared but not installed; no metrics endpoint; no log of PDF render duration outside the success row in DB. You cannot answer "what is p95 last week" without an analytics agent. Wire the basics.

6. **Two Dockerfiles, one good, one terrible.** The good one (`apps/api/Dockerfile`) is multi-stage. The bad one (root `Dockerfile`) is single-stage and used by self-hosters. Either delete it or fix it. Right now the message to self-hosted users is "image is 2GB."

7. **Fly config presumes elasticity but is configured for stuffing.** `soft_limit: 80` on a Playwright box is wishful thinking. Drop to single-digit concurrency and let Fly add machines.

8. **The hot path has at least 4 sequential DB writes.** `POST /v1/generate`:
   - `SELECT custom_fonts` (read)
   - `INSERT generations status=processing` (write)
   - `UPDATE generations status=completed` (write)
   - `INSERT/UPDATE usage_daily` (write)
   - `SELECT COUNT(*) generations` (read, in `maybeCelebrateFirstPdf`)
   Plus the auth roundtrip and the rate-limit pipeline. None are batched. None are parallelized. 5×5ms = 25ms of DB time on the critical path before Playwright even starts. Combine the three writes into a single transaction; cache fonts; replace COUNT with column.

9. **Where you can save 100ms on the hot path:**
   - Drop `waitUntil: 'networkidle'` → `'load'` for HTML-only inputs (no remote assets). 200–500ms saved.
   - Cache `Handlebars.compile` per template. 5–20ms.
   - Drop the `customFonts` query for users with none (in-memory bitmap or 60s LRU). 3–10ms.
   - Replace `maybeCelebrateFirstPdf` `COUNT(*)` with column check. 5–15ms (worse at scale).
   - Replace latin1 page-count regex with `pdf-lib.getPageCount()`. 5–30ms on large PDFs.
   - Skip `/health` through logging middleware. Indirect, but saves I/O bandwidth.

   Realistic floor for a 1-page Hello World PDF gen end-to-end is ~250–350ms. Today it's ~600–900ms.

10. **The drip system is the only thing in this codebase that can keep a machine awake long enough to OOM by itself.** Hourly tick + serial enqueue + full table scans + no overlap protection is a slow-bleeding tarpit. As users grow, the tick will exceed an hour and the system will compact into permanent tick-running mode. Fix the scan with indexed columns now, while you have <1000 users.
