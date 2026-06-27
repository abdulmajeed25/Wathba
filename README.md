# Wathba (وثبة)

Arabic-first, RTL, KSA-focused **reward-based crowdfunding** platform with
**execution-guarantee escrow**: live spending transparency + milestone-based
escrow release.

> "حوّل فكرتك إلى واقعٍ ملموس" — turn your idea into tangible reality.

## Architecture

Turborepo monorepo (pnpm workspaces):

```
apps/
  mobile/      React Native + Expo (TypeScript) — the client
  api/         NestJS (TypeScript) backend

packages/
  types/       Shared domain types / DTOs
  ui-tokens/   Design tokens extracted from the prototype
  config/      Shared tsconfig + eslint + prettier
```

**Mobile:** Expo SDK 52, RTL forced, dual theme (light/dark), Arabic fonts (IBM Plex Sans Arabic + Space Grotesk + Material Symbols Rounded).
**Backend:** NestJS + PostgreSQL (pgvector) + Redis + BullMQ + Moyasar Split.

## Quick start

```bash
pnpm install
pnpm dev          # turbo run dev — boots api + mobile
pnpm typecheck    # all packages
pnpm lint
```

## Design source of truth

`design/wathba.dc.html` is the canonical visual prototype. All screens must
match it visually 1:1 (in React Native), with the same fonts, colors, and
layout. Convert USD → SAR everywhere.

## Funding model (the differentiator)

`DRAFT → UNDER_REVIEW → LIVE → {SUCCESSFUL|FAILED}`
`SUCCESSFUL → FUNDED → IN_PRODUCTION → DELIVERED`
`FAILED → REFUNDED`

At deadline: if `raised ≥ goal × releaseThresholdPct/100` (default 80%) →
Capture all holds. Else → Refund. **Disclosed to backers before pledging.**

## Bounded contexts

`identity` · `projects` · `rewards` · `funding` · `escrow-payments` ·
`milestones` · `procurement` · `notifications` · `contracts` (pluggable) ·
`investment` (**DORMANT** — built but feature-flagged OFF, never imported,
never shown in UI).

## Compliance

KYC via Nafath · AML/CFT on collection/distribution · PDPL/SDAIA data
protection · ZATCA Phase 2 e-invoice on **platform commission only** (not
the pledge amount).
