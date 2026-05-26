# Rebrand: DocuForge → Deckle

A complete record of the rebrand from **DocuForge** to **Deckle**, executed May 20–25, 2026.

## Why

"DocuForge" collided with 6+ other projects, including a direct competitor (`docuforge.app`) using identical MCP tool names. The collisions extended into the package registries:
- **npm**: `docuforge` was squatted by an unrelated CLI tool (`douglasrubims`, 8 versions)
- **PyPI**: `docuforge` was taken by an unrelated "AI content rewrite engine" (`ishowshao`)
- **Go**: the assumed `github.com/docuforge/docuforge-go` module path 404'd

So every documented install command (`npm install docuforge`, `pip install docuforge`) was pointing new users at the wrong software. "Deckle" (the frame used in papermaking that creates a deckle edge) is distinctive and was largely free.

## Final naming

| Thing | Value |
|-------|-------|
| Brand | **Deckle** (lowercase wordmark `deckle`) |
| Domain | **getdeckle.dev** |
| npm — TS SDK | **`@getdeckle/sdk`** |
| npm — React components | **`@getdeckle/react-pdf`** |
| PyPI | **`deckle`** |
| RubyGems | **`deckle`** |
| Go module | **`github.com/Yoshyaes/deckle/packages/sdk-go`** |
| Main class (TS/Python) | **`Deckle`** |
| API key prefix | **`dk_live_`** (legacy `df_live_` still accepted) |
| Subdomains | `api.` / `app.` / `docs.` / `cdn.` `.getdeckle.dev` |
| GitHub repo | **`Yoshyaes/deckle`** |

**npm scope note:** the intended `@deckle` org and bare `deckle` name were *both* already owned by third parties (the same squatting problem that triggered the rebrand). We pivoted the two *public* npm packages to the **`@getdeckle`** scope (matching the domain). Internal workspace packages (`@deckle/api`, `@deckle/web`, `@deckle/dashboard`, `@deckle/mcp-server`) keep the `@deckle/*` names — they're private and never published, so org ownership is irrelevant.

## How it was executed (14 commits, `efeb557..3645001`)

1. **Bulk string replacement** (`374441f`) — 1,578 substitutions across 174 files via an ordered, collision-safe pass (longest patterns first). A sentinel pre-pass protected literal competitor/squatter URLs (`docuforge.app`, the npm/PyPI squatter links) from being rewritten. `audits/` excluded to preserve the historical record.
2. **Renames** (`0f534d1`) — Python module dir, Ruby gemspec + lib dir, Go files, Cursor rule, marketing mockups, and 5 blog slugs.
3. **Manifests + assets** (`d22d8bf`) — all packages → `1.0.0`; 17 brand PNGs swapped (favicons, icons, logos, OG image).
4. **Scoped-name + URL-artifact fixes** (`b7d2906`) — `@deckle/sdk` scoped name; stripped doubled `/deckle/deckle` URL artifacts the bulk pass produced; fixed bare `docuforge.dev` → `getdeckle.dev`.
5. **Test fix** (`521d7a8`) — health-endpoint version assertion → `1.0.0`.
6. **Auth backward-compat** (`d2c3ab4`) — API accepts **both** `df_live_` and `dk_live_` prefixes so existing customer keys keep working through the transition.
7. **Dockerfile fix** (`f310aef`) — removed a dead `COPY public/` (the dir had been deleted) + the redundant API `/llms.txt` routes that were duplicating the marketing site; this had been silently breaking Render's Docker build.
8. **@getdeckle pivot** (`421a045`) — moved the two published packages off the unavailable `@deckle` scope (90 replacements across 40 files).
9. **Housekeeping + history scrub** (`a16ca09`, `c1650d3`, plus a `git-filter-repo` force-push) — removed a stale lockfile and the one-off migration scripts; purged an accidentally-committed internal `deckle_rebrand/` planning folder from git history.

## Problems hit & resolved

| Problem | Resolution |
|---------|-----------|
| `docuforge` squatted on npm + PyPI; `@deckle` scope + bare `deckle` also taken | Pivoted public npm packages to `@getdeckle/*`; PyPI/RubyGems `deckle` were free |
| Vercel builds failing | Build Command still filtered `@docuforge/web` / `@docuforge/dashboard` → updated to `@deckle/*` |
| Render serving stale pre-rebrand image | Dockerfile `COPY public/` pointed at a deleted dir; removed it + dead routes |
| Render deploy death-spiral | Upstash Redis hit its monthly quota cap; the API hammered it and Render kept rolling back. Fixed by raising the Redis quota, then re-triggered the deploy |
| `R2`/CDN | PDFs serve from the R2 `pub-*.r2.dev` URL (works); branded `cdn.getdeckle.dev` deferred (needs DNS-on-Cloudflare for R2 custom domains) |
| DNS | Domain bought on Vercel; api/docs CNAMEs + Clerk's 5 CNAMEs added in Vercel DNS |
| Clerk | Migrated dev → production instance on `clerk.getdeckle.dev`; swapped `pk_live_`/`sk_live_` into Vercel + redeployed |
| Accidental commit of internal planning folder | `git-filter-repo` history scrub + force-push (backup bundle kept) |

## Final live state (verified)

- **Marketing** `https://getdeckle.dev` — 200, rebranded
- **Docs** `https://docs.getdeckle.dev` — live (Mintlify)
- **Dashboard** `https://app.getdeckle.dev` — live on production Clerk (`pk_live_`, `clerk.getdeckle.dev`)
- **API** `https://api.getdeckle.dev/health` — 200, rebrand code, Redis healthy, accepts `dk_live_` + `df_live_`
- **Packages**: `@getdeckle/sdk@1.0.0`, `@getdeckle/react-pdf@1.0.0` (npm), `deckle@1.0.0` (PyPI), `deckle 1.0.0` (RubyGems), `…/deckle/packages/sdk-go@v1.0.0` (Go) — all verified on their registries
- **End-to-end smoke test**: fresh `npm install @getdeckle/sdk @getdeckle/react-pdf` → `dk.generate({ html })` → working PDF (HTTP 200, application/pdf) in **4.3 s** zero-to-PDF

## Rollback

Pre-rebrand state is pinned at branch **`backup-pre-rebrand`** and in history-backup bundles under `~/deckle-history-backup-*` / `~/docuforge-history-backup-*`.

## Remaining tasks

See **[LAUNCH-REMAINING.md](LAUNCH-REMAINING.md)** — all optional polish (Cloudflare 301s, branded CDN, npm deprecation of the old package, `df_live_` sunset, external profile bios). Nothing blocks users today.
