# Documentation, Onboarding & Engagement — Teardown

Scope: Mintlify docs site (`docs/`), onboarding flow (home banner, `onboarding-checklist.tsx`, `starter-template-picker.tsx`), drip campaigns (`drip.ts` + `emails/templates.ts`), admin funnel/diagnostics (`apps/dashboard/src/app/admin/**`, `apps/dashboard/src/app/api/admin/**`), and user-facing error surfaces (`/generations`).

## TL;DR

The docs broadly cover the surface a paying customer would touch, and the comparison pages are unusually honest (real pricing tables, real "when to choose competitor" sections). But docs are now meaningfully stale vs the shipped API: `react` and `watermark` aren't documented on `/v1/generate`, three whole route groups (`/v1/fonts`, `/v1/analytics`, `/v1/billing`, plus `/v1/keys`) are missing entirely from `mint.json`, `/v1/pdf/protect` lies about encrypting PDFs, the intro still says React-to-PDF is "Coming in Phase 2" even though it's live, and the only TS code snippet in the onboarding checklist is **wrong** (`new DocuForge({ apiKey })` — the constructor takes a string, not an object).

The onboarding has the right ingredients (no-key playground, checklist with 4 concrete steps, starter picker, drip emails) but contradicts itself on timing (home banner: "under 60 seconds", checklist: "under 5 minutes", quickstart: "5 minutes"), and the drip cadence is suspect (`welcome` then nothing until 24h, no day-0 nudge, no welcome resend on failure, and the `last_call` email signs off "The DocuForge team" while saying "I noticed" / "reply to me"). The funnel is well-designed but the dashboard "Stuck Users" panel doesn't show *why* they're stuck — it shows key count, not their last API error, even though that data exists.

For end users: failed generations are visible in `/generations/[id]` (good), but the `/generations` list view drops the status column entirely on the active list — no error indicator, no failed filter shows error reasons. A user with 5 failures in a row sees them as bullet points with no inline diagnosis.

## What's actually good

- Comparison pages are competitor-fair. Real pricing tables, real "when to choose them" sections. This is rare and will earn trust.
- The activation funnel (`/api/admin/funnel`) defines the right 5 steps: signup → key → first PDF → 7-day active → 30-day active. Plan breakdown is included. Drop-off counts are computed.
- Cohort retention (`/api/admin/cohorts`) is a proper weekly retention pivot, 12 weeks deep, with W0/W1/W2/W4/W8 columns and heat coloring.
- First-time error breakdown specifically isolates **the first failure each user had** — exactly the diagnostic that matters for activation, not just total errors.
- Per-user API error breakdown (commit ffbf882) merges pre-insert errors (auth, validation, rate limit) with post-insert failures (rendering). Most analytics tools never capture the pre-insert ones.
- Idempotency for drip emails is properly enforced at the DB level (unique `email_events` row per `(user, campaign)`).
- `nudge1` email body matches the actual product (no-code playground, real starter list) instead of generic marketing copy.
- `last_call` email is genuinely good founder-style copy with "reply to this email" CTA — until it self-sabotages with "the DocuForge team" signoff (see P1 below).
- API error recording (`recordApiError` in `index.ts`) catches every `/v1/*` 4xx/5xx with user, key prefix, method, path — invaluable for unblocking users.
- Onboarding checklist persists across sessions via localStorage and shows a real progress bar.

## Docs findings

### Accuracy vs actual API (sampled 5 endpoints)

