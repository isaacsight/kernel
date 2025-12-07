
# Base image
FROM node:18-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Builder stage
FROM base AS builder
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
# Set working directory
WORKDIR /app
# Install turbo global
RUN pnpm add -g turbo
COPY . .
# Prune the workspace for the specific app (debugger by default, or context-viewer)
# We will create a generic multi-stage build later, for now let's serve the debugger
RUN turbo prune --scope=debugger --docker

# Installer stage
FROM base AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app

# First install dependencies (as they change less often)
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install

# Build the project and its dependencies
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json

# Build debugger (and dependent packages)
RUN pnpm turbo run build --filter=debugger...

# Runner stage
FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=installer /app/apps/debugger/next.config.mjs .
COPY --from=installer /app/apps/debugger/package.json .

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=installer --chown=nextjs:nodejs /app/apps/debugger/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/debugger/.next/static ./apps/debugger/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/debugger/public ./apps/debugger/public

CMD ["node", "apps/debugger/server.js"]
