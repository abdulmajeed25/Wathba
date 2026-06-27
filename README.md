# Wathba (وثبة)

Arabic-first, RTL-first, KSA-focused **reward-based crowdfunding** platform
with **execution-guarantee escrow**: live spending transparency +
milestone-based escrow release.

> "حوّل فكرتك إلى واقعٍ ملموس" — turn your idea into tangible reality.

## Architecture

Turborepo monorepo (pnpm workspaces):

```
apps/
  web/         Next.js 15 (App Router) + React 19 + Tailwind v4 + Radix/shadcn
  api/         NestJS 11 + Prisma + PostgreSQL + Redis (BullMQ) + Moyasar Split

packages/
  types/       Shared domain types / DTOs (money in halalas)
  ui-tokens/   Tokens extracted from the prototype — CSS variables + TS module
  config/      Shared tsconfig + Tailwind preset

WATHBAوثبة.dc.html      Design source of truth (do not delete)
support.js              Design helper (do not delete)
.thumbnail              Design thumbnail (do not delete)
```

## Quick start

```bash
pnpm install
pnpm dev          # apps/web on :3000 + apps/api on :4000
pnpm typecheck
```

`apps/web` boots at http://localhost:3000 (RTL forced).
`apps/api` boots at http://localhost:4000 (Swagger at `/docs`).

## Design source of truth

`WATHBAوثبة.dc.html` is the canonical visual prototype. All web screens
must match it 1:1 — colors, gradients, typography, card geometry, spacing.
USD shown in the prototype is converted to SAR everywhere in production.

## Funding model

`DRAFT → UNDER_REVIEW → LIVE → {SUCCESSFUL | FAILED}`
`SUCCESSFUL → FUNDED → IN_PRODUCTION → DELIVERED`
`FAILED → REFUNDED`

At deadline: if `raised ≥ goal × releaseThresholdPct/100` (default **80%**)
→ Capture all holds. Else → Refund. **Threshold is disclosed to backers
before pledging.**

## Bounded contexts

`identity` · `projects` · `rewards` · `funding` · `escrow-payments` ·
`milestones` · `procurement` · `notifications` · `contracts` (pluggable) ·
`investment` (**DORMANT** — built but feature-flagged OFF, never imported,
never shown in UI).

## Compliance

KYC via Nafath · AML/CFT · PDPL/SDAIA · ZATCA Phase 2 on platform
commission only.
