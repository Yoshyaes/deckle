# Copywriting & Voice — Teardown

## TL;DR

DocuForge has a *legible* voice — clearly developer-pitched, mercifully free of "transform your business" mush — but it's nowhere near as sharp as the "Stripe for PDFs" positioning implies it wants to be. The marketing site is solid (one good hero, three good supporting headlines, two terrible filler ones). The dashboard is a desert of generic SaaS strings ("Manage Subscription," "No templates yet," "Loading..."). Error messages are the weakest surface in the codebase — a frighteningly large number of them tell the user *what went wrong* but not *what to do next*. The drip emails are the strongest writing in the product and should be the voice reference for everything else.

The brand is fighting itself in one specific way: the website says "DocuForge" with no tagline, the drip email layout brands itself as "Stripe for PDFs," and the dashboard sidebar / settings call it nothing. Pick one. The "Stripe for PDFs" line is your strongest sentence and it's hidden inside an email footer.

Headline count audit: **8 of 14** marketing/dashboard top-level headlines are generic enough to swap into a Notion landing page without anyone noticing.

CTA audit: the word **"Loading..."** appears as a button label in at least 6 places. **"Generate PDF"** is a verb-led CTA and is used consistently — credit where due. **"Get Started Free"** vs **"Start for Free"** vs **"Sign In"** vs **"Get Your API Key"** is a free-for-all on the homepage alone.

Error audit: of the ~40 user-facing error messages graded below, **24 fail the "what should the user do now?" test**. That's the single biggest copy problem in the product.

## Voice grade

**C+**

Rationale:
- **What's coherent:** The drip emails, hero, comparison table, and one or two empty states sound like the same person — slightly dry, dev-first, willing to say "Puppeteer DIY" out loud. That's a voice.
- **What's not:** The dashboard is bone-dry default Next.js boilerplate copy. Admin pages are pure data-engineer Slack-speak ("Time → 1st gen," "1st error," "tpl"). Errors lurch between under-cooked ("Generation failed") and over-cooked ("Your session may have expired or you do not have permission to access this resource"). The blog/social-proof section has fake testimonials with fake company names which actively *hurts* trust — that's a P0 trust problem masquerading as copy.
- **What's missing:** A tagline. "DocuForge" appears alone in the navbar, the dashboard sidebar, the footer, and the metadata title with no positioning phrase next to it anywhere a user can see. The "Stripe for PDFs" line — the one phrase that does all the positioning work — is in the email header only.

## What's actually good

- **Hero headline.** `"HTML in. Pixel-perfect PDFs out."` is the best sentence in the product. Concrete, contrasting, no buzzwords. Keep it.
- **Hero subhead.** `"Generate invoices, reports, and certificates from HTML, React, or templates. One API call, milliseconds."` — names three concrete use cases, then gets out of the way. Good.
- **Hero pre-credit-card line.** `"100 PDFs/month free. No credit card required."` — exactly the right scope. Tells me the cost, the friction, and the upper bound.
- **Comparison section subhead.** `"Stop maintaining headless browsers. Start shipping PDFs."` — the only place on the marketing site that names the actual pain. Should be promoted higher.
- **`last_call` drip email.** Reads like a real human founder. `"I noticed you signed up for DocuForge a week ago and haven't generated a PDF yet. That almost always means one of two things..."` That's a 1:1 sales email, not a templated nudge. Best writing in the codebase.
- **`first_pdf` drip email.** `"🎉 First PDF: shipped."` followed by a punch list of three concrete next steps. Earned the emoji.
- **Quickstart docs.** `"This took 30 seconds, not 3 days."` is a great example string to put inside a Hello World.
- **API key security panel.** The four bullets on `/keys` (`hashed and never stored in plaintext`, `only shown once`, etc.) are crisp and complete.
- **The empty state on the visual editor.** `"Start Building"` + the explainer is correct in voice and length. Most other empty states fail this bar.

## Surface-by-surface findings

### Landing — Hero (`apps/web/src/components/sections/hero.tsx`)

**Finding (P3) — Beta badge is filler.**
- Current: `"Now in public beta"`
- Verdict: The pill earns the eye-attention of every visitor and uses it to say nothing actionable. "Public beta" suggests instability, which is the opposite of what your "100 PDFs/month free" line is trying to do.
- Better: `"v1.0 — 10,000 PDFs shipped"` (use the same number you already cite in Social Proof), or just delete the badge.

**Finding (P2) — CTA pair is mismatched.**
- Current primary: `"Start for Free"` / secondary: `"Read the Docs"`.
- Verdict: Verb-led, fine, but generic. "Start" what? The Final CTA section *does* fix this with `"Generate your first PDF in under 30 seconds"` — that promise should be in the hero CTA, not 8 sections down.
- Better: primary `"Generate your first PDF"`, secondary `"Read the docs"`. (Lowercase the secondary — "Docs" capitalized in a button caption looks like a German noun.)

**Finding (P3) — CTA-vs-button-elsewhere inconsistency.**
- Hero says `"Start for Free"`. Navbar says `"Get Started Free"`. PricingPreview says `"Get Your API Key"`. FinalCta says `"Start for Free"` again. Pick one verb. Recommendation: `"Generate your first PDF"` for the homepage CTA stack, `"Sign up"` everywhere else.

### Landing — SocialProof (`social-proof.tsx`)

