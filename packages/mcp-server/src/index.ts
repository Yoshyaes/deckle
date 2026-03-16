#!/usr/bin/env node
/**
 * DocuForge MCP Server
 *
 * Exposes DocuForge PDF generation tools to AI agents via the
 * Model Context Protocol (MCP). Works with Claude Desktop, Cursor,
 * and any MCP-compatible client.
 *
 * Environment variables:
 *   DOCUFORGE_API_KEY  - Your DocuForge API key (required)
 *   DOCUFORGE_API_URL  - API base URL (default: https://api.getdocuforge.dev)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API_KEY = process.env.DOCUFORGE_API_KEY;
const API_URL = (process.env.DOCUFORGE_API_URL || 'https://api.getdocuforge.dev').replace(/\/$/, '');

async function apiRequest(method: string, path: string, body?: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'docuforge-mcp/0.1.0',
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

const server = new McpServer({
  name: 'docuforge',
  version: '0.1.0',
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
      rotation: z.number().optional().describe('Watermark rotation in degrees'),
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
  'List all saved PDF templates in your DocuForge account.',
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
  'Get your DocuForge API usage statistics for the current billing period.',
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

// Start the server
async function main() {
  if (!API_KEY) {
    console.error('Error: DOCUFORGE_API_KEY environment variable is required.');
    console.error('Set it in your MCP client config or shell environment.');
    process.exit(1);
  }

  // Startup health check to verify connectivity
  try {
    await apiRequest('GET', '/health');
  } catch (err) {
    console.warn(`Warning: DocuForge API health check failed (${(err as Error).message}). Continuing anyway — the API may not be reachable yet.`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
