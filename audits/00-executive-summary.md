# DocuForge — Full-Platform Audit: Executive Summary

**Date:** 2026-05-20
**Auditors:** 12 specialist agents (backend, security, database, performance, tests, dashboard UX, accessibility, marketing, copywriting, design system, SDKs, docs/onboarding)
**Mode:** Read-only teardown. No fixes applied.
**Total findings across reports:** ~680

---

## The verdict in one paragraph

DocuForge ships a wide surface — API, 4 SDKs, MCP server, dashboard, marketing site, docs, billing, email drip — but the foundations under each surface are half-built, and a meaningful share of the platform's public claims are not true. Three things are simultaneously true: (1) the product **does** generate PDFs, the recent QA remediation is real, the comparison pages are unusually honest, and the drip email writing is good; (2) the marketing site and dashboard are full of broken or fictional artifacts (every landing-page code sample fails to run, "Trusted by Vercel/Stripe/Linear" are not customers, all three testimonials are fabricated, the docs link points to a Mintlify preview URL that leaks the founder's first name in production); and (3) several backend systems will fail in ways that lose money or data — a VM sandbox escape gives any caller RCE, every drip-email send races to send duplicates, the browser pool recycles browsers concurrent users are still holding, and a `psql -f drizzle/*.sql` on a fresh database crashes on the first auth attempt because the migrations are months out of sync with the live schema. This is not a launch-ready platform; it is a launch-ready *demo* of a platform.

---

## Top 10 critical issues (cross-cutting, ranked by impact × effort)

1. **VM-sandbox escape in `react-renderer.ts` = full RCE** — `({}).constructor.constructor('return process')()` defeats the nulled-globals deny list. Any API caller takes over the host. Audit 02-security P0.

2. **Migrations are months out of sync with the live schema** — `users.role`, `template_versions`, `stripe_*`, `custom_fonts`, `email_events` indexes, the `'react'` input_type, and several indexes have *no migration file*. A fresh deploy crashes on the first authenticated request, on the first React render, and on every font CSS injection. Audit 03-database P0.

3. **Zero `db.transaction()` calls in the entire API + cascading deletes on billing tables** — Template version create + update, Stripe webhook handler, generation insert + usage increment all run as independent statements with no rollback. `stripe_customers.userId` and `stripe_subscriptions.userId` cascade on delete, so deleting a user vaporizes billing history while Stripe keeps charging. Audit 03-database P0.

4. **Browser pool data race + no Playwright timeouts** — `renderer.ts` returns a browser entry while a concurrent `recycleBrowser` may `close()` it; `page.setContent(... waitUntil: 'networkidle')` and `page.pdf` have no per-call timeout. A bad `<img>` URL pegs a slot 30s. Soft-limit 80 + 2 browsers + 2GB Fly RAM OOMs well below 100 RPS. Audit 04-perf-infra P0.

5. **`/v1/pdf/protect` lies about encrypting; `/v1/pdf/sign` lies about signing** — Both endpoints return `protected: true` / `signed: true`. Neither actually encrypts or signs (the code comment admits AES "requires a native module in production"). Docs document `owner_password`/`user_password`/`permissions` parameters that have no effect. Sold as compliance features. Audits 01, 02, 12 P0.

6. **Marketing site is full of fakes that won't survive due diligence** — every code sample on the landing page is broken JavaScript (default-imports a named export, calls undefined variables); "Trusted by developers building at Vercel · Supabase · Stripe · Linear · Resend · Neon" lists non-customers (trademark + credibility risk); all 3 testimonials are fabricated, one names "ReportLab" — an actual Python PDF library; docs link is `https://fred-7da601c6.mintlify.app` (Mintlify preview URL, founder's first name leaked across the entire site and `llms.txt`); no `/pricing`, `/terms`, `/privacy`, `/security`, `/status` routes exist; status and Discord footer links go to `#`. Audit 08-marketing P0.