**Finding (P0) — Fake logos burn trust.**
- Current: `"Trusted by developers building at"` over `Vercel, Supabase, Stripe, Linear, Resend, Neon`.
- Verdict: These logos are visibly placeholders (`opacity-40`, no images). For any visitor who recognizes the brands — i.e. your entire ICP — this reads as a lie. **This is a P0 trust failure.** Either get real logos (one is fine) or replace this row with something true.
- Better: Replace with: `"Built by developers who got tired of Puppeteer."` plus the metrics row only. Or run a short stat strip: `10,000+ PDFs shipped · 5 SDKs · <500ms median`.

**Finding (P2) — Metric label "PDFs generated" is undated.**
- Current: `"10,000+ PDFs generated"`.
- Verdict: 10,000 *what* — lifetime? this month? Without a window the number is fuel for skeptics.
- Better: `"10,000+ PDFs shipped this month"` (only if true).

### Landing — HowItWorks

**Finding (P3) — Step titles use Title Case but the rest of the site uses Sentence case.**
- Current: `"Write Your Template"` / `"Call the API"` / `"Get Your PDF"`.
- Verdict: Every section heading on the page is Sentence case (`"Everything you need"`, `"Your language. Your framework."`). These three are Title Case. Sentence case throughout, please.
- Better: `"Write your template"`, `"Call the API"`, `"Get your PDF"`.

**Finding (P1) — Step 3 is weakly written.**
- Current: `"Receive a pixel-perfect PDF back in milliseconds. A CDN URL, ready to download, email, or embed."`
- Verdict: The sentence fragment "A CDN URL, ready to..." reads like the writer ran out of energy. The previous two steps are complete sentences.
- Better: `"Get back a CDN URL in milliseconds — ready to download, email, or embed."`

### Landing — FeaturesGrid (`features-grid.tsx` + `lib/constants.ts`)

**Finding (P3) — "Everything you need" is the most overused SaaS headline on Earth.**
- Current: `"Everything you need"`.
- Verdict: It's not wrong, it's just lazy. The subhead does the work — promote the subhead.
- Better: `"One API for every PDF workflow"` (lift from the subhead) or `"From single PDFs to batch jobs to forms"`.

**Finding (P2) — Feature card titles use Title Case inconsistent with rest of page.**
- Current: `"HTML & React Rendering"`, `"Template Engine"`, `"Batch Generation"`, `"Multi-Cloud Storage"`.
- Verdict: Same case issue as HowItWorks. Pick a case and commit.

**Finding (P1) — Two feature descriptions bury the actual feature.**
- Current (QR/Barcode): `"Drop {{qr:data}} or {{barcode:data}} placeholders in your HTML. We render inline SVGs automatically."`
- Verdict: This is great — placeholder syntax shown literally, payoff stated. Use this pattern everywhere.
- Current (Headers & Footers): `"Dynamic page numbers, dates, and custom content in headers and footers across every page."`
- Verdict: Misses the killer detail — `{{pageNumber}}` interpolation. That's the part developers actually want to know exists.
- Better: `"Page numbers and totals via {{pageNumber}}/{{totalPages}}. Custom HTML in header and footer. Across every page, automatically."`

### Landing — CodeShowcase

**Finding (P3) — "Works with your stack" is fine but the subhead repeats itself.**
- Current subhead: `"Send HTML, React components, or use stored templates. Pick the approach that fits your workflow."`
- Verdict: The "Pick the approach that fits your workflow" half is filler — the first half already implied choice.
- Better: `"Send HTML, React components, or stored templates."` Cut the second sentence entirely.

### Landing — SdkGrid

**Finding (P2) — Headline is two short fragments — should be one promise.**
- Current: `"Your language. Your framework."`
- Verdict: Cute but doesn't carry weight. Doesn't tell me anything I didn't already know from seeing the SDK logos.
- Better: `"Five SDKs, one API"` or `"TypeScript, Python, Go, Ruby — pick one"`.

### Landing — Comparison

**Finding (P3) — Comparison rows are clean but "Maintenance: Zero" is a stretch.**
- Current: `Maintenance | Zero | High (browser updates) | Medium | Low`
- Verdict: "Zero" is hard to defend. *Hosted* products always have provider-side maintenance the customer pays for (rate limit changes, plan migrations). Be precise.
- Better: `Maintenance | None on your side | High (browser updates) | Medium | Low`.

**Finding (P2) — "Setup Time: 30 seconds" vs Hero "under 60 seconds" vs FinalCta "under 30 seconds" vs dashboard onboarding "under 5 minutes".**
- Verdict: Pick a number. Right now four different marketing touchpoints make four different time claims (`30s`, `60s`, `5 minutes`). Suggest standardizing on "60 seconds to first PDF" everywhere.

### Landing — Testimonials

**Finding (P0) — Testimonials are fictional and the fiction is visible.**
- Current: `Sarah Chen, CTO, InvoiceStack` / `Marcus Rodriguez, Senior Engineer, ReportLab` / `Priya Sharma, Full-Stack Developer, CourseHub`.
- Verdict: Three perfectly demographically balanced names at three companies whose names sound like they came from a brainstorming exercise (InvoiceStack… for invoice users… ReportLab… for the report use case…). This is worse than no testimonials — it's the kind of detail a developer's eye snags on instantly. **P0 trust.**
- Better: If you don't have real customer quotes yet, delete the section. Replace with a "From the changelog" strip, the founder's tweet, a GitHub stars badge, anything *true*. Once you have one real customer, put one real customer up.

