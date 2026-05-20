# Dashboard UX/UI — Teardown

## TL;DR

The dashboard ships a credible "v1" — most pages have a loading skeleton, a basic empty state, and the visual identity is consistent. But once you start clicking, the cracks show: there is exactly **one** `error.tsx` (the root one), **zero** `not-found.tsx` files, **zero** toast/notification system (everything that goes wrong fires a `window.alert()`), and **zero** mobile responsiveness (no breakpoint utilities, no collapsible sidebar, tables overflow viewports at 375px). Destructive actions use native `window.confirm()` for irreversible operations. The Playground is a `<textarea>` with no syntax highlighting, no autocomplete, no error line numbers. The template editor saves silently with a 2-second "Saved!" string that disappears before slow eyes catch it. Admins can change a user's plan with a single dropdown click — no confirmation, no audit trail visible in the UI, no undo. The "Delete Account" button in Settings does literally nothing — no handler attached.

Bottom line: this is a functional skeleton dressed in nice tokens. The UX layer — feedback, recovery, persistence, deep linking, mobile — is missing. Estimated ~60 findings below.

## What's actually good

- **Onboarding is genuinely thoughtful.** `onboarding-checklist.tsx` is the best-considered component in the app: progress bar, deferred SDK step with localStorage persistence, inline curl copy, dismiss-and-stay-dismissed. Most teams ship something worse.
- **First-run state on `/` is excellent.** The big gradient hero with "Generate your first PDF in under 60 seconds" + autorun template link is a real CTA, not a placeholder. `apps/dashboard/src/app/page.tsx:66-99`.
- **Loading skeletons exist for the major pages.** `generations/loading.tsx`, `keys/loading.tsx`, `analytics/loading.tsx`, `marketplace/loading.tsx`, `playground/loading.tsx`, `templates/loading.tsx`, `settings/loading.tsx` all match their content layouts. That's better than 90% of dashboards.
- **Root `error.tsx` categorizes errors** into network / auth / not_found / generic and renders contextual actions. Smart design even if no subroute uses it.
- **Generation detail page is well-laid-out** — sticky iframe preview, metadata sidebar, separate error block for failures. `apps/dashboard/src/app/generations/[id]/page.tsx`.
- **Admin overview is information-dense and useful** — funnel, cohort heatmap, first-time error breakdown, stuck-users list with deep links. A real ops tool, not vanity charts.
- **Template editor has version history with restore.** Many dashboards skip this; it's here and it works.
- **Visual editor exists at all.** Drag-and-drop, properties panel, live preview, export-to-HTML — solid scaffold.

## Page-by-page findings

### `/` (Overview) — `apps/dashboard/src/app/page.tsx`

- **P1 — "Current Plan" stat card shows `$Free` for free users.** `page.tsx:131` does `$${planLabel === 'Free' ? '0' : planLabel}` — so a Pro user sees the literal string `$Pro` as a stat value. That's a bug printed as a feature. Should show plan name *or* monthly cost, not a `$`-prefixed plan label.
- **P1 — Avg Generation Time and Success Rate render as `—` when zero**, but PDFs Generated renders as `0`. Inconsistent: either commit to em-dashes for empty or to zeros. Mixing them looks broken.
- **P2 — First-run hero and Onboarding Checklist both render simultaneously.** `isFirstRun` is `!hasAnyGeneration` (line 33); the checklist also tracks `hasGeneration`. Two competing "do this first" affordances stack vertically. Pick one or fade the hero out once the checklist has been opened.
- **P2 — `StarterTemplatePicker` and `ApiKeyDisplay` only appear in first-run.** After the first PDF the starter shortcuts vanish forever. New project? Tough — go hunt them in `/templates/gallery`. Should persist as a collapsed section.
- **P2 — `ApiKeyDisplay` in first-run shows `'No API key yet'` literally as `keyPreview` (line 112)**. It still renders the copy button. Copying `No API key yet` to your clipboard is not useful; disable the button.
- **P3 — Sidebar `usageLimit` is the plan limit, but `usageCount` is `generationCount` (all-time count from `getOverviewStats`).** Combined with the "Usage This Month" label in `sidebar.tsx:123`, this is misleading. All-time count over monthly limit makes no sense.
- **P3 — "Generate PDF" CTA links to `/playground`** with no template prefilled. From the new-user hero the link is `/playground?template=invoice&autorun=1` — much better. Inconsistent.

### `/sign-in` and `/sign-up` — `apps/dashboard/src/app/sign-{in,up}/[[...sign-{in,up}]]/page.tsx`

