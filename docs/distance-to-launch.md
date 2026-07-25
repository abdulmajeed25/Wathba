# 🚀 Wathba — Distance to Launch

*Generated 2026-07-22 · `wathba-main` @ `93ed37a` · 55 PRs merged · 53 migrations · 78 governed operations · 634 API tests green · web production build green.*

**State: the code is done. Launch is gated by external procurement + a TLS front door.**

> **Updated 2026-07-25 after Batch CLOSEOUT** (PRs #60–#64 · 57 migrations · 78 governed operations · 53 ops read endpoints · **672 API tests green** · web production build green · **Playwright 128 passed / 0 failed / 2 environment-skipped**). The residual list from `ops360-census.md` is re-scored in `closeout-batch.md`: 7 of 8 buildable items closed, 1 open and scoped, 3 deferred by decision. **The distance to launch is unchanged.**
>
> One correction to the record this file has carried: "full Playwright green" was not true. 13 ops e2e specs gated on a 404 health route and had been self-skipping, which reads as green. Arming them surfaced 24 real failures — including a hard 500 on `/ops/analytics` and an appeals decision workspace that crashed on every appeal. Those are fixed; three pre-existing public-journey failures found the same way are logged in `completion-state.md` rather than papered over.

---

## ✅ Code — launch-ready

| Area | State |
|---|---|
| Consumer / creator / supplier product | Complete (discovery, pledges + BNPL, escrow, milestones, payouts, identity/PDPL, comms, magazine home, campaign tabs) |
| Money safety | Capture-at-deadline, grace/reauth, refunds (single + bulk), disputes, DB-enforced append-only ledger, hash-chained audit, 12 SYSTEM audit trails on money paths |
| Security | Both P0s fixed (BNPL rawBody HMAC, media cross-tenant delete); Moyasar/Nafath/webhook prod-refusal guards (fail loud, never fabricate) |
| Operations Center | ~90%+ platform coverage: 78 ops + ~45 read endpoints, 20 operator screens, alerts center, impersonation, analytics surface, four-eyes appeals, email-template CMS, DB-backed maintenance mode |
| Governance | Registry-only writes (lint-enforced), CREATOR-NO-MONEY, four-eyes on money, step-up, PII masked, 8-role RBAC |

## ⛔ External blockers — the real gates (procurement, not code)

The only things standing between here and a live public launch. Code paths for each are written and waiting:

1. **Moyasar** production API key + webhook secret + payout source id
2. **Nafath** real API key
3. **ZATCA Fatoora CSID** (see the paired code item below)
4. **Payout-provider** contract / key
5. **Domain + HTTPS/TLS** — no reverse-proxy or TLS in the repo; must be provisioned externally

## 🟡 Small code tail (each gated by, or paired with, an external item — none launch-blocking for the consumer product)

- **ZATCA Phase-2 Fatoora reporting client** — the invoice *record* is generated and `money.zatca.retry` heals orphans, but the actual Fatoora submission is still a stub. It can't be exercised end-to-end until the **CSID** exists, so it's written when the credential lands (deliberately deferred/excluded this cycle).
- **Off-site DB backup + cron** — `infra/backup.sh` is local-only (no timer/S3). Operational safety, ~half a day.
- **Explicitly excluded (owner/contract decisions):** money/tax-rate DB-tunability (contract-pinned), top-of-funnel visit analytics (no event pipeline), live cookie-level impersonation (read-only snapshot is the deliberate safe choice).
- **Reverse-proxy `trust proxy` / real client IP** — added by CLOSEOUT C5. Authenticated traffic is now rate-limited per account, but the anonymous routes (sign-in, sign-up) still key on `req.ip`; behind a proxy that is the proxy's own address, so all visitors would share one bucket. Pairs with item 5 (TLS/domain) and is configuration, not code.

---

## Distance estimate

- **Consumer product → can go live the moment the external items land.** Procure the five credentials + stand up TLS, flip the prod env, and the public product is live — every code path is present and guarded.
- **Operator control plane → done and ahead of standard.** The owner (and, later, a team, and later still governed agents) can run payouts, refunds, disputes, moderation, KYC, appeals, comms, and settings entirely in-dashboard, with four-eyes + audit behind it all.

**Net:** essentially **zero remaining engineering** blocks launch. The clock is procurement (Moyasar/Nafath/ZATCA/payout contracts) + one infra task (domain + TLS). The ZATCA Fatoora client and off-site backup are the only genuine code items left, and the first is CSID-gated anyway.