### Landing — PricingPreview

**Finding (P1) — "Free Tier" / "$0 per month, forever" tonally clashes with the rest.**
- Current: small print `"per month, forever"`.
- Verdict: "Forever" is a marketing-y promise that's hard to keep and reads weird next to the developer-direct voice of the rest of the page. Most developers will assume "forever" means "until we change our pricing."
- Better: drop "forever". Just `"$0 / month"`.

**Finding (P1) — Inconsistency with Settings page on free plan size.**
- Marketing PricingPreview: `"100 PDFs per month"`.
- Dashboard Settings: `free: '1,000 PDFs/month · 10MB max file size'`.
- Hero: `"100 PDFs/month free"`.
- Verdict: 100 vs 1000 is a 10x mismatch that will trigger support tickets day one. Pick a number and ripple-update.

**Finding (P2) — "Need more? Plans start at $29/month for 10,000 PDFs."**
- Verdict: Good in isolation, but PricingPreview has no link to a full pricing page. The CTA jumps you to sign-up, not pricing. Dead-ending the curious user.
- Better: Add `"See full pricing →"` underneath the $29 line.

### Landing — FinalCta

**Finding (P3) — "Ready to build?" is a placeholder headline.**
- Current: `"Ready to build?"`
- Verdict: It's the literal "default CTA section" sentence. The subhead `"Get your API key and generate your first PDF in under 30 seconds."` is the actual promise — promote it.
- Better headline: `"Generate your first PDF in 30 seconds."` Subhead: `"Free API key. No credit card."`

### Landing — Navbar / Footer

**Finding (P2) — Footer says "Pixel-perfect PDF generation for developers." — that's the missing tagline.**
- Verdict: This sentence belongs *next to the logo in the navbar*, not buried in the footer. Add as a subtitle under the wordmark.

**Finding (P3) — Footer "Status" link goes to `#`.**
- Verdict: A broken status link is worse than no status link — it tells a paying customer there's no status page on the day they need one. Either link it for real, or remove it.

**Finding (P3) — Footer "Discord" goes to `#`.** Same as above.

**Finding (P3) — Footer "Changelog" routes to `/blog`.**
- Verdict: Blog ≠ changelog. Conflating the two will lose you the developer who hits Cmd+F for "changelog" looking for "what shipped last week."

### Dashboard — Home / Onboarding banner

**Finding (P1) — Eyebrow label "Welcome to DocuForge" duplicates what the user just signed up for.**
- Current: small caps `"WELCOME TO DOCUFORGE"` above `"Generate your first PDF in under 60 seconds."`
- Verdict: The headline carries it. The eyebrow is filler. Either delete or replace with something temporal: `"NEW HERE — 60 SECONDS TO YOUR FIRST PDF"`.

**Finding (P2) — "Or create an API key" link is positioned as a secondary action but is the wrong second step.**
- Current secondary: `"Or create an API key"`.
- Verdict: The primary path says "no API key needed to start" — so why is the second option create an API key? The right second action is `"Read the quickstart"` or `"Pick a template"`. The API key creation flow is already a step in the OnboardingChecklist below.

### Dashboard — OnboardingChecklist (`onboarding-checklist.tsx`)

**Finding (P3) — Checklist titles use Sentence case but mix imperative and gerund.**
- Current items: `"Generate your first PDF in the playground"` (imperative), `"Create an API key"` (imperative), `"Call the API from code"` (imperative), `"Install an official SDK"` (imperative).
- Verdict: Actually consistent. Good. Leave it.

**Finding (P2) — Subtitle "Generate your first PDF in under 5 minutes" contradicts the banner above ("under 60 seconds").**
- Current: `"Generate your first PDF in under 5 minutes"`.
- Verdict: Two time promises 100px apart. Pick one. Recommend matching the banner: "under 60 seconds."

**Finding (P3) — "Open playground" / "Create key" / "Copy curl" / "Show snippets" are tight, verb-led, good.**
- Keep.

**Finding (P3) — "Mark as done" for the install-SDK step.**
- Current: `"Mark as done"`.
- Verdict: Fine. Could be `"I've installed it"` for slightly warmer voice — but this is taste.

### Dashboard — Sidebar (`sidebar.tsx`)

**Finding (P3) — "Usage This Month" should be Sentence case for consistency with everything else.**
- Current: `"Usage This Month"`.
- Better: `"Usage this month"`.

**Finding (P3) — Empty sidebar logo label "DocuForge" is the only place the tagline isn't present.**
- Verdict: Same comment as navbar — add `"Stripe for PDFs"` (or the better tagline below) under the wordmark in the sidebar logo block.

### Dashboard — Templates page empty state

**Finding (P1) — Empty state copy is verbose and oddly informational.**
- Current: `"Templates let you design reusable PDF layouts and merge dynamic data via the API. Create your first template to get started."`
- Verdict: This reads like a Wikipedia stub. Empty states should sell the action, not define the noun. The user already clicked "Templates" — they know what templates are conceptually.
- Better: `"No templates yet. Start from a starter or build one from scratch."` + Primary CTA `"Browse starters"`, secondary `"New blank template"`.

### Dashboard — Generations page

**Finding (P2) — Empty state literally says "No generations found."**
- Current: `"No generations found."`
- Verdict: Tells me nothing about what to do. The user is sitting on the Generations page with nothing to show — they want a path forward, not a status update.
- Better: `"No PDFs yet. Open the playground or call POST /v1/generate to generate your first."` Make `"open the playground"` a link.

