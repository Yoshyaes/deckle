#!/usr/bin/env node
/**
 * Deckle MCP Server
 *
 * Exposes Deckle PDF generation tools to AI agents via the
 * Model Context Protocol (MCP). Works with Claude Desktop, Cursor,
 * and any MCP-compatible client.
 *
 * Environment variables:
 *   DECKLE_API_KEY  - Your Deckle API key (required)
 *   DECKLE_API_URL  - API base URL (default: https://api.getdeckle.dev)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const API_KEY = process.env.DECKLE_API_KEY;
const API_URL = (process.env.DECKLE_API_URL || 'https://api.getdeckle.dev').replace(/\/$/, '');

async function apiRequest(method: string, path: string, body?: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'deckle-mcp/1.0.0',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || `API error ${res.status}`;
      throw new Error(msg);
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

/** Build the MCP text result for a tool that returns a stored URL or base64 file. */
function fileResult(heading: string, r: any, extra: string[] = []) {
  const lines = [heading];
  if (r.url) lines.push(`URL: ${r.url}`);
  if (typeof r.file_size === 'number') lines.push(`Size: ${r.file_size} bytes`);
  lines.push(...extra);
  if (!r.url && r.data) lines.push('', 'Base64:', r.data);
  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
}

/** Uniform error envelope for tool handlers. */
function toolError(err: unknown) {
  return {
    content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
    isError: true,
  };
}

export const server = new McpServer({
  name: 'deckle',
  version: '1.0.0',
});

