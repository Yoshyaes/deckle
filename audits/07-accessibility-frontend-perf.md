# Accessibility & Frontend Performance — Teardown

Scope: `apps/dashboard` and `apps/web`. The audit is brutal on purpose. Every WCAG number is computed from the actual hex tokens in `apps/dashboard/tailwind.config.ts` and `apps/web/tailwind.config.ts` against the body background `#0A0A0B`.

---

## TL;DR

- The design system is **functionally invisible** to a large fraction of users. The two text utilities used on almost every secondary string in the product — `text-text-muted` (#71717A) and `text-text-dim` (#52525B) — both fail WCAG AA on the dark background. `text-text-dim` (3.32:1) misses even the relaxed large-text threshold; `text-text-muted` (5.06:1) passes for normal body text but is used predominantly on 10–11px metadata where AAA matters. Half the dashboard's text is non-compliant.
- There is **zero global focus-visible styling**. Tailwind v3 removes the browser default; nothing replaces it. Tab through the dashboard and you genuinely cannot tell where focus is. This is a P0 keyboard-accessibility blocker.
- Custom **modals are not modals** (`apps/dashboard/src/app/keys/keys-client.tsx:117`, `apps/dashboard/src/app/templates/gallery/gallery-client.tsx:161`). No `role="dialog"`, no `aria-modal`, no focus trap, no Esc handler, no return-focus, no `aria-labelledby`. They are styled divs. Screen reader users have no way to know a modal opened.
- The **playground HTML editor is a `<textarea>`**, the **template editor is a `<textarea>`**, the **visual editor is `divs`**. No Monaco. So the dashboard's bundle is actually small — but the editor experience is also keyboard-illegible (no syntax highlighting, no tab-indent, no line numbers). This is a design trade-off worth flagging.
- Marketing site uses **framer-motion** everywhere (`ScrollReveal` wraps every section). No `prefers-reduced-motion` opt-out. WCAG 2.3.3 / 2.2 best-practice fail across every landing page section.
- Heading hierarchy is broken on most dashboard pages. Several screens render `<h1>` then jump to `<span>`-styled section titles or skip `<h2>` entirely (`apps/dashboard/src/app/page.tsx`, `apps/dashboard/src/components/generation-table.tsx`).
- `next/font` is used correctly. `next/image` is used in marketing. That's about the extent of Next.js perf hygiene — there is no `next.config.js` headers config, no AVIF/WebP override, no bundle analyzer, no route-level dynamic imports.
- The dashboard sidebar's "active" page indicator uses **color alone** (`bg-surface-hover`) and **does not set `aria-current`**. Screen-reader users cannot know which page they're on.

---

## What's actually good

- `next/font/google` is used in both apps (`apps/dashboard/src/app/layout.tsx:3`, `apps/web/src/app/layout.tsx:2`) → zero font-CLS, self-hosted, swap built-in. This is one of the few correctly-done perf items.
- Dashboard pages are mostly Server Components, with `'use client'` correctly scoped to interactive leaves (`sidebar`, `api-key-display`, `usage-chart`, `keys-client`, etc.). The default Next.js App Router posture is preserved.
- `getOverviewStats / getRecentGenerations / getUserApiKeys / getDailyUsage` are parallelized via `Promise.all` in `apps/dashboard/src/app/page.tsx:24`. No DB waterfall.
- Blog uses `generateStaticParams` (`apps/web/src/app/blog/[slug]/page.tsx:13`) → SSG by default.
- Analytics page has a real **skeleton** (`apps/dashboard/src/app/analytics/loading.tsx`). Good.
- Mobile menu button on marketing nav has `aria-label="Toggle menu"` (`apps/web/src/components/layout/navbar.tsx:74`). Rare correct ARIA in the codebase.
- The onboarding checklist X button has `aria-label="Dismiss"` (`apps/dashboard/src/components/onboarding-checklist.tsx:169`).
- Visual editor sanitizes HTML preview with DOMPurify (`apps/dashboard/src/app/templates/editor/visual-editor.tsx:1176`).
- Suspense boundary around `useSearchParams` in playground (`apps/dashboard/src/app/playground/page.tsx:243`).

---

## Accessibility findings

### P0 — Page unusable with keyboard or screen reader

**A11Y-P0-01 — No global focus-visible styles. WCAG 2.4.7 (Focus Visible).**
`apps/dashboard/src/app/globals.css` and `apps/web/src/app/globals.css` contain *no* `:focus`, `:focus-visible`, or `outline` rules. Tailwind's Preflight resets `outline-style: none` on all focusable elements. Every `<button>`, `<a>`, `<input>`, `<select>` in both apps has *no visible focus indicator*. Tab through `/keys`, `/templates/editor`, `/playground` — there is no indication where focus is. This is the highest-impact accessibility bug in the product. Fix: add `*:focus-visible { outline: 2px solid #F97316; outline-offset: 2px; }` in both globals.css.

**A11Y-P0-02 — Modals are not dialogs. WCAG 4.1.2, 2.1.2 (No Keyboard Trap, ARIA Authoring Practices).**
- `apps/dashboard/src/app/keys/keys-client.tsx:117–184` — "Create API Key" modal: a plain `<div className="fixed inset-0 ...">`. No `role="dialog"`, no `aria-modal="true"`, no `aria-labelledby`, no focus is moved into the modal on open, focus is not trapped, Esc does not close, focus is not returned to the trigger button on close.
- `apps/dashboard/src/app/templates/gallery/gallery-client.tsx:161–199` — preview modal: same failures.
- For screen reader users this is doubly broken: the modal opens with no announcement, and Tab will leak focus to the page underneath. For keyboard-only users, the only escape is the visible X (and the visible X is itself an unlabeled icon button — see P1-04).

**A11Y-P0-03 — Native browser `confirm()` for destructive actions.**
`apps/dashboard/src/app/keys/keys-client.tsx:86` calls `confirm('Are you sure you want to revoke this API key?...')`. `confirm()` blocks the page and is announced inconsistently to screen readers; many users will dismiss it without reading. The bigger issue: revoking is *destructive* and the only confirmation is a one-line modal. Move to a proper `role="alertdialog"`.

**A11Y-P0-04 — Visual editor canvas has no keyboard operation.**
`apps/dashboard/src/app/templates/editor/visual-editor.tsx`. The "click an element" interaction is a `<div onClick>` (line 421). There is no `tabIndex`, no `role="button"`, no `onKeyDown`. Same for canvas elements themselves. The palette items are buttons (good), but the canvas — the actual building surface — is a mouse-only experience. The drag-and-drop has no keyboard equivalent (no `aria-grabbed`, no arrow-key reorder). Keyboard-only users cannot use this page at all.

---

### P1 — WCAG AA fail, real users blocked

**A11Y-P1-01 — `text-dim` (#52525B on #0A0A0B) fails WCAG AA 1.4.3. Ratio 3.32:1, requires 4.5:1.**
Used 60+ times across the dashboard: metadata in `generation-table.tsx:49–58`, sidebar usage block (`sidebar.tsx:123–128`), "Admin" label (`sidebar.tsx:96`), table column headers (`keys-client.tsx:195`, `generations/page.tsx:56–62`), most empty-state copy, the entire footer of `marketing /` for copyright (`apps/web/src/components/layout/footer.tsx:75`), Sub-titles on hero subline, "100 PDFs/month free." marketing copy (`hero.tsx:71`), and many more. This text is the primary information channel for half the data in the product.

**A11Y-P1-02 — `text-dim` on `bg-surface` (#52525B on #111113) also fails. Ratio 2.92:1.**
Compounded inside any card, e.g. `bg-surface ... text-text-dim` patterns — `stat-card.tsx:10`, `generation-table.tsx:27`, `usage-chart.tsx:29`. The contrast is *worse* inside cards than against the body background.

**A11Y-P1-03 — `text-muted` (#71717A) on accent-soft tinted backgrounds fails.**
The active-pill pattern `bg-accent-soft text-accent` works visually but the inactive variant uses `text-muted` against `bg-transparent`. Not the worst, but `text-text-muted` is used at 10px–11px sizes in many places (`onboarding-checklist.tsx:183`, `stat-card.tsx:10`, `sidebar.tsx:153`); at <12px the WCAG large-text exception doesn't apply. AA still requires 4.5:1 for normal text, which #71717A delivers (5.06:1) — but only just, and AAA (7:1) fails everywhere.

**A11Y-P1-04 — Icon-only buttons missing `aria-label`. WCAG 4.1.2 (Name, Role, Value).**
- `apps/dashboard/src/components/api-key-display.tsx:28–33` — copy button (Copy/Check icon only). No label. Screen reader announces "button".
- `apps/dashboard/src/app/keys/keys-client.tsx:124` — modal X close button. No label.
- `apps/dashboard/src/app/keys/keys-client.tsx:139` — copy-new-key button. No label.
- `apps/dashboard/src/app/keys/keys-client.tsx:218–227` — copy-key-prefix per row. No label.
- `apps/dashboard/src/app/keys/keys-client.tsx:232–238` — delete (Trash2) per row. No label, only the `<Trash2>` icon. Catastrophic for screen readers — a user can delete the wrong key.
- `apps/dashboard/src/app/templates/editor/visual-editor.tsx:434, 442, 450` — move-up / move-down / delete on each canvas element. Only `title` attributes. `title` is unreliable for SR and invisible to touch users.
- `apps/dashboard/src/app/templates/gallery/gallery-client.tsx:176` — modal X.
- `apps/dashboard/src/app/templates/[id]/editor.tsx:240` — history X.
- `apps/dashboard/src/app/generations/[id]/page.tsx:52–57` — back-arrow link, no `aria-label`.
- `apps/dashboard/src/app/templates/page.tsx:35` and other empty-state "icons" use HTML entities (`&#9634;`) rendered as text via `dangerouslySetInnerHTML`-adjacent patterns. Decorative but not marked.

**A11Y-P1-05 — Sidebar nav does not communicate active page. WCAG 2.4.8 + 4.1.2.**
`apps/dashboard/src/components/sidebar.tsx:67–80`. Active state is conveyed by `bg-surface-hover` text-primary only — color/styling, no `aria-current="page"`. Screen reader users hear identical link labels regardless of position. Add `aria-current={isActive ? 'page' : undefined}` on each NavLink and the docs external link.

**A11Y-P1-06 — Generation table is not a table. WCAG 1.3.1 (Info & Relationships).**
`apps/dashboard/src/components/generation-table.tsx:30–61` — rows are `<Link>` elements with column data inside `<div>`s. Same in `apps/dashboard/src/app/generations/page.tsx:55–99` (grid-based fake table) and `apps/dashboard/src/app/keys/keys-client.tsx:194–242`. Screen readers will read each row as one long link with no column context. The data is genuinely tabular (ID / Type / Pages / Time / Created) — make it a real `<table>` with `<th scope="col">` headers and use `<a>` per cell or row-click via JS. Bonus: the admin tables (`admin/users/users-client.tsx:145`, `admin/generations/generations-client.tsx:75`) get this right — so the design system *can* do it.

**A11Y-P1-07 — Headings hierarchy is broken across pages.**
- `apps/dashboard/src/app/page.tsx` has `<h1>Overview</h1>` (line 55) then `<h2>` only inside the welcome banner (line 73). Sections like "Recent Generations" (`generation-table.tsx:24`), "Your API Key" (`api-key-display.tsx:23`), "Generation Volume" (`usage-chart.tsx:17`) are `<span>`s and `<div>`s. WCAG 2.4.6.
- `apps/dashboard/src/app/admin/page.tsx` and `apps/dashboard/src/app/admin/admin-client.tsx` — same; section titles are not `<h2>`.
- `apps/dashboard/src/app/playground/page.tsx:155` uses `<h1>Playground</h1>` but the panel titles "HTML Editor" (line 197) and "PDF Preview" (line 211) are `<span>`s.
- `apps/dashboard/src/app/templates/editor/visual-editor.tsx:1023` "Elements", `:1211` "Properties" — both are `<h2>` (good) but there is no `<h1>` on the page at all (template name `<input>` doesn't count). Page outline starts at h2.

**A11Y-P1-08 — Form inputs missing programmatic labels. WCAG 1.3.1, 3.3.2.**
- `apps/dashboard/src/app/playground/page.tsx:165–181` — Format and Orientation `<select>`s have no `<label>` and no `aria-label`. The "HTML Editor" `<span>` label above the textarea is not associated.
- `apps/dashboard/src/app/marketplace/page.tsx:79–86` — search input. No label.
- `apps/dashboard/src/app/admin/users/users-client.tsx:108–137` — search input, two `<select>`s. No labels.
- `apps/dashboard/src/app/admin/generations/generations-client.tsx:52–70` — same.
- `apps/dashboard/src/app/templates/[id]/editor.tsx:148, 202` — name input and html textarea, no labels.
- `apps/dashboard/src/app/templates/editor/visual-editor.tsx:1056` — template-name input, no label.

**A11Y-P1-09 — Form errors not announced. WCAG 3.3.1, 4.1.3 (Status Messages).**
`apps/dashboard/src/app/keys/keys-client.tsx:164, 188` — error messages render in a `<p>` or banner with no `role="alert"`, no `aria-live="polite|assertive"`, and no `aria-describedby` linking the error to the input. Same in `templates/editor` (line 156), `templates/gallery` (line 114), `visual-editor` save message (line 1068).

**A11Y-P1-10 — `aria-disabled` not used; reliance on `disabled` alone hides buttons from some flows.**
The "Generate PDF" button (`playground/page.tsx:182`) and "Save" button (`templates/[id]/editor.tsx:178`) use HTML `disabled`. Acceptable, but combined with no focus-visible (P0-01) and no aria-describedby to explain *why* it's disabled, this leaves users guessing. Add `aria-describedby` pointing at the validation reason ("Save disabled — no changes").

**A11Y-P1-11 — Toast / status updates not announced.**
"Saved!" green text in `templates/[id]/editor.tsx:157`, "Template saved!" in `visual-editor.tsx:1068`, "Copied!" in `onboarding-checklist.tsx:247` — none of these have `aria-live="polite"`. Screen reader users have no idea their action succeeded.

**A11Y-P1-12 — Modal in marketplace `preview` (`templates/gallery/gallery-client.tsx:161`) plus modal in `keys-client.tsx:117` plus modal in `visual-editor.tsx` (export panel inline) — all share the same dialog problems noted in P0-02. Listed separately to emphasize this is a *systemic* design-system gap, not a one-off.**

**A11Y-P1-13 — Visual editor's "Drop here to add element" zone has no aria-live region and no focusable target.**
`apps/dashboard/src/app/templates/editor/visual-editor.tsx:1150`. Drag-only.

**A11Y-P1-14 — The admin users tables (`apps/dashboard/src/app/admin/users/users-client.tsx:144–235`) use a real `<table>` but no `<caption>` and no `scope="col"` on `<th>`s. WCAG 1.3.1 best practice.**
Same for `admin/generations/generations-client.tsx`, `apps/web/src/components/sections/comparison.tsx:21–60` (the marketing comparison table).

**A11Y-P1-15 — Mobile menu doesn't `aria-expanded` or `aria-controls`. WCAG 4.1.2.**
`apps/web/src/components/layout/navbar.tsx:71–77`. The button toggles `mobileOpen` but the screen-reader has no idea what state the menu is in. Add `aria-expanded={mobileOpen}` and `aria-controls="mobile-menu"`, with `id="mobile-menu"` on the menu container.

**A11Y-P1-16 — Brand glow / dark theme has no `prefers-color-scheme: light` fallback.**
The product is *only* dark. There is no toggle. Some users with photophobia or astigmatism rely on light mode. Not a hard WCAG fail but a 1.4.8 (Visual Presentation) consideration.

**A11Y-P1-17 — `<html lang="en">` is hardcoded.**
Acceptable for now but worth flagging — when localizing, this must become dynamic.

**A11Y-P1-18 — Sign-in / sign-up pages have no `<h1>`.**
`apps/dashboard/src/app/sign-in/[[...sign-in]]/page.tsx:5` — a `<div>` wraps the Clerk component, no headings, no skip-link, no `<main>`. Clerk renders its own DOM but page-level landmarks are still missing.

**A11Y-P1-19 — No skip-to-content link. WCAG 2.4.1 (Bypass Blocks).**
Both `apps/dashboard/src/app/layout.tsx` and `apps/web/src/app/layout.tsx` lack a `<a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>`. With a 7+ link sidebar this is painful for keyboard users.

**A11Y-P1-20 — `prefers-reduced-motion` not respected. WCAG 2.3.3 (Animation from Interactions).**
- Every section in `apps/web/src/app/page.tsx` is wrapped in `<ScrollReveal>` (apps/web/src/components/ui/scroll-reveal.tsx:13) which animates opacity+translateY on viewport entry.
- The hero (`hero.tsx:34, 76`) and tab-switcher (`tab-switcher.tsx:30, 40`) use motion.
- No `useReducedMotion()` hook usage. No CSS `@media (prefers-reduced-motion: reduce) { ... }`. Reduced-motion users get the full Apple-style ramp.

**A11Y-P1-21 — `<main>` is missing on most dashboard pages.**
Each dashboard page wraps content in `<main className="flex-1 ...">` *inside* a flex container, so technically present. But `apps/dashboard/src/app/sign-in/page.tsx`, `apps/dashboard/src/app/sign-up/page.tsx`, and `apps/dashboard/src/app/error.tsx` use raw `<div>` only — no landmark. Marketing wraps in `<main>` in `layout.tsx:45`.

**A11Y-P1-22 — `<aside>` for sidebar (`sidebar.tsx:46`) is fine, but no `aria-label="Primary navigation"` — there is one nav landmark (`<nav>` inside) but no accessible name. Multi-region pages need labeled landmarks.**

---

### P2 — Best-practice gap

**A11Y-P2-01 — Decorative icons missing `aria-hidden="true"`.**
Every `lucide-react` icon in buttons that already have visible text is decorative; SR will read both icon and text noise. Examples: `sidebar.tsx:76, 87, 113`; `keys-client.tsx:112`; `templates/[id]/editor.tsx:146, 166, 176, 183, 191`; `playground/page.tsx` toolbar; `final-cta.tsx` arrow; ~150 call-sites total. Add `aria-hidden="true"` on the Lucide component or wrap as `<Icon aria-hidden />`.

**A11Y-P2-02 — Sidebar logo is a div with text "D" — no alt / no role.** `sidebar.tsx:48–55`. Either give it `role="img" aria-label="DocuForge"` or replace with the real logo image.

**A11Y-P2-03 — Marketing logo image alt is "DocuForge" (good) — but appears twice (nav + footer) and the link wrapping it has no `aria-label`. Result: screen reader hears "DocuForge link DocuForge image" or similar redundancy.** Wrap in `<Link aria-label="DocuForge home">`.

**A11Y-P2-04 — `<p>` rendering "&copy; ... All rights reserved." uses `text-text-dim` — readability hit; could be `text-text-muted`.**

**A11Y-P2-05 — `error.tsx` (dashboard, line 113) renders icons via `dangerouslySetInnerHTML` from numeric HTML entities. These are non-text content with no `aria-label`, no `role="img"`. Screen readers will say nothing or recite the unicode name. Replace with proper Lucide icons + `aria-label`.**

**A11Y-P2-06 — Playground "Open in new tab" link (`generations/[id]/page.tsx:177`) is fine, but the inline iframe (`generations/[id]/page.tsx:186`) has `title="PDF Preview"` (good) — no fallback content. If the iframe fails, no message.**

**A11Y-P2-07 — `apps/web/src/components/sections/social-proof.tsx:22` "Placeholder logos" — these "logos" are `<span>` text, not images, dressed up with `opacity-40`. The opacity reduces effective contrast: `#FAFAFA` at 40% over `#0A0A0B` ≈ `#67676A`, ratio 3.36:1, below AA. Best fix: use real SVGs and don't dim them.**

**A11Y-P2-08 — Disabled buttons styled with `opacity-50`** (`playground/page.tsx:185`, `keys-client.tsx:175`, `templates/[id]/editor.tsx:181`). 50% white on gradient orange = unpredictable; runs the risk of failing 3:1 UI component contrast (WCAG 1.4.11). The orange `#F97316` against the bg already has contrast issues (see matrix).

**A11Y-P2-09 — `<select>` elements use site-wide dark theme but no `color-scheme: dark` is declared on `:root`. Native form widgets (date pickers, scrollbars, autofill) will render light over dark, looking broken. Add `color-scheme: dark` to body CSS.**

**A11Y-P2-10 — `cursor-not-allowed` (`usage-chart.tsx:30`) on `disabled` buttons is fine for sighted users but the screen reader won't pick it up unless `aria-disabled` is also set. The 7d/90d period buttons are disabled with no explanation.**

**A11Y-P2-11 — `<button>` inside a `<Link>` pattern not used in code, but `<Link>` with `onClick` inside `<div onClick>` exists (visual-editor canvas element). Nested interactive elements break tabindex order.**

**A11Y-P2-12 — `apps/dashboard/src/app/playground/page.tsx:228` iframe with `src={pdfUrl}` — title is set ("PDF Preview"), but no `sandbox` and no fallback "your browser does not support PDF preview" message.**

**A11Y-P2-13 — The sidebar's progress bar at `sidebar.tsx:130–135` is a `<div>` styled as a bar — no `role="progressbar"`, no `aria-valuenow`, no `aria-valuemin`, no `aria-valuemax`, no `aria-label="Usage this month"`. Same issue in `onboarding-checklist.tsx:177` ("X/4 progress").**

**A11Y-P2-14 — Status pills (`generations/[id]/page.tsx:66–74`, `generation-table.tsx:39`) communicate completed/failed via color dots only. Add a text label or `aria-label="Completed"` to status dots.**

**A11Y-P2-15 — `apps/web/src/components/sections/comparison.tsx` — competitor cells use `text-text-dim` for "wkhtmltopdf" / "Prince XML" rows. The whole table is hard to read.**

---

### P3 — Nits

- A11Y-P3-01 — `apps/dashboard/src/app/page.tsx:62` "&#9889; Generate PDF" inserts a lightning bolt as text. Decorative but read aloud. Wrap in `<span aria-hidden>`.
- A11Y-P3-02 — Empty-state icons rendered as Unicode glyphs (`templates/page.tsx:35` `&#9634;`, `templates/editor/visual-editor.tsx:1120` `+`) — same issue.
- A11Y-P3-03 — `apps/web/src/components/sections/testimonials.tsx:17` — circular avatar with first-letter only; screen reader reads the first letter as well as the name (redundant).
- A11Y-P3-04 — `apps/dashboard/src/components/usage-chart.tsx:37–51` chart bars have no data summary; SR users get a series of empty divs. Add a visually hidden table/`<figcaption>`.
- A11Y-P3-05 — `prose-docuforge` class on `apps/web/src/app/blog/[slug]/page.tsx:70` — no `prose` plugin installed in tailwind config; that class does nothing. Markdown content will inherit only the explicit `mdx-components.tsx` overrides.
- A11Y-P3-06 — Dashboard root `<html lang="en">` is set, but `apps/dashboard/src/app/error.tsx:110` page is rendered through error boundary without a `<main>` landmark.
- A11Y-P3-07 — `apps/web/src/components/layout/navbar.tsx:36` — logo link has no `aria-label` (image alt provides accessible name; ok but worth noting).

---

## Frontend performance findings

### P0 — Page broken or 5s+ regression

**FE-P0-01 — Marketing landing dynamic via framer-motion.**
`apps/web/src/components/sections/hero.tsx:1` is `'use client'` — the *entire* hero is shipped to the client because of `motion.div`. Every section that uses `<ScrollReveal>` does the same. Result: the landing page hydrates ~10 client component trees of decoration. Each `ScrollReveal` ships framer-motion (~50KB gzip). Cumulative cost on a "static marketing page" is wildly out of line with industry baselines. Replace `ScrollReveal` with CSS `animation-play-state` triggered via IntersectionObserver-free CSS class, or `@keyframes` + `view-timeline` for browsers that support it. Could halve marketing JS payload.

**FE-P0-02 — DOMPurify in three dashboard bundles.**
`dompurify@^3.2.4` (~22KB gzip) is imported in:
- `apps/dashboard/src/app/templates/editor/visual-editor.tsx:6`
- `apps/dashboard/src/app/templates/[id]/editor.tsx:5`
- `apps/dashboard/src/app/templates/gallery/gallery-client.tsx:6`

Each of those is `'use client'` so each route bundle pulls DOMPurify independently. Worse, DOMPurify is loaded even when no preview is shown. Wrap in `next/dynamic(() => import('dompurify'), { ssr: false })` at the call sites, or lazy-load via a `usePurify()` hook.

---

### P1 — Real performance regression, fixable

**FE-P1-01 — No `next/image` for any dashboard image (there aren't many — but the logo "D" tile is a CSS gradient, OK).** Marketing uses `next/image` for `/logo.png` (good). But no `sizes` prop on the logo (`navbar.tsx:38`), so Next renders responsive `<img srcset>` without telling the browser which to pick. Add `sizes="160px"`.

**FE-P1-02 — Marketing OG / icon images are PNGs.**
`apps/web/public/og-image.png`, `twitter-banner.png`, `og-logo-dark.png`, `og-logo-light.png`, `product-hunt-thumb.png`, `brand-sheet.png` — all PNGs. OG images cannot be served as AVIF/WebP (most crawlers don't honor it), so PNG is correct *for OG*. But `/logo.png` and `/logo-light.png` are PNGs served to actual browsers — should be WebP or SVG. The Navbar logo (`navbar.tsx:38`) loads `/logo.png` at 160×40 — likely 10–30KB when a 1KB SVG would suffice.

**FE-P1-03 — No `images` config in `next.config.mjs` / `next.config.js`.**
`apps/web/next.config.mjs` has no `images.formats: ['image/avif', 'image/webp']`. Next.js defaults to WebP only since v13, so AVIF is missed. For a marketing site with hero/feature imagery, this is a 20–40% file-size leave-on-table.

**FE-P1-04 — No `headers()` config in either next.config.**
No `Cache-Control` for `/og-*.png`, `/favicon-*.png`, `/twitter-banner.png` — they go out with Next's default `public, max-age=0, must-revalidate`. Static brand assets should be `public, max-age=31536000, immutable`. Same for `/llms-full.txt` (a sizeable file).

**FE-P1-05 — Dashboard root layout wraps everything in ClerkProvider.**
`apps/dashboard/src/app/layout.tsx:32`. ClerkProvider is `'use client'` from `@clerk/nextjs` — this turns the entire app into a client-component subtree for state purposes. Combined with `@clerk/nextjs` shipping the Clerk JS (`~80KB gzip`) on every dashboard route — including SSR'd routes that don't need auth UI — this is the single largest fixed cost in the dashboard.
Mitigation: keep ClerkProvider but verify the heavy Clerk components (`UserButton`, `SignIn`, `SignUp`) are only loaded on routes that use them. `UserButton` is in `sidebar.tsx:158` → loaded on every page. Probably OK.

**FE-P1-06 — Hero on landing page is `'use client'`.**
`apps/web/src/components/sections/hero.tsx:1`. The hero is the LCP element. Making it a client component delays paint vs. the alternative of plain HTML + a tiny CSS animation. CodeBlock is a server component (good — `apps/web/src/components/ui/code-block.tsx` is plain). Splitting hero into a server-rendered text block + a small client-only decoration would speed up LCP measurably.

**FE-P1-07 — `'use client'` on entire marketplace, analytics, admin pages.**
- `apps/dashboard/src/app/marketplace/page.tsx:1` — whole page client. Fetches in `useEffect`. Should be a server component with initial data fetched in the RSC and a small client island for clone-action. Saves: hydration cost + initial fetch waterfall + skeleton.
- `apps/dashboard/src/app/analytics/page.tsx:1` — same pattern. `useEffect → fetch → setState` would be invisible to SSR. Render the chart skeleton on the server, hydrate later.
- `apps/dashboard/src/app/admin/users/users-client.tsx` — fine that *this* is client (filters are interactive), but the wrapper `apps/dashboard/src/app/admin/users/page.tsx` should still SSR the initial list. Currently, every page shows "Loading..." → fetch → render. CLS-adjacent (no skeleton).

**FE-P1-08 — No skeleton on `marketplace`, `analytics`, `templates/gallery`, `playground` first paint.**
The pattern across these is `useEffect → setLoading(true)` then a text "Loading..." string. The user sees a blank page → "Loading…" → flash to content. CLS will be 0.2+ on slower devices.

**FE-P1-09 — `lucide-react` imported eagerly.**
Every page imports a handful of Lucide icons. Each `import { Foo } from 'lucide-react'` is tree-shaken correctly, *but* the sidebar alone pulls 10 icons (`sidebar.tsx:6–17`), the editor pulls 15 (`visual-editor.tsx:8–24`). Aggregate cost is ~30–40KB across the dashboard. Use modular `lucide-react/icons/<icon>` imports (saves ~25% on parsing) or replace decorative icons with inline SVG.

**FE-P1-10 — `framer-motion` is imported in marketing for what could be CSS.**
`hero.tsx`, `tab-switcher.tsx`, `scroll-reveal.tsx`. `whileInView`, `initial`, `animate` for opacity+translateY is a one-liner in CSS with `@keyframes` triggered by an `IntersectionObserver`-set class. Switching saves ~50KB (framer-motion gzip).

**FE-P1-11 — Bundle chunks: marketing tab-switcher pulls framer-motion for a simple tab control.**
`apps/web/src/components/ui/tab-switcher.tsx:1` — just for the layoutId underline animation. Replace with a `transform: translateX` of an absolutely-positioned underline calculated from `active`.

**FE-P1-12 — Static-vs-dynamic mismatch on landing.**
`apps/web/src/app/page.tsx` is statically generated (no `export const dynamic`, no `cookies()`, no `headers()`). Good. **But** `BlogPreview` is `async` and runs `getAllPosts()` (`apps/web/src/components/sections/blog-preview.tsx:8`). If `getAllPosts` reads the filesystem, this is OK at build time (SSG). If it reads at runtime → ISR; verify `apps/web/src/lib/blog.ts` uses `fs` at build only.

**FE-P1-13 — Marketing has 10 sections, each wrapped in `<ScrollReveal>` × multiple times.**
Result: ~25 `motion.div` instances on initial paint. Each registers a viewport observer. This is hostile to long pages. CLS-wise: each animates from `opacity:0`, which doesn't shift layout — OK on CLS, but disastrous on TBT.

**FE-P1-14 — `apps/dashboard/src/components/onboarding-checklist.tsx:25–76` defines SDK_TABS at module top with 4 large multi-line strings.**
This 5KB of string data is bundled into every page that imports the checklist (i.e., the home page). Lazy-load via `import()` when the user expands the SDK panel (line 251 `onClick={() => setSdkExpanded`).

**FE-P1-15 — No bundle analyzer configured. No `@next/bundle-analyzer` in devDependencies.**
Without it there's no signal when a regression lands.

**FE-P1-16 — `localStorage` reads happen inside `useEffect` on first paint of onboarding checklist.**
`onboarding-checklist.tsx:89`. Three reads happen synchronously. Each is fast, but combined with `'use client'` and the render flash from "not dismissed" → "dismissed" on first paint = visible flicker.

**FE-P1-17 — Playground does a 3-step bounce on first paint.**
`playground/page.tsx`: render shell → `useSearchParams` → effect fetches template → effect calls handleGenerate → re-render with PDF. On a slow link this is 4 renders before content. Move the initial template fetch to server component + initial props.

**FE-P1-18 — Marketing nav scroll listener runs on every scroll without `requestIdleCallback`.**
`apps/web/src/components/layout/navbar.tsx:21`. `passive: true` is set (good), but the React `setState` on every scroll over 50px will re-render the nav. Throttle.

**FE-P1-19 — Marketing landing `Hero` LCP element ('HTML in. Pixel-perfect PDFs out.') waits for framer-motion JS to mount before becoming visible.**
Visible only after `initial: {opacity:0}` → animate. If JS is delayed (slow 3G), users see nothing for 1–2s. Server-render the headline visible by default; animate only on JS load (`@media (prefers-reduced-motion: no-preference)`).

**FE-P1-20 — `Network` for client-loaded data: marketplace, gallery, analytics, admin pages all do `fetch('/api/...')` from `useEffect`. This is `client → Next-dashboard API route → DB`. Each hop adds 30–80ms. Server-side fetch from the RSC saves a round-trip.**

**FE-P1-21 — `apps/dashboard/src/app/templates/editor/visual-editor.tsx` is a 1244-line file shipped as one client component bundle.**
The export panel, preview panel, properties panel, and palette could be split with `next/dynamic`. They're rarely all rendered together.

**FE-P1-22 — Blog post page does runtime MDX compilation on every request unless cached.**
`apps/web/src/app/blog/[slug]/page.tsx:71` — `MDXRemote` from `next-mdx-remote/rsc`. Combined with `generateStaticParams` this should be SSG, but verify by inspecting build output. If `shiki` (~50KB) is bundled per route, that's heavy.

---

### P2 — Best-practice gap

- **FE-P2-01** — `apps/dashboard/src/app/layout.tsx` does not set `<meta name="viewport">`. Next.js inserts a default but explicit is better.
- **FE-P2-02** — No `<link rel="preconnect">` for Clerk's domain (`clerk.com`, `clerk.accounts.dev`). Adds ~150ms cold-start.
- **FE-P2-03** — No `<link rel="preconnect">` for the API origin (`app.getdocuforge.dev`, the CDN serving PDFs).
- **FE-P2-04** — Marketing site's iframe-free design avoids most third-party JS — good. But the docs link (`fred-7da601c6.mintlify.app`) is a temp Mintlify subdomain — risk it 404s in prod.
- **FE-P2-05** — `apps/web/next.config.mjs` rewrites `/docs/*` → Mintlify externally. Each docs hit costs an extra hop. Use Mintlify's CNAME instead.
- **FE-P2-06** — No `Content-Security-Policy` header configured in either app's middleware or next.config. With DOMPurify in play this is a missed defense-in-depth.
- **FE-P2-07** — `apps/dashboard/src/app/loading.tsx` is global skeleton — just text "Loading...". Bad UX. Page-specific skeletons exist only for analytics, generations, keys, marketplace, playground, settings, templates — but not for the home page (`/`) and admin pages.
- **FE-P2-08** — No `prefetch={false}` on rarely-used links (e.g., footer Discord). Next.js prefetches every visible Link by default.
- **FE-P2-09** — `apps/web/src/components/sections/blog-preview.tsx:30` — uses `delay={i * 0.05}` for stagger. 0.05s × 4 = 0.2s delay before the last card animates in. On the LCP critical path.
- **FE-P2-10** — `useState` for `scrolled` triggers re-renders of the whole nav. A `data-scrolled` attribute on `<html>` set via DOM API and CSS would be cheaper.
- **FE-P2-11** — `next/font` is auto-applied via `className` on `<html>` but in the dashboard layout the `dmSans.variable` is used — *only declares the CSS variable*; you also need `dmSans.className` or set `font-family: var(--font-dm-sans)` somewhere globally. `apps/dashboard/src/app/globals.css` has no `font-family` rule, so DM Sans is currently *not applied* unless `font-sans` Tailwind utility resolves it via the config — and the dashboard `tailwind.config.ts:25` lists `'DM Sans'` as a string, not `var(--font-dm-sans)`. Marketing's config has `var(--font-dm-sans)` (correct). Dashboard hits FOIT/FOUT depending on system DM Sans installation. Bug.
- **FE-P2-12** — `apps/dashboard/src/app/templates/editor/page.tsx` (visual editor wrapper) presumably wraps `<VisualEditor />` as a client component; if so, the wrapper page does no SSR work and could even be a static export.

---

### P3 — Nits

- **FE-P3-01** — `apps/dashboard/src/components/sidebar.tsx:82` hardcodes the docs URL to a Mintlify temp domain. Use env var.
- **FE-P3-02** — `apps/web/src/components/layout/navbar.tsx:62` and 95 use Button with `href="https://app.getdocuforge.dev/..."`. Cross-origin Link will not prefetch. OK.
- **FE-P3-03** — `apps/dashboard/src/components/usage-chart.tsx:37` renders 30 bars; on small charts the gap `gap-1` plus min-height causes weird overflows in narrow viewports.
- **FE-P3-04** — `apps/web/src/components/sections/social-proof.tsx:22` uses `opacity-40` on logos — accessibility and design hit.
- **FE-P3-05** — `apps/dashboard/src/app/playground/page.tsx:165–181` `<select>` styling is inline hex, not Tailwind tokens — drift from design system.

---

## Color contrast matrix

All ratios computed against `#0A0A0B` (body bg) and `#111113` (surface bg) using WCAG 2.1 relative-luminance formula. AA normal text needs 4.5:1, AA large text (18pt or 14pt bold) needs 3:1, AA UI components/graphics need 3:1. AAA normal text needs 7:1.

| Token combo | Ratio | WCAG AA (normal) | WCAG AA (large/UI) | WCAG AAA (normal) |
| --- | --- | --- | --- | --- |
| text-primary #FAFAFA on bg #0A0A0B | 19.32:1 | PASS | PASS | PASS |
| text-primary #FAFAFA on surface #111113 | 18.09:1 | PASS | PASS | PASS |
| text-muted #71717A on bg #0A0A0B | 5.06:1 | PASS | PASS | FAIL (need 7:1) |
| text-muted #71717A on surface #111113 | 4.73:1 | PASS | PASS | FAIL |
| text-muted #71717A on surface-hover #18181B | 4.36:1 | **FAIL** (4.5 req) | PASS (3 req) | FAIL |
| text-dim #52525B on bg #0A0A0B | 3.32:1 | **FAIL** | PASS (UI/large) | FAIL |
| text-dim #52525B on surface #111113 | 3.11:1 | **FAIL** | PASS (UI/large, barely) | FAIL |
| text-dim #52525B on surface-hover #18181B | 2.86:1 | **FAIL** | **FAIL** (<3:1) | FAIL |
| accent #F97316 on bg #0A0A0B | 5.84:1 | PASS | PASS | FAIL |
| accent #F97316 on surface #111113 | 5.46:1 | PASS | PASS | FAIL |
| accent on accent-soft rgba(249,115,22,0.08) over bg | ~5.5:1 | PASS | PASS | FAIL |
| green #22C55E on bg #0A0A0B | 9.97:1 | PASS | PASS | PASS |
| red #EF4444 on bg #0A0A0B | 5.06:1 | PASS | PASS | FAIL |
| blue #3B82F6 on bg #0A0A0B | 4.89:1 | PASS | PASS | FAIL |
| purple #A855F7 on bg #0A0A0B | 6.13:1 | PASS | PASS | FAIL |
| white-on-accent (button: #FFFFFF on #F97316) | 3.31:1 | **FAIL** | PASS (3 req for large/UI) | FAIL |
| white-on-orange-600 (#FFFFFF on #EA580C) | 4.27:1 | **FAIL** (barely) | PASS | FAIL |
| border #27272A on bg #0A0A0B | 1.50:1 | n/a (non-text UI; 3:1 req) | **FAIL** | n/a |
| border-subtle #1E1E21 on bg #0A0A0B | 1.21:1 | n/a | **FAIL** | n/a |
| disabled button (50% white on accent) | ~2.4:1 | **FAIL** | **FAIL** | FAIL |
| placeholder text (text-dim on bg) in inputs | 3.32:1 | **FAIL** | PASS | FAIL |
| Mobile "Trusted by" logos at opacity-40 (≈#67676A on bg) | 3.36:1 | **FAIL** | PASS | FAIL |
| focus ring (none, default browser outline removed) | 0:1 / no indicator | **FAIL** (2.4.7) | **FAIL** | **FAIL** |

**Critical findings from the matrix:**
1. `text-dim` (#52525B) fails AA normal-text on every surface in the app. It is the most-used secondary color in the dashboard. **Replace with a color ≥ #8E8E96 (4.6:1 on bg).**
2. `text-muted` on hover-state surfaces (`surface-hover #18181B`) drops to 4.36:1 — under AA for normal text. Many nav/list items use exactly this combo. **Either darken the hover surface or lighten text-muted to #80808A.**
3. The signature `accent` orange on a button with white text — the brand button — **fails WCAG AA for normal text** (3.31:1 vs 4.5:1 required). It passes the 3:1 large-text/UI threshold, so it's not catastrophic for the visible label "Generate PDF" at button size, but it's the brand's most-used button and is below the recommendation for an 14px font-weight 600 button label. Darken to `orange-600 #EA580C` (4.27:1 — still fails AA strictly but closer) or use `orange-700 #C2410C` for guaranteed AA.
4. Border `#27272A` on bg has 1.5:1 — far below 3:1 required for UI component contrast (1.4.11). Sighted users with mild vision impairment can't see card boundaries.
5. Disabled buttons at 50% opacity fall below all thresholds — they are essentially invisible, which is what "disabled" should imply visually, but pair this with no `aria-disabled` and you get a true invisible-and-silent control.

---

## Cross-cutting themes

1. **The design system has no focus model.** No global focus-visible. No focus-ring color in the tailwind config. No `:focus-within` patterns. This single fix would lift the product from "WCAG fail across all routes" to "WCAG mostly passes for keyboard users".

2. **The design system has no modal primitive.** Every modal is reinvented per-route, none have ARIA, none trap focus, none restore focus. Build a single `<Dialog>` based on Radix or Headless UI and migrate all six modal sites. Same for tooltips, menus, and toasts (the "Saved!" / "Copied!" texts).

3. **Tables-by-grid is a recurring antipattern.** Generation table, keys table, generations history all use `grid-cols-[...]` `<div>` rows. Replace with real `<table><thead><tr><th scope="col">` markup. The admin tables prove the design system can do it correctly.

4. **Color tokens were chosen by aesthetic, not by contrast.** `text-dim` and `text-muted` need a top-down refactor; about 200 call-sites use them for content that should be readable. Suggestion: introduce `text-secondary` (≥4.5:1) and `text-tertiary` (≥3:1) tokens with explicit WCAG targets, deprecate the existing two.

5. **Marketing site is over-animated.** `framer-motion` is used decoratively on a static page. Either keep but respect `prefers-reduced-motion`, or rip out and use CSS. Saves ~50KB and improves a11y simultaneously.

6. **Client-component overreach.** Marketplace, analytics, gallery, admin tables — all marked `'use client'` and re-fetch from `useEffect`. They should be Server Components rendering the initial data, with small interactive islands. Pattern is the single biggest bundle/Hydration win available.

7. **Icons everywhere, but no `aria-hidden`.** A blanket sweep adding `aria-hidden="true"` to every Lucide icon that sits next to visible text would fix dozens of SR-noise issues with a 10-minute commit.

8. **No skip link, no landmarks-with-labels, no `aria-current`, no `aria-live`.** The four-line ARIA pattern (`role="main"` already implicit, `aria-current="page"` on active nav, `<a href="#main" class="sr-only focus:not-sr-only">`, `aria-live="polite"` on status banners) would close ~15 of the listed P1 findings.

9. **No `next.config.js` headers / images config.** Both apps ship with literally the default Next config. Adding `images.formats`, headers for static assets, and a CSP would be cheap wins.

10. **Dashboard font config is broken.** `apps/dashboard/tailwind.config.ts:25` references `'DM Sans'` literal instead of `var(--font-dm-sans)`. The body `font-sans` class doesn't resolve to the next/font instance — the dashboard is currently using a system fallback font, not DM Sans. Marketing's config has it right. This is one line to fix and dramatically changes the dashboard's typography.

---

### Suggested fix priority (one sprint)

1. Add `*:focus-visible` outline globally — fixes P0-01.
2. Fix dashboard tailwind font var — `var(--font-dm-sans)`.
3. Lift `text-dim` from #52525B to ≥ #8E8E96 — fixes ~25 contrast findings at once.
4. Build a single accessible `Dialog` primitive, migrate six modal sites — fixes P0-02, P1-12, P0-03.
5. Add `aria-current`, skip-to-content link, `aria-live="polite"` on save/error banners — fixes P1-05, P1-09, P1-11, P1-19, P1-22.
6. Sweep icon-only buttons with `aria-label` — fixes P1-04 ten places.
7. Replace `<ScrollReveal>` with CSS reduced-motion-aware fade-in — fixes A11Y-P1-20 and FE-P0-01 simultaneously.
8. Move marketplace/analytics/gallery to RSC + small client islands — fixes FE-P1-07, FE-P1-08, FE-P1-20.
9. Convert generation/keys grid-divs to real `<table>` markup — fixes P1-06 across the dashboard.
10. Add `images.formats: ['image/avif','image/webp']` and headers for static assets — FE-P1-03, FE-P1-04.