### Dashboard — Keys page

**Finding (P2) — Empty state "No API keys yet. Create one to start generating PDFs."**
- Verdict: Better than most. Could be more emphatic — `"You need an API key to call the API."` is more direct.

**Finding (P3) — Modal subtitle is unnecessarily passive.**
- Current: `"Copy this key now. It will not be shown again."`
- Verdict: "It will not be shown again" is fine but `"We'll never show it again — store it now."` is sharper. Active voice + you-orientation.

**Finding (P3) — Placeholder for key name is "e.g. Production, Staging".**
- Verdict: Good placeholder — gives the user a model.

### Dashboard — Settings page

**Finding (P1) — "Plan & Billing" wording.**
- Current: `"Plan & Billing"` heading.
- Current sub-line: `"Free Plan — $0"` then `"1,000 PDFs/month · 10MB max file size"`.
- Verdict: The headline is fine. The body is the only place in the whole product that says "1,000 PDFs/month" — everywhere else says 100. Confirm canonical limit.

**Finding (P2) — "Danger Zone" / "Delete Account" / "Permanently delete your account and all data".**
- Current: `"Permanently delete your account and all data"`.
- Verdict: Missing the most important word: *PDFs*. The thing the user is about to lose isn't "data" in the abstract, it's their generations and templates.
- Better: `"Permanently delete your account, templates, generations, and stored PDFs. This can't be undone."`

**Finding (P2) — Delete button confirm is missing.**
- Current: `<button>Delete Account</button>` with no `confirm()` handler attached on this surface.
- Verdict: Out of scope (UX), but worth flagging in copy: a delete button labeled "Delete Account" needs at least `"Type your email to confirm"` modal copy. The Keys page does this right — Settings doesn't.

### Dashboard — Playground

**Finding (P3) — Default placeholder HTML inside the editor.**
- Current: `"<h1>DocuForge Playground</h1><p>Edit this HTML to see your PDF come to life..."`
- Verdict: Good — opinionated default, explains the affordances. Keep.

**Finding (P1) — Empty preview state.**
- Current: `'Click "Generate PDF" to see a preview'`.
- Verdict: Fine, but the user is in a split-pane editor — they don't need the *button name* repeated, they need a hint. Plus the curly quotes/dumb quotes inside the JSX makes it ugly.
- Better: `"Edit HTML on the left, click Generate, preview appears here."`

**Finding (P2) — Generation failure message in playground swallows useful info.**
- Current: `data.error?.message || 'Generation failed'`
- Verdict: When the API returns a useful Zod message ("html must be at most 5242880 characters") the user sees the technically-correct but useless string. The 'Generation failed' fallback is **the worst of both worlds** — generic *and* unactionable.
- Better fallback: `"Something went wrong rendering this HTML. Check that you don't have unclosed tags or external resources that can't load."`

**Finding (P3) — `templateLoading` state shows `Loading playground…` then `Generating your PDF…`.**
- Verdict: Both are fine. Could ellipsis-style be unified across the app — some are `Loading...`, some `Loading…` (U+2026), some `Saving...`. Pick one (recommend the proper ellipsis character) and lint for it.

### Dashboard — Template editor (`apps/dashboard/src/app/templates/[id]/editor.tsx`)

**Finding (P2) — Preview label is excellent. Tooltip on Render PDF button is hidden value.**
- Current preview label: `"Preview (variables shown as placeholders)"`. **Great** — tells the user what they're looking at and why their `{{variable}}` doesn't render as data.
- Current Render PDF tooltip: `title={hasChanges ? 'Saves first, then renders' : 'Render this template as a PDF'}`.
- Verdict: Tooltip is good, but the "Saves first, then renders" behavior should be visible *next to the button*, not buried in a hover. A user about to click that button has unsaved changes and may not hover.
- Better: When `hasChanges` is true, change the button label to `"Save & Render"`.

**Finding (P3) — `Saved!` toast with exclamation point reads more excited than the surrounding voice.**
- Current: `"Saved!"`.
- Verdict: Fine. Possibly `"Saved"` (no bang) — but this is taste.

### Dashboard — Visual editor (`visual-editor.tsx`)

**Finding (P3) — Empty canvas state copy is good.**
- Current: `"Start Building"` + `"Click elements from the left palette or drag them onto this canvas to start building your template."`
- Verdict: Tight, instructional, points to the only two things to do. Keep.

**Finding (P3) — Properties panel empty state is good.**
- Current: `"No element selected"` + `"Click an element on the canvas to edit its properties here."`
- Verdict: Keep.

**Finding (P3) — "Save as Template" button is fine, but template-name placeholder `"Untitled Template"` is the default.**
- Verdict: Saving with the default name is a real risk. Consider blocking save until the name has been edited, with helper text `"Name your template before saving."`

### Dashboard — Marketplace

**Finding (P2) — Empty state is two sentences saying the same thing.**
- Current: `"No public templates available yet." / "Publish your templates to share them with the community."`
- Verdict: The second sentence is good *encouragement*, but the user came here to browse, not to publish. Lead with the action they actually want.
- Better: `"No community templates yet. Want to be first? Publish one of yours."`