| Endpoint | Documented correctly? | Drift |
| --- | --- | --- |
| `POST /v1/generate` | **No (P0)** | Missing `react` parameter (shipped, in Zod schema). Missing `watermark` object (shipped, with `text`/`color`/`opacity`/`angle`/`fontSize`). Missing `styles` parameter. Missing `output: "base64"` response shape (returns `{ id, status, data, pages, file_size, generation_time_ms }`, status `201`). Docs say `200`, actual is `201`. Error table omits `404 NOT_FOUND` for missing template. `printBackground` default in docs (`true`) is wrong — actual default is undefined/passes through to Playwright. |
| `POST /v1/generate/batch` | **Partial (P1)** | `react` and `styles` per-item are listed but the surrounding text under "Request Body" doesn't explain when to use react. `Idempotency-Key` documented correctly. Missing: the webhook only fires on the LAST item (this is a hidden gotcha that breaks "I want a webhook per batch item" mental models). |
| `POST /v1/pdf/merge` | **Partial (P2)** | Schema matches. Doc says "Each PDF must be under ~27MB when decoded" — code limit is `MAX_PDF_BASE64_SIZE = 50_000_000` (so ~37.5MB decoded, see `validateBase64Size`). Numbers don't match. |
| `Templates API` | **Partial (P1)** | CRUD is documented but the doc is missing the entire **version history** API: `GET /v1/templates/:id/versions`, `GET /v1/templates/:id/versions/:versionId`, `POST /v1/templates/:id/restore`. Those exist in `routes/templates.ts` and are linked from the dashboard. Missing `is_public` field on create/update. |
| `POST /v1/fonts` (custom fonts) | **NOT DOCUMENTED (P0)** | Route exists at `apps/api/src/routes/fonts.ts`, mounted at `/v1/fonts`. Accepts `multipart/form-data` with `file` and `family`. `GET /v1/fonts` lists. `DELETE /v1/fonts/:id` removes. **Zero coverage** in `mint.json` / no mdx page. Per CLAUDE.md, custom fonts are a v Puppeteer-comparison sales point. |

### Quickstart friction

1. **P0 — TypeScript SDK constructor in `onboarding-checklist.tsx` is broken.** `apps/dashboard/src/components/onboarding-checklist.tsx:37` shows `const df = new DocuForge({ apiKey: process.env.DOCUFORGE_API_KEY });` — but `packages/sdk-typescript/src/index.ts:24` is `constructor(apiKey: string, options?: DocuForgeOptions)`. Object form throws `"DocuForge API key is required"` because the truthy check is `if (!apiKey) throw`. A user copy-pasting the dashboard's own onboarding snippet gets an immediate error. The mintlify intro/quickstart use the correct string form. Two flavors of the same SDK in the same product.
2. **P1 — Time-to-first-PDF claim is inconsistent.** Home banner: "Generate your first PDF in under 60 seconds." Onboarding checklist: "Generate your first PDF in under 5 minutes." Quickstart heading: "Get from zero to a generated PDF in 5 minutes." Pick one. The playground autorun *can* deliver 60s; the docs path *can't*.
3. **P1 — `DOCUFORGE_DEV_BYPASS=true` is not documented anywhere in docs.** CLAUDE.md mentions it; `.env.example` mentions it; the docs site never does. For anyone running the self-hosted Docker image, this is a P1 quickstart gap.
4. **P1 — Quickstart never says "you must verify your email" or anything about Clerk.** The whole onboarding path implicitly depends on the `clerk:user.created` webhook running. If that webhook fails (no `CLERK_WEBHOOK_SECRET` in prod = `500`), no DB row is created, signup is silently broken. Not the docs' fault directly but the docs gloss over the dependency.
5. **P2 — `df_live_sk_...` examples vs actual `df_live_...` prefix.** Every doc example writes `Bearer df_live_sk_...`. Actual keys are `df_live_` + 32 chars (see `lib/id.ts:8`). The `sk_` is invented. Harmless for examples but technically misleading.
6. **P2 — Quickstart step 1 says "copy your API key from the dashboard"** but doesn't say "you can only see plaintext ONCE" (which `webhooks.ts:103-106` explicitly preserves as a design choice). Users will close that toast and never find it again.
7. **P2 — Step 4 "Use Templates" in quickstart depends on a template ID like `tmpl_invoice_v2`** that doesn't actually exist (no such ID seeded). Should reference `df.templates.create({...})` first or use one of the 15 starter slugs.
8. **P3 — Quickstart never mentions `from_react` even though the React SDK method is shipped** and CLAUDE.md lists it as a top-level SDK method.

### Framework guides

