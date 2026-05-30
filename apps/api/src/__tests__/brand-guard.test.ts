import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Brand-regression guard.
 *
 * Locks in the DocuForge -> Deckle rebrand so the old brand can't silently
 * creep back into shipping code or docs. Scans every tracked file (git
 * ls-files, which already respects .gitignore) for any case-variant of
 * "docuforge", and asserts the core Deckle invariants.
 *
 * Intentionally-allowed mentions (historical record / rebrand paperwork)
 * are listed in ALLOW below.
 */

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = resolve(dir, '..');
  }
  throw new Error('repo root (pnpm-workspace.yaml) not found');
}

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

// Files allowed to mention the old brand on purpose.
const ALLOW: RegExp[] = [
  /^audits\//, // historical audit record, deliberately preserved
  /^REBRAND-SUMMARY\.md$/, // documents the rebrand itself
  /^LAUNCH-REMAINING\.md$/, // launch checklist references the old name in tasks
  /^\.gitignore$/, // ignores the local "DocuForge Assets/" working folder
  /brand-guard\.test\.ts$/, // this guard necessarily contains the word
  /^scripts\/rebrand-finish\//, // single-use runners that finish the rebrand
];

const SCAN_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|py|rb|go|toml|ya?ml|html|css|gemspec)$/;

describe('brand guard: DocuForge must not regress into Deckle', () => {
  it('has no "docuforge" (any case) in tracked shipping files', () => {
    const files = execSync('git ls-files', { cwd: repoRoot, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .filter((f) => SCAN_EXT.test(f))
      .filter((f) => !ALLOW.some((re) => re.test(f)));

    const offenders: string[] = [];
    for (const f of files) {
      const lines = readFileSync(resolve(repoRoot, f), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/docuforge/i.test(line)) offenders.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }

    expect(offenders).toEqual([]);
  });

  it('SDK exposes the Deckle class with the getdeckle.dev default base URL', () => {
    const sdk = readFileSync(resolve(repoRoot, 'packages/sdk-typescript/src/index.ts'), 'utf8');
    expect(sdk).toMatch(/export class Deckle\b/);
    expect(sdk).not.toMatch(/export class DocuForge\b/);
    expect(sdk).toMatch(/api\.getdeckle\.dev/);
  });

  it('mints API keys with the dk_live_ prefix', () => {
    const id = readFileSync(resolve(repoRoot, 'apps/api/src/lib/id.ts'), 'utf8');
    expect(id).toMatch(/dk_live_/);
    // df_live_ is *accepted* by the auth middleware for transition, but never minted here
    expect(id).not.toMatch(/df_live_/);
  });
});