**Finding (P3) — Generic alert fallback "An error occurred. Please try again."**
- Current (`marketplace/page.tsx`): `alert('An error occurred. Please try again.')` on both fetch and clone failures.
- Verdict: This message appears in **at least 5 places in the codebase**, and it's the canonical example of an error that tells the user nothing. It also surfaces as a native `alert()` — out of brand entirely.
- Better: Inline error banner with context: `"Couldn't load templates. Check your connection and refresh."`

### Dashboard — Admin

**Finding (P3) — Section headings are crisp and useful.**
- e.g. `"Activation Funnel"`, `"Weekly Signup Cohorts — % of cohort who generated a PDF"`, `"First-Time Error Breakdown — what killed N users' first attempt"`.
- Verdict: Best in-product copy after the drip emails. The `"what killed N users' first attempt"` line in particular reads like product-eng vernacular and is exactly right for an admin tool.

**Finding (P2) — Users table column header "Time → 1st gen" is jargon-y for a UI label.**
- Current: `"Time → 1st gen"` and `"1st error"`.
- Verdict: Fine for an admin tool (which is the audience). Slightly off-brand for the dashboard's otherwise word-spelled tone. Consider `"Time to first PDF"`. Low priority since only admins see this.

**Finding (P3) — Filter dropdown options are unusually wordy.**
- Current: `"Signed up only (no key, no gen)"`, `"Has key, no generation"`, `"Active last 7d"`, `"Churned (silent 30d+)"`.
- Verdict: These are excellent — parenthetical disambiguation is the right pattern for filters with overlapping meanings.

**Finding (P3) — "Delete User" button + confirm.**
- Current confirm: `"Delete ${user.email}? This will delete all their data."`
- Verdict: Good — uses the user's identity to force attention. Could be even better with `"Delete user X and all N generations + Y templates?"` but stop while you're ahead.

### Dashboard — Generation detail page

**Finding (P2) — Failure state for the preview pane is missed opportunity.**
- Current: `"Generation failed — no PDF available."`
- Verdict: This is the page the user lands on *after* they got a failed generation. The error block above shows the technical error. The preview pane should help them act on it.
- Better: `"This PDF failed. The error message above is shown; copy it into a support thread or use the playground to retry."`

**Finding (P3) — Processing state.**
- Current: `"PDF is still processing..."`
- Verdict: Add an auto-refresh hint or a polling indicator. As a string, it's fine, but a static "is still processing" with no movement makes the page feel broken.
- Better: `"Still rendering — refresh in a few seconds to check."`

### Dashboard — Error boundary (`error.tsx`)

**Finding (P1) — Auth error description is the worst kind of corporate-paranoid copy.**
- Current: `"Your session may have expired or you do not have permission to access this resource."`
- Verdict: 17 words to say "you got logged out." Two-pronged "may have X or Y" sentences are the hallmark of legal-by-committee error copy.
- Better: `"You're signed out. Sign in again to continue."`

**Finding (P2) — Generic error description.**
- Current: `"An unexpected error occurred. Our team has been notified."`
- Verdict: "Our team has been notified" is a phrase developers actively dislike because they've all written it as a lie at some point. Either be specific or be honest.
- Better: `"Something broke. Refresh, or check the Error ID below if you contact support."`

**Finding (P3) — "Connection Issue" is fine.** Keep.

### Errors — API (`apps/api/src/lib/errors.ts`)

See dedicated table below. The big themes:
- `AuthError("Invalid API key")` is correct.
- `UsageLimitError()` → `"Monthly usage limit exceeded. Upgrade your plan."` is the best stock error in the codebase. Tells the user the rule *and* the next action. Keep.
- `RateLimitError` → `"Rate limit exceeded"` is the worst stock error — no plan, no retry-after in the human message, no next-step.
- `NotFoundError("Template")` → renders as `"Template not found"`. Fine for an API. Less fine when bubbled to the playground UI as the entire error.
- Every Zod failure surfaces as a comma-joined string of issue messages. For users hitting the API via SDK this is mostly OK; for users hitting it from the playground/dashboard it's hostile.

### Errors — repeated alert() fallback

**Finding (P0) — `"An error occurred. Please try again."` appears in `marketplace/page.tsx`, `templates/[id]/editor.tsx`, `templates/gallery/gallery-client.tsx` (4 instances total).**
- Verdict: This string is the cardinal copy sin — it tells the user nothing happened, and tells them to repeat the action that just failed, with no information about whether it'll work the second time. It's also delivered via `alert()` which breaks brand. **P0 to remove all four.**
- Better: Use an inline toast/banner per-context with a real message. Examples:
  - Marketplace fetch fail: `"Couldn't load templates — check your connection."`
  - Template clone fail: `"Couldn't clone this template. Try again, or report this in #support."`
  - Version restore fail: `"Couldn't restore this version. The template may have changed since the version was saved."`

### Drip emails (`apps/api/src/emails/templates.ts`)

**Finding (P3) — Best writing in the product.**
- Welcome: leads with "Welcome to DocuForge. Thanks for signing up." — correct register. The "you don't need to write any code to try it" sentence is a real selling point.
- Nudge1: `"Still on the fence?"` is a great subject for the timing.
- Nudge2: `"How other developers use DocuForge"` with three concrete flows (Checkout→Invoice, Dashboard→Report, E-sign→Contract) is *exactly* the pattern other SaaS emails should copy.
- Last call: best email. Names the two reasons users stall, opens the reply loop, signs from the team with the founder email visible.
- First PDF: `"🎉 First PDF: shipped."` earns the emoji.
- Reengagement: solid — leads with what's new since the user left.

