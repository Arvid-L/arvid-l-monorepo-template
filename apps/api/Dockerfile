# Build stage — compiles the API with nx/webpack.
# generatePackageJson in apps/api/webpack.config.js emits a pruned
# package.json + package-lock.json into dist/apps/api, so the runtime
# stage never needs the monorepo sources or full node_modules.
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NX_DAEMON=false
RUN npx nx build api

# Runtime stage — slim image with only the bundle + production deps.
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/dist/apps/api/package.json /app/dist/apps/api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder --chown=node:node /app/dist/apps/api .

USER node
EXPOSE 3000
CMD ["node", "main.js"]