9. **P1 — Guides ignore React-to-PDF entirely.** Next.js guide is HTML-only. Express guide is HTML-only. The whole "you can send JSX to a server-side API and get a PDF back" pitch — DocuForge's most differentiated feature — is missing from every framework guide.
10. **P1 — Next.js guide doesn't address the SSR/RSC story.** A Next.js App Router user has to know to put `df.generate` in a Route Handler (which the guide does, correctly), but the guide never mentions Server Actions, never mentions response streaming, never mentions PDF download streaming. Missing the actual Next.js-specific value.
11. **P1 — Express guide does `res.status(500).json({ error: err.message })` swallowing the error code.** Production gotcha: this leaks internal error messages to API consumers. Should reference the SDK's `DocuForgeError` and demonstrate proper error pass-through.
12. **P1 — Rails guide doesn't use the Ruby SDK.** Per CLAUDE.md, `packages/sdk-ruby` exists. The Rails guide builds an HTTP wrapper from scratch using `httpx` — actively *teaches against* using the SDK. Either delete the SDK or rewrite the guide.
13. **P1 — Django + FastAPI guides are 5-step skeletons.** No mention of `async` patterns in FastAPI (which is the whole point of using FastAPI), no mention of background tasks for large PDFs, no mention of Django Celery integration, no mention of S3/storage relay patterns.
14. **P2 — None of the guides mention webhooks.** Every framework guide should have a "webhook handler" snippet because the `webhook` option is documented on `/v1/generate`. Currently there's no example anywhere showing how to consume it.
15. **P2 — Next.js guide's client-side `'use client'` example exposes the PDF URL to the browser.** Fine for demo, but never says "in production proxy the file through your own backend so the CDN URL isn't shared".
16. **P3 — Django guide hardcodes `template="tmpl_invoice_v2"`** which the user will never have. Should be a `settings.INVOICE_TEMPLATE_ID` or a creation step.

### Comparison page fairness

17. **P1 — `vs-docraptor.mdx`** pricing claim "**$15/mo** for DocRaptor at 1,000 PDFs/mo" but their actual professional tier was $15/mo for ~125 PDFs at time of writing (their own pricing page). Doc shows DocRaptor at $15/mo with the row "1,000 PDFs/mo" — that comparison row is misleading even though the per-volume row above shows "from $15/mo (125 PDFs)". A competitor reading this would screenshot it.
18. **P1 — `vs-puppeteer.mdx`** claims Puppeteer setup is "2–5 days" — defensible for production but provocative. Either cite a postmortem or soften to "1–5 days to production".
19. **P2 — Every comparison page** uses "Setup time: 5 minutes" for DocuForge. That's only true if the user already has an account and Clerk webhook is healthy. In reality first-time signup → first generated PDF in the playground is closer to 60s once they're logged in; the "5 minutes" framing is conservative for the comparison but breaks the home banner's "60 seconds" promise.
20. **P2 — `vs-jspdf.mdx`** says jsPDF doesn't have batch generation. Technically you can loop in JS. The framing should be "not server-side / not async / not durable" — more honest and more punchy.
21. **P2 — `vs-pdfmonkey.mdx`** claims PDFMonkey doesn't support HTML-to-PDF — verify. They added HTML support a while ago. Worth re-checking.
22. **P3 — `vs-gotenberg.mdx`** lists "Uptime SLA 99.9%" for DocuForge with no link to the actual SLA page. Either link the SLA or remove the row.

### API reference completeness (vs actual route surface)

The actual mounted `/v1/*` surface (from `apps/api/src/index.ts:95-107`):

```
/v1/generate              v1/generate/batch        v1/generations
/v1/templates             /v1/usage                /v1/keys
/v1/pdf/*                 /v1/ai                   /v1/marketplace
/v1/integrations          /v1/billing              /v1/fonts
/v1/analytics             /v1/starter-templates    /v1/starter-templates/:slug/clone
```

Mintlify nav lists: generate, batch, generations, templates, usage, 7 pdf tools, marketplace, starter-templates, ai-generate, integrations.