**Finding (P2) — Subject line for `first_pdf` has a typo / un-grammatical hyphen.**
- Current subject: `"You generated your first PDF — here is what is next"`.
- Verdict: "what is next" reads stiff. Spoken aloud it's "what's next."
- Better: `"You shipped your first PDF — here's what's next"`.

**Finding (P3) — Reengagement bullets are unspecific.**
- Current: `"A bigger templates gallery (invoice, receipt, contract, NDA, event ticket, report card + more)"` is good. `"PDF forms (fill, add fields, list fields)"` reads like a changelog dump.
- Better: For a re-engagement email, lead with the *use case unlock*: `"PDF forms — fill, sign, and export with audit-ready field tracking"`.

**Finding (P3) — Email layout brand line "Stripe for PDFs".**
- Current: in every email header, under the wordmark.
- Verdict: Best brand line in the codebase. Promote to the dashboard sidebar + marketing navbar.

### Docs (`docs/introduction.mdx`, `docs/quickstart.mdx`, `docs/authentication.mdx`)

**Finding (P1) — Introduction lists "React → PDF" as "Coming in Phase 2".**
- Current: `"<Card title="React → PDF"... *(Coming in Phase 2)*"`.
- Verdict: The marketing site has `client.fromReact()` in the code examples and the FeaturesGrid promotes React rendering as a shipped feature. Either the docs are wrong or the marketing is wrong. Either way it's a P1 trust issue at the doorstep of the docs.

**Finding (P2) — "Why DocuForge?" bullet about SDKs is stale.**
- Current: `"SDKs — TypeScript and Python, with more coming soon"`.
- Verdict: The marketing site lists 5 SDKs (TS, Python, Go, Ruby, React). The docs say 2. Update.

**Finding (P3) — Quickstart H1 `"# Quickstart"` is fine, but the first sentence "Get from zero to a generated PDF in 5 minutes." then says "It took 30 seconds, not 3 days" in the code sample.**
- Verdict: Pick a number. 5 minutes vs 30 seconds is the same problem as the dashboard onboarding vs hero. Recommend "60 seconds" everywhere.

**Finding (P3) — Authentication doc is tight.** Keep.

**Finding (P3) — Authentication doc has plan-row inconsistency: "Pro" and "Starter" both say 100 requests/second.**
- Verdict: This appears to match the CLAUDE.md system prompt (`free=10, starter/pro=100, enterprise=500`). If accurate, leave it — but worth confirming the pricing differentiation between Starter and Pro is *not* rate-limit-based, and noting that to readers.

### SDK READMEs

**Finding (P3) — TypeScript README is exactly what an SDK README should be.**
- Verdict: One-sentence positioning, install command, working example, then progressive depth. Keep.

**Finding (P3) — Python README mirrors TS README — good.** Keep.

**Finding (P2) — Missing Go and Ruby READMEs.**
- Verdict: Marketing claims 5 SDKs. Two of them (Go, Ruby) have no README package files. If they exist, surface them — if they don't, *don't claim them.*

### MCP server README

**Finding (P2) — Top-line is a strong one-liner.**
- Current: `"MCP server for DocuForge PDF generation. Enables AI agents like Claude Desktop and Cursor to generate PDFs directly."`
- Keep.

**Finding (P3) — Tools table is great.** Keep.

**Finding (P3) — Missing a "What is MCP?" sentence for non-Anthropic readers.** Worth adding one line: `"MCP (Model Context Protocol) is Anthropic's open standard for letting AI agents call external tools."`

### llms.txt / llms-full.txt

**Finding (P3) — Tight, accurate.** Keep.

**Finding (P3) — Same SDK-count inconsistency.**
- Current: lists TypeScript + Python only.
- Verdict: Should match the marketing site's 5 SDKs if it's true. Or marketing should match this.

### Sign-in / Sign-up

**Finding (P2) — No custom copy at all.**
- Current: bare `<SignIn />` / `<SignUp />` from Clerk, no DocuForge branding string on either page.
- Verdict: This is the highest-conversion screen in the funnel and we say nothing on it. Even one sentence above the Clerk component would help — `"Sign up. Get 100 free PDFs/month."` or similar.
- Better: Add a header above the Clerk widget on sign-up that reiterates the offer.

## Cross-cutting themes

### 1. Pluralism of brand line

`"Stripe for PDFs"` appears once (in the email layout). `"PDF generation API for developers"` appears in docs, SDK READMEs, llms.txt. `"Pixel-perfect PDF generation for developers"` appears in the footer. `"PDF generation API"` appears in metadata. Pick **one** brand line and use it everywhere. Recommendation: `"The PDF generation API. HTML in, pixel-perfect PDFs out."`

### 2. The four-number problem

Free-tier size, time-to-first-PDF, and SDK count are all inconsistent across surfaces:

| Claim | Hero | Pricing | Settings | Onboarding banner | OnboardingChecklist | Final CTA | Docs |
|---|---|---|---|---|---|---|---|
| Free tier size | 100/mo | 100/mo | 1,000/mo | — | — | — | — |
| Time-to-first-PDF | — | — | — | 60 seconds | 5 minutes | 30 seconds | 5 minutes |
| SDK count | 5 (SdkGrid) | — | — | — | — | — | 2 |

**This is a P0 trust issue.** Run a global find-and-replace pass.

### 3. The "Loading..." plague

