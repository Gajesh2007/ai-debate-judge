# Build stage
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# Production stage
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

# Runtime config
ENV PORT=3001 \
    NODE_ENV=production \
    # pg-ecdsa-proxy connection (preferred)
    PG_HOST= \
    PG_PORT=5433 \
    PG_DATABASE=postgres

EXPOSE 3001

CMD ["node", "dist/index.js"]
