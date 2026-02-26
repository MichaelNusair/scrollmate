FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/web/package.json ./packages/web/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/ ./packages/shared/
COPY packages/web/ ./packages/web/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/web/node_modules ./packages/web/node_modules

RUN pnpm --filter @scrollmate/shared build
RUN pnpm --filter @scrollmate/web exec prisma generate
RUN pnpm --filter @scrollmate/web build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/packages/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/.next/static ./packages/web/.next/static
COPY --from=builder /app/packages/web/prisma ./prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "packages/web/server.js"]
