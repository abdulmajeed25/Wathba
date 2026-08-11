#!/usr/bin/env bash
# Wathba Playwright golden-journey gate.
#
# ONE DEFINITION, used by CI and by humans. This lived as an untracked local
# script for a long time while .github/workflows/ci.yml carried its own inlined
# copy, and the two drifted: the local one raised the auth throttles because
# "86 serial specs sign in from ONE IP; default 10/min -> 429 cascade", and the
# CI one did not raise anything. Whichever of those is wrong, they cannot both
# be right, and nobody was going to notice while they were separate.
#
# Usage:
#   infra/run-e2e.sh                      # the whole suite
#   infra/run-e2e.sh e2e/arabic-search.spec.ts   # args pass through to playwright
#
# Environment (all optional; defaults suit a local box):
#   DATABASE_URL   defaults to the isolated wathba_e2e database. CI sets its
#                  own — a throwaway service container — and that wins.
#   API_PORT       default 4001        WEB_PORT   default 3123
#   E2E_LOG_DIR    where server logs land; default $TMPDIR
#
# THREE WAYS THIS REPORTED SUCCESS IT HAD NOT EARNED, all fixed below and all
# found the same afternoon:
#
#  1. It never checked the ports were free. The API died on EADDRINUSE, wait-on
#     was satisfied by whatever stranger already held the port, and the suite
#     ran against a server this script did not start — pointed at a database it
#     could not vouch for. That is how ~400 tests were certified for weeks
#     against the DEMO database while claiming isolation.
#  2. It never checked the servers it launched were still alive. A process that
#     exits immediately is indistinguishable from one that booted, as long as
#     something else answers the health check.
#  3. `echo "PLAYWRIGHT_EXIT=$?"` was the LAST command, so the script's exit
#     status was echo's. It exited 0 over a red suite, every time.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

API_PORT="${API_PORT:-4001}"
WEB_PORT="${WEB_PORT:-3123}"
LOG_DIR="${E2E_LOG_DIR:-${TMPDIR:-/tmp}}"

# The isolated database, so a local run cannot purge the demo data the site is
# served from. CI exports its own DATABASE_URL against a disposable service
# container, and that is left alone.
export DATABASE_URL="${DATABASE_URL:-postgresql://wathba:wathba@localhost:5432/wathba_e2e?schema=public}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export JWT_SECRET="${JWT_SECRET:-e2e-ci-secret-value-not-a-placeholder-000}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:${API_PORT}}"
export API_BASE_URL="${API_BASE_URL:-http://localhost:${API_PORT}}"

# EVERY THROTTLE THE SUITE TRIPS, in one place.
#
# The whole run comes from ONE IP, so every per-IP limit is shared across all
# 400 tests rather than being per spec. Left at production values the suite
# does not merely fail — it fails ORDER-DEPENDENTLY, because what fails depends
# on how much budget the specs before it happened to spend. A 429 answers
# {statusCode:429} with no payload key, so it surfaces as
# "Cannot read properties of undefined", pointing anywhere but here.
export AUTH_SIGNIN_THROTTLE_LIMIT="${AUTH_SIGNIN_THROTTLE_LIMIT:-100000}"
export AUTH_SIGNUP_THROTTLE_LIMIT="${AUTH_SIGNUP_THROTTLE_LIMIT:-100000}"
export OPS_AUTH_THROTTLE_LIMIT="${OPS_AUTH_THROTTLE_LIMIT:-100000}"
export SEARCH_THROTTLE_LIMIT="${SEARCH_THROTTLE_LIMIT:-100000}"
export SUGGEST_THROTTLE_LIMIT="${SUGGEST_THROTTLE_LIMIT:-100000}"
# .env.example: '0' = TOTP never (dev/e2e ONLY) — money-admin ops (settle /
# deadline-override) 403 without a TOTP-stepped session otherwise.
export OPS_TOTP_REQUIRED="${OPS_TOTP_REQUIRED:-0}"

API_PID=""; WEB_PID=""
cleanup() {
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null
  return 0
}
trap cleanup EXIT

# (1) Refuse to test a server we did not start.
port_holder() { ss -lptnH "sport = :$1" 2>/dev/null | sed -E 's/.*users:\(\("([^"]+)",pid=([0-9]+).*/\1 (pid \2)/'; }
if command -v ss >/dev/null 2>&1; then
  for port in "$API_PORT" "$WEB_PORT"; do
    if ss -lntH "sport = :${port}" 2>/dev/null | grep -q .; then
      echo "FATAL: port ${port} is already in use — refusing to test a server this script did not start."
      echo "       holder: $(port_holder "$port")"
      echo "       kill it, or set API_PORT / WEB_PORT to something free, then re-run."
      exit 4
    fi
  done
else
  echo "WARN: 'ss' not available — cannot verify the ports are free before booting."
fi

# (2) A health check proves SOMETHING answers. This proves it is ours.
wait_for() { # wait_for <pid> <url> <label>
  local pid="$1" url="$2" label="$3"
  npx --yes wait-on "$url" -t 60000 &
  local waiter=$!
  while kill -0 "$waiter" 2>/dev/null; do
    if ! kill -0 "$pid" 2>/dev/null; then
      kill "$waiter" 2>/dev/null
      echo "FATAL: ${label} exited during startup."
      return 1
    fi
    sleep 1
  done
  wait "$waiter" || { echo "FATAL: ${label} never became healthy at ${url}"; return 1; }
  kill -0 "$pid" 2>/dev/null || { echo "FATAL: ${label} died just after becoming healthy."; return 1; }
}

echo "== boot API :${API_PORT} =="
PORT="$API_PORT" node apps/api/dist/main.js > "${LOG_DIR}/e2e-api.log" 2>&1 &
API_PID=$!
wait_for "$API_PID" "http://localhost:${API_PORT}/v1/health/live" "API" || {
  tail -30 "${LOG_DIR}/e2e-api.log"; exit 2;
}

echo "== seed =="
node apps/api/prisma/seed-e2e.mjs || true

echo "== boot WEB :${WEB_PORT} (standalone) =="
( cd apps/web && PORT="$WEB_PORT" HOSTNAME=0.0.0.0 node .next/standalone/apps/web/server.js ) > "${LOG_DIR}/e2e-web.log" 2>&1 &
WEB_PID=$!
wait_for "$WEB_PID" "http://localhost:${WEB_PORT}/projects" "WEB" || {
  tail -30 "${LOG_DIR}/e2e-web.log"; exit 3;
}

echo "== run playwright =="
cd apps/web
E2E_WEB_URL="http://localhost:${WEB_PORT}" E2E_API_URL="http://localhost:${API_PORT}" \
  pnpm exec playwright test "$@"
# (3) Capture it BEFORE anything else runs, and exit with it. The echo is for a
# human reading the log; the exit code is what any caller gates on.
PW_EXIT=$?
echo "PLAYWRIGHT_EXIT=${PW_EXIT}"
exit "$PW_EXIT"
