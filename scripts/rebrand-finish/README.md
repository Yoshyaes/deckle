# rebrand-finish runners

Four dependency-free Node scripts that automate the remaining **Phase B** rebrand work via each
platform's public API. You supply the API token locally (never pasted into chat), the script
shows you a dry-run plan, then `--apply` to mutate. Each script verifies its own work via API
read-back.

| Script | What it does | Time |
|---|---|---|
| [`devto.mjs`](./devto.mjs) | Rewrites all 10 Dev.to articles (title + body) in place via `PUT /api/articles/{id}`. Prints profile copy at the end (Dev.to has no profile API). | ~60s |
| [`render.mjs`](./render.mjs) | Sweeps 3 env vars on the API service (`DASHBOARD_URL`, `API_BASE_URL`, `EMAIL_FROM`); Render auto-redeploys. | ~10s + Render build |
| [`vercel.mjs`](./vercel.mjs) | Sets 3 production env vars on each of `deckle` and `deckle-dashboard`, then triggers a production redeploy of each. | ~15s + Vercel builds |
| [`cloudflare.mjs`](./cloudflare.mjs) | Creates two 301 redirect rules in the `getdocuforge.dev` zone via the Rulesets API. Idempotent (re-running replaces, doesn't duplicate). | ~10s |

## Setup (once)

```bash
cd scripts/rebrand-finish
cp .env.example .env
# Open .env and paste the API tokens for the platforms you want to run. You
# can fill in just the section you need — each script only reads its own vars.
```

`.env` is gitignored. Tokens stay on disk locally.

## Run

Every script is **dry-run by default** — it prints the plan but writes nothing. Add `--apply`
to actually mutate. Add `--yes` to skip the confirm prompt (for unattended runs).

```bash
node scripts/rebrand-finish/devto.mjs             # plan, no writes
node scripts/rebrand-finish/devto.mjs --apply     # actually update articles
node scripts/rebrand-finish/devto.mjs --apply --yes
```

Same pattern for `render.mjs`, `vercel.mjs`, `cloudflare.mjs`.

## What each token needs

| Token | Where to create | Minimum permission | Notes |
|---|---|---|---|
| `DEVTO_API_KEY` | https://dev.to/settings/extensions → "DEV Community API Keys" | "Generate API Key" | One key. Revoke after you're done. |
| `RENDER_API_KEY` | https://dashboard.render.com/account/api-keys | full account API key | Render doesn't have scoped keys yet. |
| `VERCEL_TOKEN` | https://vercel.com/account/tokens | "Full Access" (or scoped Team Access) | Revoke after. |
| `VERCEL_TEAM_ID` | vercel.com/teams/&lt;slug&gt;/settings → General | (not a permission — just the team ID string) | Only if your projects are under a team. Leave blank for personal accounts. |
| `CLOUDFLARE_API_TOKEN` | https://dash.cloudflare.com/profile/api-tokens → "Create Token" | Zone → Zone Settings → **Edit** + Zone → Zone → **Edit**, restricted to the `getdocuforge.dev` zone | Custom token, not the global API key. |

## What's NOT here

- **`npm deprecate @docuforge/react-pdf`** — one CLI line, prompts for your OTP. Not worth
  scripting:
  ```powershell
  npm deprecate "@docuforge/react-pdf@0.1.0" "Renamed to @getdeckle/react-pdf - install @getdeckle/react-pdf instead. See https://getdeckle.dev"
  ```
- **Twitter / X handle claim** — no automation possible (captcha, phone, identity).

## Recommended order

1. `cloudflare.mjs` — sets up the 301s so any traffic to old URLs gets forwarded immediately.
2. `render.mjs` — API env-vars now point at `getdeckle.dev`; Render redeploys; ~2 min outage-free.
3. `vercel.mjs` — marketing + dashboard env-vars + redeploys; ~3 min builds.
4. `devto.mjs` — by now redirects are live, so any DocuForge links in articles you may have
   missed will also forward; the rewrite ensures we don't rely on them.
5. `npm deprecate ...` — manual one-liner.
6. Twitter handle claim — manual.

After all are done, the [LAUNCH-REMAINING.md](../../LAUNCH-REMAINING.md) tracker's "Remaining
for 100%" section should be fully ✅.

## When to delete these scripts

These are single-use. After the rebrand is verified 100%, you can `rm -rf scripts/rebrand-finish/`
— the API tokens you generated for them should also be revoked at each platform's tokens page.
