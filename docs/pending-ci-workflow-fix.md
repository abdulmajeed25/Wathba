# Pending: the CI workflow fix

`.github/workflows/ci.yml` on `wathba-main` is missing three fixes. This file
carries them until someone with `workflow` scope can apply them.

**Why it lives in `docs/` instead of being applied.** GitHub refuses any write to
`.github/workflows/` from a token without the `workflow` scope — `git push`, SSH
and the REST contents API all reject it identically. The agent working on this
had `gist, read:org, repo`. Rather than leave the fix on a local branch that a
box wipe would take (this project has lost local-only branches that way before),
it is committed here, where pushing is allowed.

## Why it matters

**A red CI run on this repo is not evidence about the change under review.** The
`verify` job fails on its own missing env before it reaches anything meaningful,
and the `e2e` job rate-limits itself. Every merge since 2026-07-26 has landed on
locally-observed green suites because the pipeline could not give a verdict.

## The three fixes

### 1. `Build Web` has no `NEXT_PUBLIC_API_URL`

`next.config.ts` calls `validateEnv()`, which **throws** on a missing
`NEXT_PUBLIC_API_URL` when `NODE_ENV=production` — which is what `next build`
sets. `apps/web/.env` is gitignored, so CI never had one. Reproduced by hiding
that file locally: `[env] invalid web environment: NEXT_PUBLIC_API_URL: Required`.
The step cannot have been passing. Nothing is served from this job, so the value
only has to be a valid URL.

### 2. `Typecheck Web` never checked the e2e specs

It ran `pnpm --filter @wathba/web exec tsc --noEmit`, which reads `tsconfig.json`
only. A spec with an outright syntax error passed this step. The package's
`typecheck` script runs both projects.

`tsconfig.e2e.json` must stay a separate project — merging it into
`tsconfig.json` would put Playwright specs into the production build's typecheck
and force `noUncheckedIndexedAccess` off for `src`, which accounted for 90 of the
103 errors it originally exposed.

### 3. The `e2e` job throttles itself

The suite signs up a fresh user per journey against defaults of 5 signups and 10
signins a minute, so the run rate-limits itself and the 429s read as product
bugs. The four knobs exist for exactly this and are what the local golden stack
uses.

### Not here: the static-asset copy

