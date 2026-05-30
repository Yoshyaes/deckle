#!/usr/bin/env node
/**
 * Render env-var sweep for the Deckle API service.
 *
 * Reads existing env vars on the service, merges in the rebrand target
 * values (without dropping anything else), and PUTs the merged list back.
 * Render auto-redeploys on env-var change. Dry-run by default.
 *
 * Target env vars (from LAUNCH-REMAINING.md §2):
 *   DASHBOARD_URL    https://app.getdeckle.dev   (also the CORS origin)
 *   API_BASE_URL     https://api.getdeckle.dev
 *   EMAIL_FROM       Deckle <hello@getdeckle.dev>
 *   R2_BUCKET_NAME   (printed only; the script does NOT overwrite this
 *                    because the right value depends on your actual R2
 *                    bucket name — left to you to set manually if needed)
 *
 * Usage:
 *   node scripts/rebrand-finish/render.mjs            # dry-run
 *   node scripts/rebrand-finish/render.mjs --apply
 */
import { loadEnv, requireEnv, httpJson, applyFlag, confirm, diffTable } from './_common.mjs';

const env = loadEnv();
const KEY = requireEnv(env, 'RENDER_API_KEY', 'get one at https://dashboard.render.com/account/api-keys');
const SERVICE_NAME = env.RENDER_SERVICE_NAME || 'docuforge-api';
const APPLY = applyFlag(process.argv);

const RENDER = 'https://api.render.com/v1';
const HDR = { Authorization: `Bearer ${KEY}` };

const TARGETS = {
  DASHBOARD_URL: 'https://app.getdeckle.dev',
  API_BASE_URL: 'https://api.getdeckle.dev',
  EMAIL_FROM: 'Deckle <hello@getdeckle.dev>',
};

console.log(`Render env-var sweep — ${APPLY ? 'APPLY MODE' : 'dry-run (no writes)'}`);
console.log(`Looking up service "${SERVICE_NAME}"…`);

// Find the service by name. Render's /services endpoint paginates with
// cursor; for a single-account user with < 100 services we can grab the
// first page.
const services = await httpJson('GET', `${RENDER}/services?limit=100`, { headers: HDR, label: 'list services' });
// /services returns [{ service: {...}, cursor: ... }, ...]
const match = services.find((s) => (s.service?.name || s.name) === SERVICE_NAME);
if (!match) {
  const names = services.map((s) => s.service?.name || s.name).filter(Boolean);
  console.error(`Service "${SERVICE_NAME}" not found. Available: ${names.join(', ')}`);
  process.exit(1);
}
const svc = match.service || match;
console.log(`  → service id: ${svc.id} | type: ${svc.type} | dashboard: ${svc.dashboardUrl || '(n/a)'}`);

// Fetch current env vars. Same envelope: [{ envVar: {...} }, ...] or
// [{ key, value }, ...] depending on API version. Handle both.
const envRows = await httpJson('GET', `${RENDER}/services/${svc.id}/env-vars?limit=200`, {
  headers: HDR,
  label: 'list env vars',
});
const current = envRows.map((r) => r.envVar || r);

console.log(`\nCurrent env vars on service: ${current.length} total\n`);

const diffRows = Object.entries(TARGETS).map(([key, after]) => {
  const existing = current.find((v) => v.key === key);
  return { key, before: existing?.value, after };
});
diffTable(diffRows);

// Build the merged list — preserve everything else, replace target keys.
const merged = current
  .filter((v) => !TARGETS.hasOwnProperty(v.key))
  .map((v) => ({ key: v.key, value: v.value }))
  .concat(Object.entries(TARGETS).map(([key, value]) => ({ key, value })));

// Show R2_BUCKET_NAME for awareness without changing it.
const r2 = current.find((v) => v.key === 'R2_BUCKET_NAME');
console.log(`\n  R2_BUCKET_NAME (read-only check): ${r2 ? `"${r2.value}"` : '(unset)'} — leave alone unless wrong; .env.example expects "deckle-pdfs".`);

const changes = diffRows.filter((r) => r.before !== r.after);
console.log(`\n${changes.length}/${diffRows.length} target vars will change.`);

if (!APPLY) {
  console.log('\nDry run complete. Re-run with --apply to push.');
  process.exit(0);
}
if (changes.length === 0) {
  console.log('Nothing to change.');
  process.exit(0);
}

const ok = await confirm(`PUT ${merged.length} env vars to service ${svc.id} (replaces full set; Render will redeploy)?`, process.argv);
if (!ok) {
  console.log('Aborted.');
  process.exit(1);
}

await httpJson('PUT', `${RENDER}/services/${svc.id}/env-vars`, {
  headers: HDR,
  body: merged,
  label: 'put env vars',
});
console.log('\n✓ Env vars updated. Render will auto-redeploy.');

// Verify by re-reading.
const after = await httpJson('GET', `${RENDER}/services/${svc.id}/env-vars?limit=200`, { headers: HDR, label: 'verify' });
const afterRows = after.map((r) => r.envVar || r);
console.log('\nPost-write state of the target vars:');
diffTable(
  Object.entries(TARGETS).map(([key, expected]) => {
    const v = afterRows.find((x) => x.key === key);
    return { key, before: v?.value, after: expected };
  }),
);