- **P2 — No marketing copy, no "why DocuForge" pitch, no testimonial, no link back to the home page.** A bare-bones Clerk widget on a black background. For a signup page this is value left on the table.
- **P2 — Sign-in and sign-up are visually identical** other than the embedded widget. No way to glance and know which one you're on without reading the form. No page header, no "Don't have an account?" cross-link outside the Clerk component.
- **P3 — Hardcoded `#0A0A0B` / `#111113`** instead of design tokens (`bg-bg` / `bg-surface`). Will drift from the rest of the app if tokens change.

### `/generations` — `apps/dashboard/src/app/generations/page.tsx`

- **P0 — No deep-link state for filters except `?status=`.** Search is missing entirely. You cannot find a specific generation ID without scrolling. Cmd+F is the search box.
- **P1 — Empty state is one line of dim text in the middle of an otherwise-empty table** (line 65-67). No icon, no "Generate your first PDF →" CTA, no link to the playground. This is a dead end for new users who land here.
- **P1 — Status row uses three colors (green/red/yellow)** but the legend only has three filters (`All` / `Completed` / `Failed`). No filter for `queued` / `processing`. Yellow rows are unfilterable.
- **P1 — No bulk actions.** Can't select multiple, can't delete, can't re-download, can't re-run failed. Long lists become tedious fast.
- **P2 — Pagination is "Page X of N + Previous + Next"** but there's no jump-to-page, no per-page size selector, no total visible until you've loaded the page. `limit = 20` is hardcoded.
- **P2 — Failed rows don't surface the error inline**. You have to click in to see why. For an ops user scanning failures this is a wasted click per row. At minimum a hover/tooltip.
- **P2 — Row sort is implicit (by date desc presumably).** No column headers are clickable; no sort indicator anywhere.
- **P3 — "Type" column says `Template` or `HTML` only.** What if the source was `react`? The code never accounts for `inputType === 'react'`.

### `/generations/[id]` — `apps/dashboard/src/app/generations/[id]/page.tsx`

- **P1 — "PDF is still processing..."** for non-completed-non-failed states (line 199). No polling, no refresh, no "check again" button. Hit a queued generation and you are stranded on a static "processing..." string forever. Must hit F5.
- **P1 — `getGenerationById` returns null → `notFound()` → falls through to root error.tsx with no `not-found.tsx`**. Generic "Not Found" with no link back to `/generations`. Easy fix: add `app/generations/[id]/not-found.tsx`.
- **P2 — Iframe height calc is `100vh - 200px`** (line 189). On a 13" laptop with the sidebar, that's a tiny preview. No fullscreen toggle.
- **P2 — No way to retry a failed generation.** Failed rows show error text, no "Retry with same input" button, and the original input HTML/template isn't surfaced either. A user has no path forward from a failure other than going back to playground and re-pasting.
- **P2 — No copy-button on the generation ID** in the header (`gen.id` at line 62). It's monospace and inviting, but unclicky.
- **P2 — `<iframe src={pdfUrl}>` will hit cross-origin sandboxing on R2/S3 storage** with no fallback link in-band. The "Open in new tab" link helps but if the iframe silently fails to render, no error UI fires.
- **P3 — Status badge spelling is whatever the DB has** (e.g. `completed`, `failed`, lowercased). No human-friendly mapping.

### `/templates` — `apps/dashboard/src/app/templates/page.tsx`

- **P0 — No delete affordance.** Templates can be created (via gallery + visual editor + clone) but the `/templates` list shows no delete, no rename, no archive. The `/api/templates/[id]` route supports DELETE (verified in api routes) — the UI just doesn't expose it. Users will pile up junk templates with no way to clean up.
- **P1 — No search, no filter, no sort.** A user with 50 templates is in the same boat as a user with 5: flat unordered grid.
- **P1 — Cards show name + version + updated time only.** No preview thumbnail, no usage count, no "last rendered" stat. Hard to tell which one is which.
- **P1 — Empty state CTA "Browse Starters" is fine, but no link to "Create blank template" or visual editor.** `/templates/editor` (visual builder) is completely unmentioned. Two of the three creation paths are hidden from new users.
- **P2 — The "Render" button (top-right of each card)** at `templates/page.tsx:65-71` overlaps the name (`pr-16` is the only thing saving it). Long template names will collide.
- **P3 — No indication if a template is `isPublic` / published to marketplace.** Schema supports it; UI doesn't.

### `/templates/[id]` (Code Editor) — `apps/dashboard/src/app/templates/[id]/editor.tsx`

