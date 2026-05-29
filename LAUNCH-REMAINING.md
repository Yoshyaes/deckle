# Deckle — Rebrand Completion Tracker

The DocuForge → Deckle rebrand is **shipped and live in production**. The product surface
(website, docs, dashboard, API, all SDKs, CI) is already 100% Deckle. This file is the
finish-line tracker for the remaining **external-distribution-surface** rebrand work that
needs your dashboard access (npm OTP, Dev.to, Twitter, Render, Vercel, Cloudflare).

_Last updated: 2026-05-29. Scope decision locked: **brand-completion only.** Product Hunt,
branded `cdn.getdeckle.dev`, and the `df_live_` key prefix sunset are explicitly deferred —
see "Deferred (post-100%)" at the bottom._

---

## Definition of "100% rebrand"

The rebrand is complete when **every public-facing surface that mentions the product** says
Deckle, and **no public-facing link** points users at a DocuForge URL or package. Concretely:

1. `npm view @docuforge/react-pdf` shows a deprecation pointing at `@getdeckle/react-pdf`.
2. Dev.to profile bio + website link + all 10 articles are Deckle-branded end-to-end.
3. Twitter `@getdeckle` (or chosen fallback) is claimed with a Deckle bio + pinned post.
4. `Yoshyaes/deckle` GitHub repo's `homepageUrl` is `https://getdeckle.dev`.
5. Render + Vercel **deployed env-var values** point at `getdeckle.dev` (the code is already
   clean; only the values lag).
6. Cloudflare 301 redirect rule: `getdocuforge.dev/*` → `https://getdeckle.dev/*`
   (apex + `www`). `api.getdocuforge.dev` is **intentionally not** redirected during the
   `df_live_` transition window.
7. The brand-regression guard (`apps/api/src/__tests__/brand-guard.test.ts`) passes.

---

## 🔴 Remaining for 100% (your dashboard / accounts)

### 1. Deprecate `@docuforge/react-pdf` on npm (~2 min, needs OTP)

The package is still installable at v0.1.0, with a description that still markets the old
brand and a homepage pointing at `getdocuforge.dev/docs/react-components` (verified
2026-05-29). The unscoped `docuforge` on npm and `@docuforge/sdk` are **not yours** (the first
is a squatter; the second 404s) — no action there.

PowerShell-safe (the `<=` operator trips PowerShell):

```powershell
npm deprecate "@docuforge/react-pdf@0.1.0" "Renamed to @getdeckle/react-pdf - install @getdeckle/react-pdf instead. See https://getdeckle.dev"
```

Prompts for OTP. Verify:

```powershell
npm view @docuforge/react-pdf deprecated
```

### 2. Claim Twitter / X handle (~5 min)

`@getdeckle` showed no public footprint per the audit (and is **not** the same as the
DocuForge squatter `@docuforge` / "Anvillent"). Sign up:

- **Handle:** `@getdeckle` if available; fall back to `@getdeckledev` or `@deckle_dev`
  consistently.
- **Bio:** `Pixel-perfect PDFs from HTML, React, or templates. Built for developers and AI agents.`
- **Website:** `https://getdeckle.dev`
- **Pinned post:** one-line "Deckle is live" + the docs URL.

### 3. Render — env var sweep on the API service (~5 min)

