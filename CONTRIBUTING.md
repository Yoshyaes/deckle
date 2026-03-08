# Contributing to DocuForge

Thanks for your interest in contributing to DocuForge! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js >= 20
- pnpm 10+
- Docker (for PostgreSQL and Redis)

### Getting Started

1. Fork and clone the repository:

```bash
git clone https://github.com/docuforge/docuforge.git
cd docuforge
```

2. Install dependencies:

```bash
pnpm install
```

3. Start the local database and Redis:

```bash
docker compose up -d
```

4. Copy the environment file and configure it:

```bash
cp .env.example .env
```

5. Run database migrations:

```bash
pnpm --filter @docuforge/api db:push
```

6. Install Playwright (required for PDF rendering):

```bash
cd apps/api && npx playwright install chromium
```

7. Start the dev servers:

```bash
pnpm dev
```

This starts the API on port 3000 and the dashboard on port 3001.

## Project Structure

```
apps/
  api/          — Hono API server (PDF generation, templates, auth)
  dashboard/    — Next.js 14 dashboard
packages/
  react/        — @docuforge/react-pdf component library
  sdk-typescript/ — TypeScript SDK (npm: docuforge)
  sdk-python/   — Python SDK
  sdk-go/       — Go SDK
  sdk-ruby/     — Ruby SDK
  mcp-server/   — MCP server for AI agents
docs/           — Mintlify documentation site
```

## Running Tests

```bash
cd apps/api && npx vitest run
```

To run a specific test file:

```bash
cd apps/api && npx vitest run src/__tests__/generate-validation.test.ts
```

## Building

```bash
pnpm build
```

To build a specific package:

```bash
pnpm --filter @docuforge/react-pdf build
pnpm --filter docuforge build
```

## Contributing to `@docuforge/react-pdf`

The React component library lives in `packages/react/`. Components are in `src/components/`.

To work on it:

```bash
cd packages/react
npm run dev    # Watch mode with tsup
```

All components should:
- Accept a `style` prop for inline CSS overrides
- Use print-friendly CSS (avoid flexbox for page layout, use absolute positioning for footers)
- Be fully typed with exported prop interfaces
- Work without any runtime dependencies beyond React

## Pull Request Guidelines

1. Create a feature branch from `main`
2. Keep changes focused — one feature or fix per PR
3. Add or update tests for any new functionality
4. Make sure all tests pass before submitting
5. Update documentation if your change affects the public API
6. Write a clear PR description explaining what changed and why

## Code Style

- TypeScript strict mode
- No `any` types unless absolutely necessary
- Use existing patterns in the codebase as reference
- Prefer named exports over default exports

## Reporting Issues

- Use the GitHub issue templates (bug report or feature request)
- Include reproduction steps for bugs
- Check existing issues before creating a new one

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
