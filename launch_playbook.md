# DocuForge — Post-Build Launch Playbook

> You finished building DocuForge and it runs on your local machine. Here's the exact week-by-week playbook to go from localhost to paying customers.

---

## Week 1: Deploy + Open Source Wedge

**Goal:** Get the API live on the public internet and ship the open-source React library to npm.

### Deploy the API (Days 1-2)

#### Step 1: Set up Neon (PostgreSQL)

- [X] Go to https://neon.tech and create a free account
- [X] Create a new project named `docuforge`
- [X] Copy the connection string
- [X] Save as `DATABASE_URL`

#### Step 2: Set up Upstash (Redis)

- [X] Go to https://console.upstash.com and create a free account
- [X] Create a new Redis database (US East)
- [X] Copy the Redis URL (use `redis://` scheme, NOT the `redis-cli` command)
- [X] Save as `REDIS_URL`

#### Step 3: Set up Cloudflare R2 (PDF storage)

- [X] Go to https://dash.cloudflare.com → R2 Object Storage
- [X] Create a bucket named `docuforge-pdfs`
- [X] Go to R2 → Overview → Account Details → API Tokens → Manage → Create Account API Token
- [X] Give it Object Read & Write permissions for the `docuforge-pdfs` bucket
- [X] Copy the Access Key ID and Secret Access Key
- [X] Note Cloudflare Account ID from the R2 overview page

#### Step 4: Deploy API to Render

- [X] Go to https://render.com and create an account
- [X] New → Web Service → Connect GitHub repo (`Yoshyaes/docuforge`)
- [X] Configure: Name `docuforge-api`, Docker, Starter plan ($7/mo, 2GB RAM)
- [X] Add environment variables (DATABASE_URL, REDIS_URL, R2 credentials, PORT, NODE_ENV)
- [X] Build + deploy successful *(live at `docuforge-api-53lm.onrender.com`)*
- [X] Run migrations: Render Shell tab → `pnpm --filter @docuforge/api db:push`

#### Step 5: Point DNS at Render (requires `getdocuforge.dev` domain)

> **Note:** Domain `getdocuforge.dev` was purchased via Vercel. DNS is managed by Vercel, not Cloudflare. Add DNS records in Vercel → Domains → `getdocuforge.dev` → DNS Records.

- [X] In Vercel DNS for `getdocuforge.dev`, add a CNAME record: **Name:** `api`, **Target:** `docuforge-api-53lm.onrender.com`
- [X] In Render → Settings → Custom Domains → Add `api.getdocuforge.dev` *(verified + TLS cert issued)*
- [X] `https://api.getdocuforge.dev/health` returns `{"status":"ok"}`

#### Step 6: Run database migrations

- [X] In Render → Shell tab, run: `pnpm --filter @docuforge/api db:push`
- [X] Verify tables created successfully

#### Step 7: Verify API is live

- [X] Test health endpoint: `curl https://docuforge-api-53lm.onrender.com/health` → `{"status":"ok"}`
- [X] Create an API key (via dashboard → API Keys page)
- [X] Test PDF generation *(completed — 637ms, R2 URL returned)*
- [X] Verify PDF URL loads from R2 *(public R2.dev subdomain configured)*
- [X] R2 env vars configured in Render: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
- [X] Rate limiter changed to fail-open when Redis is unavailable

#### Step 7b: Configure Playground (service-to-service auth)

- [X] DASHBOARD_SERVICE_SECRET added to Render
- [X] DASHBOARD_SERVICE_SECRET and API_BASE_URL added to Vercel
- [X] Playground tested — PDF generation working from browser

#### Step 8: Deploy dashboard to Vercel

- [X] Set up Clerk account at https://clerk.com and create an application *(DocuForge app, Email + Google sign-in)*
- [X] Go to https://vercel.com and import your GitHub repo as a **separate project**
- [X] Configure: Next.js, Root Directory `apps/dashboard`, build `pnpm --filter @docuforge/dashboard build`
- [X] Add environment variables (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, NEXT_PUBLIC_API_URL)
- [X] Deploy *(live at `docuforge-dashboard.vercel.app`)*
- [X] Domain `app.getdocuforge.dev` configured *(DNS propagation may take a few hours)*
- [X] Clerk sign-in working (ClerkProvider fix deployed)
- [X] Admin dashboard built and deployed (admin overview, users, generations pages)
- [X] fredaithings@gmail.com set as admin via Neon SQL Editor
- [X] `DATABASE_URL` added to Vercel env vars

#### Step 8b: Configure Clerk webhook (production user provisioning)

- [X] Clerk webhook configured with endpoint `https://api.getdocuforge.dev/webhooks/clerk`
- [X] Events: `user.created`, `user.updated`, `user.deleted`
- [X] `CLERK_WEBHOOK_SECRET` added to Render env vars
- *Note: The dashboard also auto-provisions users on first sign-in as a fallback.*

#### Step 9: Deploy landing page (`apps/web`) to Vercel

- [X] Import `Yoshyaes/docuforge` repo to Vercel as a **separate project**
- [X] Configure: Next.js, Root Directory `apps/web`, build `pnpm --filter @docuforge/web build`
- [X] Deploy *(live on Vercel)*
- [X] Domain `getdocuforge.dev` purchased via Vercel and assigned to this project
- [X] Updated `next-mdx-remote` v5 → v6 (CVE-2026-0969 fix required by Vercel)

