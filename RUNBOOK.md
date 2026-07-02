# Wathba — Operations Runbook (Sprint 4 / P1-1102)

**Scope:** the money-critical failure modes and the standard operating
procedures. Everything here assumes the production stack from
`infra/docker-compose.prod.yml`.

## Golden signals

| Check | Healthy | Alert |
|---|---|---|
| `GET /v1/health/live` | 200 | process restart loop |
| `GET /v1/health/ready` | `status: ok` | `degraded` → read `workers` + `flags` |
| `workers["deadline-tick"]` | < 180 s | settlement cron dead — money frozen |
| `workers["payout-tick"]` | < 900 s | disbursement cron dead |
| Log grep `SETTLEMENT ALERT` / `CANCEL ALERT` | none | pledges stuck HELD (see §2) |
| Log grep `WEBHOOK MISMATCH` | none | PSP/DB divergence (see §3) |
| Log grep `LEDGER WRITE FAILED` / `AUDIT WRITE FAILED` | none | journal gap — reconcile manually |

## 1. Settlement didn't run at a deadline

1. `GET /v1/health/ready` → check `flags.deadlineTickDisabled`. If `true`,
   someone left `DEADLINE_TICK_DISABLED=true` after maintenance — unset and
   restart the api container.
2. Check `workers["deadline-tick"]` age. If stale with the flag off, the
   process is wedged: `docker compose restart api`.
3. Force the settlement manually (idempotent, atomic-claim protected):
   `POST /v1/admin/projects/:id/settle` with an ADMIN bearer.

## 2. Pledges stuck in HELD after settlement (`SETTLEMENT ALERT` in logs)

Cause: PSP capture/void failed 3 retries during settle. Moyasar authorization
holds expire in ~7 days — treat as urgent.
1. `POST /v1/admin/projects/:id/settle` — on an already-settled project this
   runs the residue sweep (re-captures or re-voids remaining HELD).
2. If it still fails, check Moyasar dashboard for the payment ids
   (`Pledge.paymentRef`) and reconcile manually; the webhook will sync any
   PSP-side state change (`payment_paid` / `payment_voided`).

## 3. `WEBHOOK MISMATCH` in logs

A Moyasar event arrived for a payment we can't match, or an event that is
illegal for the pledge's state (e.g. refund for a never-captured pledge).
1. Find the event: `SELECT * FROM "WebhookEvent" WHERE outcome='mismatch' ORDER BY "createdAt" DESC;`
2. Compare `payload` with the pledge row by `pspRef` = `Pledge.paymentRef`.
3. Ledger truth: `SELECT * FROM "LedgerEntry" WHERE "pspRef"='…';`
4. Never hand-edit `Pledge.status` without writing a compensating
   `LedgerEntry` and an `AuditLog` row.

## 4. Payouts not going out

1. `flags.payoutTickDisabled` on `/ready`? Unset it.
2. `SELECT count(*) FROM "Payout" WHERE status='PENDING';`
3. Manual tick: `POST /v1/admin/payouts/disburse` (ADMIN, audited).
4. Repeated per-payout failures log `payout disburse failed id=… (stays PENDING)`
   — with a real provider key configured, check the provider dashboard;
   payout idempotency key is the payout id.

## 5. ZATCA invoice failed (`ZATCA invoice FAILED` in logs)

`generateForPayout` is idempotent — re-run `POST /v1/admin/payouts/disburse`;
already-SENT payouts skip disbursement but the next tick will not retry
invoices for them automatically: backfill via a one-off script calling
`ZatcaService.generateForPayout` for payouts with `zatcaInvoiceId IS NULL AND status='SENT'`.

## 6. Backup & restore

- Nightly: `infra/backup.sh` via cron `0 3 * * *` with `DATABASE_URL` +
  `BACKUP_DIR` set. 14 dailies retained. **Backups contain PII — store
  encrypted, access-controlled (PDPL).**
- Restore drill (run quarterly): create a fresh DB, **pre-create extensions
  as superuser** (`CREATE EXTENSION vector; CREATE EXTENSION pgcrypto;`),
  then `infra/restore.sh <dump> <target-url>` and compare the printed
  User/Pledge/LedgerEntry counts against the source.
- Point-in-time recovery is NOT configured (pg_dump granularity = 24 h).

## 7. Deploy & rollback

- Deploy: `cd infra && TAG=$(git rev-parse --short HEAD) ./deploy.sh`
  (build → `prisma migrate deploy` → swap → readiness gate).
- Rollback: `./rollback.sh` re-points to the previously recorded tag.
  **Migrations are forward-only** — write expand→contract migrations; never
  a destructive change in the same release that depends on it.

## 8. Kill-flags (use sparingly, always temporary)

| Flag | Effect | Loud? |
|---|---|---|
| `DEADLINE_TICK_DISABLED=true` | freezes settlement | warns every minute + `/ready` degraded |
| `PAYOUT_TICK_DISABLED=true` | freezes disbursement | warns every 5 min + `/ready` degraded |

## 9. Secrets inventory (.env.prod)

`POSTGRES_USER/PASSWORD`, `JWT_SECRET` (≥16 chars, non-placeholder — boot
refuses otherwise), `MOYASAR_API_KEY`, `MOYASAR_WEBHOOK_SECRET`,
`NAFATH_API_KEY` (prod refuses KYC without it), `ZATCA_SELLER_VAT`,
`PAYOUT_PROVIDER_KEY`, `MINIO_ROOT_USER/PASSWORD`, `WEB_ORIGIN`, `API_ORIGIN`.