Service is named `docuforge-api` (internal identifier; cosmetic — don't rename). Render
dashboard → service → Environment, update the **values** (code is already clean):

| Var | Set to |
|-----|--------|
| `DASHBOARD_URL` | `https://app.getdeckle.dev` *(also the CORS origin)* |
| `API_BASE_URL` | `https://api.getdeckle.dev` |
| `EMAIL_FROM` | `Deckle <hello@getdeckle.dev>` |
| `R2_BUCKET_NAME` | confirm matches the real R2 bucket (`.env.example` says `deckle-pdfs`) |

Render restarts automatically on env change.

### 4. Vercel — env var sweep on both projects (~5 min)

Projects: `deckle` (marketing) and `deckle-dashboard`. **Production** environment scope on
each:

| Var | Set to |
|-----|--------|
| `NEXT_PUBLIC_API_URL` | `https://api.getdeckle.dev` |
| `NEXT_PUBLIC_APP_URL` | `https://app.getdeckle.dev` |
| `DASHBOARD_URL` | `https://app.getdeckle.dev` |

**Redeploy each project after** — Vercel env changes only take effect on a new build.

### 5. Cloudflare 301 redirects on the `getdocuforge.dev` zone (~5 min)

Cloudflare → Rules → Redirect Rules → Create rule:

- **When:** `Hostname equals getdocuforge.dev` (add a second rule for `www.getdocuforge.dev`).
- **Then:** Dynamic redirect → **301 (permanent)** → expression:
  ```
  concat("https://getdeckle.dev", http.request.uri.path)
  ```
- **Preserve query string:** on.
- ⚠️ **Do not** add `api.getdocuforge.dev` — the API still accepts `df_live_` keys during the
  transition; redirecting it would break existing customers.

### 6. Dev.to overhaul (~30–45 min)

The 10 published articles on `dev.to/yoshyaes` are the loudest residual DocuForge surface
(audit: bio still says "Building DocuForge"; all 10 articles reference DocuForge in title /
body / code samples). Strategy locked: **in-place rewrite** to preserve article URLs.

I generated the full paste-in kit in **`deckle_rebrand/devto-rewrite.md`** (gitignored;
~5,500 lines). It contains:

- Profile copy (bio + "Currently hacking on" + website) — do these first.
- One block per article with the article ID, edit URL, new title (if applicable), a summary
  of what was replaced, and the **full updated `body_markdown`** ready to paste.
- 389 DocuForge-shaped tokens → 0 after rewrite, verified.

Workflow per article: open the edit URL, replace title (if flagged), paste the body, save.

---

## ✅ Done

- **Code rebrand fully shipped:** apps, all 4 SDKs (`@getdeckle/sdk`, `@getdeckle/react-pdf`,
  `deckle` on PyPI verified 2026-05-29, `deckle` on RubyGems, Go module path), MCP server
  with full 17-tool PDF lifecycle.
- **Clerk production instance** migrated off dev; `pk_live_`/`sk_live_` swapped into Vercel.
- **Brand-regression guard test** (`apps/api/src/__tests__/brand-guard.test.ts`) passes —
  no `docuforge` (any case) in tracked shipping files outside the allowlist.
- **GitHub repo native rename:** `Yoshyaes/docuforge` is a native redirect to
  `Yoshyaes/deckle` (verified via identical `gh repo view` output) — the audit's claim of a
  "parallel repo" was a fetcher artifact; no action needed.
- **GitHub `homepageUrl`** updated to `https://getdeckle.dev` (was `docuforge-eta.vercel.app`).
- **Sign-in CSP fix** — added `clerk.getdeckle.dev` to the dashboard CSP allowlist after the
  dev → prod Clerk migration; verified live (PR #11).
- **CI rot fix** — pnpm-setup config, Node 20 → 22 (for `isolated-vm`), Go 1.21 → 1.22,
  plus pre-existing test type errors. CI is fully green on master (PR #12).
- **Test API key rotation** done after the early smoke-test leak.
- **End-to-end smoke test:** signup → `npm install @getdeckle/sdk @getdeckle/react-pdf` →
  `dk.generate({ html })` → working PDF in **4.3s**.

---

## 🟢 Deferred (post-100%)

These are intentionally out of "100% rebrand" scope — they're launch milestones, multi-step
migrations, or time-gated tasks, each worth its own plan.

- **`apps/web/public/brand-sheet.png`** — 195KB stale DocuForge press sheet, unreferenced by
  any shipping code (only audit notes mention it). Delete or replace whenever; harmless until
  then.
- **`DocuForge Assets/`** folder at the repo root — gitignored, untracked. Delete from disk
  whenever.
- **Product Hunt launch** under the Deckle name. No listing exists under either brand.
- **Branded CDN** `cdn.getdeckle.dev` — blocked on moving `getdeckle.dev` DNS from Vercel to
  Cloudflare (needed for R2 custom domains). R2 `pub-*.r2.dev` URLs work fine in the
  meantime.
- **`df_live_` key prefix sunset** — `apps/api/src/middleware/auth.ts` accepts both prefixes.
  Wait until logs show 30 days of zero `df_live_` traffic (~26 days from today).
  Then remove the `df_live_` branch + the related test, and decommission
  `api.getdocuforge.dev`.
- **Render service rename** `docuforge-api` → `deckle-api` — internal identifier only.
- **Hashnode / LinkedIn / company press kit** — not in the audit's required set.
- **Local toolchain** — your shell runs Node 20 / pnpm 9.15, project declares `engines:
  node >=22` and `packageManager: pnpm@10.30.2`. Publishes still work (just a warning);
  `nvm use 22` + `corepack prepare pnpm@10.30.2 --activate` to match CI.

---

## Rollback

Pre-rebrand state is pinned at branch **`backup-pre-rebrand`** and in history-backup bundles
under `~/deckle-history-backup-*` / `~/docuforge-history-backup-*`.