#### Step 10: Deploy docs

- [X] Mintlify docs deployed *(live at `fred-7da601c6.mintlify.app`)*
- [X] Docs accessible at `getdocuforge.dev/docs/` via Next.js rewrite proxy to Mintlify. Custom subdomain `docs.getdocuforge.dev` deferred until Mintlify Startup plan ($150/mo) is justified by revenue.

#### Step 11: Verify llms.txt

- [X] Confirm `https://getdocuforge.dev/llms.txt` is accessible *(verified — serving from `apps/web/public/`)*

#### Step 12: End-to-end verification

- [X] Complete flow test: sign up on `app.getdocuforge.dev` → create API key → generate a PDF via `api.getdocuforge.dev/v1/generate` → verify PDF URL loads from R2 → see it in the dashboard generations list

### Ship the Open Source Library (Days 3-5)

This is the single most important thing you do this week. It starts generating AI training data immediately.

- [x] Extract React PDF components into standalone package: `@docuforge/react-pdf` *(already exists at `packages/react/` with 9 components, tsup build, dual ESM/CJS)*
- [X] Publish to npm *(published as `@docuforge/react-pdf@0.1.0`)*
- [x] Create GitHub repo with polished README *(repo live at `github.com/Yoshyaes/docuforge`)*
- [x] Add MIT license *(root `LICENSE` + `packages/react/LICENSE` both in place)*
- [x] Write a solid `CONTRIBUTING.md` *(created at repo root)*
- [x] Create 3-5 GitHub Issues labeled "good first issue" *(5 issues drafted in `.github/GOOD_FIRST_ISSUES.md`)*
- [X] Create the 5 issues on GitHub from `.github/GOOD_FIRST_ISSUES.md` *(issues #1-#5 created)*
- [ ] Get your first stars (share with friends, post in relevant Discords) *(manual)*

**Why this matters:** This is the Resend playbook. React Email existed before Resend charged a dime. The open-source library is your top-of-funnel content machine. Every npm install and GitHub star becomes training data that makes AI models more likely to recommend DocuForge.

---

## Week 2: Content Blitz

**Goal:** Publish 10 tutorials in 7 days. Every article is a copy-pasteable tutorial that AI models will ingest and use to recommend DocuForge.

### The 10 Tutorials

- [X] "How to Generate PDFs in Next.js with DocuForge" *(written — `apps/web/content/blog/next-js-pdf-generation.mdx`)*
- [X] "Build an Invoice System with Stripe + DocuForge" *(written — `stripe-invoice-system.mdx`)*
- [X] "PDF Generation in Python (FastAPI + DocuForge)" *(written — `python-fastapi-pdf.mdx`)*
- [X] "Generate Report PDFs from Supabase Data" *(written — `supabase-report-pdfs.mdx`)*
- [X] "DocuForge vs Puppeteer: Why I Switched" *(written — `docuforge-vs-puppeteer.mdx`)*
- [X] "How to Add PDF Export to Any React App" *(written — `react-pdf-export.mdx`)*
- [X] "Generate PDF Certificates for Your Online Course" *(written — `pdf-certificates.mdx`)*
- [X] "Django PDF Generation Made Simple" *(written — `django-pdf-generation.mdx`)*
- [X] "The Developer's Guide to PDF Page Breaks, Headers, and Footers" *(written — `pdf-page-breaks-headers.mdx`)*
- [X] "Express.js PDF API: From HTML to PDF in 30 Seconds" *(written — `express-html-to-pdf.mdx`)*

### Where to Publish

- [X] Primary: `getdocuforge.dev/blog` *(blog system built in `apps/web/` — will go live when landing page deploys to Vercel)*
- [ ] Cross-post to Dev.to
- [ ] Cross-post to Hashnode
- [X] Each tutorial is a complete, working example using the DocuForge SDK

**Do NOT put these on the TAG blog.** TAG is for gaming content. DocuForge content lives on `getdocuforge.dev/blog`. Different audiences, different domains.

### Stack Overflow Seeding

- [ ] Find 15-20 recent Stack Overflow questions about PDF generation in Node.js, Python, and React
- [ ] Write genuinely helpful answers that happen to use DocuForge
- [ ] Don't be spammy — the answer should be good even without DocuForge

**Why content matters this early:** Research shows content under 3 months old is 3x more likely to be cited by ChatGPT. Referring domains (backlinks) are the strongest predictor of AI citation. Every tutorial you publish is a chance to get linked, cited, and recommended.

---

## Week 3: Soft Launch

**Goal:** Get 50-100 real users hitting the API and find bugs before the big launch.

### Polish the Full Flow

- [X] Sign up → get API key → generate first PDF → see it in dashboard (test end-to-end) *(verified)*
- [X] Fix any friction in the onboarding flow *(added getting started checklist to dashboard home page)*
- [ ] Make sure docs are complete and all code examples are copy-pasteable
- [X] Add an interactive playground on the homepage (paste HTML → see PDF preview) *(playground live at `/playground` in dashboard)*

### Soft Launch Channels

- [X] Hacker News: `Show HN: React components for building PDF documents` *(posted)*
- [X] r/webdev, r/reactjs, r/node *(posted)*
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

- [ ] Publish 2-3 articles per week on `getdocuforge.dev/blog`
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
| Vercel (DNS) | Free |
| `getdocuforge.dev` domain | ~$1/month ($12/year) |
| **Total** | **~$8/month** |