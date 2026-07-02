#!/usr/bin/env bash
# Restore a backup into a FRESH database and verify before switching over
# (Sprint 4 / P1-1102). Usage: ./restore.sh <file.dump> <target_database_url>
set -euo pipefail
DUMP=${1:?usage: restore.sh <file.dump> <target_database_url>}
TARGET=${2:?usage: restore.sh <file.dump> <target_database_url>}
pg_restore --no-owner --clean --if-exists --dbname="$TARGET" "$DUMP"
echo "[restore] done — verify row counts, then repoint DATABASE_URL"
psql "$TARGET" -c 'SELECT count(*) AS users FROM "User"; SELECT count(*) AS pledges FROM "Pledge"; SELECT count(*) AS ledger FROM "LedgerEntry";'
