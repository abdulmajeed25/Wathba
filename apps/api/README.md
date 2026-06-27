# @wathba/api

NestJS backend for Wathba. PostgreSQL + Prisma + Redis (BullMQ).

## Setup

```bash
# from monorepo root
pnpm install
cd apps/api
cp .env.example .env       # fill in DATABASE_URL etc.
pnpm prisma:generate
pnpm prisma:migrate        # creates initial schema
pnpm dev                   # http://localhost:4000  (docs at /docs)
```

## Bounded contexts

```
identity            auth + Nafath KYC (Phase 1)
projects            project lifecycle (Phase 1)
rewards             reward tiers (Phase 1)
funding             pledges + FSM + deadline job (Phase 1)
escrow-payments     Moyasar Split hold/capture/refund (Phase 1)
milestones          milestones + live transparency (Phase 2)
procurement         RFQ + reverse supplier auction (Phase 3)
notifications       outbox + delivery (Phase 4)
contracts           pluggable Donation/Istisna/Salam (Phase 1, thin)
investment          DORMANT — securities, flagged OFF
```

## Money

Stored as `BigInt` halalas. **Never use floats for money.** Convert at the
API boundary via `@wathba/types`' `toSar` / `toHalalas` helpers.