23. **P0 — `/v1/fonts` completely undocumented.** Real routes: `POST /v1/fonts` (multipart upload), `GET /v1/fonts`, `DELETE /v1/fonts/:id`. CLAUDE.md and comparison pages advertise custom fonts as a feature. The API to do it is hidden.
24. **P0 — `/v1/analytics` completely undocumented.** Returns top templates, error rate, latency by day, type breakdown, daily generations, peak hours. This is a feature, not internal. It's mounted under user-auth.
25. **P0 — `/v1/keys` completely undocumented.** API key CRUD endpoints. Used by the dashboard but also an API that customers might script.
26. **P0 — `/v1/billing` completely undocumented** (Stripe billing endpoints).
27. **P1 — Marketplace docs are missing `GET /v1/marketplace/:id`** but the route exists in `marketplace.ts:55-75`. Browsing detail (HTML content) is a real flow.
28. **P1 — Templates docs are missing version history routes** (see drift table row 4).
29. **P1 — `/v1/pdf/protect` lies about encryption.** Code (`pdf-tools.ts:107-152`) only sets metadata — `doc.setProducer('DocuForge')` — and a code comment explicitly says "Full AES encryption requires a native module (qpdf) in production environments." The doc states "Add password protection and permission controls to a PDF document" and accepts `owner_password`/`user_password`/`permissions` fields — but **none of them are applied to the saved PDF**. A user calling this thinks their PDF is password-protected; it isn't. **This is a P0 product lie if surfaced to a paying customer; P1 for docs to omit the qualifier.**
30. **P1 — `/v1/pdf/sign` doesn't sign cryptographically.** Doc says "Add a visual digital signature annotation". Body says "visual digital signature". This is an annotation, not a CMS digital signature. The word "digital signature" carries legal meaning (PAdES/eIDAS). Either rename to "signature image" or add a giant warning.
31. **P1 — `/v1/ai/generate-template` doc doesn't mention rate limiting/cost.** Hitting an external Claude API per request — what's the rate cap? Is there a separate quota? Doc just says "Requires `ANTHROPIC_API_KEY` to be configured on the server" — for the self-hosted user that's their key burning.
32. **P2 — Integrations endpoint missing several actions.** Real surface only has `triggers/new-generation`, `triggers/new-template`, `actions/generate`, `auth/test`. Docs document all of these. Good. But there's no `actions/create-template`, no webhook subscription endpoint despite the doc header mentioning "Webhook subscription management". Either ship it or remove the header.
33. **P2 — `mint.json` topbar CTA "Get API Key" points to `app.getdocuforge.dev`** but the dashboard root path requires sign-in. Should go to `/sign-up` or `/keys` (after sign-up). Currently the user clicks "Get API Key" and lands on a sign-in screen with no context.
34. **P2 — `mint.json` `topbarLinks` only has "Dashboard"** — no GitHub link, no support link, no status page. The `footerSocials` has `github` and `twitter` but the urls (`github.com/docuforge`, `twitter.com/docuforge`) point to org pages that may not exist.
35. **P3 — `mint.json` has no `anchors` for SDK reference pages** — the SDKs exist (TS/Py/Go/Ruby) and CLAUDE.md confirms it, but the docs don't link to npm/PyPI/etc.

## Onboarding findings

### Signup → first PDF path

The path is: Clerk signup → `webhooks.ts` Clerk webhook creates `users` row → `enqueueDripEmail({ campaign: 'welcome' })` fires → user redirected to `/` dashboard → home banner shows ("Generate your first PDF in under 60 seconds") → user clicks playground → renders.

36. **P1 — Welcome email path is fragile.** If `CLERK_WEBHOOK_SECRET` is missing in production, the webhook returns 500 and the user row is never created. The user can sign in via Clerk and get to the dashboard, but `getCurrentUser` returns null and they get redirected to `/sign-in` (`page.tsx:21-22`). This is an infinite loop. No retry, no fallback. The welcome banner's "60 seconds" promise dies before it loads.
37. **P1 — No fallback path for "user signed in but DB row missing".** `apps/dashboard/src/app/page.tsx:20-23` does `if (!user) redirect('/sign-in')` even when Clerk says the user is authenticated. Self-healing requires the webhook to fire. There should be a JIT user creation in `getCurrentUser` or a dedicated `/onboarding` page that creates the row.
38. **P2 — The home banner CTA "Generate your first PDF" links to `/playground?template=invoice&autorun=1`** — good — but if the playground errors (e.g., API server down, missing template), the user sees… what? No retry messaging. Worth a screenshot test.
39. **P2 — The "Or create an API key" secondary CTA on the home banner is at equal visual weight** with the playground CTA. For a no-code activation funnel, that's competing CTAs. Make the API-key path tertiary.

