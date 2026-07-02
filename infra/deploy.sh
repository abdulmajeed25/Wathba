#!/usr/bin/env bash
# Wathba deploy (Sprint 4 / P0-1101): build → migrate → swap.
# Usage: TAG=$(git rev-parse --short HEAD) ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
: "${TAG:=$(git -C .. rev-parse --short HEAD)}"
export TAG

echo "[deploy] building images tag=$TAG"
docker compose -f docker-compose.prod.yml --env-file .env.prod build

echo "[deploy] running prisma migrate deploy"
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm api \
  npx prisma migrate deploy --schema prisma/schema.prisma

echo "[deploy] recording current tag for rollback"
docker compose -f docker-compose.prod.yml --env-file .env.prod ps --format json api 2>/dev/null \
  | grep -oE 'wathba-api:[a-z0-9]+' | head -1 > .last-deployed-tag || true

echo "[deploy] swapping containers"
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

echo "[deploy] waiting for readiness"
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:4000/v1/health/ready > /dev/null; then
    echo "[deploy] READY — tag=$TAG live"
    exit 0
  fi
  sleep 2
done
echo "[deploy] FAILED readiness — run ./rollback.sh" >&2
exit 1
