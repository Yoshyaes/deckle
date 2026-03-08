# DocuForge Deployment Guide

## Table of Contents

- [Local Development](#local-development)
- [Self-Hosted Docker](#self-hosted-docker)
- [Public Deployment](#public-deployment)
- [Environment Variables Reference](#environment-variables-reference)

---

## Local Development

### Prerequisites

- **Node.js** 20+
- **pnpm** 10+ (`npm install -g pnpm`)
- **PostgreSQL** — use [Neon](https://neon.tech) free tier (serverless, no local install needed)
- **Redis** (optional) — use [Upstash](https://upstash.com) free tier, or skip (rate limiting will passthrough)

### 1. Install Dependencies

```bash
pnpm install
```

This also auto-installs Playwright's Chromium browser (~400MB on first run).

If Chromium doesn't install automatically:

```bash
npx playwright install chromium
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Fill in the **minimum required** variables:

| Variable | Where to get it |
|----------|----------------|
| `DATABASE_URL` | [Neon Console](https://console.neon.tech) — create a project, copy the connection string |
| `CLERK_SECRET_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) — create an app, copy from API Keys |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same Clerk dashboard |

Optional for full functionality:

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Rate limiting + BullMQ batch queue (without it, rate limiting passthroughs; batch endpoint won't work) |
| `STORAGE_PROVIDER` | Storage backend: `local`, `r2`, `s3`, or `gcs` (default: auto-detects from env vars) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Cloudflare R2 storage (without it, PDFs save to local `./storage/`) |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME` | AWS S3 storage (alternative to R2) |
| `GOOGLE_ACCESS_KEY_ID`, `GOOGLE_SECRET_ACCESS_KEY`, `GCS_BUCKET_NAME` | Google Cloud Storage via S3-compatible interop |
| `ANTHROPIC_API_KEY` | AI template generation (`POST /v1/ai/generate-template`) — optional |
| `CLERK_WEBHOOK_SECRET` | Auto-create DB users on Clerk signup |
| `WEBHOOK_SIGNING_SECRET` | HMAC signing for outbound webhooks |

### 3. Set Up the Database

```bash
# Push the Drizzle schema to your Neon database
pnpm --filter @docuforge/api db:push

# Seed a test user and API key for local development
pnpm --filter @docuforge/api db:seed
```

The seed script creates:
- **User:** `dev@docuforge.local` (pro plan)
- **API Key:** `df_live_test_key_for_local_dev_only_do_not_use_in_prod`

### 4. Start Dev Servers

```bash
pnpm dev
```

This starts both services via Turborepo:

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| Dashboard | http://localhost:3001 |

### 5. Verify It Works

**Health check:**

```bash
curl http://localhost:3000/health
```

**Generate a PDF:**

```bash
curl -X POST http://localhost:3000/v1/generate \
  -H "Authorization: Bearer df_live_test_key_for_local_dev_only_do_not_use_in_prod" \
  -H "Content-Type: application/json" \
  -d '{"html": "<h1>Hello DocuForge</h1>"}'
```

**Dashboard:** Open http://localhost:3001 and sign in via Clerk.

### 6. Run Tests

```bash
# Run all tests
pnpm --filter @docuforge/api test

# Watch mode
pnpm --filter @docuforge/api test:watch
```

### 7. Build SDKs & Packages (optional)

```bash
# TypeScript SDK
pnpm --filter docuforge build

# React component library
cd packages/react && npm install && npm run build

# MCP Server
cd packages/mcp-server && npm install && npm run build

# Go SDK — no build step, just `go mod tidy` from packages/sdk-go
# Ruby SDK — no build step, just `bundle install` from packages/sdk-ruby
```

---

## Self-Hosted Docker

The easiest way to deploy the full DocuForge stack on your own infrastructure.

### Prerequisites

- **Docker** 20+ with Compose v2
- At least **2GB RAM** (Playwright Chromium requirement)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/yourusername/docuforge.git
cd docuforge

# Start the full stack (API + PostgreSQL + Redis)
docker compose -f docker-compose.selfhost.yml up -d
```

This starts:

| Service | Port | Description |
|---------|------|-------------|
| **api** | 3000 | DocuForge API (Hono + Playwright) |
| **postgres** | 5432 | PostgreSQL 16 |
| **redis** | 6379 | Redis 7 (rate limiting + job queue) |

### Configuration

Override environment variables by creating a `.env` file or passing them to Docker:

```bash
docker compose -f docker-compose.selfhost.yml up -d \
  -e STORAGE_PROVIDER=s3 \
  -e AWS_ACCESS_KEY_ID=... \
  -e AWS_SECRET_ACCESS_KEY=... \
  -e S3_BUCKET_NAME=my-pdfs \
  -e ANTHROPIC_API_KEY=sk-ant-...
```

### Database Migrations

On first run, you need to push the schema:

```bash
# Run inside the API container
docker compose -f docker-compose.selfhost.yml exec api \
  npx drizzle-kit push
```

Or seed a dev user:

```bash
docker compose -f docker-compose.selfhost.yml exec api \
  node src/scripts/seed.js
```

### Health Check

```bash
curl http://localhost:3000/health
# {"status":"ok","version":"0.1.0","timestamp":"..."}
```

### Volumes

Data persists across restarts in Docker volumes:

| Volume | Contents |
|--------|----------|
| `pgdata` | PostgreSQL database files |
| `redis-data` | Redis persistence |
| `pdf-storage` | Locally stored PDFs (when `STORAGE_PROVIDER=local`) |

---

## Public Deployment

DocuForge is split across multiple services, each deployed to the platform best suited for it:

| Component | Platform | Why |
|-----------|----------|-----|
| **API** (Hono + Playwright) | [Fly.io](https://fly.io) | Docker containers with 2GB RAM for Chromium |
| **Dashboard** (Next.js) | [Vercel](https://vercel.com) | Native Next.js support, edge network |
| **Docs** (Mintlify) | [Mintlify](https://mintlify.com) | Their hosted platform |
| **Database** | [Neon](https://neon.tech) | Serverless PostgreSQL (same as local) |
| **Redis** | [Upstash](https://upstash.com) | Serverless Redis |
| **PDF Storage** | [Cloudflare R2](https://www.cloudflare.com/products/r2/) / [AWS S3](https://aws.amazon.com/s3/) / [GCS](https://cloud.google.com/storage) | S3-compatible; R2 has no egress fees |

### API on Fly.io

The API requires a real container (not serverless) because Playwright needs ~400MB Chromium + 2GB RAM.

#### First-time setup

```bash
# Install the Fly CLI
curl -L https://fly.io/install.sh | sh

# Log in (creates a free account if needed)
fly auth login

# Launch the app (from the repo root)
fly launch --name docuforge-api --region iad --no-deploy
```

#### Set secrets

```bash
fly secrets set \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="redis://..." \
  STORAGE_PROVIDER="r2" \
  R2_ACCOUNT_ID="..." \
  R2_ACCESS_KEY_ID="..." \
  R2_SECRET_ACCESS_KEY="..." \
  R2_BUCKET_NAME="docuforge-pdfs" \
  R2_PUBLIC_URL="https://cdn.yourdomain.com" \
  CLERK_WEBHOOK_SECRET="..." \
  WEBHOOK_SIGNING_SECRET="whsec_..." \
  ANTHROPIC_API_KEY="sk-ant-..."
```

#### Deploy

```bash
fly deploy
```

The included `fly.toml` is pre-configured with:
- **Region:** `iad` (US East) — change `primary_region` for your audience
- **VM:** 2GB RAM, 2 shared CPUs (enough for Playwright)
- **Health check:** HTTP on `/health`
- **Auto-scaling:** Machines stop when idle, start on incoming requests
- **Minimum:** 1 machine always running (prevents cold starts)

#### Custom domain

```bash
fly certs add api.yourdomain.com
```

Then add a CNAME record: `api.yourdomain.com` -> `docuforge-api.fly.dev`

### Dashboard on Vercel

#### First-time setup

```bash
npm i -g vercel
vercel login
```

#### Deploy

From the repo root:

```bash
vercel --cwd apps/dashboard
```

Or connect the GitHub repo in the [Vercel Dashboard](https://vercel.com/dashboard) and set:
- **Root Directory:** `apps/dashboard`
- **Framework Preset:** Next.js

#### Environment variables

Set these in the Vercel project settings (Settings > Environment Variables):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Your Clerk publishable key |
| `CLERK_SECRET_KEY` | Your Clerk secret key |
| `DATABASE_URL` | Your Neon connection string |
| `NEXT_PUBLIC_API_URL` | Your Fly.io API URL (e.g., `https://docuforge-api.fly.dev`) |

#### Custom domain

Add your domain in Vercel project settings > Domains (e.g., `app.yourdomain.com`).

### Docs on Mintlify

1. Go to [mintlify.com](https://mintlify.com) and create an account
2. Connect your GitHub repo
3. Set the docs directory to `apps/docs`
4. Mintlify auto-deploys on push to main

Custom domain: Configure in Mintlify dashboard (e.g., `docs.yourdomain.com`).

### Clerk Webhook Setup

To auto-create database users when people sign up:

1. Go to **Clerk Dashboard > Webhooks**
2. Add endpoint: `https://docuforge-api.fly.dev/webhooks/clerk`
3. Subscribe to events: `user.created`, `user.updated`, `user.deleted`
4. Copy the **Signing Secret** and set it as `CLERK_WEBHOOK_SECRET` in Fly.io secrets

### Cloudflare R2 Setup

1. Go to **Cloudflare Dashboard > R2**
2. Create a bucket named `docuforge-pdfs`
3. Create an API token with read/write access to the bucket
4. Set the R2 env vars in Fly.io secrets
5. (Optional) Connect a custom domain for the public URL (e.g., `cdn.yourdomain.com`)

---

## Environment Variables Reference

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | API, Dashboard | PostgreSQL connection string |
| `REDIS_URL` | Recommended | API | Redis for rate limiting + BullMQ batch queue |
| **Storage (choose one provider)** | | | |
| `STORAGE_PROVIDER` | No | API | `local`, `r2`, `s3`, or `gcs` (auto-detects if not set) |
| `R2_ACCOUNT_ID` | No | API | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | No | API | R2 API token key ID |
| `R2_SECRET_ACCESS_KEY` | No | API | R2 API token secret |
| `R2_BUCKET_NAME` | No | API | R2 bucket name (default: `docuforge-pdfs`) |
| `R2_PUBLIC_URL` | No | API | Public URL for accessing stored PDFs |
| `AWS_ACCESS_KEY_ID` | No | API | AWS S3 access key |
| `AWS_SECRET_ACCESS_KEY` | No | API | AWS S3 secret key |
| `AWS_REGION` | No | API | AWS region (default: `us-east-1`) |
| `S3_BUCKET_NAME` | No | API | S3 bucket name (default: `docuforge-pdfs`) |
| `S3_PUBLIC_URL` | No | API | Public URL for S3-stored PDFs |
| `GOOGLE_ACCESS_KEY_ID` | No | API | GCS interop access key |
| `GOOGLE_SECRET_ACCESS_KEY` | No | API | GCS interop secret key |
| `GCS_BUCKET_NAME` | No | API | GCS bucket name (default: `docuforge-pdfs`) |
| `GCS_PUBLIC_URL` | No | API | Public URL for GCS-stored PDFs |
| **Auth** | | | |
| `CLERK_SECRET_KEY` | Yes | API, Dashboard | Clerk backend secret key |
| `CLERK_WEBHOOK_SECRET` | No | API | Clerk webhook signing secret (Svix) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Dashboard | Clerk frontend publishable key |
| `DOCUFORGE_DEV_BYPASS` | No | Dashboard | Set to `true` to bypass Clerk auth in local dev |
| **Features** | | | |
| `ANTHROPIC_API_KEY` | No | API | Enables AI template generation (`/v1/ai/generate-template`) |
| `WEBHOOK_SIGNING_SECRET` | No | API | HMAC secret for outbound webhook signatures |
| `STRIPE_SECRET_KEY` | No | API | Stripe secret key (not yet implemented) |
| `STRIPE_WEBHOOK_SECRET` | No | API | Stripe webhook secret (not yet implemented) |
| **Server** | | | |
| `API_BASE_URL` | No | API | API base URL (default: `http://localhost:3000`) |
| `DASHBOARD_URL` | No | API | Dashboard URL (default: `http://localhost:3001`) |
| `PORT` | No | API | Server port (default: `3000`) |
| `NODE_ENV` | No | API | `development` or `production` |

---

## Cost Estimates

At low traffic, everything runs on free tiers:

| Service | Free Tier | Paid Starts At |
|---------|-----------|----------------|
| Fly.io | 3 shared VMs, 256MB each | ~$5-15/mo for 2GB VM |
| Vercel | 100GB bandwidth, serverless | $20/mo pro plan |
| Neon | 0.5GB storage, 190 compute hours | $19/mo |
| Upstash | 10K commands/day | $0.20/100K commands |
| Cloudflare R2 | 10GB storage, 10M reads | $0.015/GB stored |
| Clerk | 10K MAUs | $25/mo |
| Mintlify | Free for open-source | $150/mo for custom domain |

**Realistic launch cost: $0-5/month** until you exceed free tiers.
