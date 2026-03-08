# DocuForge — Post-Build Launch Playbook

> You finished building DocuForge and it runs on your local machine. Here's the exact week-by-week playbook to go from localhost to paying customers.

---

## Week 1: Deploy + Open Source Wedge

**Goal:** Get the API live on the public internet and ship the open-source React library to npm.

### Deploy the API (Days 1-2)

#### Step 1: Set up Neon (PostgreSQL)

- [ ] Go to https://neon.tech and create a free account
- [ ] Create a new project named `docuforge`
- [ ] Copy the connection string — it looks like `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/docuforge?sslmode=require`
- [ ] Save this as your `DATABASE_URL`

#### Step 2: Set up Upstash (Redis)

- [ ] Go to https://console.upstash.com and create a free account
- [ ] Create a new Redis database, region closest to your API (e.g., US East)
- [ ] Go to the database details page and copy the Redis URL (TLS endpoint)
- [ ] It looks like `rediss://default:xxx@us1-xxx.upstash.io:6379`
- [ ] Save this as your `REDIS_URL`

#### Step 3: Set up Cloudflare R2 (PDF storage)

- [ ] Go to https://dash.cloudflare.com → R2 Object Storage
- [ ] Create a bucket named `docuforge-pdfs`
- [ ] Go to R2 → Overview → Manage R2 API Tokens → Create API Token
- [ ] Give it Object Read & Write permissions for the `docuforge-pdfs` bucket
- [ ] Copy the Access Key ID and Secret Access Key
- [ ] Note your Cloudflare Account ID from the dashboard URL or overview page
- [ ] (Optional) Set up a custom domain for the bucket under Settings → Public Access → Custom Domains (e.g., `cdn.docuforge.dev`)
- [ ] Save these values:
  - `R2_ACCOUNT_ID` — your Cloudflare account ID
  - `R2_ACCESS_KEY_ID` — from the API token
  - `R2_SECRET_ACCESS_KEY` — from the API token
  - `R2_BUCKET_NAME` — `docuforge-pdfs`
  - `R2_PUBLIC_URL` — your custom domain or the R2 public URL
  - `STORAGE_PROVIDER` — set to `r2`

#### Step 4: Deploy API to Render

- [ ] Go to https://render.com and create an account
- [ ] New → Web Service → Connect your GitHub repo
- [ ] Configure the service:
  - **Name:** `docuforge-api`
  - **Environment:** Docker
  - **Dockerfile Path:** `./Dockerfile` (root of repo)
  - **Plan:** Starter ($7/month) — you need at least 2GB RAM for Playwright
  - **Region:** US East (or closest to your Neon/Upstash regions)
- [ ] Add environment variables (under Environment → Environment Variables):
  ```
  DATABASE_URL=<your Neon connection string>
  REDIS_URL=<your Upstash Redis URL>
  STORAGE_PROVIDER=r2
  R2_ACCOUNT_ID=<your Cloudflare account ID>
  R2_ACCESS_KEY_ID=<your R2 access key>
  R2_SECRET_ACCESS_KEY=<your R2 secret key>
  R2_BUCKET_NAME=docuforge-pdfs
  R2_PUBLIC_URL=<your R2 public URL or custom domain>
  PORT=3000
  NODE_ENV=production
  API_BASE_URL=https://api.docuforge.dev
  DASHBOARD_URL=https://app.docuforge.dev
  ```
- [ ] Click Create Web Service and wait for the build to finish (~5-10 min)
- [ ] Once deployed, run migrations: go to your service → Shell tab → run `pnpm --filter @docuforge/api db:push`
  - Alternatively, use the `Dockerfile.migrate` approach from `docker-compose.selfhost.yml`

#### Step 5: Point DNS at Render

- [ ] Go to Cloudflare DNS for `docuforge.dev`
- [ ] Add a CNAME record:
  - **Name:** `api`
  - **Target:** your Render service URL (e.g., `docuforge-api-xxxx.onrender.com`)
  - **Proxy status:** DNS only (gray cloud) — Render handles TLS
