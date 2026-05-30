#!/usr/bin/env node
/**
 * Cloudflare 301 redirect rules for the getdocuforge.dev zone.
 *
 * Creates a dynamic-redirect ruleset on the zone with two rules:
 *   1. host = getdocuforge.dev      → 301 https://getdeckle.dev/{path}
 *   2. host = www.getdocuforge.dev  → 301 https://getdeckle.dev/{path}
 *
 * api.getdocuforge.dev is intentionally NOT redirected — the API still
 * accepts df_live_ keys during the transition window and existing
 * customers may call that hostname.
 *
 * Idempotent: if a ruleset already exists in the http_request_dynamic_redirect
 * phase, the script MERGES our rules in (replacing any rule whose description
 * matches our marker), preserving anything else you've configured.
 *
 * Usage:
 *   node scripts/rebrand-finish/cloudflare.mjs            # dry-run
 *   node scripts/rebrand-finish/cloudflare.mjs --apply
 */
import { loadEnv, requireEnv, httpJson, applyFlag, confirm } from './_common.mjs';

const env = loadEnv();
const TOKEN = requireEnv(env, 'CLOUDFLARE_API_TOKEN', 'create at https://dash.cloudflare.com/profile/api-tokens with Zone:Edit on getdocuforge.dev');
let ZONE_ID = env.CLOUDFLARE_ZONE_ID || '';
const APPLY = applyFlag(process.argv);

const CF = 'https://api.cloudflare.com/client/v4';
const HDR = { Authorization: `Bearer ${TOKEN}` };

const PHASE = 'http_request_dynamic_redirect';
const ZONE_NAME = 'getdocuforge.dev';

// A stable description marker the script uses to recognize its own rules so
// re-runs replace them in-place rather than appending duplicates.
const MARKER = '[deckle-rebrand-finish]';

const RULES = [
  {
    expression: '(http.host eq "getdocuforge.dev")',
    description: `${MARKER} apex getdocuforge.dev → getdeckle.dev (301, preserve path + query)`,
  },
  {
    expression: '(http.host eq "www.getdocuforge.dev")',
    description: `${MARKER} www.getdocuforge.dev → getdeckle.dev (301, preserve path + query)`,
  },
].map((r) => ({
  action: 'redirect',
  enabled: true,
  ...r,
  action_parameters: {
    from_value: {
      status_code: 301,
      preserve_query_string: true,
      target_url: {
        expression: 'concat("https://getdeckle.dev", http.request.uri.path)',
      },
    },
  },
}));

console.log(`Cloudflare 301 redirect setup — ${APPLY ? 'APPLY MODE' : 'dry-run (no writes)'}`);

if (!ZONE_ID) {
  console.log(`Looking up zone "${ZONE_NAME}"…`);
  const r = await httpJson('GET', `${CF}/zones?name=${ZONE_NAME}`, { headers: HDR, label: 'zone lookup' });
  if (!r.success || !r.result || r.result.length === 0) {
    console.error(`Zone "${ZONE_NAME}" not found on this Cloudflare account. Confirm the token has Zone:Read for it.`);
    process.exit(1);
  }
  ZONE_ID = r.result[0].id;
  console.log(`  → zone id: ${ZONE_ID}`);
}

// Fetch the current entrypoint ruleset for this phase. If it doesn't exist
// yet, Cloudflare returns 404; we then create one. If it does, we merge.
let existing = null;
try {
  const r = await httpJson('GET', `${CF}/zones/${ZONE_ID}/rulesets/phases/${PHASE}/entrypoint`, {
    headers: HDR,
    label: 'get phase entrypoint',
  });
  existing = r.result;
} catch (e) {
  if (!/HTTP 404/.test(e.message)) throw e;
  console.log('  (no existing dynamic-redirect ruleset on this zone — will create)');
}

const existingRules = existing?.rules || [];
const kept = existingRules.filter((r) => !(r.description || '').startsWith(MARKER));
const newRules = [...kept, ...RULES];

console.log(`\nExisting ruleset rules: ${existingRules.length}`);
if (existingRules.length) {
  for (const r of existingRules) {
    const ours = (r.description || '').startsWith(MARKER) ? '  (will replace)' : '  (keep)';
    console.log(`  - ${r.expression}${ours}`);
  }
}
console.log(`\nRules after merge: ${newRules.length}`);
for (const r of newRules) {
  console.log(`  - ${r.expression}  ${r.description.startsWith(MARKER) ? '(ours)' : '(yours)'}`);
}

if (!APPLY) {
  console.log('\nDry run complete. Re-run with --apply to PUT the ruleset.');
  process.exit(0);
}

const ok = await confirm(
  `PUT ${newRules.length} rules to the ${PHASE} entrypoint on zone ${ZONE_ID}?`,
  process.argv,
);
if (!ok) {
  console.log('Aborted.');
  process.exit(1);
}

// Cloudflare PUTs the entire ruleset rule list atomically.
const written = await httpJson('PUT', `${CF}/zones/${ZONE_ID}/rulesets/phases/${PHASE}/entrypoint`, {
  headers: HDR,
  body: {
    rules: newRules.map((r) => ({
      action: r.action,
      action_parameters: r.action_parameters,
      expression: r.expression,
      description: r.description,
      enabled: r.enabled,
    })),
  },
  label: 'put ruleset',
});

const writtenRules = written?.result?.rules || [];
console.log(`\n✓ Wrote ${writtenRules.length} rules. The redirect is live within ~30s once Cloudflare propagates.`);
console.log(`\nVerify with:`);
console.log(`  curl -sI https://getdocuforge.dev/`);
console.log(`  curl -sI https://www.getdocuforge.dev/blog/anything`);
console.log(`Both should return: HTTP/2 301  +  Location: https://getdeckle.dev/...`);
