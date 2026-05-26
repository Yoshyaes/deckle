# @deckle/mcp-server

MCP (Model Context Protocol) server for Deckle PDF generation. Enables AI agents like Claude Desktop and Cursor to generate PDFs directly.

## Setup

### Claude Desktop

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "deckle": {
      "command": "npx",
      "args": ["@deckle/mcp-server"],
      "env": {
        "DECKLE_API_KEY": "dk_live_..."
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "deckle": {
      "command": "npx",
      "args": ["@deckle/mcp-server"],
      "env": {
        "DECKLE_API_KEY": "dk_live_..."
      }
    }
  }
}
```

### Claude Code

Add to `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "deckle": {
      "command": "npx",
      "args": ["@deckle/mcp-server"],
      "env": {
        "DECKLE_API_KEY": "dk_live_..."
      }
    }
  }
}
```

## Available Tools

**Generate**

| Tool | Description |
|------|-------------|
| `generate_pdf` | Generate a PDF from HTML |
| `generate_pdf_react` | Generate a PDF from a React component |
| `generate_pdf_template` | Generate a PDF from a saved template |

**Templates**

| Tool | Description |
|------|-------------|
| `list_templates` | List your saved templates |
| `create_template` | Create a new Handlebars template |
| `list_starter_templates` | Browse pre-built starter templates |
| `generate_template_from_prompt` | AI-generate an HTML template from a description |

**PDF tools** (operate on existing PDFs supplied as base64)

| Tool | Description |
|------|-------------|
| `merge_pdfs` | Merge multiple PDFs into one |
| `split_pdf` | Split a PDF by page ranges |
| `get_pdf_info` | Read PDF metadata (pages, title, author…) |
| `protect_pdf` | AES-256 password-protect a PDF |
| `sign_pdf` | Add a visual or cryptographic (PAdES-B-B) signature |
| `fill_pdf_form` | Fill AcroForm fields |
| `add_pdf_form_fields` | Add text/checkbox/dropdown fields |
| `list_pdf_form_fields` | List a PDF's form fields |
| `convert_pdf_to_pdfa` | Convert to archival PDF/A-1b |

**Account**

| Tool | Description |
|------|-------------|
| `get_usage` | Check API usage for the current billing period |

## Example

Once configured, just ask your agent in natural language:

> "Generate a PDF invoice for Acme Corp totaling $1,500 and give me the URL."

The agent calls `generate_pdf` with the HTML it composes and returns the hosted PDF URL. PDF-tool calls (e.g. *"merge these two PDFs"*) take base64-encoded PDFs and return a URL by default, or inline base64 if you ask for it.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DECKLE_API_KEY` | Yes | Your Deckle API key |
| `DECKLE_API_URL` | No | API URL (default: `https://api.getdeckle.dev`) |
