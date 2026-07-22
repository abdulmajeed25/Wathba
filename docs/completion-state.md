# Wathba — Completion State

*Snapshot: 2026-07-22 · `wathba-main` @ `93ed37a`. Companion to `distance-to-launch.md`, `launch-punchlist.md`, and `ops360-census.md`.*

**The code is essentially launch-ready.** 52 PRs merged, 53 migrations, **78 governed operations**, **634 API tests green**, web production build green. The distance to launch is now **external procurement + a TLS front door**, not engineering.

## Done & merged — the whole product + a world-class Operations Center

- **Consumer / creator / supplier product** — complete: discovery, pledges + BNPL, escrow, milestones, payouts, identity/PDPL, comms, magazine home, campaign tabs.
- **Money safety** — capture-at-deadline, grace/reauth, refunds (single + bulk), disputes, DB-enforced append-only ledger, hash-chained audit, SYSTEM audit trails on every money cron/webhook + the Nafath KYC flip. Both P0 security holes fixed (BNPL rawBody HMAC, media cross-tenant delete). Moyasar/Nafath/webhook prod-refusal guards (fail loud, never fabricate).
- **Operations Center — ≈90%+ platform coverage** (up from a ~56% census baseline): 78 governed operations + ~45 read endpoints, 20 operator screens, an alerts/anomaly center, read-only impersonation, an analytics surface, a four-eyes appeals workflow, an email-template CMS + per-notification-kind toggles, and DB-backed maintenance mode. Governance holds throughout: registry-only writes (lint-enforced), CREATOR-NO-MONEY, four-eyes on money, step-up on MONEY/SENSITIVE, PII masked by default, 8-role RBAC.

Built across three batches:

| Batch | Scope | PRs |
|---|---|---|
| **OPS-PRO** | Registry completion (29 → 71 ops) + 16 operator screens | #43–#45 |
| **OPS-360** | Census-driven rebuild to ~90% coverage (6 units: read layer + RBAC, cross-cutting infra, deepen screens, uncovered domains, analytics, settings + workflow ops) | #46–#51 |
| **OPS-GAPS** | Deferred-gap closure: appeals workflow, RFQ award notification, hidden-category reactivation, comms management + settings promotion + maintenance mode | #52–#55 |

## Remaining — external blockers (procurement; code is ready and waiting)

- Moyasar production key + webhook secret + payout source id
- Real Nafath API key
- ZATCA Fatoora CSID
- Payout-provider contract / key
- Domain + HTTPS/TLS — **no TLS or reverse-proxy exists in the repo**

## Small code tail (non-blocking for the consumer launch)

- **ZATCA Phase-2 Fatoora reporting client** — the invoice record + QR are generated; the actual Fatoora submission is still a stub. It is **CSID-gated** (can't be built/tested before the credential exists), so it lands when the CSID does.
- **Off-site DB backup + cron** — `infra/backup.sh` is local-only (no timer/S3).
- **Post-deploy step:** apply `apps/api/prisma/_raw/searchVector.sql` (Arabic full-text search — it is not part of the migration chain; discovery/search 500 without it).

## Excluded by owner / contract decision

- Money/tax **rate** DB-tunability (commission/VAT/method-fees) — contract-pinned until payment-provider contracts settle; stays code-owned.
- Top-of-funnel visit analytics — no event-capture pipeline; the analytics screen honestly shows «بيانات غير متوفرة».

---

> The repo's `PROJECT_AUDIT.md` / `COMPLIANCE_REPORT.md` are stale baseline audits (pre-remediation) — do not use them as current-state evidence.
