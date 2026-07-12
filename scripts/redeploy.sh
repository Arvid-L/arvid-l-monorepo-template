#!/bin/bash
# Runs ON THE SERVER (triggered by scripts/deploy-remote.sh):
# pulls latest main, rebuilds images and restarts the production stack.
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=.env.production

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ $ENV_FILE not found — run scripts/deploy-remote.sh from your machine first."
    exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

# Safety check: refuse to run anywhere but the production server. The server's
# hostname must be "<PROJECT_NAME>-<ENV_NAME>" (see docs/HETZNER-SETUP.md),
# or set EXPECTED_HOSTNAME in .env.production to override.
EXPECTED_HOSTNAME="${EXPECTED_HOSTNAME:-${PROJECT_NAME}-${ENV_NAME}}"
CURRENT_HOSTNAME=$(hostname)

if [ "$CURRENT_HOSTNAME" != "$EXPECTED_HOSTNAME" ]; then
    echo "❌ ERROR: This script only runs on the production server!"
    echo "   Current hostname:  $CURRENT_HOSTNAME"
    echo "   Expected hostname: $EXPECTED_HOSTNAME"
    echo ""
    echo "   This safety check prevents accidental data loss on dev machines."
    exit 1
fi

COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

echo "=========================================="
echo "Redeploying $PROJECT_NAME ($ENV_NAME)"
echo "=========================================="

echo "🧹 Cleaning up old Docker resources..."
docker system prune -f
docker image prune -a -f --filter "until=24h"

echo "📦 Fetching latest code from git..."
git fetch origin main
git reset --hard origin/main
git clean -fd

echo "🐋 Building images..."
$COMPOSE build

echo "🚀 Restarting containers..."
$COMPOSE up -d --remove-orphans

echo "✅ Deployment complete"
echo "=========================================="
$COMPOSE ps

echo ""
echo "📊 Disk space:"
df -h /

echo ""
echo "💡 View logs with: $COMPOSE logs -f"
