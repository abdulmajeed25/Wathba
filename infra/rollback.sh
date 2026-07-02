#!/usr/bin/env bash
# Wathba rollback (Sprint 4 / P0-1101): re-deploy the previously recorded tag.
# NOTE: migrations are forward-only (expand→contract discipline) — rolling
# back the app does NOT undo schema changes; write additive migrations.
set -euo pipefail
cd "$(dirname "$0")"
PREV=$(cat .last-deployed-tag 2>/dev/null | cut -d: -f2)
if [ -z "${PREV:-}" ]; then
  echo "no recorded previous tag (.last-deployed-tag missing)" >&2
  exit 1
fi
echo "[rollback] reverting to tag=$PREV"
TAG=$PREV docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
curl -sf http://127.0.0.1:4000/v1/health/ready && echo "[rollback] READY on $PREV"
