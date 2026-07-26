#!/usr/bin/env bash
# Wathba — bring the whole dev stack up in one command.
#
#   ./infra/dev-up.sh          start everything
#   ./infra/dev-up.sh down     stop everything
#
# Services land in their own tmux session (api / web / studio); logs stream to
# /tmp/run-logs/<name>.log. Postgres, Redis and MinIO run as docker containers.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS=/tmp/run-logs
MINIO_PW="${MINIO_ROOT_PASSWORD:-$(grep -E '^MINIO_SECRET_KEY=' "$ROOT/apps/api/.env" | cut -d= -f2)}"

if [[ "${1:-up}" == "down" ]]; then
  tmux kill-session -t api 2>/dev/null || true
  tmux kill-session -t web 2>/dev/null || true
  tmux kill-session -t studio 2>/dev/null || true
  docker stop wathba-dev-minio wathba-dev-redis wathba-dev-postgres >/dev/null 2>&1 || true
  echo "stopped: tmux sessions + docker containers"
  exit 0
fi

mkdir -p "$LOGS"

# ── backing services ────────────────────────────────────────────────────────
docker start wathba-dev-postgres wathba-dev-redis wathba-dev-minio >/dev/null 2>&1 || true
# MinIO is the one that may not exist yet on a fresh box.
if ! docker ps -a --format '{{.Names}}' | grep -qx wathba-dev-minio; then
  docker run -d --name wathba-dev-minio --restart unless-stopped \
    -p 0.0.0.0:9000:9000 -p 0.0.0.0:9001:9001 \
    -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD="$MINIO_PW" \
    -v wathba-miniodata:/data minio/minio:latest server /data --console-address ":9001" >/dev/null
  sleep 6
  docker exec wathba-dev-minio mc alias set local http://127.0.0.1:9000 minioadmin "$MINIO_PW" >/dev/null
  docker exec wathba-dev-minio mc mb --ignore-existing local/venture-evidence >/dev/null
fi

# Postgres needs a moment before the API's first query.
until docker exec wathba-dev-postgres pg_isready -U wathba >/dev/null 2>&1; do sleep 1; done

# ── app processes ───────────────────────────────────────────────────────────
tmux kill-session -t api 2>/dev/null || true
tmux kill-session -t web 2>/dev/null || true
tmux kill-session -t studio 2>/dev/null || true

tmux new-session -d -s api    -c "$ROOT/apps/api" "npx nest start --path tsconfig.json 2>&1 | tee $LOGS/api.log"
tmux new-session -d -s studio -c "$ROOT/apps/api" "npx prisma studio --port 5555 --browser none 2>&1 | tee $LOGS/studio.log"
# `next dev`, NOT `next start`, and the reason matters: every production
# runner (`next start`, and the generated .next/standalone/server.js, which
# hardcodes it on line 5) forces NODE_ENV=production. All three cookie
# setters are `secure: NODE_ENV === 'production'`, so in production mode the
# session cookies come back Secure — and no browser stores a Secure cookie
# over plain http://<ip>. That makes sign-in and the whole /ops surface
# unusable from anywhere but this box until TLS is in front. Dev mode keeps
# the stack browser-usable over the public IP; switch back to `next start`
# (after `npx next build`) once there is a real HTTPS front door.
tmux new-session -d -s web    -c "$ROOT/apps/web" "npx next dev -p 3000 -H 0.0.0.0 2>&1 | tee $LOGS/web.log"

# ── readiness ───────────────────────────────────────────────────────────────
printf 'waiting for api + web'
until curl -sf -m 3 -o /dev/null http://127.0.0.1:4000/v1/health \
   && curl -s  -m 3 -o /dev/null http://127.0.0.1:3000/projects; do printf '.'; sleep 2; done
echo ' ready'

IP=$(curl -s -4 -m 5 ifconfig.me || echo 127.0.0.1)
echo "  web    http://$IP:3000/projects"
echo "  ops    http://$IP:3000/ops"
echo "  api    http://$IP:4000/v1/health"
echo "  docs   http://$IP:4000/docs"
echo "  minio  http://$IP:9001  (console)"
echo "  studio http://127.0.0.1:5555  (localhost only — tunnel to reach it)"