7. **SDKs corrupt requests silently** — Go and Python serialize `font_size` and `print_background` but the API expects `fontSize` and `printBackground`. **Every watermark and every background-print request from those SDKs is silently dropped on the wire.** Ruby `Templates#create/list/get/update/delete` all raise `NoMethodError` at runtime because the inherited `request` method is `protected` in the parent class — every template operation is broken. MCP server's `watermark.rotation` is silently dropped (API uses `angle`). All four SDKs have **zero tests**, and CI silently passes (`go test ./...` with no `*_test.go` files; Python only runs `py_compile`). Audit 11-sdk-dx P0.

8. **Numbers and product claims contradict themselves across surfaces** — Free tier: 100/mo in marketing, 1,000/mo in dashboard settings. Time-to-first-PDF: 30s, 60s, *and* 5 minutes across four surfaces. SDK count: 5 on marketing, 2 in docs and `llms.txt`. Starter templates: 15 in code, 1 in docs, 6 in picker, 5 in CLAUDE.md. The onboarding checklist ships TypeScript SDK code that *throws on construction* (uses object form, SDK requires positional `apiKey: string`). Audits 09-copy, 12-docs P0.

9. **Webhook SSRF + font upload → `--no-sandbox` Chromium = RCE chain** — Outbound webhook delivery has TOCTOU DNS rebinding (no AAAA query, no redirect restriction, no scheme/port allowlist); cloud-metadata exfiltration is one PUT away. Separately, fonts are uploaded with no magic-byte verification and rendered inside a Chromium launched with `--no-sandbox`, so any historical font-parser CVE becomes direct RCE. `X-Service-Secret` is god-mode with `===` compare, no audit trail, can impersonate any user UUID. IP rate limiter trusts unsigned `X-Forwarded-For`. Rate-limiter "circuit breaker" is a process-local counter that fails open for the first 10 errors and never deterministically closes. Audit 02-security P0.

10. **Frontend foundations are missing** — *No global `:focus-visible` style anywhere* — Tailwind preflight kills the browser default and neither `globals.css` restores it (every keyboard user is flying blind, WCAG 2.4.7). *All six dashboard modals are styled `<div>`s* — no `role="dialog"`, no `aria-modal`, no focus trap, no Esc handler. *Contrast fails WCAG AA across the product*: `text-dim #52525B` = 3.32:1, `accent #F97316` with white text = 3.31:1, `border #27272A` = 1.50:1. *No toast/notification system exists* — 9 native `alert()` and 2 `confirm()` calls across the codebase, including for irreversible cascade-deletes. *Delete Account button has no `onClick` handler.* *Dashboard Tailwind `fontFamily` doesn't reference `var(--font-dm-sans)`* — next/font loads but the dashboard renders in the system fallback. Audits 06, 07, 10 P0.

---

## Cross-cutting themes (patterns that surfaced in 4+ audits)

### Theme 1 — Lying interfaces (security / backend / docs / copy / marketing all flagged this)
The product repeatedly claims to do things it doesn't: `/pdf/protect` doesn't protect, `/pdf/sign` doesn't sign, "Trusted by" logos aren't customers, testimonials are fabricated, code samples don't run, error messages claim "please try again" for permanent failures, SDK promises wire fields that get silently dropped. **Every interface needs a "does it actually do this?" audit before any new feature ships.**

### Theme 2 — Half-built foundations (UX / design / tests / SDKs / DB / perf all flagged this)
Wide product surface, narrow infrastructure under each surface. Specifics: no Button/Input/Modal/Card components (gradient button copy-pasted 16+ times across 12 files; `rounded-[14px]` 35+ times); zero `db.transaction()` calls; no `setup.ts`/fixtures/factories in tests; no `:focus-visible` style; no toast system; no SDK tests; no global error response shape; three different pagination styles; two parallel green systems in the design tokens; no robots.txt/sitemap; no Sentry SDK installed despite Sentry DSN env var. The platform has ~80 features and 20% of the plumbing each one needs.