A fourth gap — CI booting `.next/standalone/apps/web/server.js` without
`.next/static` or `public/`, so every script 404s and nothing hydrates — was
fixed in the web build instead (`apps/web/scripts/copy-standalone-assets.mjs`,
PR #106). That fixes CI, the deploy and local standalone runs at once, where a
workflow-level `cp` would have fixed only CI.

## How to apply

Replace `.github/workflows/ci.yml` with the file below, or apply the diff. Then
delete this doc.

```
https://github.com/abdulmajeed25/Wathba/edit/wathba-main/.github/workflows/ci.yml
```

Verify it landed:

```sh
gh api "repos/abdulmajeed25/Wathba/commits?path=.github/workflows/ci.yml&per_page=1" \
  -q '.[0].commit.author.date'
```

Anything other than `2026-07-02T19:28:12Z` means it applied.

## The diff

```diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 0e792c7..b6b3df8 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -14,6 +14,13 @@ jobs:
     name: typecheck · lint · test · build · audit
     runs-on: ubuntu-latest
     timeout-minutes: 20
+    # `Build Web` runs next.config.ts, which calls validateEnv() — and that
+    # THROWS on a missing NEXT_PUBLIC_API_URL when NODE_ENV=production, which is
+    # what `next build` sets. apps/web/.env is gitignored, so CI has none and
+    # the step failed with "[env] invalid web environment: Required". Nothing is
+    # served from this job, so the value only has to be a valid URL.
+    env:
+      NEXT_PUBLIC_API_URL: http://localhost:4000
     steps:
       - uses: actions/checkout@v4
 
@@ -34,8 +41,12 @@ jobs:
       - name: Typecheck API
         run: pnpm --filter @wathba/api exec tsc --noEmit
 
+      # `exec tsc --noEmit` reads tsconfig.json ONLY, so no e2e spec was ever
+      # typechecked — a spec with an outright syntax error passed this step. The
+      # package script runs src AND tsconfig.e2e.json, which is a separate
+      # project on purpose and must not be merged into the first.
       - name: Typecheck Web
-        run: pnpm --filter @wathba/web exec tsc --noEmit
+        run: pnpm --filter @wathba/web typecheck
 
       - name: Lint API
         run: pnpm --filter @wathba/api lint
@@ -93,7 +104,15 @@ jobs:
         run: pnpm --filter @wathba/api build && pnpm --filter @wathba/web build
       - name: Boot API + Web, seed, run journeys
         run: |
-          PORT=4001 node apps/api/dist/main.js & echo $! > /tmp/api.pid
+          # The suite signs up a fresh user per journey against defaults of 5
+          # signups and 10 signins a minute, so the run throttles ITSELF and the
+          # 429s read as product bugs. These knobs exist for exactly this.
+          PORT=4001 \
+          THROTTLE_LIMIT=2000 \
+          AUTH_SIGNIN_THROTTLE_LIMIT=400 \
+          AUTH_SIGNUP_THROTTLE_LIMIT=400 \
+          OPS_AUTH_THROTTLE_LIMIT=400 \
+          node apps/api/dist/main.js & echo $! > /tmp/api.pid
           npx --yes wait-on http://localhost:4001/v1/health/live -t 60000
           # minimal seed: an admin/creator the journeys rely on
           node apps/api/prisma/seed-e2e.mjs || true
```

## The complete file

```yaml
name: CI

on:
  push:
    branches: [main, wathba-main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    name: typecheck · lint · test · build · audit
    runs-on: ubuntu-latest
    timeout-minutes: 20
    # `Build Web` runs next.config.ts, which calls validateEnv() — and that
    # THROWS on a missing NEXT_PUBLIC_API_URL when NODE_ENV=production, which is
    # what `next build` sets. apps/web/.env is gitignored, so CI has none and
    # the step failed with "[env] invalid web environment: Required". Nothing is
    # served from this job, so the value only has to be a valid URL.
    env:
      NEXT_PUBLIC_API_URL: http://localhost:4000
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        # version is read from the root package.json "packageManager" field

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Prisma generate (API client types)
        run: pnpm --filter @wathba/api prisma:generate

      - name: Typecheck API
        run: pnpm --filter @wathba/api exec tsc --noEmit

      # `exec tsc --noEmit` reads tsconfig.json ONLY, so no e2e spec was ever
      # typechecked — a spec with an outright syntax error passed this step. The
      # package script runs src AND tsconfig.e2e.json, which is a separate
      # project on purpose and must not be merged into the first.
      - name: Typecheck Web
        run: pnpm --filter @wathba/web typecheck

      - name: Lint API
        run: pnpm --filter @wathba/api lint

      - name: Lint Web
        run: pnpm --filter @wathba/web lint

      - name: Test API
        run: pnpm --filter @wathba/api test

      - name: Build Web
        run: pnpm --filter @wathba/web build

      # Gate on critical advisories today; tighten to `high` once the
      # multer transitive advisory (logged in Sprint-0) is resolved.
      - name: Audit (prod deps, critical)
        run: pnpm audit --prod --audit-level critical

  e2e:
    name: playwright golden journeys
    runs-on: ubuntu-latest
    timeout-minutes: 25
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: wathba
          POSTGRES_PASSWORD: wathba
          POSTGRES_DB: wathba
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U wathba" --health-interval 10s
          --health-timeout 5s --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    env:
      DATABASE_URL: postgresql://wathba:wathba@localhost:5432/wathba?schema=public
      REDIS_URL: redis://localhost:6379
      JWT_SECRET: e2e-ci-secret-value-not-a-placeholder-000
      NEXT_PUBLIC_API_URL: http://localhost:4001
      API_BASE_URL: http://localhost:4001
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @wathba/api prisma:generate
      - run: pnpm --filter @wathba/api exec prisma migrate deploy
      - run: pnpm --filter @wathba/web exec playwright install --with-deps chromium
      - name: Build API + Web
        run: pnpm --filter @wathba/api build && pnpm --filter @wathba/web build
      - name: Boot API + Web, seed, run journeys
        run: |
          # The suite signs up a fresh user per journey against defaults of 5
          # signups and 10 signins a minute, so the run throttles ITSELF and the
          # 429s read as product bugs. These knobs exist for exactly this.
          PORT=4001 \
          THROTTLE_LIMIT=2000 \
          AUTH_SIGNIN_THROTTLE_LIMIT=400 \
          AUTH_SIGNUP_THROTTLE_LIMIT=400 \
          OPS_AUTH_THROTTLE_LIMIT=400 \
          node apps/api/dist/main.js & echo $! > /tmp/api.pid
          npx --yes wait-on http://localhost:4001/v1/health/live -t 60000
          # minimal seed: an admin/creator the journeys rely on
          node apps/api/prisma/seed-e2e.mjs || true
          (cd apps/web && PORT=3123 node .next/standalone/apps/web/server.js) & echo $! > /tmp/web.pid
          npx --yes wait-on http://localhost:3123/projects -t 60000
          cd apps/web && E2E_WEB_URL=http://localhost:3123 E2E_API_URL=http://localhost:4001 pnpm exec playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
```