- **P0 — The "editor" is a plain `<textarea>`** (line 202-207). No syntax highlighting, no Handlebars autocomplete, no error squigglies, no line numbers, no Tab indentation, no bracket matching, no find/replace. Monaco is one import away. Compare to what they ship: literally nothing.
- **P0 — `loadVersions()` and `handleRestore()` use `alert()` on error** (lines 77, 123). Modal blocking alert dialogs in 2026.
- **P0 — `handleRestore()` does not actually update the editor's local `html` state** (line 109-127) — it calls `router.refresh()` but the client-side `html` state remains the old value. Restoring a version visually does nothing until a hard reload.
- **P1 — Save has no autosave, no Cmd+S shortcut, no "you have unsaved changes" guard.** Click "Back" → all work gone. The `hasChanges` boolean is computed but never used to block navigation.
- **P1 — "Saved!" indicator (line 157) shows for 2 seconds then disappears.** No persistent "Last saved 3s ago" stamp. If you blink you'll think nothing happened.
- **P1 — Restore has no confirmation.** Click "Restore" → the in-flight saved version gets overwritten. No "Are you sure?" modal, no diff view.
- **P1 — No diff view for versions.** You see `v3` `v2` `v1` in a list with timestamps. No way to compare what changed. Restoring is blind.
- **P1 — Preview pane sanitizes via DOMPurify** (line 219), good — but the regex for `{{variable}}` only handles 1-2 levels of nesting (`#each` inside `#if` will break). And `{{else}}`, `{{#unless}}`, partials, helpers — none of it is previewed.
- **P2 — No delete button anywhere in the editor.** Same as the list page — no way to remove a template.
- **P2 — `name` input is a borderless transparent text field** (line 148-152). No visual cue that it's editable. No save indicator on rename specifically.
- **P2 — History panel competes with preview for the same space.** Opening History closes preview (toggle logic at line 159). Pick a layout — three-pane or a modal.
- **P3 — `error` and `saved` state are mutually exclusive in the UI** but both compete with the same toolbar slot. Save fails → error briefly. Save succeeds → "Saved!" briefly. Both vanish.

### `/templates/editor` (Visual Builder) — `apps/dashboard/src/app/templates/editor/visual-editor.tsx`

- **P0 — Closing the tab or hitting browser back destroys everything.** No `beforeunload` guard, no autosave, no draft persistence. 30 minutes of drag-and-drop work, one accidental cmd+W away from gone.
- **P0 — No "delete this element" undo.** Click the `X` on an element → it's gone. No history stack. No Cmd+Z.
- **P0 — `handleSave` hardcodes `sample_data: {}` (line 971).** The visual editor can never produce a template with sample data, even though the schema supports it. Users who save via visual editor and then switch to code mode get an empty data field.
- **P1 — "Save as Template" is the only save action** — there's no way to edit an *existing* template visually. The visual editor is creation-only. The `/templates/[id]` page goes to the *code* editor. Visual and code are fully separate worlds; there's no parity.
- **P1 — No template-name validation.** Empty name → save → goes through. `templateName = 'Untitled Template'` default lives forever.
- **P1 — Drag-drop only inserts at the bottom**. Cannot reorder by dragging — only via the move-up/move-down buttons. The `<GripVertical>` icon (line 467) is misleading — looks draggable, isn't.
- **P1 — Element types are 8 hardcoded primitives.** No way to add custom HTML blocks, no Handlebars-block insertion, no `{{#each}}` loop primitive. So the visual editor can only build static documents, defeating the purpose of "templates."
- **P2 — Properties panel for tables uses a flat list of R1C1, R1C2... text inputs** (line 875-889). For a 5×5 table that's 25 stacked inputs. Should be an inline grid editor.
- **P2 — No keyboard shortcuts.** Pro tools have Delete/Backspace to remove selected, arrow keys to reorder, Cmd+D to duplicate. This has none.
- **P2 — No multi-select / group ops.**
- **P2 — Properties panel scrolls independently** with no indication. Long edits (table contents) collide with viewport on small laptops.
- **P3 — Image element only accepts URLs**. No upload, no drag-from-disk, no built-in placeholder gallery.
- **P3 — Spacer element has no visual handle to resize.** Type into a number input, watch it change. Should be drag-to-resize.

### `/templates/gallery` — `apps/dashboard/src/app/templates/gallery/gallery-client.tsx`

