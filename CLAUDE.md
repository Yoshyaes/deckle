# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DocuForge is a PDF generation API ("Stripe for PDFs"). It accepts HTML or template data and returns pixel-perfect PDFs. The codebase is a pnpm monorepo with Turborepo orchestration.

## Commands

```bash
pnpm install                    # Install all workspace dependencies
pnpm dev                        # Run all dev servers (API :3000, Dashboard :3001)
pnpm build                      # Build all packages via Turborepo

# API server
pnpm --filter @docuforge/api dev        # API dev server with hot reload
pnpm --filter @docuforge/api build      # Build API
pnpm --filter @docuforge/api db:push    # Push schema to database
pnpm --filter @docuforge/api db:generate # Generate migration files
pnpm --filter @docuforge/api db:migrate  # Run migrations

# Testing
cd apps/api && npx vitest run           # Run all 36 API tests
cd apps/api && npx vitest run src/__tests__/generate-validation.test.ts  # Single test file

# Dashboard
pnpm --filter @docuforge/dashboard dev   # Next.js dev on port 3001
pnpm --filter @docuforge/dashboard build # Build dashboard

# TypeScript SDK
pnpm --filter docuforge build           # Build SDK (ESM + CJS + types)
pnpm --filter docuforge dev             # Watch mode build

# React component library
cd packages/react && npm run build      # Build @docuforge/react

# Playwright (required once before API dev)
cd apps/api && npx playwright install chromium

# Docker (self-hosted)
docker compose -f docker-compose.selfhost.yml up -d
```

## Architecture

**Monorepo layout** (`pnpm-workspace.yaml` covers `apps/*` and `packages/*`):

