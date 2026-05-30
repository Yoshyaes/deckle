// Shared helpers for the rebrand-finish scripts. Kept dependency-free —
// just a tiny .env loader, a fetch wrapper with 429/5xx backoff, and a
// confirm prompt that respects the --apply flag convention.

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

/** Parse a simple .env file: KEY=VALUE per line. No shell expansion, no
 *  quoting magic. Lines starting with # and blank lines are ignored. */
export function loadEnv(envPath) {
  // Resolve next to this module — works correctly on Windows + POSIX via
  // fileURLToPath (no URL.pathname leading-slash quirks).
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fixed = envPath || path.join(here, '.env');
  if (!fs.existsSync(fixed)) {
    throw new Error(
      `No .env at ${fixed}. Copy .env.example to .env and fill in the section you need.`,
    );
  }
  const out = {};
  for (const raw of fs.readFileSync(fixed, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip optional surrounding quotes (single or double).
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function requireEnv(env, key, hint = '') {
  if (!env[key]) {
    throw new Error(`${key} is missing from .env${hint ? ` — ${hint}` : ''}`);
  }
  return env[key];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch wrapper that throws on non-2xx (after a couple of backoff retries on
 *  429/5xx), JSON-decodes the body, and is loud about what it sent so dry-run
 *  output is auditable. */
export async function httpJson(method, url, { headers = {}, body, label } = {}) {
  const init = {
    method,
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
  };
  if (body !== undefined) init.body = typeof body === 'string' ? body : JSON.stringify(body);

  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) {
      const text = await res.text();
      try {
        return text ? JSON.parse(text) : null;
      } catch {
        return text;
      }
    }
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = 2000 * attempt;
      console.log(`    ${res.status} on ${label || url}; backing off ${wait}ms (attempt ${attempt})`);
      await sleep(wait);
      continue;
    }
    lastErr = new Error(`${method} ${url} → HTTP ${res.status}: ${text.slice(0, 400)}`);
    throw lastErr;
  }
  throw lastErr;
}

/** True iff the script was invoked with --apply (or DECKLE_APPLY=1). Without
 *  it, scripts run in dry-run mode: they fetch + compute the diff but never
 *  mutate. */
export function applyFlag(argv) {
  return argv.includes('--apply') || process.env.DECKLE_APPLY === '1';
}

/** Interactive y/n confirmation. Auto-yes if --yes is passed (for CI/scripted
 *  use). Default-no. */
export async function confirm(question, argv) {
  if (argv.includes('--yes')) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise((res) => rl.question(`${question} [y/N] `, res));
  rl.close();
  return /^y(es)?$/i.test(ans.trim());
}

/** Pretty-print a before/after diff for an env-var-like list. */
export function diffTable(rows) {
  if (rows.length === 0) {
    console.log('  (no changes)');
    return;
  }
  const widths = {
    key: Math.max(3, ...rows.map((r) => r.key.length)),
    before: Math.max(6, ...rows.map((r) => String(r.before ?? '(unset)').length)),
  };
  console.log(`  ${'KEY'.padEnd(widths.key)}  ${'BEFORE'.padEnd(widths.before)}  →  AFTER`);
  for (const r of rows) {
    const before = String(r.before ?? '(unset)');
    const after = String(r.after);
    const same = before === after;
    const arrow = same ? '=' : '→';
    console.log(`  ${r.key.padEnd(widths.key)}  ${before.padEnd(widths.before)}  ${arrow}  ${after}${same ? '   (unchanged)' : ''}`);
  }
}

/** Common rebrand replacements applied to text bodies (e.g. Dev.to articles).
 *  Order matters — longer/more-specific patterns first so a later rule can't
 *  eat part of a brand we already rewrote. */
export const REBRAND_RULES = [
  [/@docuforge\/react-pdf/g, '@getdeckle/react-pdf'],
  [/@docuforge\/sdk/g, '@getdeckle/sdk'],
  [/npm install docuforge\b/g, 'npm install @getdeckle/sdk'],
  [/yarn add docuforge\b/g, 'yarn add @getdeckle/sdk'],
  [/pnpm add docuforge\b/g, 'pnpm add @getdeckle/sdk'],
  [/pip install docuforge\b/g, 'pip install deckle'],
  [/getdocuforge\.dev/g, 'getdeckle.dev'],
  [/df_live_/g, 'dk_live_'],
  [/df_test_/g, 'dk_test_'],
  [/DOCUFORGE/g, 'DECKLE'],
  [/DocuForge/g, 'Deckle'],
  [/Docuforge/g, 'Deckle'],
  [/docuforge/g, 'deckle'],
];

export function applyRebrand(text) {
  let out = text;
  const counts = {};
  for (const [re, repl] of REBRAND_RULES) {
    const m = out.match(re);
    if (m) {
      counts[re.source] = (counts[re.source] || 0) + m.length;
      out = out.replace(re, repl);
    }
  }
  return { out, counts };
}
