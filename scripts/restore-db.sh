#!/bin/bash
# Runs ON THE SERVER: restores a backup produced by scripts/backup-db.sh
# into the production database. DESTRUCTIVE — the dump's --clean flags drop
# and recreate all tables it contains.
#
# Usage: ./scripts/restore-db.sh /var/backups/<project>/<db>_<timestamp>.sql.gz
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=.env.production
BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file.sql.gz>"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ $ENV_FILE not found."
    exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

DB_CONTAINER="${PROJECT_NAME}-db-${ENV_NAME:-prod}"
API_CONTAINER="${PROJECT_NAME}-api-${ENV_NAME:-prod}"

echo "⚠️  About to restore into $DATABASE_NAME on $DB_CONTAINER"
echo "   from: $BACKUP_FILE"
echo "   This DROPS the current tables. Press Enter to continue, Ctrl-C to abort."
read -r

# Stop the API while tables are dropped/recreated under it
echo "🛑 Stopping API..."
docker stop "$API_CONTAINER" >/dev/null

echo "📥 Restoring..."
gunzip -c "$BACKUP_FILE" \
    | docker exec -i "$DB_CONTAINER" psql -U "$DATABASE_USER" -d "$DATABASE_NAME" \
        --set ON_ERROR_STOP=on --quiet

echo "🚀 Starting API..."
docker start "$API_CONTAINER" >/dev/null

echo "✅ Restore complete. Check: docker logs -f $API_CONTAINER"
