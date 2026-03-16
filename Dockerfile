FROM node:20-slim AS base

# Install Playwright system dependencies + fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    fonts-noto-color-emoji \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm (pinned version)
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy package.json files for workspaces needed by the API
COPY apps/api/package.json apps/api/
COPY packages/sdk-typescript/package.json packages/sdk-typescript/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy root tsconfig (extended by apps/api/tsconfig.json)
COPY tsconfig.json ./

# Copy source code
COPY apps/api/ apps/api/
COPY packages/sdk-typescript/ packages/sdk-typescript/

# Build the API
RUN pnpm --filter @docuforge/api build

# Install Playwright Chromium
RUN cd apps/api && pnpm exec playwright install chromium

RUN groupadd -r docuforge && useradd -r -g docuforge -d /app docuforge
RUN chown -R docuforge:docuforge /app
USER docuforge

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => { if (!r.ok) process.exit(1) })" || exit 1

CMD ["node", "apps/api/dist/index.js"]
