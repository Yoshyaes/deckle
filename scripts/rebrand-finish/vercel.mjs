#!/usr/bin/env node
/**
 * Vercel env-var sweep for both `deckle` (marketing) and `deckle-dashboard`
 * (app). Sets the three production-scoped env vars from LAUNCH-REMAINING §2,
 * then triggers a production redeploy of each project so the new values
 * take effect (Vercel env-var writes don't auto-rebuild).
 *
 * Target env vars (production scope on both projects):
 *   NEXT_PUBLIC_API_URL    https://api.getdeckle.dev
 *   NEXT_PUBLIC_APP_URL    https://app.getdeckle.dev
 *   DASHBOARD_URL          https://app.getdeckle.dev
 *
 * Usage:
 *   node scripts/rebrand-finish/vercel.mjs            # dry-run
 *   node scripts/rebrand-finish/vercel.mjs --apply
 */
import { loadEnv, requireEnv, httpJson, applyFlag, confirm, diffTable } from './_common.mjs';

const env = loadEnv();
const TOKEN = requireEnv(env, 'VERCEL_TOKEN', 'get one at https://vercel.com/account/tokens');
const TEAM_ID = env.VERCEL_TEAM_ID || '';
const APPLY = applyFlag(process.argv);

const V = 'https://api.vercel.com';
const HDR = { Authorization: `Bearer ${TOKEN}` };
const TQ = TEAM_ID ? `teamId=${encodeURIComponent(TEAM_ID)}` : '';
const qs = (extra = '') => {
  const parts = [TQ, extra].filter(Boolean);
  return parts.length ? `?${parts.join('&')}` : '';
};

const PROJECTS = ['deckle', 'deckle-dashboard'];
const TARGETS = {
  NEXT_PUBLIC_API_URL: 'https://api.getdeckle.dev',
  NEXT_PUBLIC_APP_URL: 'https://app.getdeckle.dev',
  DASHBOARD_URL: 'https://app.getdeckle.dev',
};

console.log(`Vercel env-var sweep — ${APPLY ? 'APPLY MODE' : 'dry-run (no writes)'}`);
if (TEAM_ID) console.log(`Team scope: ${TEAM_ID}`);

const plans = [];

for (const projectName of PROJECTS) {
  console.log(`\n── Project: ${projectName} ─────────────────────────────────`);
  let project;
  try {
    project = await httpJson('GET', `${V}/v9/projects/${projectName}${qs()}`, { headers: HDR, label: `project ${projectName}` });
  } catch (e) {
    console.error(`  ✗ Could not find project "${projectName}": ${e.message}`);
    console.error('  (If your projects live under a team, set VERCEL_TEAM_ID in .env.)');
    process.exit(1);
  }
  console.log(`  project id: ${project.id}`);

  const envList = await httpJson('GET', `${V}/v10/projects/${project.id}/env${qs()}`, { headers: HDR, label: `env list ${projectName}` });
  const envs = envList.envs || envList;

  const rows = Object.entries(TARGETS).map(([key, after]) => {
    const existing = envs.find((e) => e.key === key && (e.target || []).includes('production'));
    return { key, after, existing };
  });

  diffTable(rows.map((r) => ({ key: r.key, before: r.existing?.value, after: r.after })));

  // Plan: PATCH if a production-scoped var exists, POST otherwise.
  const ops = rows.map((r) => {
    const same = r.existing && r.existing.value === r.after;
    if (same) return { type: 'skip', key: r.key };
    if (r.existing) return { type: 'patch', key: r.key, envId: r.existing.id, value: r.after };
    return { type: 'create', key: r.key, value: r.after };
  });

  plans.push({ projectName, projectId: project.id, ops });
}

const totalOps = plans.reduce((s, p) => s + p.ops.filter((o) => o.type !== 'skip').length, 0);
console.log(`\n${totalOps} env-var write operation(s) planned across ${plans.length} project(s).`);

if (!APPLY) {
  console.log('\nDry run complete. Re-run with --apply to write env vars + trigger redeploys.');
  process.exit(0);
}
if (totalOps === 0) {
  console.log('Nothing to change.');
  process.exit(0);
}

const ok = await confirm(`Write env vars to ${plans.map((p) => p.projectName).join(', ')} and redeploy each?`, process.argv);
if (!ok) {
  console.log('Aborted.');
  process.exit(1);
}

for (const p of plans) {
  console.log(`\n── Applying to ${p.projectName} ───────────────────────────`);
  for (const op of p.ops) {
    if (op.type === 'skip') {
      console.log(`  - ${op.key}: unchanged`);
      continue;
    }
    if (op.type === 'patch') {
      await httpJson('PATCH', `${V}/v10/projects/${p.projectId}/env/${op.envId}${qs()}`, {
        headers: HDR,
        body: { value: op.value, target: ['production'] },
        label: `patch ${op.key}`,
      });
      console.log(`  ✓ PATCH ${op.key}`);
    } else if (op.type === 'create') {
      await httpJson('POST', `${V}/v10/projects/${p.projectId}/env${qs(`upsert=true`)}`, {
        headers: HDR,
        body: { key: op.key, value: op.value, target: ['production'], type: 'plain' },
        label: `create ${op.key}`,
      });
      console.log(`  ✓ POST ${op.key}`);
    }
  }

  // Trigger redeploy: find latest production deployment, then POST a new
  // deployment referencing it. Vercel rebuilds from the same git source so
  // the new env values are picked up.
  console.log(`  Triggering production redeploy for ${p.projectName}…`);
  const deps = await httpJson(
    'GET',
    `${V}/v6/deployments${qs(`projectId=${p.projectId}&target=production&limit=1&state=READY`)}`,
    { headers: HDR, label: `latest deploy ${p.projectName}` },
  );
  const latest = (deps.deployments || [])[0];
  if (!latest) {
    console.warn(`  ⚠ No prior production deployment found for ${p.projectName} — redeploy via UI.`);
    continue;
  }
  const redeploy = await httpJson('POST', `${V}/v13/deployments${qs()}`, {
    headers: HDR,
    body: { name: p.projectName, deploymentId: latest.uid, target: 'production' },
    label: `redeploy ${p.projectName}`,
  });
  console.log(`  ✓ Redeploy queued: ${redeploy.url ? `https://${redeploy.url}` : redeploy.id}`);
}

console.log('\n✓ Vercel sweep done. Check https://vercel.com → deployments to watch builds.');