- **P1 — `handlePreview()` uses `alert()` on failure** (line 50). Same anti-pattern.
- **P1 — Preview modal doesn't show what variables the template expects.** `sample_data` is on the starter object but never displayed. User clones, then has to dig through the cloned template to learn what `{{customer.email}}` etc. means.
- **P1 — No "Use as starter for blank" option.** It's clone-as-template only. A user who wants a one-off PDF would need to clone → render → delete → which they can't delete.
- **P2 — No category filter.** Cards show category as a tag, but you can't filter by it. With 5 starters that's fine; at 50 it's broken.
- **P2 — No search.**
- **P3 — Preview is a sanitized HTML rendering of the Handlebars-laden source** — so users see colored "each: items" boxes, not what the actual PDF looks like. They have no idea what the rendered output is until they clone + render.

### `/playground` — `apps/dashboard/src/app/playground/page.tsx`

- **P0 — `<textarea>` for HTML editor (line 199-205).** Same as template editor — no Monaco, no syntax highlighting, no autocomplete. The single most-marketed page in the dashboard ("Generate your first PDF") is a notepad on the left and a viewer on the right. Compare to PDFShift, DocRaptor, anyone — all use real editors.
- **P0 — No save/share of playground state.** No URL persistence (the HTML lives in state). Refresh and you lose your work. No "Save as template" button anywhere in the toolbar.
- **P0 — No keyboard shortcut to generate.** Cmd+Enter is a universal expectation. Not wired up.
- **P1 — `templateName` shows as "Starter: foo" but there's no way to clear it or load a different one without manual URL editing.** No template picker dropdown in the toolbar.
- **P1 — Error display is a single-line red box** (line 215-217). API errors with stack traces, line numbers, or selector hints get truncated/cropped. No expand. No copy-error button.
- **P1 — `setPdfUrl(null)` is never called when `html` changes,** so the preview shows a stale PDF until you regenerate. There's no "stale" indicator.
- **P1 — Sidebar has `usageCount = 0` and `usageLimit = 1000` hardcoded defaults** (line 150). The sidebar shows a "0 of 1000" usage bar on this page regardless of actual usage. Real numbers exist server-side but aren't passed in (this page is `'use client'`).
- **P2 — Format/orientation selectors only.** No margins, header/footer, watermark, page numbers — all of which the API supports. Playground is a fraction of the API surface.
- **P2 — `handleGenerate` calls `/api/playground` which doesn't enforce daily limits in any visible way.** Hitting the API limit just shows "Generation failed" — no upsell, no "you've hit your free tier" message.
- **P2 — Generated PDF iframe has no zoom, no print, no toolbar.** Browser default chrome only.
- **P3 — `DEFAULT_HTML` ships with the dashboard. Lots of bytes in the client bundle for a sample.** Should be fetched on demand.

### `/keys` — `apps/dashboard/src/app/keys/keys-client.tsx`

- **P0 — Delete uses `window.confirm()` (line 86).** Native browser confirm for an irreversible "revoke API key" action. No type-the-name-to-confirm, no modal styled like the rest of the app, no list of dependent integrations.
- **P1 — No "rotate" action.** Common need — generate a new key, deprecate old one with a grace period. Schema doesn't even support it but UX should.
- **P1 — The "key shown once" modal has no "I've saved it" button distinct from "Done"** (line 145-150). One click = forever lost. No second-chance reveal, no email-the-key-to-me fallback.
- **P1 — Copy buttons on existing keys copy only the *prefix* (e.g. `df_live_abcd1234...`)** — line 27-31. That's never useful. Should be either disabled or relabeled "Copy prefix" because the misclick rate will be 100%.
- **P2 — "Last Used" column shows date only, not relative time.** A key last used "Today" reads as "May 20, 2026". Less scannable.
- **P2 — No usage-per-key stats.** You can't tell which key is your prod key vs your test key by looking.
- **P2 — No IP allowlist, no scopes, no expiration.** Out of scope for UX maybe but the form is too thin: just a name field.
- **P3 — Table is one wide flat row with no sort.** Sorting by Last Used is a common need.

### `/settings` — `apps/dashboard/src/app/settings/page.tsx`

