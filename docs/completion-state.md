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
| **CLOSEOUT** | Pre-launch deferred items: settings wiring, RFQ award fan-out (winner + losing bidders), content reads onto the ops layer, appeals hardening (takedown appeals, DB-level uniqueness, `trust.appeals`) — then **arming the Playwright gate**, which had been self-skipping, and fixing the 24 real failures it had been hiding. See `closeout-batch.md`. | #60–#64 |

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
- **Reverse-proxy `trust proxy` + real client IP** (CLOSEOUT C5) — the API rate-limits authenticated traffic per account now, but anonymous routes (sign-in, sign-up) still key on `req.ip`. Behind a proxy that is the proxy's address, so every visitor shares one sign-up/sign-in bucket. Lands with the TLS/reverse-proxy work, not before it.
- **Three pre-existing public-journey e2e failures**, surfaced by running the full browser suite rather than caused by this batch: a homepage carousel that reports zero scroll, a discover «trending» filter that does not reach the URL, and the money journeys tripping the 5/min sign-up limiter. The first two are outside the CLOSEOUT scope and are logged here rather than silently fixed or silently ignored; the third is an e2e-env knob, now set in CI.

## Excluded by owner / contract decision

- Money/tax **rate** DB-tunability (commission/VAT/method-fees) — contract-pinned until payment-provider contracts settle; stays code-owned.
- Top-of-funnel visit analytics — no event-capture pipeline; the analytics screen honestly shows «بيانات غير متوفرة».

---

> The repo's `PROJECT_AUDIT.md` / `COMPLIANCE_REPORT.md` are stale baseline audits (pre-remediation) — do not use them as current-state evidence.
