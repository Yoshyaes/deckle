# Deckle

**The PDF generation API for developers.** HTML in, pixel-perfect PDF out — in under 3 seconds.

```typescript
import { Deckle } from '@getdeckle/sdk';

const deckle = new Deckle('dk_live_...');

const pdf = await deckle.generate({
  html: '<h1>Invoice #1234</h1><p>Amount due: $500</p>',
  options: { format: 'A4', margin: '1in' },
});

console.log(pdf.url); // → a hosted PDF, ready to download
```

Full CSS support (Grid, Flexbox, custom fonts), smart page breaks, and headers/footers with `{{pageNumber}}` / `{{totalPages}}` interpolation.

## Install

```bash
npm install @getdeckle/sdk     # TypeScript / JavaScript
pip install deckle             # Python
gem install deckle             # Ruby
go get github.com/Yoshyaes/deckle/packages/sdk-go  # Go
```

Get an API key at [app.getdeckle.dev](https://app.getdeckle.dev).

## Templates

Design once, merge data forever. Templates use Handlebars syntax (`{{variable}}`, `{{#each}}`, `{{#if}}`).

```typescript
const pdf = await deckle.fromTemplate({
  template: 'tmpl_abc123',
  data: { name: 'Acme Corp', amount: 500 },
});
```

## SDKs

| Language | Package | Class |
|----------|---------|-------|
| TypeScript | [`@getdeckle/sdk`](https://www.npmjs.com/package/@getdeckle/sdk) | `Deckle` |
| React | [`@getdeckle/react-pdf`](https://www.npmjs.com/package/@getdeckle/react-pdf) | components |
| Python | [`deckle`](https://pypi.org/project/deckle/) | `Deckle` |
| Ruby | [`deckle`](https://rubygems.org/gems/deckle) | `Deckle` |
| Go | [`.../deckle/packages/sdk-go`](https://pkg.go.dev/github.com/Yoshyaes/deckle/packages/sdk-go) | functional options |

All SDKs return the same shape: `{ id, status, url, pages, file_size, generation_time_ms }`.

## Self-hosting

```bash
docker compose -f docker-compose.selfhost.yml up -d
```

Runs the API with Postgres and Redis. See [docs.getdeckle.dev](https://docs.getdeckle.dev) for storage (R2/S3/GCS) and scaling config.

## Local development

Requires Node 20+, pnpm 9+, PostgreSQL, and Redis.

```bash
pnpm install
cp .env.example .env                          # set DATABASE_URL + REDIS_URL
cd apps/api && npx playwright install chromium # one-time, for rendering
pnpm dev                                       # API :3000, dashboard :3001
```

This is a pnpm + Turborepo monorepo:

```
apps/
  api/          Hono API server, Playwright HTML→PDF rendering
  dashboard/    Next.js dashboard (Clerk auth)
  web/          Marketing site
packages/
  sdk-typescript, sdk-python, sdk-go, sdk-ruby
  react/        @getdeckle/react-pdf components
  mcp-server/   MCP server for AI agents
docs/           Mintlify documentation
```

## Docs

- **Quickstart & guides:** [docs.getdeckle.dev](https://docs.getdeckle.dev)
- **API reference:** every route is under `/v1/*` — generate, templates, PDF tools (merge/split/sign/forms), and marketplace.

## License

MIT