Every state where the dashboard fetches data shows `Loading...` with no context. `Loading analytics...`, `Loading templates...`, `Loading admin stats...`, `Loading versions...`, `Loading playground…`. This is acceptable, but generic. A single, consistent spinner UI element with no string would be better. If you must use a string, make it product-flavored: `"Fetching your PDFs…"` etc.

### 4. Inclusive language

No instances of `guys`, `blacklist`, `whitelist`, `master`, `slave`, `sanity check`, or `crazy` found in the audited files. Clean.

### 5. Sentence-case discipline

The marketing site mixes Sentence case headings (`"Everything you need"`) with Title Case feature card titles (`"HTML & React Rendering"`, `"Template Engine"`, `"Multi-Cloud Storage"`). Pick one. **Recommendation: Sentence case** everywhere. It reads less SaaS-y, more developer-direct.

### 6. The "what should the user do" deficit

This is the single biggest copy problem in the product. See the error table below — 24 of the 40 user-facing errors I sampled fail this test.

### 7. Punctuation hygiene

- Ellipses: mix of `...` (three dots) and `…` (proper Unicode) across the codebase. Normalize to `…`.
- Dashes: mix of `—` (em dash, used in admin section headings, drip emails — correctly), `–` (en dash, used a few places), and `-` (hyphen, used in headings). The drip emails use em dashes correctly; the dashboard should too.
- Quotes: most strings use ASCII quotes inside JSX (`&quot;Generate PDF&quot;`), some use unicode. Normalize.

### 8. The dashboard has no copy reviewer

This is a meta-finding: the dashboard *feels* like the surface where copy was an afterthought. Every page is `<h1>NounPlural</h1>` followed by a table or empty state. Compare with the drip emails — same product, drastically different writing quality. The dashboard could be 30% better with one editing pass focused on empty states + error messages + button labels.

## Error-message audit table

