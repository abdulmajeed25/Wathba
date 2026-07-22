# 🔭 Wathba OPS-360 — Total Platform Feature Census & Dashboard Coverage Verdict

*Phase A deliverable · read-only · `wathba-main` @ `2f8dd45` · 56 models · 21 enums · 71 governed ops · 16 operator screens · 498 API tests. Every finding cited file:line by 5 parallel read-only auditors against merged code — registers/prior reports were NOT used as evidence.*

---

## A8 — THE COVERAGE VERDICT (the headline)

**Honest dashboard platform-coverage ≈ 56%.** The *governance spine* is world-class (money + project-lifecycle + user-lifecycle + support are fully view-and-govern, all through the OpRunner dry-run→reason→confirm→execute contract with append-only audit + ledger). The *breadth* is the hole: **25 of 56 models (45%) have zero Ops Center surface**, moderation is count-only (operators can act but can't browse what needs acting on), analytics is a dashboard-snapshot stub over a write-only telemetry table, ~15 read endpoints are missing, and one role (MODERATOR) is effectively blind.

| Dimension | Covered | Verdict |
|---|---|---|
| Entities (A2) | 31/56 have a surface; ~20 FULLY | **~55%** — 25 models fully uncovered |
| Money features & states (A1/A3) | spine fully governed; 4 ops have no button; `webhooks.replay` unreachable | **~85%** governance / gaps in observability |
| Metrics (A4) | ~8 of ~25 meaningful metrics on the dashboard | **~32%** — many computed-but-invisible / derivable-but-missing |
| Settings (A5) | 4 catalog keys tunable; ~30 tunables env/code-only; 22 email templates + 20 notif kinds unmanaged | **~15%** of tunables (some correctly env-only) |
| Role capabilities (A6) | 8 roles; MODERATOR blind; several mis-homed/over-broad perms | **PARTIAL** — critical gaps |
| Workflows (A7) | 3 of 10 clean full-loop in-dashboard | **~30%** — fulfillment/award/appeal/onboarding drop out |

The 16 screens are the right *foundation*; Phase B must **build the read layer out, deepen/extend the screens, add surfaces for the uncovered domains, make analytics & settings first-class, and fix the RBAC** — driving every PARTIAL/MISSING below to COVERED.

---

## A1 — Feature coverage (biggest UNCOVERED, no ops surface at all)
1. **Spend logs / transparency ledger** (`milestones.controller.ts:138,148`) — the creator's public "where the money went" record; invisible to fraud investigation.
2. **Project updates + likes** (`updates.controller.ts`) — primary creator→backer channel; no read, no takedown op.
3. **Contests & winners** (`contests.controller.ts`; `ContestStatus` DRAFT→OPEN→CLOSED→ANNOUNCED) — full FSM, zero ops surface.
4. **Reward tiers & add-ons** (`rewards.controller.ts`, `addons.controller.ts`) — the actual product catalog backers pay for; only an aggregate `addOnsHalalas` surfaces.
5. **Collaborators** (`collaborators.controller.ts`) — creator-team access grants entirely absent from ops.
6. **Saved projects, creator follows, notifications** — relevant to brigading/CIB investigations; present only in merge/PDPL plumbing.
7. **Payout beneficiary bank record** — payouts governable but the IBAN/beneficiary record is unviewable/unverifiable.
8. **Comment / FAQ / report moderation is "blind"** — ops exist (`moderation.comment.moderate`, `faq.question.hide`, `project-reports.dismiss`) but **no list endpoint**; operator must already possess the target ID (`trust/moderation-queue.tsx:146-148`).
9. **Legacy `/admin` surface** duplicates governance (review, settle, disburse, KYC queue, moderation) OUTSIDE `/ops` — split-brain risk to retire.

## A2 — 25 models with ZERO ops surface
Address, RewardTier, AddOn, PledgeAddOn, SpendLog, ProjectUpdate, UpdateLike, CommunityMaterialised, **AnalyticsEvent (write-only — collected, never read anywhere)**, ProjectCollaborator, Contest, ContestWinner, FaqItem, CommunityStat, ProjectChangeLog, CreatorProfile, CreatorFollow, Notification, OperationExecution, AgentDryRun, PasswordResetToken, EmailVerifyToken, **PayoutBeneficiary (disbursement depends on it, yet unviewable)**, SavedProject, KnownDevice. Moderation entities (Comment, CommentReport, ProjectReport, FaqQuestion, WebhookEvent, ZatcaInvoice) are PARTIAL: operable + audited but no browse endpoint.

## A3 — states reachable only outside the dashboard
Pledge `PENDING_REAUTH` (reauth cron), `FAILED_CAPTURE` (grace-expiry cron), `DISPUTED` (bank webhook), `FAILED` (hold-fail). All *viewable* via `?status=` but the refunds-panel dropdown omits FAILED/REFUNDED/PENDING_BNPL/PENDING_REAUTH; no dashboard tile counts DISPUTED or PENDING_REAUTH. Payout **stuck-SENDING** detector exists (`payout.disburser.ts:138`) but is log-only. Project SUCCESSFUL/FAILED/FUNDED and SCHEDULED→LIVE are cron-only (observable, not directly triggerable). RFQ award & bid award are creator-only (no ops override).

## A4 — metrics: computed-but-invisible / derivable-but-missing
- **Computed but invisible:** commission-earned Σ (ledger COMMISSION), VAT-collected Σ (`ZatcaInvoice.vatHalalas`), per-project ledger `projectSummary()`.
- **Derivable but missing:** success rate, refund rate, capture-failure *true* rate, per-category performance, KYC conversion, platform distinct-backers, verify→pledge→repeat funnel, pledged-vs-realized platform contrast, session/auth stats, moderation throughput.
- **Bug:** the `pendingPayoutLiabilityHalalas` tile uses `net ?? amount`; PENDING rows have net=null so it reports **gross** (overstates).
- **Not computed:** top-of-funnel (no visit/signup event capture); email/notification delivery (no tracking record). `AnalyticsEvent` is written but never read.

## A5 — settings: should-be-tunable backlog (catalog has only 4 keys)
`OPS_IP_ALLOWLIST`, `OPS_TOTP_REQUIRED` (shown read-only), global release-threshold default, pause cap, grace window, `REAUTH_AFTER_DAYS`, duration tiers (60/120), funding-goal minimum, `BLOCKED_WORDS` (belongs behind Trust), `CONSENT_VERSION`, throttle limits, and — the biggest buried business levers — `PLATFORM_COMMISSION_BP`/`VAT_BP`/`METHOD_FEES` (deferred "until provider contracts settle"). No email-template management, no per-notification-kind enablement, no maintenance-mode flag (doesn't exist). `SUPPORT_INBOX` env duplicates the `support.inboxEmail` catalog key.

## A6 — RBAC gaps (critical)
- **MODERATOR is blind:** holds only `moderation.queue` → can run ban/hide/dismiss but the trust screen reads `/ops/dashboard` (needs `analytics.read`) + `/ops/projects` (needs `projects.review`), neither of which MODERATOR has. **Cannot see any queue or project.**
- **OPS_MANAGER gaps:** no `projects.feature` (can't staff-pick/partner), no `users.pii.unmask`/`users.roles.assign` (can't unmask/merge/grant ops-roles/PDPL-export), no money perms (can't open /ops/money at all).
- **Over-broad:** SUPPORT holds `users.lifecycle` → can `users.pdpl.erase` (irreversible) and `suppliers.verify`. REVIEWER's `projects.review` also gates RFQ reads → a project reviewer browses all supplier bids.
- **Weak four-eyes:** FINANCE bundles `money.execute` + `money.approve` (separation is role-nominal; the counter still keys on distinct actors).
- **No read endpoints** for moderation/categories/editorial/collections/team/agents domains — roles whose whole job is those (MODERATOR, CONTENT_EDITOR) can act but barely view.

## A7 — workflow drop-out points (must leave the dashboard)
Clean full-loop today: **support ticket**, **single/project refund**, **PDPL export/erase** only. Drop-outs: reward **fulfillment** (no surface at all), **RFQ award** (creator-only, no ops op), **supplier onboarding/creation** (no op), **appeal** post-ban (does not exist anywhere), and the **discovery holes** — dispute/KYC/report/milestone worklists don't exist (ops can *act* if they already have the id, but there's no queue to find items). Categories/editorial/collections *reads* ride legacy `/v1/admin` + public endpoints, not the ops read layer.

## Current Ops Center — depth & UX (baseline for the rebuild)
- **Strong:** the OpRunner governance spine (dry-run blast-radius, risk-tier coloring, MONEY typed-confirm, idempotency, step-up links); the immutable audit browser with live chain-verify; intellectual honesty (screens name their own gaps rather than fake data — analytics is the model).
- **Bugs found:** `refunds-panel.tsx` declares `backerEmail` but API returns `backer.email` → backer column always "—"; `payouts-panel.tsx` declares `creatorHandle` but API returns `creator{name,handle}` → shows truncated projectId. Agents screen bypasses OpRunner with `window.prompt` for the audited reason (governance inconsistency).
- **Cross-cutting MISSING:** saved views, column management, CSV/export, generic bulk engine, global notifications/alerts center, impersonation, density/theme toggle, jump-to-record search, name resolution for actor/assignee UUIDs.
- **Consistency:** money panels / project-detail / agents / audit hand-roll `<table>` instead of the shared `DataTable`; filters are `FilterForm` on some screens, inline `<form>` on others; two different tab-bar styles; two different mutation paths (OpRunner vs window.prompt).
- **A11y:** modals set `aria-modal` but don't trap focus or restore it on close (fails 2.4.3/2.1.2); color is the sole status signal in places (1.4.1); muted hint text likely < 4.5:1 (1.4.3); no skip-link; op-result not announced to SR. Hardcoded dark theme ignores appearance prefs. Loading states/skeletons absent on server lists.
- **IA:** flat 16-item rail, no grouping, no per-section counts; `/ops/suppliers/[id]` is mislabeled (it's RFQ detail; no supplier profile exists); milestone approval is a 6-hop path.

---

## PHASE B BUILD BACKLOG (drive every item to COVERED; money last within each unit)

**Unit 1 — Read layer + RBAC (the binding constraint; unblocks ~10 screens):**
- New ops read endpoints: unified reports/moderation queue (comments+project+comment reports), comments browser, project sub-resources (updates, reward-tiers, add-ons, spend-logs, collaborators, contests, faq-questions), notifications, saved/follows, payout-beneficiary, ZATCA-invoice browser, WebhookEvent browser (unblocks `webhooks.replay`), dispute queue, KYC/Nafath queue, cross-project submitted-milestones queue, supplier-entity detail, count-by-status aggregates, `openReportCount` on the project list row, ops-role in the user DTO.
- RBAC fixes: give MODERATOR a read path (a `moderation.queue`-gated reports/projects read); re-home `users.pdpl.erase` + `suppliers.verify` off `users.lifecycle`; split RFQ reads off `projects.review`; document/decide the FINANCE execute-vs-approve separation.
- Bug fixes: refunds/payouts panel data-shape mismatches; payout-liability gross-vs-net.

**Unit 2 — Design system + cross-cutting infra:** consolidate onto shared DataTable/FilterForm/tab-bar; add saved views, column management, CSV export (PDPL-masked), a generic bulk engine with blast-radius dry-run, a global alerts/notifications center wired to the anomaly queries (stuck SENDING, webhook mismatch, ZATCA orphans, journal gaps, counter drift, PENDING_REAUTH/DISPUTED), read-only time-boxed impersonation, focus-trap + a11y fixes, density/theme toggle, actor/assignee name resolution, jump-to-record in the palette, nav taxonomy grouping + per-section counts.

**Unit 3 — Deepen existing screens to close PARTIAL:** trust (real report queue + repeat-offender), money (milestones queue, missing buttons for settle.run/settle.residue/deadline.override, DISPUTED/PENDING_REAUTH tiles, stuck-SENDING staleness, beneficiary column, ZATCA-invoice browser), users (KYC queue), suppliers (supplier profile page + onboarding + award-override op), support (cross-page status aggregates), team (ops-role matrix from the DTO), categories/editorial/collections (move reads onto the ops read layer + hidden-node listing).

**Unit 4 — New screens for UNCOVERED domains:** content governance (updates, spend-logs, reward-tiers/add-ons, contests, collaborators, FAQ items), notifications inspector, fulfillment tracking, webhook/integration console.

**Unit 5 — Analytics surface (A4) to full coverage:** aggregate endpoints for success/refund/capture-failure rates, per-category, KYC conversion, distinct backers, funnels, cohorts, commission-earned/VAT-collected, pledged-vs-realized; date-range + segment + export; saved dashboards. Retire the write-only `AnalyticsEvent` gap (either surface it or capture top-of-funnel).

**Unit 6 — Settings surface (A5) to full coverage + workflows end-to-end:** DB-back the should-be-tunable policy knobs, email-template management, per-notification-kind enablement, security-posture toggles; then close the workflow drop-outs (fulfillment, award, appeal, onboarding) so every A7 workflow is drivable start-to-finish in-dashboard.

**Governance invariants (unchanged, law):** everything through the registry (no direct DB writes; the lint stays green), CREATOR-NO-MONEY, four-eyes on money, step-up on MONEY/SENSITIVE, agents propose-not-execute money, PII masked by default, append-only audit + ledger. Money areas built LAST within each unit.

---

# ✅ FINAL STATE — after OPS-360 Phase B (all 6 units merged, mainline `e10abc6`, 2026-07-22)

**Refreshed dashboard platform-coverage: ≈ 56% → ≈ 90%+.** Every MISSING/PARTIAL item the census named was driven to COVERED or has a logged, reasoned residual. Registry **73 governed operations**, **~40+ read endpoints**, **574 API tests green**, web production build green across all 20 sections + detail routes.

## What each unit closed
- **Unit 1 (PR #46)** — read layer + RBAC: ~22 read endpoints (moderation queue, project sub-resources, money observability incl. WebhookEvent list that unblocked `webhooks.replay`, KYC queue, ops-role in the user DTO, supplier profile), payout-liability gross→net fix, RBAC fixes (MODERATOR unblinded, destructive perms re-homed off SUPPORT, `procurement.read` split), migration 0050.
- **Unit 2 (PR #47)** — cross-cutting infra: `/ops/alerts` anomaly center, read-only audited impersonation, actor-name resolution; power table (column mgmt, saved views, CSV, bulk engine); a11y (focus trap, live regions, contrast); light theme + density; grouped nav with live counts; palette jump-to-record.
- **Unit 3 (PR #48)** — deepened screens: real moderation queues (MODERATOR can work), KYC escalation queue, supplier profile page, project workspace sub-resources (backers roster, updates, comments, catalog, spend-logs), money vault (real milestones queue + beneficiaries/ZATCA/webhook-events tabs + DISPUTED/PENDING_REAUTH tiles), team ops-role matrix.
- **Unit 4 (PR #49)** — uncovered-domain screens: notifications inspector, contests oversight, fulfillment roster, collaborators/FAQ project tabs. Nav 16→20.
- **Unit 5 (PR #50)** — analytics surface: 5 aggregate endpoints (financial/funnel/projects/users/operations) surfacing the ~13 previously-invisible/derivable metrics; rebuilt screen with a working date range + CSS bars + honest-null states.
- **Unit 6 (PR #51)** — settings + workflow ops: `SETTINGS_CATALOG` 4→10 keys wired to consumers; `rfq.award` (operator award-override) + `notifications.resend` ops (registry 71→73).

## Residual (deferred with reasons — NOT silently dropped)
| Item | Why deferred |
|---|---|
| Appeal workflow (post-ban) | Needs a whole new `Appeal` model + review FSM — a product feature, not a control-plane gap. Product decision. |
| `RFQ_AWARDED` NotificationKind + email templates | Schema was frozen this batch; `rfq.award` ships without a misleading reused kind. Schema follow-up. |
| Email-template management + per-notification-kind toggles | Code/env-owned for now; a CMS-style surface is its own unit. |
| Content screens read `/v1/admin` seams; no hidden-category listing | The ops read layer doesn't model content; re-activating hidden categories needs an admin "all categories" read. |
| Top-of-funnel analytics (visits) | No event capture exists (`AnalyticsEvent` is write-only) — honestly rendered «بيانات غير متوفرة». |
| Impersonation = read-only snapshot, not a live session swap | Deliberate safety choice; full cookie-level impersonation + durable revocation is a follow-up. |
| `commentReportsResolved` throughput | No `resolvedAt` column on `CommentReport`. |
| Table server-side cross-cursor sort | Client-page sort only today. |
| Money rates (commission/VAT/method-fees) not DB-tunable | Contractually pinned until provider contracts settle. |
| `projects.durationSelfServeMaxDays` catalog-only | Enforcement lives in `projects.review.approve`; wiring it there is a follow-up. |

## Distance to launch — unchanged and external
Coverage and control are now enterprise-grade; the only launch gates remain **external procurement + a TLS front door** (Moyasar/Nafath/ZATCA credentials, payout-provider contract, domain + HTTPS) — not code.