- **P0 — "Delete Account" button has no `onClick` handler** (line 70-72). It's a `<button>` that does literally nothing. Not "TODO" — just no behavior. Server-rendered, no client component for delete. Either remove it or wire it up.
- **P0 — Billing actions use `alert()`** in 4 places (lines 24, 27, 45, 48). Stripe checkout failure shows a native browser alert.
- **P1 — Account section is read-only.** Can't change email, can't update name, can't add a billing email, can't change password (Clerk-managed but no link out to Clerk's profile UI either).
- **P1 — Plan section shows the *plan badge* with an upgrade button** but no usage-vs-limit. The sidebar shows it; settings doesn't. Inconsistent.
- **P2 — Plan upgrade buttons are two `<button>`s in `billing-actions.tsx`**. No comparison table, no "what changes if I upgrade?" copy.
- **P2 — Enterprise plan returns `null`** (line 87). User on enterprise sees zero subscription management UI. No "Contact your account manager" link.
- **P2 — Danger Zone is the only "Account" actions in the whole app.** No export-my-data, no notification preferences, no 2FA, no team members.

### `/analytics` — `apps/dashboard/src/app/analytics/page.tsx`

- **P0 — Fetches client-side via `useEffect`** (line 21-27) — bypasses the `loading.tsx` skeleton (which only fires for server-component navigations). Result: hard refresh shows the skeleton briefly, then the page renders with `loading=true` and a "Loading analytics..." string. Two competing loading states.
- **P0 — `catch(() => {})` (line 25)** — silent error swallowing. API fail → empty white page with no message.
- **P1 — No date range picker.** "Last 30 days" is hardcoded server-side. Most analytics pages let you pick.
- **P1 — Charts are bare-bones gradient bars with no axes, no gridlines, no values on hover beyond browser `title=` tooltips.** Compare to Recharts/visx — this looks placeholder-y.
- **P1 — "Avg Latency" stat reads "the LAST day's avg" (line 51-54)** which is nothing like "avg." Misleading.
- **P2 — No segmentation by template, by key, by status.** It's one global aggregate.
- **P2 — No export.** Common ask for analytics: download CSV.
- **P3 — Peak hours chart x-axis labels say `12am 6am 12pm 6pm 12am`** (line 162-167) — confusing repeat. Drop the right-side `12am` or label as `Next 12am`.

### `/marketplace` — `apps/dashboard/src/app/marketplace/page.tsx`

- **P0 — Two `alert()`s on fetch / clone failure** (lines 36, 52).
- **P0 — `handleClone` has no error path** other than the catch — if `res.ok` is false but the catch doesn't fire, the user sees nothing. The spinner clears but no error and no navigation.
- **P0 — `loading` is shown in the body, but there's also a `loading.tsx` skeleton.** Same anti-pattern as analytics: fetch is client-side useEffect so the skeleton fires once and is immediately replaced by an inline loading string. Pick a strategy.
- **P1 — No preview before cloning.** Marketplace cards show name, version, updated date — no thumbnail, no description, no HTML preview. Cloning is a leap of faith.
- **P1 — No author, no rating, no usage count, no category, no tags.** It's just a list of names. Cannot be called a "marketplace" by any other site's standards.
- **P1 — No "publish my template" action anywhere in `/templates`**. The API supports publish/unpublish — UI doesn't.
- **P2 — Search is client-side filtering only** (line 58-60). With server pagination this will appear broken when results exist on later pages.
- **P2 — Sidebar `usageCount=0 usageLimit=100` hardcoded** (line 64). Wrong numbers for every user.

### `/admin` (Overview) — `apps/dashboard/src/app/admin/admin-client.tsx`

- **P1 — Six parallel fetches with `Promise.all` and one shared `loading` state** (line 117-134). If any one request stalls, the whole page is "Loading admin stats...". One slow query and the entire admin view is blocked.
- **P1 — Error path is `<div className="text-red-400">Failed to load admin stats.</div>`** (line 141). If only the cohorts fetch fails, you don't see a partial render — you see the same error. No granularity.
- **P1 — Single timestamp on cohort heatmap.** Cohort heatmap (line 198-242) is useful but has no filtering, no comparison to previous period, no drill-down.
- **P2 — "Stuck users" table is the most actionable widget but only shows 25 with no pagination link** (line 123). To see more, you go to `/admin/users?stage=has_key_no_gen` — that's not stated anywhere in the UI.
- **P2 — API errors widget shows top 15 (errorCode, path) pairs** (line 323) — no filter by user, no jump-to-user, no time-range picker (hardcoded 168h).
- **P3 — Daily generations chart has no value labels** — title-attribute tooltip is the only way to see counts. Same as analytics.

### `/admin/users` — `apps/dashboard/src/app/admin/users/users-client.tsx`

- **P0 — Plan changes via the inline `<select>` have no confirmation** (line 195-204). One misclick downgrades a paying user. The PATCH fires immediately on change. No undo, no audit log in UI, no toast confirmation.
- **P0 — `updatePlan` has no error handling** (line 93-100). If the PATCH fails, the dropdown silently flips back (because `fetchUsers()` overwrites state) — but the user gets no feedback that the change failed.
- **P1 — No pagination.** `total` is computed but no `offset` UI. Large customer bases will exceed the default limit (whatever it is server-side).
- **P1 — No bulk actions** — can't change plan for 10 users at once, can't delete batch.
- **P1 — No export.** Admin needs to email finance "list of pro users" → no CSV button.
- **P1 — Search submits on form-submit only** (line 88-91). Typing in the input doesn't filter — you have to press Enter. The placeholder doesn't hint at this.
- **P2 — `1st error` column truncates to 200px with no expand affordance** (line 217-222). The most useful column is the most truncated. Should be a tooltip or click-to-expand.
- **P2 — No sort.** Sort by gens, by signup date, by churn — all common needs, none supported.
- **P2 — `key_count`, `generation_count`, `success_count` etc are numeric columns with no filtering thresholds** ("show users with 0 generations" is the most common need — only achievable via the `stage` dropdown, which is fine but undiscoverable as a filter idiom).

### `/admin/users/[id]` — `apps/dashboard/src/app/admin/users/[id]/user-detail-client.tsx`

- **P0 — Delete user uses `window.confirm()`** (line 138) for a cascade-delete-all-data action. No type-the-email-to-confirm, no warning about data loss, no list of what will be deleted.
- **P0 — `updatePlan` and `deleteUser` have no error path at all** (line 125-141) — `await fetch(...)` with no `.ok` check. Plan-change failures are silently lost.
- **P1 — No admin actions visible beyond plan + delete.** Cannot:
  - Reset password / send magic link
  - Impersonate (log in as user)
  - Reset usage quota
  - Revoke all keys
  - Restore deleted templates
  - View audit log
  - Add an internal note
  Admin can change a plan and delete an account. That's it. The page advertises "comprehensive admin tools" but it's a viewer.
- **P1 — No way to download the user's generations as CSV / NDJSON** for support investigation.
- **P1 — "Recent Generations" doesn't link to `/admin/generations` filtered to this user.** You see `g.id` as plain text — no link to the generation detail.
- **P2 — Tables for keys / templates / generations have no empty CTAs.** "No API keys" is fine; "No templates — this user has never used templates" with a stage label would be more useful for triage.
- **P2 — Failure rate / success rate not shown on stat cards.** Computed but not in the four StatCards at the top.

### `/admin/generations` — `apps/dashboard/src/app/admin/generations/generations-client.tsx`

- **P1 — `userIdFilter` is a free-text input for `usr_xxx` IDs** (line 64-69). No autocomplete from the user list, no email search. Admins have to copy-paste IDs from another tab.
- **P1 — No date range filter.** Can only filter by status + userId. "Show me yesterday's failures" requires squinting at the Created column.
- **P1 — No bulk actions** — re-run, delete, mark as reviewed.
- **P1 — No link to user from each generation row.** `g.user_email` is plain text. Clicking should jump to `/admin/users/{id}`.
- **P2 — No link to the generation detail page** — admin can't open a specific PDF preview.
- **P2 — Error column truncates at 250px** (line 116-118) like the users page — same fix needed.

## Component-level findings

### `sidebar.tsx`

- **P0 — Not responsive.** Fixed `w-[220px]` at line 46, `sticky top-0` (line 46). No mobile menu, no collapse, no hamburger. At 375px the sidebar consumes 60% of the viewport. Tested visually: this is unusable on mobile.
- **P1 — `pathname.startsWith(item.href)` (line 63) marks `/templates` active when on `/templates/gallery`, `/templates/editor`, and any `/templates/[id]`** — which is fine for `/templates` itself, but then `/templates/editor` (which has its own custom layout *without* the sidebar) doesn't apply, so this only affects routes that share the sidebar. Net: works but fragile.
- **P1 — `usageCount` is mis-fed everywhere.** Multiple pages pass `0` as a placeholder (marketplace, admin pages, playground). The "Usage This Month" widget lies on those pages. Pull from server-side context or hide when missing.
- **P1 — Hardcoded docs link to `https://fred-7da601c6.mintlify.app`** (line 82). That's a personal mintlify URL. Will 404 once the team's public docs ship.
- **P2 — Logo "D" mark links to nothing.** Should link to `/` (home). Currently it's a static div.
- **P2 — Admin section is appended at the bottom** (line 93-119) — divider plus "Admin" header is the right idea but it's after the usage widget visually, not before. Order is: nav → usage → admin → user. Should be: nav → admin → usage → user.
- **P3 — "Docs" item uses `<a>` not Next `<Link>`** — fine for external but should `noreferrer` + open icon to telegraph external nav.

### `onboarding-checklist.tsx`

- **P1 — "Mark as done" for SDK step writes to localStorage** (line 142) — clears on incognito / different device. Step persistence should be server-side.
- **P1 — Curl command interpolates `apiKeyPreview` if present**, otherwise `YOUR_API_KEY` (line 127). If the user copies the curl with `YOUR_API_KEY` and the key was actually created seconds ago, the placeholder string ends up in their shell. Not destructive, but confusing.
- **P2 — Once dismissed, no way to bring it back.** The localStorage key is the only off-switch. New employee on the same company account can't onboard themselves if their predecessor dismissed it.
- **P2 — Steps are linear** (`isFirstOpen` finds the first incomplete) but a user might want to install the SDK *before* creating an API key. No way to expand step 4 without clicking through.
- **P3 — Progress bar fills with the same orange→yellow gradient as the sidebar usage bar.** They're semantically different (progress vs consumption) but look identical.

### `api-key-display.tsx`

- **P1 — Component takes `keyPreview` (always shown) and optional `fullKey`** but the page always passes only `keyPreview`. So the copy button copies the masked prefix string (e.g. `df_live_abcd••••••••••••••••`). Same bug as `keys/keys-client.tsx` — never useful.
- **P2 — No "Regenerate" or "Manage keys" action.** The card is a static display. Should link to `/keys`.

### `generation-table.tsx`

- **P1 — Hardcoded column widths** (w-20, w-16, w-12) — clip on long IDs / counts. Not responsive at all.
- **P2 — Empty state text is "No generations yet. Generate your first PDF via the API."** No CTA. The /playground option isn't mentioned.
- **P2 — Status dot is two colors only** (completed=green, failed=red). No `queued` / `processing` state — those rows render as red.

### `starter-template-picker.tsx`

- **P2 — Fetches client-side every page load** even though the same starter list is fetched server-side on `/templates/gallery`. Two requests, two loading states.
- **P2 — Loading state is "Loading starter templates…" in a card** — better than a spinner but a 3-skeleton grid would match the rendered card layout.
- **P3 — Category icons are ASCII glyphs (`$`, `#`, `§`, `~`)** — clever but inconsistent with lucide icons used everywhere else.

### `usage-chart.tsx`

- **P0 — `7d` and `90d` period buttons are disabled and `cursor-not-allowed`** (line 27, 29). They render but don't work. Either hide them or wire them up — exposing dead controls in production is amateur hour.
- **P1 — No values on bars** — no axis labels, no hover tooltip, no min/max. Just gradient bars.
- **P2 — Last 3 bars get a brighter gradient** (line 46-47) — visual flourish that implies recency but doesn't explain itself. No legend.

### `stat-card.tsx`

- **P2 — Optional `trend` prop is defined but never passed anywhere** (line 4, 14). Dead code path. Either use it or remove it.
- **P3 — `min-w-[140px]` (line 9)** — at narrow viewports cards wrap; at the dashboard width they stretch ugly. No max-width.

## Cross-cutting themes

### 1. **No toast/notification system.** Pervasive.
- 4× `alert()` in `settings/billing-actions.tsx`
- 2× `alert()` in `marketplace/page.tsx`
- 2× `alert()` in `templates/[id]/editor.tsx`
- 1× `alert()` in `templates/gallery/gallery-client.tsx`
- 2× `confirm()` in `keys/keys-client.tsx` + `admin/users/[id]/user-detail-client.tsx`
- Inline error banners that disappear or persist with no consistent pattern.
- Success feedback is `setSaved(true); setTimeout(() => setSaved(false), 2000)` — copy-pasted across files.
**Fix:** ship a toast provider (sonner, react-hot-toast, or roll one). Replace every `alert`/`confirm`/inline-success with toasts.

### 2. **No `not-found.tsx` anywhere.** Verified via Glob.
- `templates/[id]/page.tsx:18` calls `notFound()` → root error.tsx generic page.
- `generations/[id]/page.tsx:41` same.
- `/admin/users/[id]` shows `<div>User not found.</div>` inline at line 118 — no nav.
**Fix:** add per-route `not-found.tsx` with contextual "Back to Templates / Generations / Users" CTAs.

### 3. **Only one `error.tsx` (root).** Per-route error boundaries are missing.
- The root one is well-designed but it never fires for client-component errors inside pages like analytics, marketplace, admin/users.
- Pages with `'use client'` + `useEffect` for data fetching swallow errors entirely (analytics line 25, admin-client.tsx line 133).
**Fix:** add `error.tsx` to admin/, analytics/, marketplace/, playground/ at minimum.

### 4. **No mobile responsiveness.**
- Zero usages of `md:hidden`, `sm:hidden`, `lg:hidden` (Grep returned no files).
- Sidebar is `w-[220px]` static + sticky.
- Tables use `min-w-[1100px]` in some places (admin users line 145), pushing horizontal scroll without a visual cue.
- Playground / template editor are split-pane at 50/50 with no stacking.
- Touch targets — `<Trash2 size={14} />` icon buttons are way under the 44px guideline.
**Fix:** sidebar collapse + slide-over for mobile, table horizontal scroll affordances, stack split-panes on small viewports.

### 5. **Stale/incorrect data passed to Sidebar from many pages.**
- `/playground`: `<Sidebar />` with no props → defaults to `0/1000`.
- `/marketplace`: `<Sidebar usageCount={0} usageLimit={100} />` — fabricated.
- `/admin/*`: `<Sidebar usageCount={0} usageLimit={limit} isAdmin />` — admin's own count never fetched.
- `/`: `usageCount={stats.generationCount}` — all-time count under a "This Month" label.
**Fix:** centralize sidebar data in a server-component layout OR pass via Context. Stop ad-hoc defaults.

### 6. **No URL/search-param state for filters across the app.**
- `/templates` — no `?search=`, no `?sort=`.
- `/marketplace` — search lives in state only.
- `/admin/users` — filters are state-only, no deep linking, no shareable URLs.
- `/admin/generations` — same.
**Fix:** push filters to `searchParams`, restore on navigation.

### 7. **No optimistic UI anywhere.**
- Delete a key → spinner → row disappears.
- Save a template → spinner → "Saved!".
- Change a plan → spinner → silent refresh.
- All actions hide the action button during the request. None show the new state immediately + rollback on failure.
**Fix:** at least optimistic delete + optimistic plan change.

### 8. **No "destructive action" confirmation pattern.**
- API key revoke: `window.confirm()`.
- User delete: `window.confirm()`.
- Template delete: doesn't exist.
- Account delete: button does nothing.
- Plan downgrade (admin): no confirmation at all.
- Restore template version: no confirmation.
**Fix:** type-to-confirm modal for irreversible actions (revoke key, delete user, delete account). Inline confirm-buttons-flip for medium-risk (restore version, downgrade plan).

### 9. **Inconsistent loading patterns.**
- Server-component pages: `loading.tsx` skeleton via Suspense.
- Client-component pages (analytics, marketplace, admin/*, admin/users/[id]): `useEffect` + `loading` state inline. Skeleton from `loading.tsx` fires briefly during navigation, then is replaced by client's loading string. Two competing loading UIs per page.
**Fix:** decide per-page — RSC + loading.tsx OR client-fetch + skeleton-component, not both.

### 10. **Many features hinted at but not wired up.**
- `usage-chart.tsx`: 7d / 90d buttons are visibly disabled with `cursor-not-allowed`.
- `settings/page.tsx`: Delete Account button has no handler.
- `stat-card.tsx`: `trend` prop unused.
- Visual editor `sample_data: {}` hardcoded.
- "Manage Subscription" for enterprise → renders nothing.
- Marketplace publish: no UI.
- Template delete: no UI.
**Fix:** ship them or remove them. Disabled-future-feature UI is worse than absent UI.

### 11. **No empty-state CTAs on terminal pages.**
- `/generations` empty: dim text only.
- `/keys` empty: "No API keys yet. Create one to start generating PDFs." — but the "Create Key" button is way up in the header.
- `/admin/users` empty (after filter): "No users found" — no "clear filters" button.
- `/marketplace` empty: explanatory but no link to publish.

### 12. **No back behavior consistency.**
- `/generations/[id]` has a back arrow.
- `/templates/[id]` (editor) has a back arrow.
- `/templates/gallery` has a back arrow.
- `/admin/users/[id]` has a "← Back to users" link (text, not button).
- `/templates/editor` (visual) has "Back to Templates" in the left sidebar.
- Other pages have nothing — rely on browser back.
**Fix:** standardize on either breadcrumbs or back-arrow + page title.

### 13. **No "what's new / changelog" anywhere.** Common dashboard pattern, completely absent.

### 14. **No skeletons for client-fetched data.** Analytics + marketplace + admin pages use plain "Loading..." strings instead of matching the layout. The `loading.tsx` skeletons that *do* match are wasted because the page above also renders a loading string.

### 15. **Toolbars are not sticky.**
- Template editor toolbar (line 140) scrolls off with the textarea.
- Playground toolbar scrolls off too.
- For long content edits the user has to scroll back up to hit Save.

### 16. **No keyboard shortcuts visible to users.**
- No `?` to open shortcut help.
- No Cmd+K command palette (table stakes for dev-tool dashboards now).
- No Cmd+S to save (editor, playground).
- No Cmd+Enter to run (playground).