### Theme 3 — Race conditions are pervasive (security / DB / perf / backend / tests all flagged this)
- Browser pool: returns in-use browsers while recycler closes them.
- Drip campaign: check-then-insert race with no `UNIQUE(user_id, campaign)`, sends duplicate welcomes.
- Template versions: `templates.version++` is a read-modify-write race with no `UNIQUE(template_id, version)`.
- `usageDaily` increment, `apiKeys.lastUsedAt` update, idempotency cache write-after-success, Stripe webhook double-delivery — all race-prone.
- Rate-limiter circuit-breaker counter is module-level process-local state with no atomic transitions.

### Theme 4 — Test theater (tests / SDKs / security all flagged this)
The 18 test files overstate real coverage by ~3–4×: six of them inline a copy of the route's Zod schema instead of importing the real one (drift is *invisible*); `webhooks.test.ts` mocks `dns/promises` to always return a public IP, *defeating the SSRF guard the test would otherwise prove*; the rate-limit test misses the circuit-breaker entirely; the auth test doesn't cover timing-attack resistance (and there isn't any — the bcrypt loop short-circuits on first match and the service secret uses `===`). CI provisions Postgres + Redis but every test mocks them. All four SDKs have zero tests and CI silently passes. **A passing CI is currently uncorrelated with the system working.**

### Theme 5 — Brand-line and dashboard/marketing fragmentation (design / copy / marketing all flagged this)
The marketing site and dashboard look like they came from two different companies on the same dark-theme moodboard. Marketing has a real component library (Button/Card/CodeBlock/SectionWrapper/TabSwitcher/ScrollReveal); the dashboard imports none of it. The strongest tagline "Stripe for PDFs" exists *only* in an email template — no paying customer ever sees it. Dashboard has no `public/` directory at all (no favicon, no OG image, no manifest). PDF artifacts produced by `@docuforge/react` use `-apple-system` fonts, so the actual product output doesn't match the brand.

### Theme 6 — Error UX is the cardinal sin (copy / UX / docs / backend all flagged this)
Only **17% (8/47)** of user-facing error messages tell users what to do next. `alert("An error occurred. Please try again.")` is the dominant error UX for irrecoverable failures. Zod errors are comma-joined and surfaced raw to users. Generation `/generations` list shows a red dot for failed rows but the error reason is two clicks deep. The admin "Stuck Users" panel doesn't join in the `api_errors` table that exists for exactly this purpose. The drip campaign's `last_call` email writes in first-person founder voice ("I noticed", "I'll fix it this week") and then signs `— The DocuForge team`, neutering its own intimacy.

---

## What's actually good (preserve)

If a polish pass goes through and accidentally regresses any of this, that's a problem:

- **`AppError` hierarchy + centralized `errorResponse` handler** (`apps/api/src/lib/errors.ts`) — only the shape is good; the messages are the cardinal sin above.
- **Resource ownership checks are consistent** — `eq(*.userId, user.id)` on every fetch. No IDOR on user-owned resources.
- **Stripe webhook uses `constructEvent`, Clerk webhook uses `timingSafeEqual`** — signature verification is correctly done where it matters.
- **`javaScriptEnabled: false` in Playwright contexts** — closes a whole class of XSS-via-PDF.
- **`sanitizeDataKeys` strips `__proto__`/`constructor` prototype-pollution keys** + depth validation for billion-laughs JSON.
- **Webhook delivery has HMAC signing + outbound SSRF defenses** — though incomplete (see Theme 1), the bones are right.
- **Admin funnel / cohort heatmap / stuck-users dashboard** — the analytics surface is the most thought-out part of the dashboard.
- **`@docuforge/react` component primitives** — Document/Page/Header/Footer/Table API surface is well-designed (even though the rendered font is wrong).
- **Comparison pages are unusually fair** — the audit's only unambiguous "what's good" callout on the docs side.
- **Drip email writing quality** (especially `last_call`) — the strongest single piece of copy in the codebase.
- **Free-tier pricing block** on marketing — clear, loud, no-credit-card microcopy on point.
- **Free-tier signup → API key flow** is one click from every CTA. The funnel architecture is right; only the destination is broken.

---

## Recommended remediation order — 2-week sprint plan

### Week 1: Stop the lying, fix the bleeding

Day 1–2 — **Take fakes offline**
- Remove or replace the "Trusted by" logo wall and the three fabricated testimonials. Either show real customers or an empty `<SocialProof />` until you have them.
- Fix every code sample on the landing page so it actually runs against the current SDK. Add a CI check that lints the marketing-site code blocks against the live SDK.
- Replace `https://fred-7da601c6.mintlify.app` with the real docs domain everywhere (site, footer, `llms.txt`).
- Either implement encryption for `/pdf/protect` (qpdf native module) or remove the endpoint and its docs entirely. Same for `/pdf/sign`. Don't ship lies as features.

Day 3–4 — **Fix the migrations + the sandbox + the pool**
- Generate the missing migrations from the current schema. Test against a fresh Postgres in CI.
- Replace Node `vm` in `react-renderer.ts` with `isolated-vm`, or **remove `/v1/generate` React support** until you have a real sandbox. This is the single most dangerous code path in the platform.
- Add a semaphore around browser-pool acquisition. Add per-call timeouts to `page.setContent` and `page.pdf`. Add a graceful-drain hook on SIGTERM.

Day 5 — **Fix SDK wire-format bugs**
- Go: rename JSON tags on `WatermarkOptions.FontSize` and `PDFOptions.PrintBackground` to camelCase.
- Python: same for the Pydantic field aliases.
- Ruby: make `Client#request` public, or move it to a module. Add one end-to-end test that creates and lists a template — that single test would have caught this.
- MCP: rename `watermark.rotation` → `angle`.

### Week 2: Pour foundations under the surface

Day 6–7 — **Frontend primitives**
- Add a global `:focus-visible` style. Test every interactive element is keyboard-discoverable.
- Build a `Dialog` component with focus trap + Esc + return-focus. Migrate all six dashboard modals.
- Build a toast system. Replace every `alert()` and `confirm()` call.
- Fix the dashboard Tailwind `fontFamily` to reference `var(--font-dm-sans)`.

Day 8–9 — **Backend correctness**
- Wrap multi-write paths in `db.transaction`: template version create + bump, Stripe webhook handler, generation insert + usage increment, Clerk webhook user-create + welcome email.
- Add `UNIQUE(user_id, campaign)` on `email_events` and `UNIQUE(template_id, version)` on `template_versions`. Drip dedup via DB constraint not application code.
- Change `stripe_customers.userId` and `stripe_subscriptions.userId` FKs from CASCADE to RESTRICT or SET NULL.

Day 10 — **Trust signals + missing pages**
- Add `/pricing`, `/terms`, `/privacy`, `/security`, `/status`, `/contact`, `/about`. Empty-but-honest is better than 404.
- Add `robots.txt` + `sitemap.xml`. Add JSON-LD for SoftwareApplication.
- Install `@sentry/node` and actually wire it up to the existing `SENTRY_DSN` env var.

### Beyond two weeks

The remaining ~600 findings divide into: **(a)** copywriting pass on every empty/error/CTA string (audit 09 gives the table); **(b)** a real design-system package with `Button`/`Input`/`Card`/`Modal` reusable across both apps (audit 10); **(c)** real test coverage on Stripe/keys/Clerk-webhook/drip + one real-PDF E2E (audit 05); **(d)** SDK feature parity to cover the ~68% of the API surface they're missing (audit 11); **(e)** the rest of the security hardening from audit 02 (CSRF on admin, signed `X-Forwarded-For`, scoped idempotency keys, etc.).

---

## How to use this audit

- `audits/01-…` through `audits/12-…` contain the per-area teardowns with `file:line` citations.
- Spot-check accuracy by opening one citation per report.
- A reasonable next step is to triage the top 10 above into GitHub issues, and to run `/ultrareview` on the most critical fix PRs before merge.
- Re-run this audit team after the 2-week sprint to confirm the headline issues are closed and nothing has regressed.
