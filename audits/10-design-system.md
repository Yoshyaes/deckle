# Design System & Visual Polish — Teardown

Scope: dashboard (`apps/dashboard`), marketing (`apps/web`), and PDF component library (`packages/react`). Tokens, typography, color discipline, spacing, radius, shadows, icons, dark-theme execution, component reuse, cross-app consistency, Clerk override, logo/favicon, and PDF-component styling.

Verdict: there is **no design system**. There are two carefully duplicated `tailwind.config.ts` files that define 12 color tokens, and then every page reimplements buttons, inputs, modals, surfaces, and stat cards from scratch. Visual coherence is held together by everyone copy-pasting the same `rounded-[14px] bg-surface border border-border` literal — which means it *looks* consistent at a glance, but breaks the second anyone deviates (and they have).

---

## TL;DR

- **P0** — No `components/ui/` library in the dashboard. 7 components total, none of which are Button / Input / Modal / Badge / Card. Every page reinvents these inline with raw `<button>`/`<div>` + a copy-pasted gradient string.
- **P0** — `rounded-[14px]` appears in **35+ places** as a magic number. There is no token for it. Tailwind already gives you `rounded-2xl` (16px) and `rounded-xl` (12px); 14 is a one-off you've now committed to forever.
- **P0** — The "primary CTA" gradient (`bg-gradient-to-br from-accent to-orange-600`) is copy-pasted **16+ times across 12 files**. There is no `Button` component on the dashboard. Each instance has slightly different padding, font-weight, and shadow.
- **P0** — Marketing site has a `Button` component (`apps/web/src/components/ui/button.tsx`). Dashboard does not import or use it. Two apps, two button systems, one shared package would have fixed this.
- **P0** — Loading skeleton sidebar width (`w-[240px]`) does not match real sidebar width (`w-[220px]`). The page literally jumps 20px on hydration.
- **P0** — Dashboard has no `apps/dashboard/public/` directory. No favicon, no apple-touch-icon, no manifest. The browser tab is naked.
- **P1** — Status / semantic color tokens (`green`, `red`, `blue`, `purple`) are defined in Tailwind but **only used as raw `bg-green` / `text-red` half the time**; the other half uses `bg-green-500/20 text-green-400` (Tailwind defaults). Two parallel green systems, two parallel red systems.
- **P1** — Accent color is on every button on every page. There is no visual hierarchy of "primary action" vs. "secondary action" because everything important is the same orange gradient.
- **P1** — No icon size token. Icons are inline `<Icon size={11} />`, `12`, `13`, `14`, `16`, `18`, `20`, `24` scattered everywhere; no `xs/sm/md/lg` enum.
- **P1** — No shadow scale. There are exactly three shadow usages and they're all hardcoded `shadow-[0_0_30px_rgba(249,115,22,0.15)]` literals.
- **P1** — Logo is a PNG only. No SVG. Renders fuzzy on hi-DPI, can't be recolored, can't animate.
- **P1** — Clerk sign-in/sign-up cards override with `bg-[#111113] border border-white/10` — uses raw hex and `white/10` instead of the `border-subtle` token. Doesn't match the rest of the surface treatment.
- **P2** — `globals.css` ships an inline body `background: #0A0A0B; color: #FAFAFA` that duplicates Tailwind's `bg-bg` / `text-text-primary` for no reason — duplicate source of truth.
- **P2** — Custom scrollbar (`::-webkit-scrollbar` 6px / `#333`) doesn't use any token, won't render at all on Firefox, and uses `#333` which doesn't match `#27272A` (`border`) or `#1E1E21` (`border-subtle`).

Total findings below: **~55**.

---

## What's actually good

1. The token names themselves are sensible: `bg / surface / surface-hover / border / border-subtle / text-primary / text-muted / text-dim / accent / accent-glow / accent-soft`. Five colors of text, two of border, three of surface — that's the right vocabulary.
2. Surface layering palette (`#0A0A0B → #111113 → #18181B`) is well-chosen. Subtle enough to be sophisticated, distinct enough to read as layers in dark mode.
3. Lucide icons are used consistently as the icon library in the dashboard. No mixing with Heroicons / Tabler / inline SVG (except the visual editor palette, which is still Lucide). Score: 9/10 on icon library discipline.
4. DM Sans + JetBrains Mono is a clean, modern choice that signals "developer tool" without trying too hard.
5. `text-text-primary` / `text-text-muted` / `text-text-dim` hierarchy is actually applied consistently. The three-tier text system is the strongest part of the design system.
6. The `accent-soft` (`rgba(249,115,22,0.08)`) and `accent-glow` (`rgba(249,115,22,0.15)`) tokens are smart — they're properly layered alpha values, not just lighter shades.
7. Marketing site has a real `<Button>`, `<Card>`, `<CodeBlock>`, `<SectionWrapper>`, `<TabSwitcher>`, `<ScrollReveal>` set. Six components, but they exist and are used. That's a real design system for the marketing surface.

---

## Token audit

### Colors