// Tool: Generate PDF from HTML
server.tool(
  'generate_pdf',
  'Generate a PDF document from HTML. Returns a URL to the generated PDF.',
  {
    html: z.string().max(5242880).describe('HTML content to render as PDF'),
    format: z.enum(['A4', 'Letter', 'Legal']).optional().describe('Page format (default: A4)'),
    margin: z.string().optional().describe('Page margin, e.g. "1in" or "20mm"'),
    orientation: z.enum(['portrait', 'landscape']).optional().describe('Page orientation'),
    watermark: z.object({
      text: z.string().describe('Watermark text'),
      opacity: z.number().min(0).max(1).optional().describe('Watermark opacity (0-1)'),
      angle: z.number().optional().describe('Watermark rotation in degrees'),
    }).optional().describe('Watermark configuration'),
    header: z.string().optional().describe('HTML for page header. Supports {{pageNumber}} and {{totalPages}}.'),
    footer: z.string().optional().describe('HTML for page footer. Supports {{pageNumber}} and {{totalPages}}.'),
  },
  async ({ html, format, margin, orientation, watermark, header, footer }) => {
    try {
      const result = await apiRequest('POST', '/v1/generate', {
        html,
        options: {
          format: format || 'A4',
          margin: margin || '0.5in',
          orientation: orientation || 'portrait',
        },
        ...(watermark && { watermark }),
        ...(header && { header }),
        ...(footer && { footer }),
        output: 'url',
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `PDF generated successfully!\n\nURL: ${result.url}\nPages: ${result.pages}\nFile size: ${result.file_size} bytes\nGeneration time: ${result.generation_time_ms}ms\nID: ${result.id}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// Tool: Generate PDF from React component
server.tool(
  'generate_pdf_react',
  'Generate a PDF from a React/JSX component. The component should export a default function.',
  {
    react: z.string().max(5242880).describe('JSX/TSX component source code with a default export'),
    data: z.record(z.unknown()).optional().describe('Props to pass to the React component'),
    styles: z.string().optional().describe('Additional CSS styles'),
    format: z.enum(['A4', 'Letter', 'Legal']).optional().describe('Page format (default: A4)'),
  },
  async ({ react, data, styles, format }) => {
    try {
      const result = await apiRequest('POST', '/v1/generate', {
        react,
        data,
        styles,
        options: { format: format || 'A4' },
        output: 'url',
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `PDF generated from React component!\n\nURL: ${result.url}\nPages: ${result.pages}\nFile size: ${result.file_size} bytes\nGeneration time: ${result.generation_time_ms}ms\nID: ${result.id}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// Tool: Generate PDF from template
server.tool(
  'generate_pdf_template',
  'Generate a PDF from a saved template with dynamic data.',
  {
    template: z.string().describe('Template ID (tmpl_xxx)'),
    data: z.record(z.unknown()).describe('Data to merge into the template'),
    format: z.enum(['A4', 'Letter', 'Legal']).optional().describe('Page format (default: A4)'),
  },
  async ({ template, data, format }) => {
    try {
      const result = await apiRequest('POST', '/v1/generate', {
        template,
        data,
        options: { format: format || 'A4' },
        output: 'url',
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `PDF generated from template!\n\nURL: ${result.url}\nPages: ${result.pages}\nFile size: ${result.file_size} bytes\nGeneration time: ${result.generation_time_ms}ms\nID: ${result.id}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// Tool: List templates
server.tool(
  'list_templates',
  'List all saved PDF templates in your Deckle account.',
  {},
  async () => {
    try {
      const result = await apiRequest('GET', '/v1/templates');
      const templates = result.data || [];

      if (templates.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No templates found. Create one with create_template.' }],
        };
      }

      const lines = templates.map(
        (t: any) => `- ${t.name} (${t.id}) — v${t.version}${t.is_public ? ' [public]' : ''}`,
      );

      return {
        content: [{ type: 'text' as const, text: `Templates:\n${lines.join('\n')}` }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// Tool: Create template
server.tool(
  'create_template',
  'Create a new reusable PDF template with Handlebars syntax for dynamic data.',
  {
    name: z.string().describe('Template name'),
    html_content: z.string().describe('HTML template with {{variable}} placeholders. Supports {{#each items}}, {{#if condition}}.'),
  },
  async ({ name, html_content }) => {
    try {
      const result = await apiRequest('POST', '/v1/templates', {
        name,
        html_content,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Template created!\n\nID: ${result.id}\nName: ${result.name}\nVersion: ${result.version}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// Tool: Get usage stats
server.tool(
  'get_usage',
  'Get your Deckle API usage statistics for the current billing period.',
  {},
  async () => {
    try {
      const result = await apiRequest('GET', '/v1/usage');
      return {
        content: [
          {
            type: 'text' as const,
            text: `Usage stats:\n\nPlan: ${result.plan}\nGenerations: ${result.generation_count} / ${result.limit}\nTotal pages: ${result.total_pages}\nPeriod: ${result.period_start} to ${result.period_end}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// Tool: List starter templates
server.tool(
  'list_starter_templates',
  'Browse pre-built starter templates (invoice, receipt, report, certificate, shipping label) that you can clone.',
  {},
  async () => {
    try {
      const result = await apiRequest('GET', '/v1/starter-templates');
      const templates = result.data || [];
      const lines = templates.map(
        (t: any) => `- **${t.name}** (${t.slug}): ${t.description}`,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: `Available starter templates:\n\n${lines.join('\n')}\n\nUse generate_pdf_template with the template ID after cloning, or use generate_pdf with the starter template's HTML directly.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  },
);

// ── PDF tools ────────────────────────────────────────────────────────────
// These operate on existing PDFs supplied as base64. They default to
// returning a hosted URL; pass output: "base64" to get the bytes inline.

// Tool: Merge PDFs
server.tool(
  'merge_pdfs',
  'Merge two or more PDFs into a single document. Provide the PDFs as base64 strings in the order they should appear.',
  {
    pdfs: z.array(z.string()).min(2).describe('Base64-encoded PDF files to merge, in order (at least 2)'),
    output: z.enum(['url', 'base64']).optional().describe('Return a hosted URL (default) or inline base64'),
  },
  async ({ pdfs, output }) => {
    try {
      const r = await apiRequest('POST', '/v1/pdf/merge', { pdfs, output: output || 'url' });
      return fileResult('PDFs merged.', r);
    } catch (err) {
      return toolError(err);
    }
  },
);

// Tool: Split PDF
server.tool(
  'split_pdf',
  'Split a PDF into multiple files by page range. Ranges are 1-indexed and inclusive; each is [start] or [start, end]. Omit ranges to split into one file per page.',
  {
    pdf: z.string().describe('Base64-encoded PDF to split'),
    ranges: z
      .array(z.array(z.number().int().positive()).min(1).max(2))
      .optional()
      .describe('Page ranges, e.g. [[1,3],[5]] for pages 1-3 and page 5. Omit to split every page.'),
    output: z.enum(['url', 'base64']).optional().describe('Return hosted URLs (default) or inline base64'),
  },
  async ({ pdf, ranges, output }) => {
    try {
      const r = await apiRequest('POST', '/v1/pdf/split', {
        pdf,
        ...(ranges && { ranges }),
        output: output || 'url',
      });
      const parts = (r.parts || [])
        .map((p: any, i: number) => `  ${i + 1}. ${p.url || `(base64, ${p.file_size} bytes)`}`)
        .join('\n');
      return { content: [{ type: 'text' as const, text: `Split into ${r.total} file(s):\n${parts}` }] };
    } catch (err) {
      return toolError(err);
    }
  },
);

// Tool: PDF info
server.tool(
  'get_pdf_info',
  'Get metadata for a PDF: page count, title, author, and other document properties.',
  { pdf: z.string().describe('Base64-encoded PDF') },
  async ({ pdf }) => {
    try {
      const info = await apiRequest('POST', '/v1/pdf/info', { pdf });
      return { content: [{ type: 'text' as const, text: `PDF info:\n${JSON.stringify(info, null, 2)}` }] };
    } catch (err) {
      return toolError(err);
    }
  },
);

// Tool: Protect (encrypt) PDF
server.tool(
  'protect_pdf',
  'Password-protect a PDF with AES-256 encryption. Supply a user password (required to open), an owner password (required to change permissions), or both.',
  {
    pdf: z.string().describe('Base64-encoded PDF'),
    user_password: z.string().optional().describe('Password required to open the PDF'),
    owner_password: z.string().optional().describe('Password required to change permissions'),
    permissions: z
      .object({
        print: z.enum(['none', 'low', 'full']).optional().describe('Printing allowance'),
        modify: z.boolean().optional(),
        copy: z.boolean().optional(),
        annotate: z.boolean().optional(),
      })
      .optional()
      .describe('Permission flags enforced when opened with the user password'),
    output: z.enum(['url', 'base64']).optional(),
  },
  async ({ pdf, user_password, owner_password, permissions, output }) => {
    try {
      const r = await apiRequest('POST', '/v1/pdf/protect', {
        pdf,
        ...(user_password && { user_password }),
        ...(owner_password && { owner_password }),
        ...(permissions && { permissions }),
        output: output || 'url',
      });
      return fileResult('PDF encrypted (AES-256).', r);
    } catch (err) {
      return toolError(err);
    }
  },
);

// Tool: Sign PDF
server.tool(
  'sign_pdf',
  'Add a signature to a PDF. Without `signature`, draws a visual signature annotation. With a base64 PKCS#12 (.p12/.pfx) credential, also embeds a cryptographic PAdES-B-B signature. The P12 is used once and never stored.',
  {
    pdf: z.string().describe('Base64-encoded PDF'),
    name: z.string().describe('Signer name shown on the signature'),
    reason: z.string().optional(),
    location: z.string().optional(),
    contact: z.string().optional(),
    page: z.number().int().min(0).optional().describe('0-indexed page for the visual annotation'),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    signature: z
      .object({
        p12: z.string().describe('PKCS#12 credential, base64-encoded (max 100KB)'),
        password: z.string().optional().describe('P12 passphrase (use "" if none)'),
      })
      .optional()
      .describe('Cryptographic signing material. Omit for a visual-only annotation.'),
    output: z.enum(['url', 'base64']).optional(),
  },
  async ({ pdf, signature, output, ...opts }) => {
    try {
      const r = await apiRequest('POST', '/v1/pdf/sign', {
        pdf,
        ...opts,
        ...(signature && { signature }),
        output: output || 'url',
      });
      const extra = r.cryptographically_signed
        ? [`Cryptographically signed: yes (${r.signature_type})`]
        : ['Cryptographically signed: no (visual annotation only)'];
      return fileResult('PDF signed.', r, extra);
    } catch (err) {
      return toolError(err);
    }
  },
);

// Tool: Fill PDF form
server.tool(
  'fill_pdf_form',
  'Fill form fields in a PDF that already has an AcroForm. Set flatten=true to make the values non-editable.',
  {
    pdf: z.string().describe('Base64-encoded PDF with form fields'),
    fields: z
      .array(z.object({ name: z.string(), value: z.union([z.string(), z.boolean()]) }))
      .describe('Field name to value. Use a boolean for checkboxes.'),
    flatten: z.boolean().optional().describe('Flatten the form so fields are no longer editable'),
    output: z.enum(['url', 'base64']).optional(),
  },
  async ({ pdf, fields, flatten, output }) => {
    try {
      const r = await apiRequest('POST', '/v1/pdf/forms/fill', {
        pdf,
        fields,
        ...(flatten !== undefined && { flatten }),
        output: output || 'url',
      });
      return fileResult('Form filled.', r);
    } catch (err) {
      return toolError(err);
    }
  },
);

// Tool: Add PDF form fields
server.tool(
  'add_pdf_form_fields',
  'Add new form fields (text, checkbox, or dropdown) to a PDF at a given page and position.',
  {
    pdf: z.string().describe('Base64-encoded PDF'),
    fields: z
      .array(
        z.object({
          name: z.string(),
          type: z.enum(['text', 'checkbox', 'dropdown']),
          page: z.number().int().min(0).describe('0-indexed page'),
          x: z.number(),
          y: z.number(),
          width: z.number().optional(),
          height: z.number().optional(),
          options: z.array(z.string()).optional().describe('Choices for a dropdown'),
          defaultValue: z.union([z.string(), z.boolean()]).optional(),
        }),
      )
      .describe('Form fields to add'),
    output: z.enum(['url', 'base64']).optional(),
  },
  async ({ pdf, fields, output }) => {
    try {
      const r = await apiRequest('POST', '/v1/pdf/forms/add-fields', { pdf, fields, output: output || 'url' });
      return fileResult('Form fields added.', r);
    } catch (err) {
      return toolError(err);
    }
  },
);

// Tool: List PDF form fields
server.tool(
  'list_pdf_form_fields',
  'List the form fields present in a PDF.',
  { pdf: z.string().describe('Base64-encoded PDF') },
  async ({ pdf }) => {
    try {
      const r = await apiRequest('POST', '/v1/pdf/forms/list-fields', { pdf });
      return {
        content: [{ type: 'text' as const, text: `${r.total} field(s):\n${JSON.stringify(r.fields, null, 2)}` }],
      };
    } catch (err) {
      return toolError(err);
    }
  },
);

// Tool: Convert to PDF/A
server.tool(
  'convert_pdf_to_pdfa',
  'Convert a PDF to the archival PDF/A-1b format. Optionally set document metadata.',
  {
    pdf: z.string().describe('Base64-encoded PDF'),
    title: z.string().optional(),
    author: z.string().optional(),
    subject: z.string().optional(),
    output: z.enum(['url', 'base64']).optional(),
  },
  async ({ pdf, title, author, subject, output }) => {
    try {
      const r = await apiRequest('POST', '/v1/pdf/pdfa', {
        pdf,
        ...(title && { title }),
        ...(author && { author }),
        ...(subject && { subject }),
        output: output || 'url',
      });
      return fileResult('Converted to PDF/A-1b.', r);
    } catch (err) {
      return toolError(err);
    }
  },
);

// Tool: Generate a template from a natural-language prompt (AI)
server.tool(
  'generate_template_from_prompt',
  'Use AI to generate a reusable HTML template (with Handlebars variables) from a natural-language description. Returns the HTML and detected variables; pass the HTML to create_template to save it.',
  {
    prompt: z
      .string()
      .max(2000)
      .describe('Describe the document, e.g. "a modern invoice with line items and a total"'),
    type: z.enum(['invoice', 'receipt', 'report', 'certificate', 'letter', 'resume', 'other']).optional(),
    style: z.enum(['professional', 'modern', 'minimal', 'colorful']).optional(),
    variables: z.array(z.string()).optional().describe('Specific Handlebars variable names to include'),
  },
  async ({ prompt, type, style, variables }) => {
    try {
      const r = await apiRequest('POST', '/v1/ai/generate-template', {
        prompt,
        ...(type && { type }),
        ...(style && { style }),
        ...(variables && { variables }),
      });
      const vars = (r.variables || []).join(', ') || '(none detected)';
      return {
        content: [
          {
            type: 'text' as const,
            text: `Template generated.\nDetected variables: ${vars}\n\nHTML:\n${r.html_content || r.html}`,
          },
        ],
      };
    } catch (err) {
      return toolError(err);
    }
  },
);

// Start the server
async function main() {
  if (!API_KEY) {
    console.error('Error: DECKLE_API_KEY environment variable is required.');
    console.error('Set it in your MCP client config or shell environment.');
    process.exit(1);
  }

  // Startup health check to verify connectivity
  try {
    await apiRequest('GET', '/health');
  } catch (err) {
    console.warn(`Warning: Deckle API health check failed (${(err as Error).message}). Continuing anyway — the API may not be reachable yet.`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Only start the stdio transport when this file is run directly (e.g. via
// `npx @deckle/mcp-server` or Claude Desktop). When imported by a test, the
// `server` export is inspected without opening stdio. Case-insensitive compare
// for Windows path casing.
const invokedDirectly =
  !!process.argv[1] &&
  import.meta.url.toLowerCase() === pathToFileURL(process.argv[1]).href.toLowerCase();

if (invokedDirectly) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
