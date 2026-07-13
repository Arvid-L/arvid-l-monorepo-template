#!/bin/bash
# Runs ON THE SERVER: dumps the production database to a gzipped file and
# rotates old backups. Install as a daily cron (see docs/HETZNER-SETUP.md):
#   crontab -e
#   30 3 * * * /opt/<project>/scripts/backup-db.sh >> /var/log/db-backup.log 2>&1
#
# Off-site copies: set BACKUP_REMOTE in .env.production to any rsync/scp
# target (e.g. a Hetzner Storage Box: u123456@u123456.your-storagebox.de:backups)
# and each dump is pushed there after being written locally.
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=.env.production

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ $ENV_FILE not found — nothing to back up here."
    exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/${PROJECT_NAME}}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
DB_CONTAINER="${PROJECT_NAME}-db-${ENV_NAME:-prod}"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/${DATABASE_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "📦 Dumping $DATABASE_NAME from $DB_CONTAINER..."
# pg_dump inside the container; plain-SQL format piped through gzip so the
# dump is restorable with nothing but psql.
docker exec "$DB_CONTAINER" pg_dump -U "$DATABASE_USER" --clean --if-exists "$DATABASE_NAME" \
    | gzip > "$BACKUP_FILE"

# An empty/failed dump must not silently rotate away good backups
if [ ! -s "$BACKUP_FILE" ]; then
    echo "❌ Backup file is empty — keeping old backups, aborting."
    rm -f "$BACKUP_FILE"
    exit 1
fi

echo "✅ Backup written: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

echo "🧹 Rotating backups older than $BACKUP_KEEP_DAYS days..."
find "$BACKUP_DIR" -name '*.sql.gz' -mtime "+$BACKUP_KEEP_DAYS" -delete

if [ -n "${BACKUP_REMOTE:-}" ]; then
    echo "☁️  Pushing to $BACKUP_REMOTE..."
    if command -v rsync >/dev/null 2>&1; then
        rsync -az "$BACKUP_FILE" "$BACKUP_REMOTE/"
    else
        scp -q "$BACKUP_FILE" "$BACKUP_REMOTE/"
    fi
    echo "✅ Off-site copy done"
fi

echo "📊 Current backups:"
ls -lh "$BACKUP_DIR" | tail -n +2