### Onboarding checklist

40. **P0 — TS snippet in `install-sdk` step uses `new DocuForge({ apiKey })` object form.** Will throw at runtime (see drift table). The dashboard onboarding contradicts the docs and the SDK.
41. **P1 — Checklist step "Call the API from code" only checks `hasGeneration && hasApiKey`.** A user who renders via the playground (no API key) gets `hasGeneration=true` but `hasApiKey=false`, so the step stays open. Then they create a key but never call from code, and the step instantly marks complete because both are true. The step doesn't actually verify "from code" — it just AND's two unrelated facts.
42. **P1 — Step "Install an SDK" has no DB signal** and is gated on the user clicking "Mark as done" or copying the code. A user who copies the install command but not the code never marks it done. The whole step is purely psychological.
43. **P1 — Checklist dismissal is permanent via localStorage.** A user on a new device sees the checklist again, even if they're a 10K-PDF/month power user. Should also gate on `hasApiKey && hasGeneration` server-side.
44. **P2 — Steps are not ordered for activation.** "Generate your first PDF in the playground" is step 1 (correct), but "Create an API key" is step 2 — the user might generate without a key then bounce. The conversion-optimal order is play → key → call from code. Currently the order works, but the visual cue "is first open" is computed each render, not pinned.
45. **P2 — The curl command uses `${apiKeyPreview}...` as a placeholder** (e.g. `Bearer df_live_abc123...`). If the user actually copies and runs it verbatim, they get a 401. There should be a copy-with-real-key option once they have one.
46. **P3 — The Go SDK install line `go get github.com/docuforge/docuforge-go`** — verify the repo URL matches actual publication.

### Starter templates

47. **P1 — Docs claim 5 pre-built templates** (in CLAUDE.md's mention) but the code (`scripts/starter-templates.ts`) actually has **15**: invoice, receipt, report, certificate, shipping-label, resume, contract, proposal, packing-slip, letter, meeting-minutes, nda, event-ticket, purchase-order, report-card. Mintlify only shows one (invoice) example in `starter-templates.mdx`. The dashboard `StarterTemplatePicker` shows only **6** (`.slice(0, 6)`). Same data, three different counts.
48. **P2 — Starter picker has no "see all 15" link.** A user sees 6 cards and assumes that's all there is. The `/templates/gallery` page (per CLAUDE.md) exists but isn't linked from the picker.
49. **P2 — Category icons are typography-only** (`$`, `#`, `§`, `~`). Looks like a designer-driven minimalist choice but feels broken — users may think the icons failed to load. SVGs would convert better.

## Drip campaign findings

The campaign roster (`drip.ts:42-48`): `welcome | nudge1 | nudge2 | last_call | first_pdf | reengagement`. Trigger map:
- `welcome`: on Clerk `user.created` webhook
- `nudge1`: hourly tick scans users 24–48h old with 0 gens
- `nudge2`: 72–96h with 0 gens
- `last_call`: 168–192h (7–8d) with 0 gens
- `first_pdf`: fires from `generate.ts:193,222` on first completed generation
- `reengagement`: previously active, silent 14+ days

### Campaign-by-campaign critique

50. **P1 — `welcome` email subject "Welcome to DocuForge — your first PDF is one click away".** Body delivers on the promise (button → playground autorun). Good. But the email has **no signature, no founder name**. For a "Stripe for PDFs" founder-mode product, the welcome should come from a human.
51. **P1 — `nudge1` ("Your first PDF in 60 seconds")** echoes the home banner's claim, which is fine. But the CTA points to `playgroundUrl = /playground?template=invoice&autorun=1`. If the user already tried the playground and bounced, this is a repeat ask without addressing *why* they bounced. Worth A/B'ing a "what got in your way?" variant.
52. **P1 — `nudge2` ("How other developers use DocuForge")** lists 3 example flows. Two of them name-drop "Stripe webhook" and "e-sign". The user might not be in either category. There's no segmentation by signup intent (DocuForge doesn't ask), so the email is one-size-fits-all and risks feeling like spam.
53. **P0 — `last_call` email contradicts itself.** Body uses first-person ("Hey — I noticed", "I'd like to know", "I'll fix it this week"). Signoff is "**— The DocuForge team**". One human one moment, a team the next. Pick a voice. The first-person founder tone is the right one — change the signoff. Also, `founderEmail` env var is the reply-to but the email doesn't use it as a `Reply-To:` header (see `email.ts`), only as visible text. A user replying to the actual sender doesn't reach the founder.
54. **P1 — `first_pdf` email celebrates with a 🎉 emoji and says "First PDF: shipped."** Great copy. But the CTA is "Open your dashboard →" not "Save this as a template →". The user just rendered HTML — the next step is templatize that HTML, then call from code. The dashboard link is too vague.
55. **P1 — `reengagement` email lists shipped features** including "Password protection, digital signatures, PDF/A conversion" — but `pdf-tools.ts:107-152` shows password protection is **non-functional** (sets metadata only). Sending this email to a returning user who tries it and discovers it doesn't actually protect = trust destroyed.
56. **P2 — No mid-funnel "you have an API key but haven't called the API" campaign.** This is the largest stuck-user cohort per the admin "Stuck Users" panel (`admin-client.tsx:122-123`). The drip tick scans for "no generations" period; doesn't differentiate "has key, no gens" from "no key, no gens". The latter group already gets nudges via playground; the former group might be a developer who created a key, hit an error, and bounced — a different message would help.
57. **P2 — No drip after `first_pdf` celebrating the 10th PDF, the 100th PDF, or upgrade nudges.** The whole post-first-PDF lifecycle is empty until 14-day silence triggers re-engagement.

