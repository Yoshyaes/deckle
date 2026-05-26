/**
 * Stdio smoke test — launches the BUILT server (dist/index.js) exactly the
 * way Claude Desktop / Cursor do (spawn `node dist/index.js` over stdio),
 * performs the MCP handshake, and lists the tools.
 *
 * Usage:
 *   npm run build && node scripts/smoke.mjs
 *
 * Set DECKLE_API_KEY to your real key to also exercise a live generate_pdf
 * call; otherwise a dummy key is used and only the handshake + tools/list
 * are verified (no network beyond the server's own startup health check).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = resolve(here, '..', 'dist', 'index.js');

if (!existsSync(serverEntry)) {
  console.error(`dist not built: ${serverEntry}\nRun "npm run build" first.`);
  process.exit(1);
}

const EXPECTED = 17;

const transport = new StdioClientTransport({
  command: process.execPath, // node
  args: [serverEntry],
  env: { ...process.env, DECKLE_API_KEY: process.env.DECKLE_API_KEY || 'dk_live_smoke_dummy' },
});

const client = new Client({ name: 'deckle-stdio-smoke', version: '0.0.0' });

try {
  await client.connect(transport);
  console.log('✓ Connected to deckle MCP server over stdio (handshake OK)');

  const { tools } = await client.listTools();
  console.log(`✓ tools/list returned ${tools.length} tools:`);
  for (const t of tools) console.log('   -', t.name);

  if (tools.length !== EXPECTED) {
    console.error(`\n✗ SMOKE FAIL: expected ${EXPECTED} tools, got ${tools.length}`);
    process.exitCode = 1;
  } else {
    console.log(`\n✓ SMOKE OK: ${EXPECTED} tools registered and reachable over stdio`);
  }

  // Optional live call when a real key is present.
  if (process.env.DECKLE_API_KEY) {
    const res = await client.callTool({
      name: 'generate_pdf',
      arguments: { html: '<h1>Deckle MCP smoke</h1><p>It works.</p>', format: 'A4' },
    });
    const text = res.content?.map((c) => c.text).join('\n') ?? '';
    console.log('\nlive generate_pdf result:\n' + text);
  }
} finally {
  await client.close();
}