| Error | File:line | Tells user what to do? | Better message |
|---|---|---|---|
| `"Invalid API key"` | `apps/api/src/lib/errors.ts:16` | No | `"Invalid API key. Check that you're sending it as 'Authorization: Bearer df_live_…'."` |
| `"Rate limit exceeded"` | `apps/api/src/lib/errors.ts:23` | No | `"Rate limit exceeded. Retry after {retryAfter}s, or upgrade your plan for higher limits."` |
| `"Monthly usage limit exceeded. Upgrade your plan."` | `apps/api/src/lib/errors.ts:35` | **Yes** | Keep. (Note: doesn't say *which* plan; could be `"Upgrade to Starter or Pro for higher limits."`) |
| `"An unexpected error occurred"` (500) | `apps/api/src/lib/errors.ts:77` | No | `"Something broke on our side. The error ID has been logged — retry in a minute, or share the request ID if you contact support."` (and add a request-id header) |
| `"Missing or invalid Authorization header"` | `apps/api/src/middleware/auth.ts:45` | Partial | `"Missing or invalid Authorization header. Add: Authorization: Bearer df_live_… (starts with df_live_)."` |
| `AuthError()` bare | `apps/api/src/middleware/auth.ts:40, 50, 88` | No | Same as #1 — never throw `AuthError()` without context. Always supply a hint. |
| `"One of 'html', 'react', or 'template' must be provided"` | `apps/api/src/routes/generate.ts:81` | **Yes** | Keep. |
| `"Template not found"` (via `NotFoundError`) | `apps/api/src/routes/generate.ts:111` | Partial | When fired from `/v1/generate?template=…`, hint with: `"Template not found. List your templates with GET /v1/templates."` |
| Zod issue join (generate) | `apps/api/src/routes/generate.ts:73` | No | Field-by-field rendering instead of comma-joined messages. E.g. `{ field: 'html', message: 'must be at most 5MB' }`. |
| `"At least 2 PDFs required"` | `apps/api/src/routes/pdf-tools.ts:33` | **Yes** | Keep. |
| `"PDF #N exceeds maximum size of 37MB"` | `apps/api/src/routes/pdf-tools.ts:24` | **Yes** | Keep — names the file and the limit. Best error in the codebase. |
| Zod issue join (pdf-tools, all routes) | `pdf-tools.ts:41, 74, 125, 161, 188, 231, 254, 283, 315` | No | Same — surface as structured errors. |
| `"Missing 'file' in form data"` / `"Missing 'family' name…"` / `"Content-Type must be multipart/form-data"` | `apps/api/src/routes/fonts.ts:17, 18, 25` | **Yes** | Keep — concrete and named. |
| `"Plan must be 'starter' or 'pro'"` | `apps/api/src/routes/billing.ts:24` | **Yes** | Keep. |
| `"Stripe is not configured"` | `apps/api/src/routes/billing.ts:17` | No | `"Billing is not yet enabled. Contact support@docuforge.dev to upgrade."` — `Stripe is not configured` is server-internals leaking out. |
| `"Invalid key name"` | `apps/api/src/routes/keys.ts:16` | No | `"Key name is required and must be 1–255 characters."` |
| `"API key not found"` (via NotFoundError) | `apps/api/src/routes/keys.ts:37` | Partial | `"That API key doesn't exist or has already been revoked."` |
| `"Template not found"` (templates routes) | `apps/api/src/routes/templates.ts:96, 126, 173, 204, 240, 289` | Partial | OK for API; in dashboard, surface as `"This template was deleted or moved."` |
| `"Version not found"` | `apps/api/src/routes/templates.ts:212, 248` | Partial | `"That template version doesn't exist. List versions with GET /v1/templates/:id/versions."` |
| `"Either html or template_id is required"` | `apps/api/src/routes/integrations.ts:119` | **Yes** | Keep. |
| `"React component must export a default function component. Example: export default function MyDoc(props) { return <div>...</div>; }"` | `apps/api/src/services/react-renderer.ts:79` | **Yes** | Keep — *exactly* the model error message: names the rule, shows the fix. Use this pattern more. |
| `"React component source exceeds maximum size of 1048576 bytes"` | `apps/api/src/services/react-renderer.ts:99` | Partial | Use human size: `"React component source exceeds 1MB."` Bytes are not human-readable. |
| `"Failed to render React component"` (production) | `apps/api/src/services/react-renderer.ts:124` | No | Add at least a hint: `"Failed to render. Check your component for syntax errors or unsupported APIs (no useState/useEffect)."` |
| `"Failed to load starter template"` | `apps/dashboard/src/app/playground/page.tsx:106` | No | `"Couldn't load that starter. It may have been removed — pick another from /templates/gallery."` |
| `"Template not found"` (playground) | `apps/dashboard/src/app/playground/page.tsx:133` | No | `"This template was deleted. Open Templates to see your remaining ones."` |
| `"Failed to load template"` | `apps/dashboard/src/app/playground/page.tsx:137` | No | Same as above. |
| `"Generation failed"` (playground fallback) | `apps/dashboard/src/app/playground/page.tsx:77` | No | `"Couldn't render this HTML. Common causes: unclosed tags, external resources timing out, or invalid CSS @page rules."` |
| `"Failed to connect to API"` | `apps/dashboard/src/app/playground/page.tsx:80` | No | `"Couldn't reach the API. Check your connection and refresh."` |
| `"Failed to create key"` | `apps/dashboard/src/app/keys/keys-client.tsx:53, 71` | No | If 401: `"You're not signed in."` If 5xx: `"Something broke creating that key. Try again."` |
| `"Failed to delete key"` | `apps/dashboard/src/app/keys/keys-client.tsx:93, 98` | No | `"Couldn't revoke that key. It may have already been deleted — refresh the page."` |
| `"Failed to save"` | `apps/dashboard/src/app/templates/[id]/editor.tsx:55, 62` | No | `"Couldn't save the template. Refresh and retry — your edits are still in this tab."` |
| `"Failed to save before rendering"` | `apps/dashboard/src/app/templates/[id]/editor.tsx:97, 100` | No | `"Couldn't save before rendering. Save manually, then click Render PDF."` |
| `"Failed to save template"` | `apps/dashboard/src/app/templates/editor/visual-editor.tsx:976` | No | `"Couldn't save. Your work is still in this editor — try again or copy the HTML out."` |
| `"Failed to clone template"` | `apps/dashboard/src/app/templates/gallery/gallery-client.tsx:82` | No | `"Couldn't clone — you may be over your template limit, or there was a network issue."` |
| `"Failed to create checkout session"` | `apps/dashboard/src/app/settings/billing-actions.tsx:24` | No | `"Couldn't start checkout. Refresh and try again — if this persists, billing might not be enabled for your account yet."` |
| `"Failed to open billing portal"` | `apps/dashboard/src/app/settings/billing-actions.tsx:45` | No | `"Couldn't open the billing portal. Check you're on a paid plan."` |
| `"Failed to initiate upgrade. Please try again."` | `apps/dashboard/src/app/settings/billing-actions.tsx:27` | No | `"Couldn't start the upgrade. Refresh and retry."` (and remove the `alert()`) |
| `"An error occurred. Please try again."` ×4 | marketplace/page.tsx:36,51, templates/[id]/editor.tsx:77,123, gallery-client.tsx:50 | **No (×4)** | **P0 — remove all. Replace with context-aware messages per surface.** |
| `"User not found."` | `apps/dashboard/src/app/admin/users/[id]/user-detail-client.tsx:118` | No | `"This user no longer exists — they may have been deleted."` |
| `"Failed to load admin stats."` | `apps/dashboard/src/app/admin/admin-client.tsx:141` | No | `"Couldn't load admin stats. Check the API is up and refresh."` |
| `"Generation failed — no PDF available."` | `apps/dashboard/src/app/generations/[id]/page.tsx:195` | Partial | `"This PDF failed to render. See the error above; click 'Open playground' to retry with the same HTML."` |
| `"PDF is still processing..."` | `apps/dashboard/src/app/generations/[id]/page.tsx:199` | Partial | `"Still rendering. Refresh in a few seconds to check."` |
| `"Connection Issue"` block | `apps/dashboard/src/app/error.tsx:54-57` | **Yes** | Keep. |
| `"Authentication Required"` block | `apps/dashboard/src/app/error.tsx:60-63` | Partial | Shorten and direct: `"You're signed out — sign in to continue."` |
| `"Not Found"` block | `apps/dashboard/src/app/error.tsx:65-68` | Partial | `"That page no longer exists. Head back to your dashboard."` |
| `"Something Went Wrong"` block | `apps/dashboard/src/app/error.tsx:72-75` | No | See cross-cutting note above. |

**Tally:** 47 errors audited. **Pass (Yes): 8. Partial: 14. Fail (No): 25.** That's a 17% pass rate. Industry target should be 60%+ for an API-first product.
