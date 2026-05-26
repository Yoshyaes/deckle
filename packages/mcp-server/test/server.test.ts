import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { server } from '../src/index.js';

/**
 * Boots the MCP server over an in-memory transport and asserts that exactly
 * the expected tool set is registered — the same `tools/list` call an MCP
 * client (Claude Desktop, Cursor) makes on connect. No network, no API key.
 */

const EXPECTED_TOOLS = [
  // generate
  'generate_pdf',
  'generate_pdf_react',
  'generate_pdf_template',
  // templates
  'list_templates',
  'create_template',
  'list_starter_templates',
  'generate_template_from_prompt',
  // account
  'get_usage',
  // pdf toolkit
  'merge_pdfs',
  'split_pdf',
  'get_pdf_info',
  'protect_pdf',
  'sign_pdf',
  'fill_pdf_form',
  'add_pdf_form_fields',
  'list_pdf_form_fields',
  'convert_pdf_to_pdfa',
].sort();

test('MCP server registers exactly the expected 17 tools', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'deckle-mcp-test', version: '0.0.0' });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  try {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();

    assert.equal(
      tools.length,
      EXPECTED_TOOLS.length,
      `expected ${EXPECTED_TOOLS.length} tools, got ${tools.length}: ${names.join(', ')}`,
    );
    assert.deepEqual(names, EXPECTED_TOOLS);

    // Every tool must advertise a non-empty description and an input schema so
    // an LLM can call it without guessing.
    for (const t of tools) {
      assert.ok(t.description && t.description.length > 0, `tool ${t.name} is missing a description`);
      assert.ok(t.inputSchema, `tool ${t.name} is missing an input schema`);
    }
  } finally {
    await client.close();
  }
});
