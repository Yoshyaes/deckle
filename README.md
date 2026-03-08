# DocuForge

**PDF generation API for developers. HTML in, pixel-perfect PDF out.**

Generate pixel-perfect PDFs from HTML or reusable templates. Full CSS support, smart page breaks, headers/footers with page numbers — all in under 3 seconds.

## Quick Start

```typescript
import { DocuForge } from 'docuforge';

const df = new DocuForge('df_live_...');

const pdf = await df.generate({
  html: '<h1>Invoice #1234</h1><p>Amount: $500</p>',
  options: { format: 'A4', margin: '1in' }
});

console.log(pdf.url);
// → https://cdn.docuforge.dev/gen_abc123.pdf
```

## Features

- **HTML → PDF** — Send any HTML, get a perfect PDF. CSS Grid, Flexbox, custom fonts all work.
- **Templates** — Design once, merge data forever. Handlebars syntax for variables, loops, conditionals.
- **Headers & Footers** — With `{{pageNumber}}` and `{{totalPages}}` interpolation.
- **Smart Page Breaks** — No orphaned headings or split table rows.
- **TypeScript & Python SDKs** — Install and generate in 4 lines of code.
- **AI-Native** — llms.txt, Cursor rules, and framework guides from day one.

## Project Structure

```
docuforge/
├── apps/
│   ├── api/          # Hono API server (Playwright rendering)
│   └── dashboard/    # Next.js dashboard (Clerk auth)
├── packages/
│   ├── sdk-typescript/   # npm: docuforge
│   └── sdk-python/       # pip: docuforge
├── docs/             # Mintlify documentation
└── public/           # llms.txt, Cursor rules
```

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL (or Neon)
- Redis (or Upstash)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Install Playwright browsers
cd apps/api && npx playwright install chromium

# Start development servers
pnpm dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values. At minimum, you need:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string

For local development, the API server falls back to local filesystem storage when R2 is not configured.

## SDKs

### TypeScript

```bash
npm install docuforge
```

### Python

```bash
pip install docuforge
```

See the [SDK documentation](https://docs.docuforge.dev/quickstart) for full usage details.

## Deployment

### Fly.io

```bash
fly launch
fly secrets set DATABASE_URL=... REDIS_URL=... R2_ACCOUNT_ID=...
fly deploy
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/generate` | Generate a PDF from HTML or template |
| GET | `/v1/generations/:id` | Get generation details |
| GET | `/v1/generations` | List generations |
| POST | `/v1/templates` | Create a template |
| GET | `/v1/templates` | List templates |
| GET | `/v1/templates/:id` | Get a template |
| PUT | `/v1/templates/:id` | Update a template |
| DELETE | `/v1/templates/:id` | Delete a template |
| GET | `/v1/usage` | Get usage stats |
| GET | `/health` | Health check |

## License

MIT
