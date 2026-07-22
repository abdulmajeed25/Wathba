# ✅ Wathba — Launch Punch-List (Owner: Procurement + TLS)

*The code is done (`wathba-main` @ `93ed37a`). This is the actionable list of external items that must be obtained/provisioned before a live public launch. Each block: **what to get → from whom → which config to set → how to verify.** The API's prod-refusal guards mean a mis-provisioned service fails loud (HTTP 503) rather than silently faking — so "verify" is concrete.*

> Rule of thumb: in `NODE_ENV=production`, Moyasar / Nafath / the webhook secret **refuse to run stubbed** — if any is unset the API returns 503 for that path. So "no 503s + no `[STUB]` log lines" = correctly configured.

---

## A. Payments — Moyasar (card auth/capture/refund)  ⛔ launch-critical
- [ ] **Get:** Moyasar **production secret API key** + **webhook signing secret**. Vendor: Moyasar (moyasar.com) — production merchant account, KYC-approved.
- [ ] **Set (API env):**
  - `MOYASAR_API_KEY=` (live secret key)
  - `MOYASAR_WEBHOOK_SECRET=` (the `secret_token` you configure on the Moyasar webhook)
- [ ] **Configure at Moyasar:** point the payment webhook at `https://<api-domain>/v1/webhooks/moyasar` (or your API's public webhook path) with that secret.
- [ ] **Verify:** a real card pledge authorizes + captures at deadline; API logs show **no `[STUB]`** line; `GET /v1/health` `db:up`; a test webhook delivers and is accepted (not 401/503).

## B. Payouts to creators — payout provider  ⛔ launch-critical
- [ ] **Get:** payout-provider contract + **API key** + the **source/wallet id** funds disburse from. Vendor: Moyasar Payouts (or the contracted payout provider).
- [ ] **Set (API env):**
  - `PAYOUT_PROVIDER_URL=` (defaults to Moyasar `/v1/payouts` if unset)
  - `PAYOUT_PROVIDER_KEY=`
  - `MOYASAR_PAYOUT_SOURCE_ID=` (the funded source id)
  - `MOYASAR_PAYOUT_PURPOSE=` (regulatory purpose code, if required)
  - `PAYOUT_TICK_DISABLED=` leave unset/`0` in prod (the disburser cron must run)
- [ ] **Verify:** in Ops → الخزنة → الدفعات, run a disburse cycle on a real pending payout; it flips `SENT` with a real provider ref (not a stub ref); the creator's `PayoutBeneficiary` (IBAN) resolves.

## C. BNPL — Tabby / Tamara (optional at launch)
- [ ] **Get:** Tabby/Tamara merchant credentials + **webhook signing secret** (if offering installments at launch).
- [ ] **Set (API env):** `TABBY_WEBHOOK_SECRET=` (+ provider checkout keys per the BNPL adapter).
- [ ] **Configure:** point the BNPL webhook at the API's `/v1/webhooks/tabby|tamara` path (HMAC is verified over the raw body — the P0 fix ensures this works).
- [ ] **Decision:** if not launching with BNPL, disable the card/bnpl methods in Ops → الإعدادات (`payments.methodsEnabled`). No code change needed.

## D. Identity / KYC — Nafath  ⛔ launch-critical (money-tier KYC)
- [ ] **Get:** Nafath production **API key** + **app id** + base URL. Vendor: Nafath (via the Saudi National Single Sign-On / your integration partner).
- [ ] **Set (API env):** `NAFATH_BASE_URL=` · `NAFATH_APP_ID=` · `NAFATH_API_KEY=`
- [ ] **Verify:** a real Nafath verification flips `nafathVerified` (visible in Ops → المستخدمون); no `[STUB]`/503 on the Nafath path in prod.

## E. Tax invoicing — ZATCA Fatoora  🟡 (pairs with a small code item)
- [ ] **Get:** ZATCA Fatoora **CSID** (compliance/production cryptographic stamp id) + seller VAT registration details. Vendor: ZATCA (zatca.gov.sa) Fatoora onboarding.
- [ ] **Set (API env):** `ZATCA_SELLER_VAT=` · `ZATCA_SELLER_NAME=` · `ZATCA_API_KEY=`
- [ ] **NOTE (code):** the invoice *record* + QR are generated today; the **Fatoora reporting client is still a stub** and gets written once the CSID exists (it's CSID-gated, so it can't be built/tested before). Flag this to engineering when the CSID lands. **Does not block the consumer launch** — invoices are recorded; reporting to Fatoora is the follow-up.

## F. Email delivery  ⛔ (transactional emails: verification, receipts, payouts, appeals)
- [ ] **Get:** transactional email provider (API URL + key) + a verified sender domain (SPF/DKIM/DMARC). Vendor: your ESP (e.g. an SMTP/HTTP provider).
- [ ] **Set (API env):** `EMAIL_ENABLED=true` · `EMAIL_PROVIDER_URL=` · `EMAIL_PROVIDER_KEY=` · `EMAIL_FROM=` · `EMAIL_FROM_NAME=وثبة`
- [ ] **Verify:** Ops → الإعدادات → الاتصالات → «إرسال تجريبي» delivers a real email to the operator; no `[EMAIL stub]` log lines in prod.

## G. Object storage + bot protection
- [ ] **Get:** production object storage (S3-compatible / MinIO) bucket for media/evidence; a Cloudflare Turnstile site (bot protection).
- [ ] **Set (API env):** `MINIO_ENDPOINT=` · `MINIO_PUBLIC_ENDPOINT=` · `MINIO_ACCESS_KEY=` · `MINIO_SECRET_KEY=` · `MEDIA_BUCKET=` · `TURNSTILE_SECRET_KEY=` (captcha; unset = disabled).
- [ ] **Verify:** an image upload + the post-upload verify round-trips; the excluded/deletion path is owner-scoped (P0 fix).

## H. Domain + HTTPS/TLS + core secrets  ⛔ launch-critical (nothing in the repo)
- [ ] **Get:** a production **domain** + DNS.
- [ ] **Provision TLS + reverse proxy** in front of the web (`:3000`) and API (`:4000`) — Caddy / Nginx / Cloudflare (auto-cert). **No TLS or reverse-proxy config exists in the repo**; this is pure infra.
- [ ] **Set:**
  - API: `CORS_ORIGINS=https://<web-domain>` · `APP_PUBLIC_URL=https://<web-domain>` · `WEB_BASE_URL=https://<web-domain>` · a strong `JWT_SECRET` (≥16 chars, the boot check enforces this) · `DEVICE_HASH_SALT=` (random) · `DATABASE_URL=` (managed Postgres with `pgvector` + `pgcrypto`).
  - Web: `NEXT_PUBLIC_API_URL=https://<api-domain>`
- [ ] **Post-deploy DB steps (one-time, not in the migration chain):** apply `apps/api/prisma/_raw/searchVector.sql` (Arabic FTS — discover/search 500s without it) after `prisma migrate deploy`.
- [ ] **Verify:** `https://<web-domain>` serves over TLS; sign-in works; `GET https://<api-domain>/v1/platform/status` returns `{maintenance:false}`; discovery/search return results (searchVector applied).

---

## I. Operational safety (small code/ops item — not launch-blocking)
- [ ] **Off-site DB backup + cron:** `infra/backup.sh` is local-only (no timer, no S3/rsync). Add a scheduled off-box backup before real money flows. ~half a day of infra work.

---

## Excluded by owner/contract decision (do NOT expect these)
- Money/tax **rate** DB-tunability (commission/VAT/method-fees) — contractually pinned until payment-provider contracts settle; stays code-owned.
- ZATCA computation changes — frozen pending CSID + contracts (see block E).
- Top-of-funnel visit analytics — no event-capture pipeline; the analytics screen honestly shows «بيانات غير متوفرة».

---

## Launch order (suggested)
1. **H** (domain + TLS + core secrets + DB + searchVector) — everything else needs the box reachable over HTTPS.
2. **A + D + F** (Moyasar + Nafath + email) — the money + identity + comms spine.
3. **B** (payouts) — before the first campaign settles.
4. **G** (storage + captcha), **C** (BNPL if in scope).
5. **E** (ZATCA) + **I** (backups) — can trail the public launch; ZATCA reporting is CSID-gated code.

Once **A, B, D, F, H** are green, the consumer product can go live.
