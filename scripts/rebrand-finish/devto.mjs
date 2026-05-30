#!/usr/bin/env node
/**
 * Dev.to rebrand auto-runner.
 *
 * Fetches every published article on the authenticated Dev.to account,
 * applies the same DocuForge → Deckle replacements documented in
 * deckle_rebrand/devto-rewrite.md (URLs, scoped npm names, key prefixes,
 * brand text — case variants), shows you a per-article diff summary, and
 * (with --apply) updates the article via `PUT /api/articles/{id}`.
 *
 * Profile fields (bio, website, "currently hacking on") are NOT exposed by
 * Dev.to's public API. The script prints the exact copy to paste into
 * https://dev.to/settings once articles are done.
 *
 * Usage:
 *   node scripts/rebrand-finish/devto.mjs            # dry-run
 *   node scripts/rebrand-finish/devto.mjs --apply    # actually update
 *   node scripts/rebrand-finish/devto.mjs --apply --yes  # skip confirm
 */
import { loadEnv, requireEnv, httpJson, applyFlag, confirm, applyRebrand } from './_common.mjs';

const env = loadEnv();
const KEY = requireEnv(env, 'DEVTO_API_KEY', 'get one at https://dev.to/settings/extensions');
const APPLY = applyFlag(process.argv);

const DEVTO = 'https://dev.to/api';
const HDR = { 'api-key': KEY, 'user-agent': 'deckle-rebrand-finish/1.0' };

// /api/articles/me returns the authenticated user's published articles. It
// paginates with ?page=N&per_page=30; we only have ~10, so one page is fine.
async function fetchMine() {
  const list = await httpJson('GET', `${DEVTO}/articles/me/published?per_page=100`, {
    headers: HDR,
    label: 'list articles',
  });
  if (!Array.isArray(list)) throw new Error(`Unexpected /articles/me response: ${JSON.stringify(list).slice(0, 200)}`);
  return list;
}

async function fetchOne(id) {
  return httpJson('GET', `${DEVTO}/articles/${id}`, { headers: HDR, label: `article ${id}` });
}

async function updateOne(id, title, bodyMarkdown) {
  return httpJson('PUT', `${DEVTO}/articles/${id}`, {
    headers: HDR,
    body: { article: { title, body_markdown: bodyMarkdown } },
    label: `update ${id}`,
  });
}

function countHits(s) {
  return (s.match(/docuforge|df_live_|df_test_/gi) || []).length;
}

console.log(`Dev.to rebrand auto-runner — ${APPLY ? 'APPLY MODE' : 'dry-run (no writes)'}`);
console.log('Fetching article list…');
const list = await fetchMine();
console.log(`Found ${list.length} published articles.\n`);

// Plan first — fetch full body for each, compute diff, never mutate.
const plan = [];
for (let i = 0; i < list.length; i++) {
  const stub = list[i];
  const a = await fetchOne(stub.id);
  const beforeHits = countHits(a.body_markdown || '') + countHits(a.title || '');
  const { out: newBody, counts: bodyCounts } = applyRebrand(a.body_markdown || '');
  const { out: newTitle } = applyRebrand(a.title || '');
  const afterHits = countHits(newBody) + countHits(newTitle);
  const titleChanged = newTitle !== a.title;
  const bodyChanged = newBody !== a.body_markdown;
  plan.push({
    id: a.id,
    slug: a.slug,
    oldTitle: a.title,
    newTitle,
    titleChanged,
    bodyChanged,
    beforeHits,
    afterHits,
    bodyCounts,
    body: newBody,
  });
  const ruleSummary = Object.keys(bodyCounts).length
    ? Object.entries(bodyCounts).map(([k, v]) => `${k}×${v}`).join(', ')
    : '(no body changes)';
  console.log(
    `  ${String(i + 1).padStart(2)}. ${beforeHits.toString().padStart(3)} → ${String(afterHits).padStart(3)} | ${a.id} | ${a.slug}`,
  );
  if (titleChanged) console.log(`        title: "${a.title}" → "${newTitle}"`);
  console.log(`        body: ${ruleSummary}`);
}

const totalBefore = plan.reduce((s, p) => s + p.beforeHits, 0);
const totalAfter = plan.reduce((s, p) => s + p.afterHits, 0);
const toUpdate = plan.filter((p) => p.titleChanged || p.bodyChanged);

console.log(`\nTotals: ${totalBefore} DocuForge-shaped tokens → ${totalAfter} after rewrite`);
console.log(`Articles that need updates: ${toUpdate.length} of ${plan.length}\n`);

if (!APPLY) {
  console.log('Dry run complete. Re-run with --apply to push the updates.\n');
  printProfileCopy();
  process.exit(0);
}

if (toUpdate.length === 0) {
  console.log('Nothing to update.');
  printProfileCopy();
  process.exit(0);
}

const ok = await confirm(`Update ${toUpdate.length} articles via PUT /api/articles/{id}?`, process.argv);
if (!ok) {
  console.log('Aborted.');
  process.exit(1);
}

let updated = 0;
for (const p of toUpdate) {
  console.log(`Updating ${p.id} (${p.slug})…`);
  await updateOne(p.id, p.newTitle, p.body);
  updated++;
  // Be polite to the Dev.to API even though writes are not as throttled.
  await new Promise((r) => setTimeout(r, 1500));
}
console.log(`\nUpdated ${updated}/${toUpdate.length}.`);

// Verify by refetching and recounting.
console.log('Verifying…');
let stillDirty = 0;
for (const p of toUpdate) {
  const a = await fetchOne(p.id);
  const hits = countHits(a.body_markdown || '') + countHits(a.title || '');
  if (hits > 0) {
    stillDirty++;
    console.log(`  ⚠ ${p.id} still has ${hits} DocuForge-shaped tokens`);
  }
  await new Promise((r) => setTimeout(r, 1500));
}
console.log(stillDirty === 0 ? '\n✓ All articles are brand-clean.' : `\n✗ ${stillDirty} article(s) still need attention.`);

printProfileCopy();

function printProfileCopy() {
  console.log(`
─────────────────────────────────────────────────────────────────────────
Dev.to profile copy (the API doesn't expose these — paste manually at
https://dev.to/settings):

  Profile / bio:
    Building Deckle — open-source React components + API for pixel-perfect PDFs.

  Website URL:
    https://getdeckle.dev

  "Currently hacking on" (on your profile page):
    Deckle — a PDF generation API for developers. Open-source React component
    library at @getdeckle/react-pdf. Trying to be the "Stripe for PDFs."
─────────────────────────────────────────────────────────────────────────`);
}