### Triggers/timing

58. **P1 — No day-0 nudge between welcome (T+0) and nudge1 (T+24h).** A user who signs up, doesn't generate a PDF, closes the tab — first follow-up is 24h later. For a developer audience whose attention has churned by then, T+4h or T+8h with "still here? Here's the playground link" would lift activation.
59. **P1 — Drip tick is hourly** (`drip.ts:327`) but the cohort windows are 24h-wide for nudge1 (24–48). That means a user signing up at 10:30am gets the nudge1 email some time between 10:30am next day and 10:30am the day after — could be at 2am their time. No timezone awareness. Should constrain sends to business hours per-user or per-cohort.
60. **P1 — No unsubscribe link rendered.** `templates.ts:52` reads `${ctx.unsubscribeUrl ? ... : ''}` and `drip.ts:81-92` never sets `unsubscribeUrl`. **CAN-SPAM compliance issue**. Every commercial drip email needs a real unsubscribe link, not a maybe.
61. **P2 — `reengagement` campaign has no max-send cap.** A user silent for 14 days gets one. Then? If they stay silent another 14 days, the idempotency check at `drip.ts:101-110` blocks re-sends, so they never get a second touch. That might be intentional but should be documented.
62. **P2 — `welcome` is enqueued even if user creation comes from a webhook re-fire.** Idempotency catches the duplicate (good). But `welcomeEmail` content is time-sensitive ("Thanks for signing up") and silently sending it days later if the original failed is misleading. Should have a "max age" filter on failed→retry.
63. **P3 — `email_events.status` enum** — `queued`, `sent`, `skipped`, `failed` — but no `unsubscribed` state. When unsubscribe lands, the schema can't represent it.

### Email content quality

