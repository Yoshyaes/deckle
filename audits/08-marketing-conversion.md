# Marketing Site & Conversion — Teardown

Scope: `apps/web` only. A skeptical-buyer's 30-second pass plus a deep-dive on every section, the blog, SEO, legal, and tracking.

Files of record:
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/components/sections/*.tsx`
- `apps/web/src/components/layout/{navbar,footer}.tsx`
- `apps/web/src/lib/constants.ts`
- `apps/web/src/lib/blog.ts`
- `apps/web/src/app/blog/page.tsx`, `apps/web/src/app/blog/[slug]/page.tsx`
- `apps/web/content/blog/*.mdx`
- `apps/web/public/{llms.txt,llms-full.txt,og-image.png,...}`
- `apps/web/next.config.mjs`

---

## TL;DR

This site looks polished on the surface — dark theme, gradient accent, Framer Motion reveals, a sensible 11-section narrative arc — but it does not survive 60 seconds of scrutiny from a serious buyer. The first three failure modes that will kill conversion:

1. **The hero code sample is broken JavaScript.** `import DocuForge from 'docuforge'` is a default import, but the SDK only exports a named `DocuForge` class. The very next line then calls `docuforge.generate(...)` — a variable that is never declared. The promise of "copy this and ship" dies in the hero. Every code-showcase variant repeats the broken default import. The template tab uses `templateId:` while the SDK's `TemplateParams` requires `template:`. The React tab calls `client.fromReact({ component: ... })` while the SDK requires `react:`. This isn't a typo — it's four wrong API shapes on the page that defines the product.
2. **Every trust signal is fake or stub.** Logo wall is `['Vercel', 'Supabase', 'Stripe', 'Linear', 'Resend', 'Neon']` rendered as text at 40% opacity with a `Trusted by developers building at` heading — placeholder logos for companies that almost certainly are not customers. Testimonials are three fabricated humans ("Sarah Chen at InvoiceStack", "Marcus Rodriguez at ReportLab", "Priya Sharma at CourseHub"). Metrics: "10,000+ PDFs generated", "99.9% Uptime", "<500ms Avg response" — none sourced, none datestamped. A buyer who Googles InvoiceStack or ReportLab finds nothing and bounces.
3. **No legal pages, no status page, no security page exist.** The footer links `Status` to `#` and `Discord` to `#`. There is no `/pricing`, `/terms`, `/privacy`, `/security`, `/about`, `/contact`, `/dpa`, `/status`. Pricing is an in-page anchor only. For a B2B API that holds customer documents, the absence of even a Privacy stub is a non-starter for compliance review.

Add to that: the Docs link points to `https://fred-7da601c6.mintlify.app` — a personal preview URL, not a custom domain — leaking the founder's name from the navbar and footer. Plus: no `robots.txt`, no `sitemap.xml`, no JSON-LD, no canonical URLs on blog posts, no analytics, no UTM handling, no conversion events, no OG-per-post.

If this site shipped today, the steel-man case for it is "a strong design system around a placeholder product." Aggregate count below: 64 findings.

---

## What's actually good

- **Narrative arc is correct.** Hero → social proof → how → features → code → SDKs → comparison → testimonials → blog → pricing → final CTA is a textbook developer-tools landing structure.
- **Primary CTA is consistent and unambiguous.** "Start for Free" → `app.getdocuforge.dev/sign-up` appears in hero, pricing, final CTA, navbar (as "Get Started Free"). One click to signup from anywhere on the page.
- **Above-the-fold CTA is visible** without scrolling, with a secondary "Read the Docs" pairing — exactly right for developer tooling.
- **Free tier is loud, not buried.** "$0 per month, forever" in a 5xl heading with a bulleted list of included features and a "no credit card" reassurance. This is the single best-executed block on the site.
- **Risk-reducer microcopy under the CTA** ("100 PDFs/month free. No credit card required.") is the right move and well-placed.
- **Three-step "How it works"** is the right step count and the icons (Code2 / Send / FileDown) actually communicate the API loop.
- **Visual hero pairing of request + response code blocks** is a smart developer-tools convention — buyers can see what comes back without reading docs.
- **OG image, Twitter card, and full favicon set are present** (`og-image.png`, `twitter-banner.png`, `favicon-16x16/32x32`, `apple-touch-icon.png`, 64/128/512/1024 icons). Better than average for a beta site.
- **Per-post OG metadata** is generated via `generateMetadata` in `apps/web/src/app/blog/[slug]/page.tsx` with `type: 'article'` and `publishedTime`. Half-correct (missing canonical, twitter, image).
- **Static generation** of blog routes via `generateStaticParams` — fast, indexable.
- **Blog inventory exists.** 10 MDX posts in `apps/web/content/blog/`, each frontmattered with title/description/date/category/readingTime. Better than most beta sites.
- **`llms.txt` and `llms-full.txt` exist** for AI discoverability — `llms-full.txt` is 245 lines with real API examples. Few competitors do this.
- **Reduced-motion-friendly structure** is theoretically achievable — animations are isolated to ScrollReveal and the hero (though no `prefers-reduced-motion` honoring; see a11y agent).

---

## Section-by-section findings

### Hero (`apps/web/src/components/sections/hero.tsx`)

**[P0] Hero code sample uses a default import that does not exist.** `import DocuForge from 'docuforge';` — the SDK at `packages/sdk-typescript/src/index.ts` only exports `export class DocuForge`, never a default. This will throw `TypeError: docuforge is not a constructor` on copy-paste. Must be `import { DocuForge } from 'docuforge';`.

**[P0] Hero code calls `docuforge.generate(...)` but never declares `docuforge`.** Line 9 calls a `docuforge` instance that was never instantiated. There's no `const docuforge = new DocuForge('...')`. The most prominent code block on the marketing site cannot run. This is the single highest-credibility-damage bug on the site.

**[P0] Hero response JSON is missing `file_size`** while every other code sample includes it. Tiny, but signals the marketing data is hand-authored without checking the real response shape.

**[P1] Headline is generic.** "HTML in. Pixel-perfect PDFs out." is fine but does not differentiate vs Puppeteer/DocRaptor/Gotenberg. Every PDF API claims pixel-perfection. A differentiator would be speed ("<500ms"), framework breadth ("React, Handlebars, raw HTML"), or category ("the only PDF API with first-class React components").

**[P1] Subhead is a feature list, not a value prop.** "Generate invoices, reports, and certificates from HTML, React, or templates. One API call, milliseconds." Lists use cases and inputs but never says *why* over competitors. Compare to "Stripe for PDFs" (the project's own pitch in CLAUDE.md) — that frame is sharper and absent from the site.

**[P2] "Now in public beta" badge** is honest but also a deflater. If you want trust, it reads as "not production-ready." Either move to launch positioning or pair with "Used in production by X teams."

**[P2] CTA verb is weak.** "Start for Free" is fine, but "Generate your first PDF" or "Get your API key" (the FinalCta uses this!) is more action-tied. Be consistent with the FinalCta wording.

**[P2] No live demo, no playground.** Competitors like DocRaptor expose a try-it-in-browser. The hero is static code — but for a PDF API, even an inline form ("paste HTML → see PDF") would crush the conversion ceiling.

**[P3] The accent-orange gradient on "Pixel-perfect PDFs"** is the third-most-prominent ornament after the glow and the codeblock chrome dots — the reader's eye doesn't know what to land on.

---

### SocialProof (`apps/web/src/components/sections/social-proof.tsx`)

**[P0] Logo wall is hardcoded names — not customers.** Lines 23–32: `['Vercel', 'Supabase', 'Stripe', 'Linear', 'Resend', 'Neon']` rendered as text at `opacity-40`. There is zero indication these companies use DocuForge. Listing well-known logos you do not have permission for is a legal risk (Stripe in particular polices trademark) and a credibility-destroyer once a buyer realizes they're stub. Either:
  - Pull the section until you have real customers, or
  - Use a labeled "Customers we built this for" + categories ("Fintech", "EdTech") with no names.

**[P0] "Trusted by developers building at"** above placeholder logos is a *literal lie* — at best aspirational, at worst fraudulent. This is the kind of copy that ends up in a screenshot on Hacker News.

**[P1] Metrics are unsourced and undated.** "10,000+ PDFs generated", "99.9% Uptime", "<500ms Avg response", "5 SDK languages." The last one is verifiable; the first three need a "since launch" timestamp, a status-page link backing the uptime claim, or removal. "10,000+" PDFs is also weak — a single hobby user generates that in a week.

**[P2] No badges to substantiate enterprise trust** — no SOC2, no GDPR-ready, no ISO27001, not even a "Built on Cloudflare R2" or "Powered by AWS" reassurance.

**[P2] Logos at opacity-40 is a tell.** Real logo walls render at full opacity because they're proud customers; fading them is the visual equivalent of "we know these aren't real."

---

### HowItWorks (`apps/web/src/components/sections/how-it-works.tsx`)

**[P1] Step 2 oversimplifies the API surface.** "One POST request with your content." But the actual API has `/v1/generate`, batch, templates, react, plus eleven `/v1/pdf/*` tools (merge, split, protect, sign, pdfa, forms). The 3-step framing under-promises in a way that conflicts with the 8-feature grid two sections later. Resolve by either (a) calling out "and ten more endpoints" in step 2, or (b) renaming step 2 "Pick an endpoint."

**[P1] No mention of auth setup.** Realistically step 1 should be "Get your API key" — and that's the actual conversion event. Burying API key creation behind "Write your template" obscures the path.

**[P2] "Milliseconds"** in step 3 contradicts the `llms-full.txt` line that says "under 3 seconds" (line 7). Pick one.

**[P3] Connector arrows** are `&rarr;` glyphs at `top-1/2 -right-4`. They don't visually connect because the cards have padding — the arrow floats in negative space rather than touching cards.

---

### FeaturesGrid (`apps/web/src/components/sections/features-grid.tsx`)

**[P1] "Self-Hostable" is a buyer-killer feature for the *paid* SaaS pitch.** Telling visitors they can run the whole stack on Docker Compose is generous and aligns with the GitHub-driven positioning — but on the same page as a $29/month pricing tier, it cannibalizes paid signups. Either gate the self-host messaging to a "/self-host" page, or commit to the open-source positioning and rework pricing.

**[P1] "Multi-Cloud Storage"** is an infra detail, not a customer benefit. A buyer doesn't care which S3-compatible store you use — they care that their PDFs are durably stored. Reframe as "Durable storage on R2, S3, or GCS."

**[P2] Feature card copy mentions implementation detail.** "Playwright renders it" leaks the implementation — fine for developer audiences but unusual to surface so explicitly. Either own the choice ("Built on Chromium for browser-grade rendering") or hide it.

**[P2] "QR Codes & Barcodes" card** literally shows `{{qr:data}}` and `{{barcode:data}}` syntax — this is correct, but feels like dropping API syntax into a feature card.

**[P3] Eight cards in a 4-wide grid** at `lg` means two rows of identical look. Visually flat — the most important features should be larger or highlighted.

---

### CodeShowcase (`apps/web/src/components/sections/code-showcase.tsx` + `lib/constants.ts`)

**[P0] HTML tab repeats the broken default-import bug.** `import DocuForge from 'docuforge';` — same wrong default import as hero. `new DocuForge('df_live_...')` *is* called this time, so it would compile in TS-strict only because of `DocuForge` being typed `any` on a bad default import, but in real ESM it throws.

**[P0] React tab is wrong in three ways.**
  1. `import DocuForge from 'docuforge';` — broken default import (same bug).
  2. `import { Document, Page, Table } from '@docuforge/react-pdf';` then passes JSX as a string literal — the React-renderer service runs the JSX through esbuild in a sandbox where the *string* `'<Document title="Monthly Report">...'` has no resolved imports. The `@docuforge/react-pdf` import line is decorative and misleading.
  3. The SDK method is `await client.fromReact({ react: string, data? })`, NOT `await client.fromReact({ component: ... })`. The parameter name `component` does not exist on `ReactParams`. Anyone copy-pasting gets `400 Bad Request` from the API.

**[P0] Template tab uses `templateId:` — wrong key.** The SDK's `TemplateParams` interface (verified in `packages/sdk-typescript/src/types.ts`) uses `template: string`, not `templateId`. Copy-paste = 400.

**[P1] cURL example is the only one that would actually work** — but it uses `api.getdocuforge.dev` and the dashboard hostname is `app.getdocuforge.dev`. Confirm both subdomains exist before launch.

**[P1] Default tab is "HTML"** which is fine, but if React-to-PDF is your differentiator (it should be), feature React first.

**[P2] No "Copy" button on code blocks** (`CodeBlock` ships no clipboard action). For a developer site, "Copy" is table stakes — there's a reason every API doc ships it.

**[P2] No syntax highlighting.** `shiki` is installed (`package.json` line 18) but unused — the CodeBlock just renders plain `<code>` with no token coloring. The traffic-light dots imply IDE-quality syntax that isn't delivered.

**[P3] cURL block embeds the response in `# Response:` comments.** Reasonable but visually conflates request and response.

---

### SdkGrid (`apps/web/src/components/sections/sdk-grid.tsx`)

**[P1] React is listed as an "SDK".** It's a peer of TypeScript/Python/Go/Ruby in the grid (5-wide on `lg`). But `@docuforge/react-pdf` is a *component library* you use *with* the TypeScript SDK — not an alternative SDK. Mixing categories confuses what you actually shipped.

**[P1] No Java/PHP/C#/Rust** but the headline is "Your language. Your framework." For an enterprise pitch, the absence of Java is conspicuous. Either downgrade the claim ("First-class TypeScript, Python, Go, and Ruby SDKs") or chart a roadmap.

**[P2] Install commands are unverified.** `gem install docuforge` — verify the Ruby gem is actually published. `go get github.com/docuforge/docuforge-go` — verify the GitHub org exists and the module path resolves.

**[P2] Framework chips ("Next.js", "Express", "FastAPI", "Django", "Rails")** are decorative pills — they don't link to the framework guide for each, which is a missed SEO + conversion opportunity. The docs site has a `/guides/nextjs` per footer; chain them.

**[P3] Letter-only "logos"** (first character of SDK name in a colored square) feel like placeholders. Real SDK badges (TS logo, snake/Python, gopher, Ruby gem) carry far more recognition.

---

### Comparison (`apps/web/src/components/sections/comparison.tsx`)

**[P0] Missing the comparator most buyers actually evaluate against: DocRaptor, PDFShift, Api2PDF, PDFCrowd, Gotenberg.** The current table compares DocuForge against "Puppeteer DIY", "wkhtmltopdf", and "Prince XML" — these are libraries/CLIs, not the direct hosted-API competitors. The DocuForge value prop versus another hosted PDF API is much harder to make, and the brief asked specifically "vs Puppeteer/DocRaptor/Gotenberg." Add at least DocRaptor.

**[P1] "Setup Time: 30 seconds vs 30+ minutes for Puppeteer"** is defensible but borderline. "1 hour" for Prince XML is harder to defend (Prince installs in minutes; setup is config, not install).

**[P1] "Maintenance: Zero"** for DocuForge — for a *hosted* API this is true at the integration level, but the answer to "what about your infra" is what enterprise buyers ask. Soften to "No infrastructure to maintain."

**[P1] No metrics, just adjectives.** Every row is a qualitative label ("Built-in", "DIY", "High", "Yes"). Conversion-grade comparison tables include numbers: latency p50/p99, throughput per dollar, max document size, max pages, concurrent renders. A side-by-side without numbers reads as marketing, not engineering.

**[P2] Color asymmetry is suspicious.** DocuForge row is green, all competitors are dimmed gray (`text-text-dim`). The visual hierarchy is fine but a more credible table colors *each cell* based on outcome (red for DIY in setup-time, etc.) rather than coloring the column.

**[P2] "React Support: Manual" for Puppeteer** is correct but unhelpful — Puppeteer renders any HTML. The honest comparison is whether you provide a React-to-PDF pipeline. Reword to "React JSX as input: Built-in / DIY / No / No."

**[P3] Comparison is a single block.** A typical strong comparison adds a "Why this matters" line per row — currently the reader has to infer.

---

### Testimonials (`apps/web/src/components/sections/testimonials.tsx`)

**[P0] All three testimonials are stock fabrications.** "Sarah Chen, CTO, InvoiceStack" / "Marcus Rodriguez, Senior Engineer, ReportLab" / "Priya Sharma, Full-Stack Developer, CourseHub" — these companies do not exist in any meaningful search index. ReportLab is also the name of an established Python PDF library — using it as a fake testimonial company is a footgun. Pull these immediately or replace with real beta users (the hero already says "public beta"; beta-tester quotes are legit).

**[P1] No avatars, just letter circles.** The first-character-in-a-circle is the same letter-logo treatment used in SdkGrid. Combined with the names that read as stock, it doubles the "this is filler" signal.

**[P1] No linkbacks.** Real testimonials link to the testimonial-giver's LinkedIn, Twitter, or company site. Zero of three do.

**[P1] No company logos in testimonial cards.** Even a small logo per quote would lift credibility — but you'd need real customers first.

**[P2] Quotes are too well-written.** "Replaced 200 lines of Puppeteer boilerplate with a single API call" is exactly the kind of polished line marketers write, never users.

**[P3] Three quotes is the right count** but they should be staggered across the page (one near features, one near pricing) rather than packed in one block — that pattern lifts perceived volume of social proof.

---

### BlogPreview (`apps/web/src/components/sections/blog-preview.tsx`)

**[P1] All 10 blog posts are dated 2026-02-26 to 2026-03-07** — a 10-day burst at launch, then nothing. By any current date past mid-March 2026, the freshness signal is dead. "From the blog" with the latest post 3+ months old hurts more than no blog.

**[P2] No reading time on the homepage card** — actually wait, there is (`{post.readingTime} min read`). Fine.

**[P2] No date on the homepage blog cards.** The index page shows the date but the homepage preview doesn't. Either show date everywhere (signals freshness) or nowhere (hides staleness — but then why a "from the blog" section).

**[P3] 4 cards in a 4-wide grid** is fine but the description gets `line-clamp-2` to 2 lines — most blog descriptions look truncated.

---

### PricingPreview (`apps/web/src/components/sections/pricing-preview.tsx`)

**[P0] `/pricing` route does not exist.** Navbar and footer both link "Pricing" to `/#pricing` (anchor only). There is no standalone pricing page at `apps/web/src/app/pricing/page.tsx`. For a SaaS evaluated against competitors, an anchor-only pricing strategy means no rank on "DocuForge pricing" search and no shareable link to specific tier comparison.

**[P0] Only one pricing tier shown.** "Free Tier: $0/month forever" is the only card. The microcopy says "Need more? Plans start at $29/month for 10,000 PDFs" but there's no tier comparison, no enterprise CTA, no annual-vs-monthly toggle. A buyer evaluating DocuForge against DocRaptor (~$15/mo for 125 docs) or PDFShift (~$9/mo for 1,000) has no answer.

**[P1] "$29/month for 10,000 PDFs"** = $0.0029/PDF. Without competitor anchoring on the page, that number is meaningless. Add a "vs DocRaptor at $0.038/doc" or similar anchor.

**[P1] No mention of overage pricing, no rate-limit transparency, no SLA per tier.** Per CLAUDE.md: rate limits are 10 req/s (free) → 500 req/s (enterprise). Surface this on the pricing page or buyers infer the worst.

**[P2] "Get Your API Key" CTA** is well-tuned to the pricing context. Keep this verb pattern.

**[P3] The free-tier feature list includes "All PDF generation features"** — vague. Spell out: "HTML, React, Templates, batch, merge, split, sign, etc."

---

### FinalCta (`apps/web/src/components/sections/final-cta.tsx`)

**[P1] Headline "Ready to build?"** is generic — every dev-tools site uses this. A repeat of the hero promise or an urgency angle ("100 free PDFs are 30 seconds away") would convert better.

**[P1] Identical CTA buttons to the hero** — fine for repetition but the FinalCta loses an opportunity to test a different copy variant. Consider: "Generate my first PDF" or "Get my API key" (the latter is *already* used on the pricing card — be consistent).

**[P2] No urgency, no scarcity, no social proof at the bottom.** The strongest FinalCta sections add a "Join 1,200 developers shipping PDFs with DocuForge" line. Currently it's just a repeat of hero copy.

**[P3] "Under 30 seconds" claim** is fine but unverified.

---

## Blog findings

**[P1] All blog posts dated within a 10-day window (Feb 26 – Mar 7, 2026).** No new posts since launch. By current date (May 2026), the blog is 2+ months stale. Either ship a posting cadence (monthly minimum for dev-tools) or hide the date.

**[P2] No author bylines beyond "DocuForge Team".** Every post is attributed to the same anonymous brand. Putting Fred's name (or a named technical writer's) on engineering content earns 10x more credibility on Hacker News / Twitter.

**[P2] No author profile pages, no `/authors/` directory.** Standard dev-blog convention.

**[P2] No tags/categories landing pages.** `post.category` is rendered but `/blog?category=React` or `/blog/category/react` does not exist. Lost SEO opportunity for "React PDF" longtail.

**[P2] No related-posts at the end of each post.** `apps/web/src/app/blog/[slug]/page.tsx` ends after the MDX body — no "Read next" — losing the dwell time blogs are supposed to drive.

**[P2] No RSS feed.** Standard for a dev blog targeting newsletters and IndieHackers/HN crowd.

**[P2] Per-post OG metadata missing `images`.** `generateMetadata` in `[slug]/page.tsx` sets `openGraph.title/description/type/publishedTime` but no `images` array — so every blog post shares to social with the default site OG, not a per-post image. Either generate per-post OG (using DocuForge itself!) or set a blog-default OG image.

**[P2] No canonical URLs.** No `alternates: { canonical: ... }` in any metadata. If the blog is ever syndicated or mirrored, Google won't know which copy is canonical.

**[P2] No Twitter card metadata per-post.** Only the site-default summary_large_image inherited from layout.

**[P3] MDX components are basic** — no callouts/admonitions, no tabs, no syntax highlighting (`shiki` is in package.json but unused in `mdx-components.tsx`). Code blocks render as plain `<code>` inside `CodeBlock` chrome.

**[P3] No images in posts** (no `<img>` or `<Image>` in `mdxComponents`). Dev blog posts that show output PDFs would convert 5x harder.

**[P3] No JSON-LD `Article` schema per post.** Article schema with `author`, `datePublished`, `image`, `publisher` is standard SEO for blog ranking.

**[P3] `/blog` index has no pagination/limit.** With 10 posts now it's fine, but the index renders all posts every visit.

**[P3] Blog post path uses `process.cwd() + '..' + '..'`** (`apps/web/src/lib/blog.ts:16`) — fragile if the working directory ever changes (Docker, monorepo build).

---

## SEO / discoverability

**[P0] No `robots.txt`.** Missing from `apps/web/public/` and not generated via `apps/web/src/app/robots.ts`. Search crawlers have no canonical rules — most just index everything, but bot policy and sitemap discovery break.

**[P0] No `sitemap.xml`.** No `apps/web/src/app/sitemap.ts` exists. Next 14 makes this trivially generatable from `getAllPosts()` plus static routes. Without a sitemap, blog posts will index slowly and inconsistently.

**[P0] Docs link is a Mintlify preview URL.** Every navbar, footer, and several CTAs route to `https://fred-7da601c6.mintlify.app`. This is a default Mintlify preview hostname tied to a user named "fred" — leaking founder identity from every page, and Mintlify will revoke this URL if the project moves to a custom domain. Map docs.getdocuforge.dev or /docs (already rewritten in `next.config.mjs` but pointing to the same preview URL) before launch.

**[P1] No JSON-LD structured data.** No `SoftwareApplication`, `Organization`, or `Product` schema on the homepage. Add at minimum `Organization` (name, URL, logo, sameAs Twitter/GitHub) and `SoftwareApplication` (name, applicationCategory, offers).

**[P1] No homepage-specific OG image override.** Layout sets a single `/og-image.png` for all pages — but the homepage is the most-shared page and should have a custom 1200x630 with the hero claim baked in.

**[P1] Canonical URLs not set anywhere.** `apps/web/src/app/layout.tsx` has `metadataBase` but no `alternates.canonical`. Same on blog index, blog posts.

**[P1] `metadataBase: new URL('https://getdocuforge.dev')`** — but the dashboard is `app.getdocuforge.dev` and the docs are `fred-7da601c6.mintlify.app`. Confirm DNS and TLS on `getdocuforge.dev` apex.

**[P2] No `<link rel="alternate" type="application/rss+xml">`** for the blog.

**[P2] `llms.txt`** is good but minimal (only 24 lines). Add Pricing, Status, and Security pointers when those exist.

**[P2] `llms-full.txt`** has good API coverage (245 lines) but uses `template:` as the key in the request body — consistent with the SDK but contradicts the marketing-site code-showcase's `templateId:`. Pick one and ship it everywhere.

**[P2] No `humans.txt`, no `security.txt`** — minor but `.well-known/security.txt` is RFC9116 and trivially earned trust signal.

**[P3] HTML `lang="en"` only** — no locale strategy. Fine for v1 but no `hreflang` planning.

---

## Trust / legal findings

**[P0] No `/terms` page.** Required to legally onboard paying users.
**[P0] No `/privacy` page.** Required for GDPR/CCPA — and a B2B API that holds customer documents *must* publish a privacy notice.
**[P0] No `/dpa` (Data Processing Agreement).** Required for any EU customer signup.
**[P0] No `/security` page.** No mention of encryption-at-rest, encryption-in-transit, retention policy, deletion policy. Enterprise procurement will not engage without this.
**[P0] No `/status` page (route stub: `'#'`).** Footer claims "Status" but links to nowhere. Either ship `status.getdocuforge.dev` (statuspage.io, Atlassian Statuspage, BetterStack) or remove the link.
**[P1] No SOC 2 / ISO27001 / GDPR-ready / HIPAA mentions anywhere.** Even an "SOC 2 Type II in progress" badge converts B2B prospects who otherwise bounce.
**[P1] No "Contact Sales" path.** No `/contact`, no `mailto:`, no enterprise inbound funnel. Lost high-LTV deals.
**[P1] No GitHub link works.** Footer links `https://github.com/docuforge` — verify this org exists and has real repos visible.
**[P1] Footer "Discord"** → `#`. Stub.
**[P2] No company/about page.** Buyers want to know who builds this. Single founder is fine — say so.
**[P2] No cookie banner / consent mechanism.** Required for EU traffic if any analytics ship.
**[P2] No "Report a vulnerability" path.** RFC9116 `/.well-known/security.txt` would address.
**[P3] No press / brand assets page** but `brand-sheet.png` is in `/public` — surface it.

---

## Tracking / analytics

**[P0] No analytics, anywhere.** No PostHog, Plausible, Mixpanel, GA, Vercel Analytics, Segment, or even a `<script>` for any tracker. The site cannot measure: page views, CTA clicks, time on page, scroll depth, signup conversion, blog engagement, or attribution. Launching a marketing site with no analytics is a non-starter — you cannot iterate without data.

**[P0] No conversion event firing on "Start for Free" / "Get Your API Key".** Even with analytics, no `onClick` instrumentation is wired on the Button component. Clicks become opaque.

**[P1] No UTM parameter handling.** No code in `apps/web` parses or persists `utm_source`, `utm_medium`, `utm_campaign` on landing. Inbound marketing attribution is impossible.

**[P1] No referrer tracking handoff to the signup app.** The signup link goes to `app.getdocuforge.dev/sign-up` with no querystring — attribution dies at the domain boundary.

**[P1] No exit-intent, no scroll-depth events, no A/B testing harness.**

**[P2] No `Sentry`** on the marketing site. Production errors go unnoticed.

**[P3] No heatmap (Hotjar/Microsoft Clarity)** — useful for conversion teardown.

---

## Conversion-path analysis (landing → signup)

Click count to signup, measured from cold landing on `/`:
- **1 click** if user clicks any of: hero "Start for Free", navbar "Get Started Free", pricing "Get Your API Key", final-CTA "Start for Free". This is excellent and consistent.
- All four CTAs route to the same `https://app.getdocuforge.dev/sign-up`. No URL-param differentiation by source — so even with analytics later, all signups attribute identically. **Fix:** append `?source=hero|nav|pricing|final` so analytics can compare CTA performance.

Friction points:
- **No "Try without signing up"** — no in-browser sandbox or anonymous playground. For a PDF API, a "paste HTML → see PDF" widget would reduce the conversion barrier dramatically.
- **No "View pricing" path before signup** — the pricing-preview shows one tier, with paid tiers as a single sentence of microcopy. Buyers comparing to DocRaptor leave without engaging.
- **No "Continue with GitHub / Google" indication** on the marketing CTA — common dev-tools UX is to show OAuth options preemptively, increasing trust that signup is one step.
- **No exit-intent capture** (email-only signup, content download, free template, etc.).
- **No retargeting pixel** (Twitter/X, LinkedIn, Reddit) — paid-acquisition campaigns can't audience-build.

---

## Cross-cutting themes

1. **Polish exceeds substance.** The visual system, animations, dark theme, and section composition are genuinely good. But the content underneath — code examples, testimonials, logos, metrics, comparisons — is partial, fabricated, or wrong. Buyers detect this gap within one scroll. **Recommendation:** delete every placeholder before delete every animation. A site with three real customer quotes and no fake-logo wall converts better than this site.

2. **Documentation hostname is a footgun.** Every link to docs hits `https://fred-7da601c6.mintlify.app`. The Mintlify preview URL is tied to a personal account, leaks the founder's first name everywhere, and will rot when the project moves to a custom domain. **Action:** set up `docs.getdocuforge.dev` (Mintlify supports custom domains) and update navbar + footer + llms.txt + blog before launch.

3. **The SDK code on the page does not match the SDK that ships.** Default vs named imports, `template` vs `templateId`, `react` vs `component`. These are 30-minute fixes but they're the most credibility-damaging items on the site. **Action:** add an integration test in CI that runs `apps/web` code-showcase snippets against the actual SDK type definitions.

4. **No conversion measurement of any kind.** Analytics, UTM, event tracking, A/B testing — all absent. Launching without this is shipping blind. **Action:** PostHog or Plausible in `layout.tsx`, instrument the Button component with `onClick` events for every CTA, append `?source=` to signup URLs.

5. **Legal and trust pages are a blocker for paying customers.** No Terms, no Privacy, no DPA, no Security page, no Status. Even a $29/month customer's procurement check fails on this. **Action:** ship `/terms`, `/privacy`, `/security`, and a real Status page link before announcing GA.

6. **Comparison narrative is incomplete.** The table compares to libraries (Puppeteer, wkhtmltopdf, Prince) but not to hosted-API competitors (DocRaptor, PDFShift, Api2PDF, Gotenberg). Buyers evaluating "should I build vs buy a PDF API" have already decided to buy by the time they land here — they need DocuForge-vs-DocRaptor, not DocuForge-vs-DIY.

7. **The "Self-Hostable" + paid SaaS messaging is internally conflicted.** Either commit to open-source-first ("free forever, paid for hosted") or commit to SaaS-first (hide the self-host page behind enterprise sales). Currently the homepage pitches a paid product while inviting buyers to host themselves for free.

8. **Blog has correct shape, wrong fuel.** 10 well-titled posts published over 10 days, then silence. A dev-tools blog needs minimum monthly cadence — otherwise the freshness signal works against you. **Action:** either commit to a posting calendar or hide post dates everywhere on the index/preview cards.

9. **Free-tier marketing is the single best section.** The "Start generating PDFs for free / $0 forever / 100 PDFs/month" framing is correctly weighted. Lean into this in the hero ("100 free PDFs/month. No credit card.") rather than the generic "Pixel-perfect PDFs out."

10. **`shiki` is installed but unused.** Either use it for real syntax highlighting in `CodeBlock` (and MDX `pre`), or remove the dependency. Dead deps inflate bundle size and audit signal.
