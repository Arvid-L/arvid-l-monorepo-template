#!/bin/bash
# One-time TLS bootstrap — runs ON THE SERVER.
# Prerequisites: DNS A record for $DOMAIN points at this server, stack
# deployed at least once (HTTP-only), ports 80/443 open.
#
# What it does:
#   1. ensures nginx is up serving the ACME challenge webroot over HTTP
#   2. issues a Let's Encrypt certificate for $DOMAIN via certbot (webroot)
#   3. switches nginx to the HTTPS config (NGINX_TEMPLATES=templates-tls)
#      and enables the certbot auto-renewal service (COMPOSE_PROFILES=tls)
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=.env.production

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ $ENV_FILE not found — deploy first (scripts/deploy-remote.sh)."
    exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

: "${DOMAIN:?DOMAIN must be set in .env.production}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL must be set in .env.production}"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

echo "🌐 Ensuring nginx is up for the ACME HTTP challenge..."
$COMPOSE up -d nginx

echo "🔐 Requesting Let's Encrypt certificate for $DOMAIN ..."
$COMPOSE run --rm --entrypoint certbot certbot certonly \
    --webroot -w /var/www/certbot \
    -d "$DOMAIN" \
    --email "$LETSENCRYPT_EMAIL" \
    --agree-tos --no-eff-email \
    --keep-until-expiring

echo "🔧 Switching to HTTPS config + enabling auto-renewal..."
sed -i 's/^NGINX_TEMPLATES=.*/NGINX_TEMPLATES=templates-tls/' "$ENV_FILE"
sed -i 's/^COMPOSE_PROFILES=.*/COMPOSE_PROFILES=tls/' "$ENV_FILE"
grep -q '^NGINX_TEMPLATES=' "$ENV_FILE" || echo 'NGINX_TEMPLATES=templates-tls' >> "$ENV_FILE"
grep -q '^COMPOSE_PROFILES=' "$ENV_FILE" || echo 'COMPOSE_PROFILES=tls' >> "$ENV_FILE"

# Compose gives OS environment precedence over --env-file: the values sourced
# at the top of this script would silently override the file edits above.
export NGINX_TEMPLATES=templates-tls
export COMPOSE_PROFILES=tls

$COMPOSE --profile tls up -d --force-recreate nginx certbot

echo "✅ TLS active — https://$DOMAIN"
echo "   Certificates auto-renew via the certbot service; nginx reloads every 6h."