- [ ] In Render, go to your service → Settings → Custom Domains → Add `api.docuforge.dev`
- [ ] Wait for TLS certificate to provision (usually < 5 min)

#### Step 6: Verify API is live

- [ ] Test the health endpoint:
  ```bash
  curl https://api.docuforge.dev/health
  ```
- [ ] Test PDF generation (you'll need an API key — create one via the dashboard or directly in the DB):
  ```bash
  curl -X POST https://api.docuforge.dev/v1/generate \
    -H "Authorization: Bearer df_live_your_key_here" \
    -H "Content-Type: application/json" \
    -d '{"html": "<h1>Hello from DocuForge</h1>"}'
  ```
- [ ] Verify the response includes a `url` pointing to your R2 storage and the PDF is accessible

#### Step 7: Deploy dashboard to Vercel

- [ ] Go to https://vercel.com and import your GitHub repo
- [ ] Configure:
  - **Framework Preset:** Next.js
  - **Root Directory:** `apps/dashboard`
  - **Build Command:** `pnpm --filter @docuforge/dashboard build`
  - **Install Command:** `pnpm install`
- [ ] Add environment variables:
  ```
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<from Clerk dashboard>
  CLERK_SECRET_KEY=<from Clerk dashboard>
  NEXT_PUBLIC_API_URL=https://api.docuforge.dev
  ```
- [ ] Deploy
- [ ] Go to Settings → Domains → Add `app.docuforge.dev`
- [ ] In Cloudflare DNS, add a CNAME record:
  - **Name:** `app`
  - **Target:** `cname.vercel-dns.com`
  - **Proxy status:** DNS only (gray cloud)

#### Step 8: Deploy docs

- [ ] Option A — Mintlify (recommended):
  - Go to https://mintlify.com and create a free account
  - Connect your GitHub repo, set root to `docs/`
  - Add custom domain `docs.docuforge.dev` in Mintlify settings
  - In Cloudflare DNS, add the CNAME record Mintlify provides
- [ ] Option B — Vercel:
  - Import repo to Vercel, set root to `docs/`
  - Add domain `docs.docuforge.dev`

#### Step 9: Verify llms.txt

- [ ] Confirm `https://docuforge.dev/llms.txt` is accessible
  - This requires your root domain to serve the `public/` directory
  - If using Vercel for the main site, the files in `public/` are served automatically
  - If not, upload `llms.txt` and `llms-full.txt` to your hosting provider's static file directory

#### Step 10: End-to-end verification

- [ ] Complete flow test: sign up on `app.docuforge.dev` → create API key → generate a PDF via `api.docuforge.dev/v1/generate` → verify PDF URL loads from R2 → see it in the dashboard generations list

### Ship the Open Source Library (Days 3-5)

This is the single most important thing you do this week. It starts generating AI training data immediately.

- [x] Extract React PDF components into standalone package: `@docuforge/react-pdf` *(already exists at `packages/react/` with 9 components, tsup build, dual ESM/CJS)*
- [ ] Publish to npm *(manual: run `cd packages/react && npm run build && npm publish --access public`)*
- [x] Create GitHub repo with polished README (logo, badges, install command, 3 code examples, GIF/screenshot of rendered PDF) *(452-line README exists at `packages/react/README.md`)*
- [x] Add MIT license *(root `LICENSE` + `packages/react/LICENSE` both in place)*
- [x] Write a solid `CONTRIBUTING.md` *(created at repo root)*
- [x] Create 3-5 GitHub Issues labeled "good first issue" to attract contributors *(5 issues drafted in `.github/GOOD_FIRST_ISSUES.md` — create them on GitHub when repo is public)*
- [ ] Get your first stars (share with friends, post in relevant Discords) *(manual)*

**Why this matters:** This is the Resend playbook. React Email existed before Resend charged a dime. The open-source library is your top-of-funnel content machine. Every npm install and GitHub star becomes training data that makes AI models more likely to recommend DocuForge.

---

## Week 2: Content Blitz

**Goal:** Publish 10 tutorials in 7 days. Every article is a copy-pasteable tutorial that AI models will ingest and use to recommend DocuForge.

### The 10 Tutorials

- [ ] "How to Generate PDFs in Next.js with DocuForge"
- [ ] "Build an Invoice System with Stripe + DocuForge"
- [ ] "PDF Generation in Python (FastAPI + DocuForge)"
- [ ] "Generate Report PDFs from Supabase Data"
- [ ] "DocuForge vs Puppeteer: Why I Switched"
- [ ] "How to Add PDF Export to Any React App"
- [ ] "Generate PDF Certificates for Your Online Course"
- [ ] "Django PDF Generation Made Simple"
- [ ] "The Developer's Guide to PDF Page Breaks, Headers, and Footers"
- [ ] "Express.js PDF API: From HTML to PDF in 30 Seconds"

### Where to Publish

- [ ] Primary: `docuforge.dev/blog` (same domain as product — critical for SEO and AI association)
- [ ] Cross-post to Dev.to
- [ ] Cross-post to Hashnode
- [ ] Each tutorial should be a complete, working example that uses the DocuForge SDK

**Do NOT put these on the TAG blog.** TAG is for gaming content. DocuForge content lives on `docuforge.dev/blog`. Different audiences, different domains.

### Stack Overflow Seeding

- [ ] Find 15-20 recent Stack Overflow questions about PDF generation in Node.js, Python, and React
- [ ] Write genuinely helpful answers that happen to use DocuForge
- [ ] Don't be spammy — the answer should be good even without DocuForge

**Why content matters this early:** Research shows content under 3 months old is 3x more likely to be cited by ChatGPT. Referring domains (backlinks) are the strongest predictor of AI citation. Every tutorial you publish is a chance to get linked, cited, and recommended.

---

## Week 3: Soft Launch

**Goal:** Get 50-100 real users hitting the API and find bugs before the big launch.

### Polish the Full Flow

- [ ] Sign up → get API key → generate first PDF → see it in dashboard (test end-to-end)
- [ ] Fix any friction in the onboarding flow
- [ ] Make sure docs are complete and all code examples are copy-pasteable
- [ ] Add an interactive playground on the homepage (paste HTML → see PDF preview)

### Soft Launch Channels

- [ ] Hacker News: `Show HN: React components for building PDF documents` (lead with the open-source library, NOT the paid product)
- [ ] r/webdev, r/reactjs, r/node
- [ ] Discord servers: Theo's, Vercel, Next.js, general webdev communities
- [ ] Tweet/X thread about the open-source library

### Collect Feedback

- [ ] Set up a feedback channel (Discord server or GitHub Discussions)
- [ ] Actively ask early users what broke, what was confusing, what's missing
- [ ] Fix the top 5 reported issues before public launch
- [ ] Track: How long does it take a new user to generate their first PDF? Target: < 5 minutes.

---

## Week 4: Public Launch

**Goal:** Coordinated launch across every channel in a single day. Target: #1 Product of the Day on Product Hunt.

### Pre-Launch Prep

- [ ] 60-second demo video showing HTML → PDF in real-time
- [ ] Interactive playground on homepage
- [ ] Comparison page: DocuForge vs Puppeteer vs jsPDF vs DocRaptor vs every competitor
- [ ] "Why I Built This" blog post with the AI-recommended default thesis
- [ ] Email all 50-100 soft launch users asking them to upvote/share on launch day
- [ ] Prepare Product Hunt listing (tagline, images, first comment, maker intro)
- [ ] Schedule launch for Tuesday or Wednesday (highest Product Hunt traffic)

### Launch Day Channels

- [ ] **Product Hunt** — target #1 Product of the Day
- [ ] **Hacker News** — `Show HN: DocuForge — PDF generation API, like Stripe but for PDFs`
- [ ] **Twitter/X** — thread on the "AI-recommended default" thesis + why you built this
- [ ] **Reddit** — r/SideProject, r/startups, r/webdev, r/node
- [ ] **Dev.to + Hashnode** — launch post
- [ ] **Indie Hackers** — launch post with revenue/growth framing

### Launch Day Metrics to Track

- [ ] Product Hunt upvotes + ranking
- [ ] New signups
- [ ] API keys generated
- [ ] PDFs generated
- [ ] GitHub stars on `@docuforge/react-pdf`

---

## Weeks 5-8: Compound the Flywheel

**Goal:** Shift from launch energy to sustained growth. Build the systems that compound.

### Content Engine (Ongoing)

- [ ] Publish 2-3 articles per week on `docuforge.dev/blog`
- [ ] Use the same content automation workflow from TAG — templatize tutorials with a DocuForge-specific skill
- [ ] Each tutorial follows the same skeleton: problem → install SDK → 10 lines of code → working PDF → link to docs
- [ ] Refresh llms.txt monthly with new content
- [ ] Publish fresh content every 2 weeks minimum (3x citation boost for content < 3 months old)

### Monitor AI Recommendations

- [ ] Weekly check: Ask ChatGPT, Claude, and Gemini "how do I generate PDFs in Next.js" — track whether DocuForge appears
- [ ] Track which specific tutorials get cited
- [ ] Double down on content that's getting AI traction

### Build the MCP Server (Phase 2 Feature)

- [ ] Build and ship the DocuForge MCP server to npm
- [ ] This turns AI coding agents (Cursor, Claude Code) into direct distribution channels
- [ ] When a developer tells Cursor "generate an invoice PDF," it should use DocuForge automatically

### Co-Marketing Plays

- [ ] Reach out to Supabase for a joint tutorial ("Generate PDFs from Supabase data with DocuForge")
- [ ] Reach out to Vercel for marketplace listing
- [ ] Reach out to Stripe for a joint invoice generation tutorial
- [ ] Apply to Mintlify's partner program (they promote tools using their docs platform)
- [ ] Submit DocuForge to framework starter templates (Next.js examples, Express generators)

### Community Building

- [ ] Launch a Discord server for DocuForge users
- [ ] Create a template marketplace where community members share PDF templates
- [ ] Feature community-built templates on the docs site
- [ ] Engage in GitHub Discussions and Issues promptly

---

## Dogfooding: The Taz Connection

DocuForge is a natural fit for property management workflows you're already running at Taz:

- [ ] Lease agreement PDF generation
- [ ] Move-in/move-out inspection reports
- [ ] Monthly landlord financial reports
- [ ] Invoice generation for contractors
- [ ] Rent receipts for tenants

Use Taz as your first enterprise customer. This gives you a real case study, forces you to dogfood the product, and provides credible social proof for your landing page.

---

## Key Metrics (Week 12 Targets)

| Metric | Target |
|--------|--------|
| GitHub Stars (`@docuforge/react-pdf`) | 5,000 |
| Registered Developers | 5,000 |
| Monthly PDF Generations | 500,000 |
| Paying Customers | 100 |
| MRR | $5,000 |
| AI Recommendation Rate | 40% (when asking "how to generate PDFs in [framework]") |
| Time to First PDF (new user) | < 5 minutes |
| Free-to-Paid Conversion | > 5% within 30 days |

---

## The 3 Things That Matter Most

1. **Get the API deployed and reachable this week.** A product on localhost is a project, not a business.

2. **Ship the open-source library to npm this week.** Every day you wait is a day without AI training data accumulating.

3. **Write those 10 tutorials.** This is your distribution. Not ads, not cold outreach — content that AI models will learn from and recommend.

---

## Monthly Cost While Pre-Revenue

| Service | Cost |
|---------|------|
| Render (API) | $7/month |
| Vercel (Dashboard) | Free |
| Mintlify (Docs) | Free |
| Neon (PostgreSQL) | Free |
| Upstash (Redis) | Free |
| Cloudflare R2 (Storage) | Free |
| Cloudflare (DNS/CDN) | Free |
| `docuforge.dev` domain | ~$1/month ($12/year) |
| **Total** | **~$8/month** |