# Build stage — compiles the Angular app.
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Install the pnpm version pinned in package.json's "packageManager"
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g "$(node -p 'require("./package.json").packageManager')" \
  && pnpm install --frozen-lockfile

COPY . .
ENV NX_DAEMON=false
RUN pnpm exec nx build frontend

# Runtime stage — nginx serving the static bundle with SPA fallback.
# This is the app-internal nginx; the public-facing reverse proxy lives
# in infrastructure/nginx and proxies to this container on port 80.
FROM nginx:alpine AS production
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/apps/frontend/browser /usr/share/nginx/html
EXPOSE 80