64. **P1 — All emails use one-color (#F97316) branding** with no plain-text alternative. `sendEmail` is called without a `text` field (see `drip.ts:163`). Gmail/Outlook may flag as suspicious. Plain-text fallback is mandatory for deliverability.
65. **P1 — The footer "You're getting this because you signed up for DocuForge with ${ctx.email}"** is good for transparency. But it doesn't include a physical mailing address (CAN-SPAM § 5(a)(5)). For US-based DocuForge LLC, this is a legal gap.
66. **P2 — `<code>` styling uses `background:#1a1a1d`** which is dark — fine for dark-mode email clients but in light-mode Gmail it'll be hard to read against the email's `#111113` body (already dark). The whole email is dark-mode-only, which is unusual for transactional email.
67. **P2 — No personalization beyond `${ctx.email}` in the footer.** No first name, no signup source, no plan. For a developer audience, "Hey Fred" lifts response rate by ~30% per industry benchmarks.

## Funnel & admin tooling findings

68. **P1 — "Stuck Users" panel on `/admin` shows `key_count` and `generation_count`** but **not** the user's most recent API error. The `apiErrors` data is fetched separately and never joined. An admin looking at a stuck user has to: click into the user, scroll past the metadata, find the "API Errors" section, scan the most recent. Should surface "last error: `VALIDATION_ERROR — must provide html/react/template`" inline in the stuck-users table.
69. **P1 — Funnel step "Created API key"** counts via `apiKeys.userId` distinct. But users who created and then **deleted** their key still count. The funnel says "27% have a key" when really "27% ever had a key, currently maybe 20% do". `apiKeys` table needs a `revokedAt`/`deletedAt` filter.
70. **P1 — Cohort retention is "did user generate a PDF that week"** — but doesn't separate completed vs failed. A user with 5 failed attempts looks identical to a user with 5 successful attempts. For retention you want successful generations or at minimum a parallel "successful retention" pivot.
71. **P1 — First-error breakdown groups by raw error message** (`generations.error` text). A renderer that returns "Timeout: 30000ms" and "Timeout: 30000ms after navigation" become two rows. Should bucket by a stable error code, not message.
72. **P2 — Admin "Active Users 7d" / "Active Users 30d" counts users with any generation,** but doesn't filter to successful. Bot-spammers with 100 failed generations count as active.
73. **P2 — Admin user detail page** (`admin/users/[id]/user-detail-client.tsx`) shows the admin can change a user's plan and delete them, but the **only action to unblock a stuck user is implicit**: there's no "resend welcome email", no "auto-create an API key", no "send a personal note". The pitch is "unblock stuck users"; the UI lets you read, not act.
74. **P2 — Admin error breakdown's "View →" link** on stuck users goes to `/admin/users/${u.id}` (good) but there's no breadcrumb back to "Stuck Users" — the admin loses their place.
75. **P2 — `/api/admin/funnel`** has plan filtering via `?plan=free` but the dashboard UI has no plan filter control. Dead code or unfinished?
76. **P3 — `/api/admin/cohorts`** is hardcoded to 12 weeks; no `?weeks=` query param.
77. **P3 — Funnel drop-off display** shows `-X%` between consecutive steps but the calculation is `(prev - current) / prev` not `current / prev`. So "27 → 18" shows "-33.3%" which is correct, but the visual treatment as a small negative number next to a large positive % is hard to scan. Consider showing absolute counts ("9 dropped here") alongside.

## Engagement product surface findings

78. **P1 — `/generations` list page has NO error column.** Looking at `apps/dashboard/src/app/generations/page.tsx:56-99`: the grid is `[auto_1fr_100px_80px_80px_80px]` = status-dot, ID, Type, Pages, Time, Created. No error message even when a row is failed. A user with 5 consecutive failures has to click into each row to see the reason. **The data is there** (`gen.error`) but the list ignores it.
79. **P1 — Filter pills are "All / Completed / Failed"** but the failed filter only shows the same column set. A user filtering for "Failed" sees a list of failed gen IDs with timing — still no error reason inline.
80. **P1 — `/generations/[id]` shows error message in a red panel — good** — but there's no "common errors" doc link. A user seeing "Timeout: 30000ms" doesn't know if it's their HTML's fault, a Playwright issue, or a network blip. Link each error code to a troubleshooting doc page (which would also need to be written).
81. **P2 — Generation detail page has no "regenerate" button.** A failed generation can't be retried from the dashboard. User has to copy their HTML out, paste into the playground, hit run.
82. **P2 — No dashboard surface for "what was your last error" on the home page.** First-time visitors get a welcome banner; returning users with recent failures get the same generic stats. Missed opportunity to surface "3 failures in the last hour — view diagnostics".
83. **P3 — Sidebar usage progress shows `usageCount / usageLimit`** but doesn't visually flag when failures eat into usage. (Verify: does a failed generation increment `usageDaily`? Per `generate.ts:241-248` looking at the catch block: `incrementUsage` is only called inside the try after success. Good. But if so, the failure rate isn't surfaced anywhere on the dashboard except behind two clicks.)

