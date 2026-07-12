#!/bin/bash
# Trigger a remote deployment from the local machine.
# Reads DEPLOY_HOST / DEPLOY_USER / DEPLOY_PATH from .env.production and
# copies that same file to the server before running scripts/redeploy.sh there.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.production ]; then
    echo "❌ .env.production not found. Copy .env.production.example and fill it in."
    exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.production
set +a

: "${DEPLOY_HOST:?DEPLOY_HOST must be set in .env.production}"
: "${DEPLOY_USER:?DEPLOY_USER must be set in .env.production}"
: "${DEPLOY_PATH:?DEPLOY_PATH must be set in .env.production}"

echo "🚀 Deploying to $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH ..."
echo ""

scp .env.production "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/.env.production"
ssh "$DEPLOY_USER@$DEPLOY_HOST" "cd $DEPLOY_PATH && bash ./scripts/redeploy.sh"

echo ""
echo "✅ Deployment completed"