- **`apps/api`** — Hono API server. Playwright renders HTML→PDF. Drizzle ORM for PostgreSQL. Redis for rate limiting + BullMQ job queue. Multi-provider storage (local/R2/S3/GCS).
- **`apps/dashboard`** — Next.js 14 App Router. Clerk auth. Tailwind CSS with dark theme (#0A0A0B bg, #F97316 accent). DM Sans body font, JetBrains Mono for code.
- **`packages/sdk-typescript`** — npm package `docuforge`. Dual ESM/CJS build via tsup. `DocuForge` class with `generate()`, `fromTemplate()`, `fromReact()`, `batch()`, and `templates.*` namespace.
- **`packages/sdk-python`** — pip package `docuforge`. Mirrors TS SDK API. Uses httpx + Pydantic v2.
- **`packages/sdk-go`** — Go module `github.com/docuforge/docuforge-go`. Stdlib `net/http` + functional options. Context-based API.
- **`packages/sdk-ruby`** — Ruby gem `docuforge`. Uses Faraday HTTP client. Idiomatic Ruby API.
- **`packages/react`** — `@docuforge/react` component library (Document, Page, Header, Footer, Table, Grid, Watermark, Barcode, Signature).
- **`packages/mcp-server`** — MCP server for AI agent integration (Claude Desktop, Cursor, Claude Code). 7 tools.
- **`docs/`** — Mintlify documentation site. Framework guides for Next.js, Express, FastAPI, Django, Rails.
- **`public/`** — AI discoverability: `llms.txt`, `llms-full.txt`.

## Key Patterns

**ID prefixes** — All entities use nanoid with semantic prefixes: `gen_` (generations), `tmpl_` (templates), `df_live_` (API keys), `usr_` (users). See `apps/api/src/lib/id.ts`.

**API auth flow** — Bearer token (`df_live_...`) → look up by first 16 chars as `keyPrefix` → bcrypt compare full token → set user on Hono context (`c.get('user')`). Middleware chain: CORS → logging → (public routes bypass) → auth → rate limit → route handler → global error handler.

**Error hierarchy** — `AppError` base class in `apps/api/src/lib/errors.ts` with subclasses: `AuthError` (401), `RateLimitError` (429), `NotFoundError` (404), `UsageLimitError` (403), `ValidationError` (400). All caught by Hono's `app.onError` and serialized as `{ error: { code, message } }`.

**Rate limiting** — Redis sliding window (1s). Plan-based: free=10, starter/pro=100, enterprise=500 req/s. Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset.

**Browser pool** — Playwright keeps 2-3 Chromium instances alive, round-robin assignment, recycles each after 100 uses. Headers/footers interpolate `{{pageNumber}}`/`{{totalPages}}`.

**Template engine** — Handlebars syntax (`{{variable}}`, `{{#each}}`, `{{#if}}`). Templates stored in DB with JSON schema for expected variables. Version history tracked in `template_versions` table.

**React-to-PDF** — `apps/api/src/services/react-renderer.ts` transpiles JSX/TSX via esbuild (classic React.createElement transform), evaluates in a sandboxed Function with React injected, renders via `renderToStaticMarkup`.

**QR/Barcode placeholders** — `{{qr:data}}` and `{{barcode:data}}` in HTML are replaced with inline SVGs by `apps/api/src/services/barcodes.ts` before Playwright rendering.

**Batch queue** — BullMQ queue (`pdf-generation`) in `apps/api/src/services/queue.ts`. Worker processes jobs with concurrency of 5, 3 retries with exponential backoff.

**Storage providers** — Configured via `STORAGE_PROVIDER` env var (local/r2/s3/gcs). All use S3-compatible SDK. Fallback: `.storage/pdfs/` on local filesystem.

**Usage tracking** — `usage_daily` table with composite PK (userId + date). Monthly limits checked before generation.

## API Routes

All protected routes are under `/v1/*` and require auth. Route files are in `apps/api/src/routes/`:

**PDF Generation:**
- `POST /v1/generate` — Main endpoint. Accepts `html`, `react`, or `template`+`data`. Supports `watermark` and `options`.
- `POST /v1/generate/batch` — Batch async generation via BullMQ. Returns 202.

**PDF Tools** (`/v1/pdf/*`):
- `POST /v1/pdf/merge` — Merge multiple PDFs (base64 input).
- `POST /v1/pdf/split` — Split PDF by page ranges.
- `POST /v1/pdf/protect` — Add password protection metadata.
- `POST /v1/pdf/info` — Get PDF metadata.
- `POST /v1/pdf/sign` — Add visual digital signature.
- `POST /v1/pdf/pdfa` — Convert to PDF/A-1b format.
- `POST /v1/pdf/forms/fill` — Fill form fields in existing PDF.
- `POST /v1/pdf/forms/add-fields` — Add form fields (text, checkbox, dropdown).
- `POST /v1/pdf/forms/list-fields` — List form fields in a PDF.

**Templates:**
- CRUD on `/v1/templates` — Create/list/get/update/delete. PUT increments version and saves to history.
- `GET /v1/templates/:id/versions` — List version history.
- `GET /v1/templates/:id/versions/:versionId` — Get specific version content.
- `POST /v1/templates/:id/restore` — Restore to a previous version.

**Marketplace:**
- `GET /v1/marketplace` — Browse public templates.
- `POST /v1/marketplace/:id/clone` — Clone a public template.
- `POST /v1/marketplace/:id/publish` / `unpublish` — Publish/unpublish own templates.

**Starter Templates:**
- `GET /v1/starter-templates` — Public (no auth). Lists 5 pre-built templates.
- `POST /v1/starter-templates/:slug/clone` — Clone starter (auth required).

**AI:**
- `POST /v1/ai/generate-template` — AI-powered template generation using Claude. Requires `ANTHROPIC_API_KEY`.

**Integrations** (Zapier/Make):
- `GET /v1/integrations/triggers/new-generation` — Polling trigger for new generations.
- `GET /v1/integrations/triggers/new-template` — Polling trigger for new templates.
- `POST /v1/integrations/actions/generate` — Simplified generate action.
- `GET /v1/integrations/auth/test` — Connection test.

**Other:**
- `GET /v1/generations/:id` and `GET /v1/generations` — Generation history.
- `GET /v1/usage` — Current billing period stats.
- `GET /health` — Public, no auth.

## Dashboard Pages

- `/` — Overview with usage stats, recent generations
- `/generations` — Generation history with filtering
- `/templates` — Template list, links to gallery and visual editor
- `/templates/[id]` — Template code editor with version history panel
- `/templates/gallery` — Pre-built template gallery (clone to start)
- `/templates/editor` — Visual drag-and-drop template builder
- `/marketplace` — Browse and clone community templates
- `/keys` — API key management (create/delete)
- `/usage` — Usage statistics

## SDK Conventions

All SDKs (TS, Python, Go, Ruby) share identical response shapes. Key response: `{ id, status, url, pages, file_size, generation_time_ms }`.

## Environment Variables

Required for API: `DATABASE_URL`, `REDIS_URL`. Optional: `STORAGE_PROVIDER` (local/r2/s3/gcs), `R2_*`/`AWS_*`/`GCS_*` vars, `PORT` (default 3000), `ANTHROPIC_API_KEY` (for AI templates). Dashboard: `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `DOCUFORGE_DEV_BYPASS=true` for local dev.

## Deployment

**Docker**: `Dockerfile` at repo root. `docker-compose.selfhost.yml` for full self-hosted stack (API + Postgres + Redis).

**Fly.io**: Config in `fly.toml` (2GB RAM, 2 shared CPUs — Playwright needs memory). `fly secrets set ...` then `fly deploy`.