## Cross-cutting themes

- **The product is ahead of the docs in three ways**: React-to-PDF is shipped but called "Coming in Phase 2", custom fonts are shipped but not documented at all, and template version history is shipped but absent from mintlify. The docs are 1–2 ship-cycles behind reality. Whoever ships features needs to own the doc update in the same PR.
- **The product is behind the marketing in two ways**: `/v1/pdf/protect` doesn't protect, `/v1/pdf/sign` doesn't digitally sign. Both are documented as if they do. These are the highest-trust-risk findings in the audit — a CIO who buys for "password-protected PDFs" and discovers the PDFs aren't actually password-protected will churn and never come back.
- **The onboarding has the right shape but the wrong polish.** Banner says 60s, checklist says 5min, quickstart says 5min, drip says "60 seconds". The TS code snippet on the dashboard doesn't compile. The Go SDK snippet's repo URL might not exist. These are 30-minute fixes individually, but together they're "we don't read our own onboarding".
- **The funnel data is excellent, the activation interventions are weak.** Admins can see who's stuck and why, but can't act. The drip campaign has 6 templates but no per-error-cause variants, no business-hours timing, no plain-text fallback, no real unsubscribe.
- **End users' visibility into their own errors is two clicks too deep.** The `/generations` list buries the most important diagnostic (the error message) behind a detail-page click, while admins see everything. Invert it: users should see *their own* errors as prominently as admins see them.
- **Comparison pages are an outlier** in quality — concrete, fair, citation-able. That's the bar the rest of the docs should hit.
- **Mintlify nav structure has no SDK section.** Five SDKs ship (TS, Python, Go, Ruby, plus React component lib and MCP server), but the docs `mint.json` has no "SDKs" group or anchors. Users find SDKs by reading framework guides — discoverability gap.

## File pointers

Docs: `C:\Users\soon2\Documents\Docuforge\docs\mint.json`, `docs\quickstart.mdx`, `docs\introduction.mdx`, `docs\authentication.mdx`, `docs\api-reference\*.mdx`, `docs\guides\*.mdx`, `docs\comparisons\*.mdx`.

Onboarding: `apps\dashboard\src\app\page.tsx`, `apps\dashboard\src\components\onboarding-checklist.tsx`, `apps\dashboard\src\components\starter-template-picker.tsx`.

Drip: `apps\api\src\services\drip.ts`, `apps\api\src\emails\templates.ts`, `apps\api\src\routes\webhooks.ts`, `apps\api\src\services\email.ts`.

Admin: `apps\dashboard\src\app\admin\page.tsx`, `apps\dashboard\src\app\admin\admin-client.tsx`, `apps\dashboard\src\app\admin\users\[id]\user-detail-client.tsx`, `apps\dashboard\src\app\api\admin\funnel\route.ts`, `apps\dashboard\src\app\api\admin\cohorts\route.ts`, `apps\dashboard\src\app\api\admin\first-error-breakdown\route.ts`, `apps\dashboard\src\app\api\admin\api-errors\route.ts`.

API surface (for cross-check): `apps\api\src\index.ts`, `apps\api\src\routes\generate.ts`, `apps\api\src\routes\batch.ts`, `apps\api\src\routes\pdf-tools.ts`, `apps\api\src\routes\templates.ts`, `apps\api\src\routes\fonts.ts`, `apps\api\src\routes\analytics.ts`, `apps\api\src\routes\marketplace.ts`, `apps\api\src\routes\integrations.ts`, `apps\api\src\routes\ai.ts`, `apps\api\src\routes\starter-templates.ts`, `apps\api\src\scripts\starter-templates.ts`.

User error surface: `apps\dashboard\src\app\generations\page.tsx`, `apps\dashboard\src\app\generations\[id]\page.tsx`, `apps\dashboard\src\components\generation-table.tsx`.