- **P0** [`apps/dashboard/tailwind.config.ts:7-23`] — Only 12 colors defined. There is no `success/warning/info/danger` semantic layer. `green`/`blue`/`purple`/`red` are pure raw hue names. The moment you want a green-tinted background you have to write `bg-green-500/10` (Tailwind default green-500 = `#22c55e`, which by coincidence matches your `green: '#22C55E'` — but the alpha-variant utilities only work on Tailwind's palette, not your custom token).
- **P0** [`apps/dashboard/src/components/onboarding-checklist.tsx:200,208`; `apps/dashboard/src/app/admin/admin-client.tsx:100-104`; `apps/dashboard/src/app/generations/[id]/page.tsx:71`] — The codebase has **two parallel green systems**: custom `bg-green` (solid `#22C55E`) and Tailwind defaults `bg-green-500/20`, `text-green-400`, `bg-green-500/60`. They're nearly the same hue but not identical; on adjacent UI they will visibly clash.
- **P0** [`apps/dashboard/src/app/generations/page.tsx:79`; `apps/dashboard/src/app/generations/[id]/page.tsx:71`; `apps/dashboard/src/app/admin/generations/generations-client.tsx:104-107`] — Yellow is used to mean "queued/processing" but there is **no yellow token** in the Tailwind config. Yellow is the only status color without a token. So `bg-yellow-500`, `bg-yellow-500/10`, `text-yellow-500`, `text-yellow-400` all coexist — that's two different yellows on the status row.
- **P1** [`apps/dashboard/src/components/sidebar.tsx:132`; `apps/dashboard/src/components/onboarding-checklist.tsx:179`; `apps/dashboard/src/app/analytics/page.tsx:96,126`] — `from-accent to-yellow-400` is used four times as a "progress" gradient. `yellow-400` is the Tailwind default `#FACC15`, not in your token system. Progress bars and analytics charts share a gradient that lives nowhere in the design system.
- **P1** [`apps/dashboard/src/app/error.tsx:131`] — Error page uses `from-orange-500 to-orange-600` (Tailwind defaults) instead of `from-accent to-orange-600` (which is what every *other* primary button uses). The orange-500 (`#F97316`) happens to equal `accent` exactly — but a maintainer changing the accent token would not change this one.
- **P1** [`apps/dashboard/src/app/analytics/page.tsx:70-72`] — Chart legend colors are raw hex literals `#f97316` / `#3b82f6` / `#8b5cf6` inline in JSX. `#8b5cf6` is violet-500, not any token. Three of your charts have legend colors that don't reference Tailwind at all.
- **P1** [`apps/dashboard/src/app/playground/page.tsx:168,177,213`] — Playground page hardcodes `border-[#333]`, `bg-[#1a1a1d]`, `bg-[#525659]` (PDF viewer chrome). None of these are tokens. `#1a1a1d` is roughly between `surface` (`#111113`) and `surface-hover` (`#18181B`) — a new ad-hoc surface tier. `#525659` is presumably the macOS Preview gray; doesn't matter that it's hardcoded but no comment explains why.
- **P1** [`apps/dashboard/src/app/layout.tsx:42-43`] — Clerk override uses `backgroundColor: '#1a1a1d'` and `borderColor: '#333'` — neither value exists elsewhere in the system. The Clerk popover renders on a surface that is a fourth distinct color.
- **P1** [`apps/dashboard/src/app/sign-in/[[...sign-in]]/page.tsx:10`; `apps/dashboard/src/app/sign-up/[[...sign-up]]/page.tsx:10`] — Sign-in/sign-up pages use `bg-[#111113] border border-white/10`. `white/10` ≈ `rgba(255,255,255,0.1)` ≈ `#1A1A1A` — that's a different border than `border-subtle` (`#1E1E21`) or `border` (`#27272A`). Three border styles within 10 lines of code, none matching.
- **P1** [`apps/dashboard/src/components/api-key-display.tsx:26`; `apps/dashboard/src/app/keys/keys-client.tsx:134,162`; `apps/dashboard/src/app/templates/[id]/editor.tsx:205`; `apps/dashboard/src/app/templates/editor/visual-editor.tsx:497,500,815`; `apps/dashboard/src/app/playground/page.tsx:203`; `apps/dashboard/src/components/onboarding-checklist.tsx:279,290`] — `bg-[#0D0D0F]` appears 10+ times as "the input/code-block background." It's a real, repeated design value — but it has no name. It sits between `bg` (`#0A0A0B`) and `surface` (`#111113`). Add it as `surface-deep` or `surface-input` and replace every literal.
- **P2** [`apps/dashboard/src/app/globals.css:6-8`] — `body { background: #0A0A0B; color: #FAFAFA; }` is a parallel source of truth for the body color. If you ever change `bg` in Tailwind, body won't follow. Use `@layer base { body { @apply bg-bg text-text-primary; } }` instead.
- **P2** [`apps/dashboard/src/app/globals.css:17`] — Scrollbar thumb is `#333` — doesn't match `border` (`#27272A`) or `border-subtle` (`#1E1E21`). It's a third gray.

### Typography

- **P0** — There is **no type scale token**. Headings are `text-[22px]` (page titles, 7 occurrences), `text-[28px]` (hero, 2 occurrences), `text-[15px]` (card headers), `text-[16px]` (playground), `text-[13px]` (most body), `text-[11px]` (chips), `text-[10px]` (micro labels). All as arbitrary `text-[Npx]` square-bracket values. **Tailwind's `text-xs/sm/base/lg/xl/2xl/3xl/4xl` is never used in the dashboard** for headings — only inside SignIn page and the marketing site.
- **P0** — DM Sans is loaded twice via `next/font/google` — once in `apps/dashboard/src/app/layout.tsx` and once in `apps/web/src/app/layout.tsx`. No shared font config, no preconnect strategy.
- **P0** — Dashboard `tailwind.config.ts` uses `fontFamily.sans: ['DM Sans', ...]` (raw font name string), but `apps/dashboard/src/app/layout.tsx` loads DM Sans with a CSS variable `--font-dm-sans`. The Tailwind config does **not reference the variable**, so `font-sans` resolves to the literal string `"DM Sans"` which the browser uses only if `next/font` happens to ship that family with that exact CSS name. Web app's config (`apps/web/tailwind.config.ts:25`) correctly uses `var(--font-dm-sans)`. Dashboard is broken by drift.
- **P1** — Headings have no consistent tracking/leading tokens. Hero h1 uses `tracking-tight leading-[1.1]`, page h1s use `tracking-tight` (no leading override → 1.5 from body), card h2s use no tracking. Picking `tracking-tight` for h1 but not h2 is a design choice; doing it inconsistently across pages is not.
- **P1** — Stat card values use `text-[28px] font-bold tracking-tight` (`stat-card.tsx:12`), but the local `StatCard` redefined inside `analytics/page.tsx:206` uses `text-xl font-bold` with no tracking. Same component, two visuals, in two files that should be one.
- **P1** — Page H1s are inconsistent: most pages use `text-[22px]` (Overview, Generations, Templates, Settings, Analytics, Keys, Admin) but `marketplace/page.tsx:69` uses `text-2xl` (24px, Tailwind default). Two pixels off, on the largest text on the page, every time.
- **P2** — Mono font usage is fine where it appears (`gen_*` IDs, `df_live_...` keys, code blocks). But the playground textarea (`apps/dashboard/src/app/playground/page.tsx:203`) sets `font-mono text-[13px]` and the template editor textarea (`apps/dashboard/src/app/templates/[id]/editor.tsx:205`) sets `font-mono text-sm` (14px). Different mono sizes in two HTML editors that should feel identical.
- **P3** — No `line-clamp` plugin (`@tailwindcss/line-clamp`) is enabled in either Tailwind config, yet `line-clamp-2` and `line-clamp-3` are used in `starter-template-picker.tsx`, `gallery-client.tsx`, `blog-preview.tsx`, `blog/page.tsx`. As of Tailwind 3.3 these utilities are core, but it's worth ensuring the Tailwind version in `package.json` is ≥3.3 — otherwise these are silently no-ops.

### Spacing

- **P1** — Card padding is `p-4` (analytics local StatCard), `p-5` (shared StatCard, generation table, api-key-display, settings danger zone, templates list, gallery cards), `p-6` (usage chart, settings sections, analytics sections, generation detail card metadata), `p-8` (marketplace, hero/CTA backgrounds), `p-12` (templates empty state), `p-16` (visual editor empty state). Six padding values for "this is a card" — pick three: dense, comfortable, prominent.
- **P1** — Page padding is `p-6` everywhere (good) **except** `marketplace/page.tsx:65` which uses `p-8`. The marketplace is the only page that breathes differently.
- **P1** — Section bottom margins: `mb-6` on dashboard pages, `mb-8` in admin-client, `mb-4` in some flows, no `mb-*` between sections in the marketplace card grid. Vertical rhythm is per-page, not per-system.
- **P1** [`apps/dashboard/src/components/stat-card.tsx:9`] — Stat card uses `flex-1 min-w-[140px]` for responsive sizing, but the admin overview (`admin-client.tsx:149`) puts the same StatCard inside `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`. Two layout strategies, two different responsive behaviors, same component.
- **P2** — Sidebar uses `gap-2.5` on nav items but `gap-3` (templates list), `gap-4` (overview stat row), `gap-6` (analytics), `gap-8` (sidebar nav between groups). No `xs/sm/md/lg` gap token; every author picks a `gap-[N]` by feel.
- **P2** — Inputs use `px-3 py-2` (most), `px-4 py-2` (api-key-display container), `px-4 py-2.5` (search), `px-3 py-2.5` (button-styled selects), `py-1.5 px-3` (toolbar buttons). Five button/input heights.
- **P2** — Empty states have wildly different vertical breath: `p-12` in templates empty state, `py-8` in keys empty state, `py-12` in marketplace empty state, `p-16` in visual editor canvas. No consistent "empty state" component.

### Radius

- **P0** — `rounded-[14px]` is the de facto card radius. It appears **35+ times** as a magic number across the dashboard. Tailwind defaults are `rounded-xl` (12px) or `rounded-2xl` (16px). Pick one and rename, or add `card: '14px'` to `borderRadius` in the Tailwind config. As written, every developer must know to type `rounded-[14px]` and not `rounded-xl`.
- **P1** — Modals use `rounded-2xl` (16px, `keys-client.tsx:119`, `gallery-client.tsx:162`, visual-editor empty state). Cards use `rounded-[14px]`. Two pixel difference, no rationale documented.
- **P1** — Buttons use `rounded-lg` (8px), pills use `rounded-full`, badges use `rounded` (4px) or `rounded-md` (6px), tags use `rounded-full` — and `keys-client.tsx:140` uses `rounded-md` for the copy button while `generations/[id]/page.tsx:154` uses `rounded-lg` for an equivalent button. There is no system: `rounded-md` and `rounded-lg` are picked by gut feel.
- **P1** — Sidebar logo uses `rounded-md` (`sidebar.tsx:49`), starter-template-picker icon uses `rounded-md` (`starter-template-picker.tsx:57`), but onboarding-checklist step icons use `rounded-full` (`onboarding-checklist.tsx:206`). Three different geometric languages for "icon container."
- **P2** — Chart bars use `rounded-t` and `rounded-t-sm` interchangeably (compare `usage-chart.tsx:41` `rounded-t` vs `analytics/page.tsx:96` `rounded-t-sm`). Same visual element, two radius choices, same author probably.
- **P2** — Code-block window dots (`code-block.tsx:10-12`) use `rounded-full` `w-2.5 h-2.5` — but the macOS traffic-light metaphor only works at 12px. At 10px it just reads as colored dots.

### Shadows

- **P0** — There is no shadow scale. Only three uses of shadow in the entire codebase:
  - `shadow-[0_0_30px_rgba(249,115,22,0.15)]` — primary CTA glow (hardcoded twice in `apps/dashboard/src/app/page.tsx:60,86`, and once via the marketing `Button` component).
  - `shadow-[0_0_40px_rgba(249,115,22,0.25)]` — first-run "Generate your first PDF" button, hardcoded once.
  - `shadow-xl` (Tailwind default) — modal cards, used twice.
- **P0** — Dark-theme cards have NO shadow. They rely entirely on the 1px `border-border` to define edges. That's a legitimate design choice, but the moment a card overlays another card (modal-on-page, dropdown-on-card) there's no elevation. Modals use `shadow-xl` which is `0 20px 25px -5px rgba(0,0,0,0.1)` — that's a *light theme* shadow. On `#0A0A0B` it's almost invisible.
- **P1** — Visual editor uses `ring-2 ring-blue shadow-lg shadow-blue/10` (`visual-editor.tsx:424`) for selected elements. `shadow-blue/10` ≈ `rgba(59,130,246,0.1)` — that's the only blue shadow in the codebase. Selected state has unique elevation language not shared with anything else.

### Icons

- **P0** — No icon size token. Inline sizes scattered: `size={10}`, `11`, `12`, `13`, `14`, `16`, `18`, `20`, `24`. Tailwind has `[&_svg]:size-4` patterns; you have none. Recommended scale: `xs=12 / sm=14 / md=16 / lg=20 / xl=24` as constants in `lib/icons.ts`.
- **P1** — Icon opacity: sidebar nav uses `opacity-70` on icons (`sidebar.tsx:76,113`), no other component does. Some icons get `text-text-dim`, some `text-text-muted`, some inherit color. The visual language of "this icon is decorative" vs "this icon is interactive" is not codified.
- **P1** — Stat cards have **no icon** despite icons being a defining feature of comparable dashboards (Stripe, Linear, Vercel). The 4-card row on Overview is just text — no visual anchor.
- **P2** — `starter-template-picker.tsx:13-19` uses category icons as **font-mono characters**: `'$'`, `'#'`, `'§'`, `'~'`. The gallery (`gallery-client.tsx:17-22`) uses actual Lucide icons (`Receipt`, `BarChart3`, `Award`, `FileText`) for the same category concept. Two visual treatments for category, on adjacent pages that link to each other.
- **P3** — `apps/dashboard/src/app/templates/page.tsx:35` and `apps/dashboard/src/app/templates/editor/visual-editor.tsx:1120` use HTML entities (`&#9634;` "▢", `+`) as empty-state visuals. Inconsistent with the Lucide-only rule. Worse, `error.tsx:53-78` uses **emoji HTML entities** (`&#9888;`, `&#128274;`, `&#128269;`) rendered via `dangerouslySetInnerHTML`. The error page has emoji; the rest of the product has line icons. Different visual register.

---

## Component-level findings

### Buttons

- **P0** — No `<Button>` component in the dashboard. Sixteen+ occurrences of `bg-gradient-to-br from-accent to-orange-600 text-white ... font-semibold` are copy-pasted across 12 files. Each instance has subtly different padding (`px-3 py-1.5`, `px-4 py-2`, `px-4 py-2.5`, `px-5 py-2.5`), font weight (`font-semibold` vs `font-bold` on the first-run CTA), and shadow (some have it, most don't).
- **P0** — Dashboard does not consume `@docuforge/web`'s `Button` (`apps/web/src/components/ui/button.tsx`). They live in separate `apps/*` packages with no shared `packages/ui`. Move it to `packages/ui` (doesn't exist) and consume from both.
- **P1** — Secondary button styles are also ad hoc. Compare:
  - `apps/dashboard/src/app/page.tsx:91`: `border border-border-subtle text-text-primary text-sm font-semibold hover:border-accent/50`
  - `apps/dashboard/src/app/templates/[id]/editor.tsx:144`: `p-1.5 rounded-lg border border-border hover:bg-surface-hover`
  - `apps/dashboard/src/app/generations/[id]/page.tsx:162`: `border border-border text-text-primary text-sm font-medium hover:bg-surface-hover`
  - `apps/dashboard/src/app/keys/keys-client.tsx:147`: `border border-border text-sm font-medium text-text-primary hover:bg-surface-hover`
  - Three different border tokens (`border-subtle` vs `border`), three different font weights, three different hover styles, all "secondary" buttons.
- **P1** — Toolbar buttons in template editor use `border border-border text-text-muted hover:text-text-primary`, but the gradient render button uses `bg-gradient-to-br from-accent to-orange-600 text-white`. The "primary action" inside the toolbar (Render) and the "primary action" on a page (Save) are visually the same weight. Hierarchy collapses.
- **P1** — Filter "chip" buttons (`apps/dashboard/src/app/generations/page.tsx:42-52`, `apps/dashboard/src/components/usage-chart.tsx:26-34`, `apps/dashboard/src/app/templates/[id]/editor.tsx:160-176`) all use the same active/inactive pattern but redefine it inline three times. This is a `ToggleChip` component.
- **P1** — Destructive buttons: `settings/page.tsx:70` uses `border border-red/30 text-red text-sm font-medium hover:bg-red/10`; `keys-client.tsx:233` uses just `text-text-dim hover:text-red transition-colors` (icon-only). Two destructive styles, one with a border, one without.
- **P2** — Marketing `Button` (`apps/web/src/components/ui/button.tsx`) has three variants (`primary`/`secondary`/`ghost`) and three sizes. Dashboard has, effectively, eight ad-hoc variants. The marketing one is the right model.
- **P2** — Disabled state is `disabled:opacity-50` everywhere — including on top of an already orange-on-dark gradient where it ends up looking peach. No `disabled` token, no contrast check.

### Inputs / Forms

- **P0** — No `<Input>`, `<Select>`, or `<Textarea>` component. Every input is:
  ```
  bg-[#0D0D0F] border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50
  ```
  (visual-editor) — or some near-variant (admin search uses `bg-surface` not `#0D0D0F`; playground select uses `bg-[#1a1a1d]` with `border-[#333]`).
- **P1** — Three input background colors coexist: `bg-[#0D0D0F]` (visual editor, keys modal, template editor), `bg-surface` (admin search, marketplace search, admin filters), `bg-[#1a1a1d]` (playground select). Same form element, three surfaces.
- **P1** — Focus state inconsistency: `focus:border-accent/50` (`keys-client.tsx:162`, `visual-editor.tsx`), `focus:border-accent` (`users-client.tsx:112`, `generations-client.tsx:55`), `focus:outline-none` only (some). No `focus-visible` anywhere. **Keyboard users on dark mode have no reliable focus indicator** — that's an accessibility hole but also a polish hole; tab through the dashboard and watch focus disappear.
- **P1** — Native `<select>` arrows are not customized. On dark backgrounds Chrome's native arrow is a dim gray triangle that disappears. `appearance-none` is set only in one place (`visual-editor.tsx:500`) — and even there no custom chevron is drawn, so the select looks like an input that won't open.
- **P1** — Checkboxes use raw `<input type="checkbox" accent-accent>` (`visual-editor.tsx:867`). On dark mode default unchecked checkbox is gray-on-gray, nearly invisible.
- **P2** — Placeholders use `placeholder:text-text-dim` in three files, default browser placeholder elsewhere. Default browser placeholder on dark mode is barely-readable.
- **P2** — `keys-client.tsx:162` uses `bg-[#0D0D0F] border border-border-subtle`, but every other input in the same file (and every modal) uses `bg-[#0D0D0F] border border-border-subtle` too — accidentally consistent. The bug is that input border-radius for `keys-client.tsx:162` is `rounded-lg` but the textarea in visual-editor is also `rounded-lg`. So far so good. Then `gen` filter chip in `generations/page.tsx:42` is also `rounded-lg`. Then the input dropdown shadow is nowhere. Net: there is no system but the system accidentally works half the time.

### Cards

- **P0** — Marketing `<Card>` (`apps/web/src/components/ui/card.tsx`) exists and uses `bg-surface border border-border rounded-[14px]`. Dashboard does **not** import it. Dashboard inlines this exact triplet 35+ times. Move `<Card>` to `packages/ui` and consume.
- **P1** — `stat-card.tsx` is one of two competing StatCard implementations. `analytics/page.tsx:202-209` has a private `StatCard` with **smaller padding (`p-4` vs `p-5`)** and **smaller value text (`text-xl` vs `text-[28px]`)**. So your analytics dashboard's primary metrics look different from your overview dashboard's primary metrics.
- **P1** — Hover affordance is split: `templates/page.tsx:55` uses `hover:border-accent/30`, `gallery-client.tsx:123` uses `hover:border-accent/30`, `marketplace/page.tsx:102` uses `hover:border-accent/30`, but `generations` row uses `hover:bg-surface-hover/50`, and onboarding cards use `bg-green-500/5` for done state. No single "card-hover" behavior.
- **P1** — Card headers (`px-5 py-4 border-b border-border-subtle` in `generation-table.tsx:23`, `px-5 py-3 border-b border-border-subtle` in `keys-client.tsx:195`) differ in vertical padding by 4px. Same card pattern, different chrome.
- **P2** — First-run welcome card (`apps/dashboard/src/app/page.tsx:67-99`) uses `rounded-2xl` (16px) — different from every other card (14px) on the same screen. It's also the only card with `bg-gradient-to-br from-accent/10 via-surface to-surface` and a `blur-3xl` glow blob. It's the loudest UI element in the product and lives only on first run.

### Tables

- **P1** — Three table styles coexist:
  1. The "linked rows" pattern (generations/keys) — div grid layout with `border-b border-border-subtle` rows.
  2. The "real `<table>`" pattern (admin users, admin generations, admin user detail) — actual `<table>` with `border-b border-border-subtle` rows.
  3. The "borderless data list" (`comparison.tsx` on marketing) — `<table>` with alternating row backgrounds.
- **P1** — Column header treatment: divs use `text-xs font-medium text-text-dim`, real tables use `text-left ... text-text-muted font-medium`. Different text-tone class for the same semantic meaning.
- **P1** — Row hover: dashboard rows use `hover:bg-surface-hover/50` (50% alpha), admin tables use `hover:bg-surface-hover/30` (30% alpha). Same hover semantic, different intensity.
- **P1** — `apps/dashboard/src/app/keys/keys-client.tsx:195` uses a fixed grid (`grid-cols-[1fr_200px_120px_120px_60px]`); `apps/dashboard/src/app/generations/page.tsx:56` uses a different fixed grid (`grid-cols-[auto_1fr_100px_80px_80px_80px]`); admin uses real `<table>` with `min-w-[1100px]` overflow. Three layout languages for tabular data.

### Modals / Dialogs

- **P0** — No `<Modal>` / `<Dialog>` component. `keys-client.tsx:117-184` and `gallery-client.tsx:160-200` both implement modal scaffolding (`fixed inset-0 z-50 ... bg-black/60`) inline. They diverge:
  - Keys modal: `rounded-2xl w-full max-w-md p-6 shadow-xl`
  - Gallery modal: `rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl` and has a sticky header
- **P1** — No focus trap, no `Esc` to close (gallery has none, keys has none — closing requires clicking the X), no `aria-modal`, no return-focus on close. This is a complete a11y/UX miss and you can build it once.
- **P1** — Backdrop is `bg-black/60` in both modals. On a black page that's barely a backdrop. `bg-black/80` plus a `backdrop-blur-sm` is the dark-mode pattern.
- **P2** — Native `window.confirm()` for destructive actions (`keys-client.tsx:86`). Confirms look like Chrome 95, not DocuForge.

### Toasts / Notifications

- **P0** — There are no toasts. Every async state shows inline messages or uses `alert('An error occurred. Please try again.')` (`gallery-client.tsx:51`, `templates/[id]/editor.tsx:77`, `templates/[id]/editor.tsx:123`, `marketplace/page.tsx:36`). `alert()` is a native dialog, completely outside the design system.
- **P1** — Inline success state is `text-xs text-green Saved!` (`editor.tsx:157`), inline error is `text-xs text-red` (`editor.tsx:156`). No icon, no background — easy to miss.
- **P1** — `setSaveMessage` toast in `visual-editor.tsx:1067-1073` is an inline span next to the Save button. Three different "operation completed" UX patterns within the same product surface.

### Dashboard nav

- **P1** — Sidebar is `w-[220px]` (`sidebar.tsx:46`). Loading skeleton uses `w-[240px]` (`loading.tsx:5`). **20px layout shift on hydration on every page load.** Drop everything and fix this one.
- **P1** — Active nav item is `bg-surface-hover text-text-primary`. Inactive hover is `bg-surface-hover/50`. So if you hover an inactive item, the difference between active and hover is *50% alpha on the same color* — practically imperceptible. There's no left-edge accent line, no icon highlight, nothing to telegraph "this is where you are."
- **P1** — Sidebar logo is `rounded-md` 28×28 with a gradient D. It's the only place in the dashboard where the brand wordmark appears, and it appears as a fake favicon. Marketing site has an actual logo PNG; dashboard does not load it.
- **P2** — "Usage This Month" mini-progress is inside the sidebar (`sidebar.tsx:122-136`). It's a `from-accent to-yellow-400` gradient bar. There is no system for these mini-bars; the onboarding checklist also has one with the same gradient (`onboarding-checklist.tsx:178`); analytics page has a different one with the same gradient. Three implementations, one visual.
- **P2** — Docs nav item (`sidebar.tsx:82-89`) is hard-coded to `https://fred-7da601c6.mintlify.app` — a Mintlify preview URL with a developer's name in it, shipped to production users.

### Marketing UI components

- **P1** — Hero gradient text (`hero.tsx:46`): `bg-gradient-to-r from-accent to-orange-400`. Uses `orange-400` (`#FB923C`) which is brighter than the accent — fine. But this is the *only* place a gradient text treatment is used; nowhere else picks it up.
- **P1** — SocialProof "logos" are literally text spans with brand names at 40% opacity (`social-proof.tsx:22-32`). They're labeled "Trusted by developers building at" — these companies have not endorsed DocuForge. This is either dishonest, a placeholder that should be removed before launch, or a polish-blocker.
- **P1** — `sdk-grid.tsx:26-29` builds SDK avatars by *concatenating a hex color with `"20"`* as an alpha suffix (`backgroundColor: sdk.color + '20'`) and setting `color: sdk.color` on the same element. That's a clever-but-wrong way to do tinted backgrounds; the `+20` only works with 6-digit hex (and most of these are 6-digit so it works) but it produces an undesigned palette. Also, the avatar in the React SDK ("R") would render with `color: '#61DAFB'` — almost cyan — which clashes with the rest of the orange/text-primary product palette.
- **P2** — Marketing `<Card>` is `bg-surface border border-border rounded-[14px]` — same as dashboard. So the dashboard inlines the same triplet but doesn't import this `<Card>`. The component is duplicated implicitly.
- **P2** — `final-cta.tsx:8` background gradient is `bg-gradient-to-b from-transparent via-accent/5 to-transparent`. There's a similar but not identical pattern in `apps/dashboard/src/app/page.tsx:68`: `bg-accent/10 blur-3xl`. Two "accent glow background" patterns, never abstracted.

---

## Cross-app consistency findings (dashboard vs apps/web)

- **P0** — `tailwind.config.ts` files are not literally identical:
  - `apps/dashboard`: `fontFamily.sans: ['DM Sans', 'system-ui', 'sans-serif']` (string literal — broken given how the layout loads fonts)
  - `apps/web`: `fontFamily.sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif']` (correct)
  - `apps/web` adds `animation.marquee` + `keyframes.marquee`. Dashboard doesn't.
  - These are otherwise identical, which means somebody has been keeping them in sync manually. There's no single source of truth — a `packages/tailwind-config` would fix this in 30 minutes.
- **P0** — Marketing has `<Button>`, dashboard does not. Marketing has `<Card>`, dashboard does not. Marketing has `<CodeBlock>`, dashboard has hand-rolled code blocks in the onboarding checklist. **The marketing site is more design-systemed than the product.**
- **P0** — Marketing `<Button>` primary variant has `shadow-[0_0_30px_rgba(249,115,22,0.15)] hover:shadow-[0_0_40px_rgba(249,115,22,0.25)] transition-shadow`. Dashboard primary buttons either copy the shadow (`apps/dashboard/src/app/page.tsx:60`) or omit it (`apps/dashboard/src/app/templates/page.tsx:27`, `apps/dashboard/src/app/marketplace/page.tsx:117`, `apps/dashboard/src/app/playground/page.tsx:185`, etc.). The shadow makes the button feel alive on the marketing site; on most dashboard pages the same button is flat.
- **P1** — Marketing uses framer-motion for `ScrollReveal`, hero animations, tab underline animations. Dashboard has zero motion. The visual personality of the two surfaces is very different — marketing feels polished and modern; dashboard feels static and utility.
- **P1** — Marketing navbar (`navbar.tsx`) and dashboard sidebar are totally separate concepts (one's horizontal, one's vertical) — that's fine — but they share zero brand atoms. The wordmark in marketing is a real PNG; in the dashboard it's a CSS gradient div with the letter "D." These represent two different products.
- **P1** — Both apps have a `font-sans antialiased` body. Marketing's also has `<Navbar />` and `<Footer />` in the layout; dashboard's does not. So the dashboard pages render full-bleed with no chrome unless each page individually adds `<Sidebar>`. Easy to forget; the `playground/loading.tsx` and a few other loading states forget to add a sidebar placeholder, causing layout jumps.
- **P1** — Both apps' `globals.css` is **identical** to within `html { scroll-behavior: smooth }`. Move to a shared `@docuforge/styles` package.
- **P1** — Marketing site sets a real favicon set (`apps/web/public/favicon-16x16.png`, `32x32`, `apple-touch-icon.png`, `og-image.png`, `twitter-banner.png`). Dashboard has none. Users who pin the dashboard tab see the Vercel/Next.js default favicon.
- **P2** — Marketing page metadata is fully populated (`apps/web/src/app/layout.tsx:10-34`); dashboard metadata is two lines (`apps/dashboard/src/app/layout.tsx:9-12`). No OG image, no Twitter card, no description with a keyword, no metadataBase. Sharing a dashboard URL in Slack gets you a generic preview.

---

## Clerk appearance override

- **P1** [`apps/dashboard/src/app/layout.tsx:33-58`] — Override uses `colorBackground: '#111113'` (= `surface`, ✓), `colorPrimary: '#F97316'` (= `accent`, ✓), but `colorTextSecondary: '#A1A1AA'` — that's `zinc-400`, **not** any DocuForge token. (`text-muted` is `#71717A`, `text-dim` is `#52525B`.) Clerk's "secondary text" is a third gray.
- **P1** — `userButtonPopoverCard.backgroundColor: '#1a1a1d'` and `borderColor: '#333'` — both are values that don't exist anywhere else in the codebase. The Clerk popover floats on a fourth distinct surface.
- **P1** — Sign-in / sign-up cards use raw appearance prop overrides (`card: 'bg-[#111113] border border-white/10'`). The border uses `white/10`, not `border-subtle`. Three border tones converging on the same auth screen.
- **P2** — `userButtonPopoverFooter: { display: 'none' }` — you're hiding the "Secured by Clerk" badge. Fine, but if you want native feel, also override the avatar size, the dropdown radius, the menu-item hover state, the divider color. As-is, the Clerk dropdown opens and visibly looks like a Clerk widget grafted onto your product.

---

## Gradient usage

- **P1** — The accent gradient (`from-accent to-orange-600`) is used for **every single primary button** on both apps. That's not on-brand, that's a tic. Once everything important is the same neon-orange gradient, nothing reads as "the primary action." The "Generate PDF" button on the overview has the same visual weight as "Browse Starters" on the templates empty state has the same visual weight as "Open PDF" on the generation detail.
- **P1** — Three different gradient flavors of the same orange exist:
  - `from-accent to-orange-600` (most buttons, 16 places) — orange → darker orange
  - `from-orange-500 to-orange-600` (error page, 1 place) — orange → darker orange (with `accent` swapped for `orange-500`)
  - `from-accent to-orange-400` (hero gradient text, 1 place) — orange → lighter orange
  - `from-accent to-yellow-400` (progress bars, 4 places) — orange → yellow
- **P2** — The "lightning emoji" call-out from the inventory is real: `apps/dashboard/src/app/page.tsx:62` literally renders `<span>&#9889;</span>` (a unicode lightning bolt) inside the Generate PDF button. Mixing emoji glyphs into otherwise-Lucide UI is jarring. It also doesn't theme — the emoji is whatever color Apple/Microsoft shipped.

---

## Logo / wordmark

- **P0** — No SVG logo exists. `apps/web/public/logo.png` and `logo-light.png` are PNGs. Hi-DPI screens render fuzzy; you can't recolor for hover/focus; can't animate.
- **P0** — Dashboard has no logo file at all. Logo in the sidebar (`sidebar.tsx:48-54`) is a 28×28 CSS gradient div with the literal letter "D" inside. No `<Image>`, no real wordmark.
- **P1** — Logo PNG dimensions vary across uses: navbar uses `width={160} height={40}` and renders it as `className="h-8 w-auto"`; footer uses `width={140} height={35}` and renders as `h-7 w-auto`. Two crops, two sizes — and `next/image` wants a real intrinsic size to optimize. The PNG also has built-in padding which means the logo is never optically the size it should be in either context.
- **P1** — No dark/light variant logic. There's a `logo-light.png` in the web public dir but nothing imports it. Marketing site is dark-only; if you ever add a light mode this breaks.
- **P1** — Favicon set is web-only. Dashboard ships no favicon, no apple-touch-icon, no manifest, no PWA bits.

---

## Component library (`packages/react`)

- **P1** — Default styles are functional but visually dated. `Header.tsx` uses `borderBottom: '2px solid #e5e7eb'` (light gray, 2px) — that's a 2010-era invoice template look. `Footer.tsx` uses `borderTop: '1px solid #e5e7eb'` with `color: '#6b7280'`. `Signature.tsx` uses `borderBottom: '1px solid #1a1a1a'`. Three different border colors and weights across three components that visually anchor a document.
- **P1** — Color palette is unbranded grays (`#1a1a1a`, `#6b7280`, `#e5e7eb`, `#d1d5db`, `#f9fafb`). None of these reference DocuForge's accent or text tokens. The component library produces PDFs that look generic — which is fine for a library — but the default-styled output should also be the marketing screenshot, and right now it's not visually distinctive.
- **P1** — No Storybook. No `__tests__`. No `.stories.tsx` files. There is no way to visually browse, document, or QA the React components other than building a PDF and looking at it. For a developer-facing library, this is a serious gap.
- **P1** — `Table.tsx` defaults: `fontSize: '12px'`, `padding: '8px 12px'`, header `backgroundColor: '#f9fafb'`. `Page.tsx` body `fontFamily` is `'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...'`. The PDF library does not opt into the marketing brand's fonts (DM Sans). Generated PDFs look "Apple"-ish, the marketing site looks "DM Sans"-ish. The brand splits at the artifact.
- **P1** — `Watermark.tsx` defaults to `opacity: 0.08` + `angle: -45` + `letterSpacing: 0.1em` + `textTransform: uppercase`. Strong defaults, but the watermark default `color: '#000000'` will be invisible on any dark or photographic page background. A safer default is `color: '#cccccc'` with `mix-blend-mode: multiply`.
- **P2** — `Barcode.tsx` renders the literal placeholder string `{{qr:value}}` inside a sized div — that's correct (the API replaces it server-side), but the dev who opens the React tree in a Storybook will see `{{qr:abc}}` and think it's broken. A `process.env.NODE_ENV === 'development'` fallback to a placeholder QR SVG would massively help library DX.
- **P2** — `Signature.tsx` has `marginTop: '40px'` baked in. That's a layout decision the consumer should own.
- **P2** — `PageNumber.tsx` is `<span>` with the placeholder text `{{pageNumber}} of {{totalPages}}`. In Storybook or a React tree, this renders as literal Handlebars. Same issue as Barcode.
- **P2** — Components are inconsistent on accessibility: `Document` has no `lang` attribute on `<html>` (compare `apps/web/src/app/layout.tsx:42` which does); `Footer.tsx` has `role="contentinfo"` (good); `Header.tsx` has `role="banner"` (good); `Watermark.tsx` has `aria-hidden="true"` (good); `Table.tsx` has full ARIA scaffolding (good); `Page.tsx` has `role="region"` with `aria-label="Page"` (correct). One inconsistency to address: `Document` should also accept and apply a `lang` prop.
- **P3** — `apps/dashboard/src/app/templates/[id]/editor.tsx:222` injects raw HTML for variable previews using `color:#f97316;background:#fff7ed;...` and `border:1px dashed #3b82f6;...`. These light-mode color schemes (`#fff7ed` is `orange-50`) clash horribly with the dark dashboard chrome around the preview pane. The preview iframe is white, so it sort of works, but the rendered preview *style choice* is light-mode while the editor is dark-mode. No unified design for the in-app preview.

---

## Cross-cutting themes

1. **Tokens exist; usage doesn't.** The Tailwind config defines 12 colors. Half the dashboard ignores them — `bg-[#0D0D0F]`, `border-[#333]`, `bg-[#1a1a1d]`, `from-orange-500 to-orange-600`, `text-green-400`, `bg-red-500/10`. Lint rule needed: forbid `bg-[#`, `text-[#`, `border-[#` in `apps/*/src` and force authors to either add a token or use one.
2. **Marketing has a design system; product does not.** `apps/web/src/components/ui/` is the design system that *should* live in `packages/ui` and be consumed by `apps/dashboard`. Cost of building it now < cost of refactoring 35 inlined card definitions later.
3. **Magic-number radius.** `rounded-[14px]` is the single most-typed string in the codebase after `bg-surface border border-border`. Either ship it as a token (`borderRadius.card: '14px'`) or stop using 14 — `rounded-2xl` (16px) would not be visibly different and is one token.
4. **No `Button` is the single biggest design-system gap.** Sixteen copy-pasted gradient strings, eight ad-hoc secondary styles, two destructive styles. Building `<Button variant="primary|secondary|ghost|destructive" size="sm|md|lg">` is a one-afternoon task that unlocks consistency across both apps forever.
5. **Status colors are split between two palettes.** `green` (token) and `green-500` (Tailwind default) are nearly the same hex but used in different places. Pick one — either drop the custom tokens and use only Tailwind defaults (`green-500`, `red-500`, `blue-500`, `purple-500`, `yellow-500`) which give you the `/10 /20 /60` alpha utilities for free; or extend the custom token to include explicit `green-bg / green-text / green-border` variants.
6. **Focus state on dark UI is functionally absent.** `focus:border-accent/50` on form inputs is the closest thing to a focus indicator, and it's per-input — buttons, links, table rows have no focus style at all. Add a global `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg` and inherit it from a `Button`/`Input`/`Link` component.
7. **Loading states are not part of the design system.** Skeletons exist (`generations/loading.tsx`, `analytics/loading.tsx`, etc.) and are decent, but the sidebar-width mismatch shows nobody is checking these as a single suite. Hook a Playwright visual test to every `/loading` route.
8. **Dashboard is not branded.** No favicon, no apple-touch-icon, no PNG logo, no OG image, no meta description. From a "does this feel like a product" standpoint, the dashboard could be any internal admin tool. Marketing did the polish work; product did not.
9. **PDF artifacts ≠ web brand.** The `packages/react` components produce light-gray-on-white invoices using `-apple-system` fonts. The marketing site advertises pixel-perfect PDFs using DM Sans. The thing the customer actually pays for (the generated PDF) does not feel like the product they signed up for. Ship a `@docuforge/react/presets` with `Modern` / `Classic` / `Brand` style packs that map DocuForge's design language into PDF output. That's also a strong marketing artifact (the screenshot on the homepage).
10. **The product needs ~6 components to leap forward.** A `packages/ui` containing `Button`, `Input`, `Select`, `Card`, `Modal`, `Toast`, plus a shared `Sidebar` for the dashboard and a shared `tailwind-preset`, would eliminate ~80% of the inconsistencies above and reduce the dashboard codebase by ~600 lines.
