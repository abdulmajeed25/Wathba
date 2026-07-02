#!/usr/bin/env bash
# Nightly Postgres backup (Sprint 4 / P1-1102). Cron: 0 3 * * *
# Keeps 14 dailies. Restore: ./restore.sh <file.dump>
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL}"
: "${BACKUP_DIR:=/var/backups/wathba}"
mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/wathba-$STAMP.dump"
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$OUT"
echo "[backup] wrote $OUT ($(du -h "$OUT" | cut -f1))"
ls -1t "$BACKUP_DIR"/wathba-*.dump | tail -n +15 | xargs -r rm -v
