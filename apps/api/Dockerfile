# Build stage — compiles the API with nx/webpack.
# generatePackageJson in apps/api/webpack.config.js emits a pruned
# package.json + pnpm-lock.yaml into dist/apps/api, so the runtime
# stage never needs the monorepo sources or full node_modules.
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Install the pnpm version pinned in package.json's "packageManager"
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g "$(node -p 'require("./package.json").packageManager')" \
  && pnpm install --frozen-lockfile

COPY . .
ENV NX_DAEMON=false
RUN pnpm exec nx build api

# Runtime stage — slim image with only the bundle + production deps.
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# pnpm-workspace.yaml carries the allowBuilds list; without it the frozen
# install fails on the prod deps' unreviewed build scripts.
COPY --from=builder --chown=node:node /app/dist/apps/api/package.json /app/dist/apps/api/pnpm-lock.yaml ./
COPY --from=builder --chown=node:node /app/pnpm-workspace.yaml ./
# nx copies "packageManager" into the generated package.json but not the
# lockfile's matching packageManagerDependencies section, so a frozen install
# would fail on it. Install that pnpm version globally, then drop the field.
RUN npm install -g "$(node -p 'require("./package.json").packageManager')" \
  && npm pkg delete packageManager \
  && pnpm install --prod --frozen-lockfile \
  && pnpm store prune \
  && npm uninstall -g pnpm && npm cache clean --force

COPY --from=builder --chown=node:node /app/dist/apps/api .

USER node
EXPOSE 3000
CMD ["node", "main.js"]
