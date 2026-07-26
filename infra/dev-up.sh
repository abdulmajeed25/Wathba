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
# ── web: two modes, and they cannot coexist ────────────────────────────────
# `next dev` and `next build` share .next, and `next dev` has no --dist-dir,
# so starting dev mode DESTROYS the production build. Hence an explicit knob
# instead of a silent default:
#
#   ./infra/dev-up.sh                 prod build via the standalone server
#   WEB_MODE=dev ./infra/dev-up.sh    next dev (overwrites .next)
#
# Why it matters which one runs: every production runner forces
# NODE_ENV=production — `next start` sets it, and the generated
# .next/standalone/apps/web/server.js hardcodes it on line 5. All three
# cookie setters are `secure: NODE_ENV === 'production'`, so in prod mode
# wathba_session / wathba_ops_session come back Secure, and no browser stores
# a Secure cookie over plain http://<ip>. Over the public IP that means
# anonymous browsing works but sign-in and /ops do not. Two ways round it:
# reach the site as http://localhost:3000 through an SSH tunnel (browsers
# treat localhost as a trustworthy origin and do keep Secure cookies there),
# or run WEB_MODE=dev. The real fix is TLS in front, after which prod mode is
# correct with no caveat.
if [[ "${WEB_MODE:-prod}" == "dev" ]]; then
  echo "WEB_MODE=dev — this overwrites the production build in .next"
  tmux new-session -d -s web -c "$ROOT/apps/web" "npx next dev -p 3000 -H 0.0.0.0 2>&1 | tee $LOGS/web.log"
else
  # Rebuild only if the artifact is missing (e.g. a previous dev-mode run ate
  # it). The standalone bundle ships without static assets, so stage them.
  if [[ ! -f "$ROOT/apps/web/.next/standalone/apps/web/server.js" ]]; then
    echo "no production build found — running next build (a few minutes)"
    (cd "$ROOT/apps/web" && npx next build)
  fi
  cp -r "$ROOT/apps/web/.next/static" "$ROOT/apps/web/.next/standalone/apps/web/.next/static" 2>/dev/null || true
  cp -r "$ROOT/apps/web/public" "$ROOT/apps/web/.next/standalone/apps/web/public" 2>/dev/null || true
  tmux new-session -d -s web -c "$ROOT/apps/web" \
    "PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/apps/web/server.js 2>&1 | tee $LOGS/web.log"
fi

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
if [[ "${WEB_MODE:-prod}" != "dev" ]]; then
  echo
  echo "  web is in PROD mode: session cookies are Secure, so sign-in and /ops"
  echo "  need either TLS or a tunnel:  ssh -L 3000:127.0.0.1:3000 root@$IP"
  echo "  then browse http://localhost:3000/ops   (or: WEB_MODE=dev $0)"
fi
