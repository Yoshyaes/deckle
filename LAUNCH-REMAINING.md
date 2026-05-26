# Deckle — Remaining Launch Tasks

The DocuForge → Deckle rebrand is **functionally complete and live**. This file tracks the optional polish + housekeeping that still needs your dashboard access (I can't do these from the codebase). None of them block users from installing the SDKs and generating PDFs today.

_Last updated: 2026-05-25, after the end-to-end smoke test passed (zero-to-PDF in 4.3s, PDF URL resolves)._

---

## 🔴 Do now (security)

### Rotate the test API key ✅
A `dk_live_` key was pasted into a chat during the smoke test and is now in that history.
- Go to **app.getdeckle.dev/keys** → delete the key `dk_live_fa6RB…` → create a fresh one.

---

## 🟡 Recommended before a public launch

### 1. Clerk production instance — ✅ DONE
Migrated off the Clerk dev instance to production (primary domain `getdeckle.dev`).
- [x] Created production instance (cloned from dev), "Primary application"
- [x] Added the 5 Clerk DNS CNAMEs in Vercel DNS — all verified resolving to the correct `*.clerk.services` targets
- [x] Clerk DNS verified; SSL certs issued for `clerk.`/`accounts.getdeckle.dev`
- [x] Swapped `pk_live_`/`sk_live_` into Vercel `deckle-dashboard` env + redeployed
- [x] Verified `app.getdeckle.dev` now serves `pk_live_` bound to `clerk.getdeckle.dev`
- [ ] _Remaining only if you use the Clerk webhook for user sync:_ re-point it to the production instance + update `CLERK_WEBHOOK_SECRET` (skip if no webhook)

### 2. Platform env var sweep (values still pointing at getdocuforge.dev)
The *code* is clean (verified). The *deployed env var values* may still reference the old domain. Check and update:

**Render → `docuforge-api` service → Environment:**
| Var | Set to | Notes |
|-----|--------|-------|
| `DASHBOARD_URL` | `https://app.getdeckle.dev` | **Also the CORS origin** (`apps/api/src/index.ts:47`). Without this, the dashboard can't call the API cross-origin. |
| `API_BASE_URL` | `https://api.getdeckle.dev` | self-referential links |
| `R2_PUBLIC_URL` | _(see CDN task below)_ | currently the `pub-*.r2.dev` URL — **works**, just unbranded |
| `R2_BUCKET_NAME` | confirm matches the real bucket | `.env.example` says `deckle-pdfs`; verify the actual R2 bucket name or storage writes fail |
| `EMAIL_FROM` | `Deckle <hello@getdeckle.dev>` | drip/transactional emails |

**Vercel → `deckle` and `deckle-dashboard` → Environment Variables** (check the **Production** environment filter — vars are scoped per environment):
| Var | Set to |
|-----|--------|
| `NEXT_PUBLIC_API_URL` | `https://api.getdeckle.dev` |
| `NEXT_PUBLIC_APP_URL` | `https://app.getdeckle.dev` |
| `DASHBOARD_URL` | `https://app.getdeckle.dev` |

After changing Vercel env vars, **redeploy** the affected project (env changes only take effect on a new build). Render restarts automatically on env change.

### 3. Cloudflare 301 redirects (preserve old inbound links)
Old links to `getdocuforge.dev/*` (blog backlinks, search results, shared URLs) should forward to the new domain.
- In the **getdocuforge.dev** Cloudflare zone → **Rules → Redirect Rules → Create rule**:
  - **When**: `Hostname` `equals` `getdocuforge.dev` (add another for `www.getdocuforge.dev`)
  - **Then**: Dynamic redirect, **301 (permanent)**, expression: `concat("https://getdeckle.dev", http.request.uri.path)`
  - Preserve query string: on
- Repeat/extend for the subdomains if you want `docs.`/`app.` old URLs to forward (api.getdocuforge.dev should **stay serving** during the key-transition window — see §6).

### 4. Deprecate the old npm package
`@docuforge/react-pdf@0.1.0` is still installable. Point people to the new name. **PowerShell-safe** (the `<=` operator trips up PowerShell, so use an explicit version):
```powershell
npm deprecate "@docuforge/react-pdf@0.1.0" "Renamed to @getdeckle/react-pdf - install @getdeckle/react-pdf instead"
```
(Will prompt for an npm OTP.)

---

## 🟢 Optional / nice-to-have

### 5. Branded PDF CDN (`cdn.getdeckle.dev`)
PDFs currently serve from the R2 public URL (`https://pub-7a29…r2.dev/pdfs/…`) — **this works**, it's just not on-brand. To serve them from `cdn.getdeckle.dev`:
- **Blocker**: R2 custom domains require the domain to be managed by **Cloudflare**, but `getdeckle.dev` currently uses **Vercel** nameservers.
- **Cleanest fix**: move `getdeckle.dev` DNS to Cloudflare (re-point the registrar's nameservers at Cloudflare, then recreate the `api` / `app` / `docs` CNAMEs there). Then: Cloudflare R2 → bucket → Settings → Custom Domains → add `cdn.getdeckle.dev`; set Render `R2_PUBLIC_URL=https://cdn.getdeckle.dev`.
- Until then, the `r2.dev` URLs are fine for low/moderate volume (they're rate-limited at high scale).

### 6. Retire the `df_live_` key prefix (after a transition window)
The API accepts **both** `df_live_` and `dk_live_` prefixes right now (`apps/api/src/middleware/auth.ts`) so existing customer keys keep working. Once your logs show no `df_live_` traffic for ~30 days:
- Remove the `df_live_` branch from the auth middleware + the global error handler (`apps/api/src/index.ts`), and update the related test.
- Keep `api.getdocuforge.dev` serving until then (it shares the Render service, so it already does).

### 7. Repo housekeeping
- **Helper scripts** from the rebrand (`scripts/rebrand.ps1`, `scripts/npm-rename.ps1`) — ✅ removed (preserved in git history if ever needed).
- **Old brand assets**: `apps/web/public/brand-sheet.png` is still the DocuForge press sheet (no Deckle equivalent shipped in `deckle_rebrand/`). It's unreferenced by code (only mentioned in old audit notes), so it's harmless — regenerate a Deckle version when you build a press/brand page, or delete it. The untracked `DocuForge Assets/` folder at the repo root is your old working assets; delete from disk whenever.
- **External profiles** (not in the repo): update Dev.to / Hashnode / GitHub / Twitter / LinkedIn / Product Hunt bios from "DocuForge" to "Deckle" — old article URLs will 301 once §3 is done.

### 8. Local toolchain note
Your terminal runs **Node v20 / pnpm 9.15**, but the project declares `engines: node >=22` and `packageManager: pnpm@10.30.2`. Publishes worked anyway (just an "Unsupported engine" warning), but consider `nvm use 22` + `corepack prepare pnpm@10.30.2 --activate` to match CI and avoid edge-case build differences.

---

## ✅ Done (for reference)

- All code rebranded DocuForge → Deckle (9 commits, pushed to `Yoshyaes/deckle`)
- **SDKs published & verified live:** `@getdeckle/sdk`, `@getdeckle/react-pdf` (npm), `deckle` (PyPI), `deckle` (RubyGems), `github.com/Yoshyaes/deckle/packages/sdk-go` (Go); `v1.0.0` across the board
- API live on `api.getdeckle.dev` (rebrand code, Redis healthy, accepts both key prefixes)
- Marketing (`getdeckle.dev`), docs (`docs.getdeckle.dev`), dashboard (`app.getdeckle.dev`) live with SSL
- GitHub repo renamed `docuforge` → `deckle`; local remote updated
- Brand assets swapped (favicons, icons, logos, OG image)
- **End-to-end smoke test passed**: signup → `npm install @getdeckle/sdk @getdeckle/react-pdf` → `dk.generate({ html })` → working PDF, **4.3s** zero-to-PDF, returned URL resolves (HTTP 200, application/pdf)
- Backup branch `backup-pre-rebrand` pins the pre-rebrand state
