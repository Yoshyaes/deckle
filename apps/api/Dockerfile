# ── Stage 1: Build ──
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy workspace root files and all package.json manifests (pnpm needs them)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/sdk-typescript/package.json packages/sdk-typescript/

# Install dependencies for the API workspace
RUN pnpm install --frozen-lockfile --filter @docuforge/api...

# Copy API source
COPY apps/api/ apps/api/

# Build the API
RUN pnpm --filter @docuforge/api build

# ── Stage 2: Production ──
FROM node:20-slim

# Install Chromium system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  libnss3 \
  libatk-bridge2.0-0 \
  libdrm2 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpango-1.0-0 \
  libcairo2 \
  libxshmfence1 \
  libx11-xcb1 \
  libxcb-dri3-0 \
  libdbus-1-3 \
  libatspi2.0-0 \
  libcups2 \
  fonts-liberation \
  fonts-noto-color-emoji \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install Playwright Chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy workspace root files for pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/sdk-typescript/package.json packages/sdk-typescript/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod --filter @docuforge/api...

# Copy built output from builder stage
COPY --from=builder /app/apps/api/dist apps/api/dist

# Copy public assets (llms.txt etc.)
COPY public ./public

# Copy migration files
COPY apps/api/drizzle apps/api/drizzle

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/apps/api

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) })"

CMD ["node", "dist/index.js"]
