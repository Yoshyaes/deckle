# @docuforge/mcp-server

MCP (Model Context Protocol) server for DocuForge PDF generation. Enables AI agents like Claude Desktop and Cursor to generate PDFs directly.

## Setup

### Claude Desktop

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "docuforge": {
      "command": "npx",
      "args": ["@docuforge/mcp-server"],
      "env": {
        "DOCUFORGE_API_KEY": "df_live_..."
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
    "docuforge": {
      "command": "npx",
      "args": ["@docuforge/mcp-server"],
      "env": {
        "DOCUFORGE_API_KEY": "df_live_..."
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
    "docuforge": {
      "command": "npx",
      "args": ["@docuforge/mcp-server"],
      "env": {
        "DOCUFORGE_API_KEY": "df_live_..."
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `generate_pdf` | Generate PDF from HTML |
| `generate_pdf_react` | Generate PDF from a React component |
| `generate_pdf_template` | Generate PDF from a saved template |
| `list_templates` | List your saved templates |
| `create_template` | Create a new Handlebars template |
| `get_usage` | Check API usage stats |
| `list_starter_templates` | Browse pre-built starter templates |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DOCUFORGE_API_KEY` | Yes | Your DocuForge API key |
| `DOCUFORGE_API_URL` | No | API URL (default: `https://api.docuforge.dev`) |
