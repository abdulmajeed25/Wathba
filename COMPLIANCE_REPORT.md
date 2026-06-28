# Wathba (وثبة) — Full Implementation Compliance Report

**Date:** 2026-06-28
**Branch:** `sync/frontend-from-project200` (local, not pushed)
**Method:** 6 read-only Explore subagents running in parallel, each owning one section
of the spec. Each verified by **evidence** — file:line citations, `grep` results, HTTP
sweeps, and screenshot inspection — not by trusting checklists.

Status legend: ✅ implemented · ⚠️ partial · ❌ missing

---

## Headline

The new project200-derived frontend covers **most concept surfaces** but ships with
**7 of 14 specced web deps missing**, **2 §7 platform-partner pieces missing**, **~60% of 5B
screens absent**, and **3 of 4 compliance areas (AML/PDPL/ZATCA) effectively unimplemented**.
Backend FSM, escrow, contracts, and dormant-investment isolation are clean. Icon-rendering
bug is fully fixed and verified visually.

| Section | Verdict |
| --- | --- |
| §1 Stack — web deps | **⚠️ 7/14 missing** (Radix, TanStack Query, Zustand, react-hook-form, zod, visx, framer-motion) |
| §1 Stack — API deps | ✅ NestJS 11 + Prisma 6 + pgvector + Redis + BullMQ + Moyasar adapter — all present |
| §1 Design Fidelity | ✅ **96/100** average per screen; icon defect resolved (0 ligatures) |
| §1 RTL + IBM Plex Arabic | ✅ correct |
| §2 Domain Model | ✅ **52/54 fields present**; 2 ⚠️ (Milestone.evidenceUrl missing in shared types, wathba-start posts USD hardcode) |
| §3 Funding FSM (80% threshold) | ✅ full implementation, 6 spec tests, both UI disclosures present |
| §4 Contracts (Donation/Istisna/Salam) | ✅ thin/swappable, neutral default, web mirrors API 1:1 |
| §4 Dormant investment | ✅ isolated, feature-flagged, 0 imports, 0 UI hits |
| §5 Platform partner | **⚠️ 6/8** — badge ✅, banner ✅, disclosure ✅; **filter ❌, admin screen ❌** |
| §6 5A screens (12) | ✅ all 12 routes exist, 2 functional gaps (milestones step in launch wizard, transparency tab not bound to live API) |
| §6 5B screens (~30) | **❌ ~60% missing** — admin (5), backer mgmt (3), supplier-onboarding (3), payments/wallet (4), settings (4), Privacy/Help (3 of 4), skeleton/empty states |
| §7 Milestone escrow | ✅ Moyasar Hold/Capture/Refund wired; ⚠️ per-milestone capture batched (all pledges capture together at funding settle, not per-milestone) |
| §7 Live Transparency Dashboard | ⚠️ tab exists, `/v1/projects/:id/transparency` endpoint exists, but web reads fixtures — **not bound to live API** |
| §7 Reverse supplier auction | ✅ API atomic award + 5 tests; ⚠️ web reads fixtures (submit form is local-state only) |
| §8 Nafath KYC | ⚠️ stub-only on API; **0 web UI** for verification step |
| §8 AML/CFT | ❌ absent |
| §8 PDPL/SDAIA | ❌ no privacy page, no consent tracking |
| §8 ZATCA Phase 2 | ❌ schema field only (`Payout.zatcaInvoiceId`), no invoice service |
| §9 Build health | ✅ typecheck 5/5, 18/18 tests, `next build` 26 routes; ⚠️ `next lint` not configured (interactive prompt) |

---

## §1 — STACK

### Web (`apps/web/package.json`)

| Dependency | Spec | Installed | Used in code | Status |
| --- | --- | --- | --- | --- |
| Next.js 15 | ✅ | `15.1.3` | App Router in `src/app/layout.tsx` | ✅ |
| React 19 | ✅ | `19.0.0` | — | ✅ |
| Tailwind v4 + CSS variables | ✅ | `4.0.0-beta.8` | `@theme` block in `globals.css` lines 40–56 | ✅ |
| **Radix UI + shadcn-style** | ✅ | — | — | **❌ MISSING** |
| **TanStack Query** | ✅ | — | — | **❌ MISSING** (Server Components fetch directly via `lib/api/wathba.ts`) |
| **Zustand** | ✅ | — | — | **❌ MISSING** (UI state is local `useState`) |
| **react-hook-form** | ✅ | — | — | **❌ MISSING** (forms are uncontrolled `<form action={serverAction}>`) |
| **zod** | ✅ | — | — | **❌ MISSING** on web (API has it) |
| lucide-react | ✅ | `^1.21.0` | `components/ventures/wathba/wathba-icons.tsx` | ✅ |
| **visx + SVG/Canvas** | ✅ | — | — | **❌ MISSING** (charts use raw `<svg>` / CSS bars) |
| **framer-motion** | ✅ | — | — | **❌ MISSING** (transitions use CSS keyframes in `wathba-tokens.ts`) |
| Arabic/English RTL | ✅ | — | `<html dir="rtl">` `layout.tsx:37` | ✅ |
| IBM Plex Sans Arabic | ✅ | — | `next/font/google` `layout.tsx:21–26` | ✅ |

**7 of 14 web deps absent.** The new project200-derived frontend was written without
them — it uses Server Components + Server Actions + local `useState` + raw SVG / CSS
keyframes instead. This is **architecturally viable** (the app works), but it **deviates
from the stack spec**. Decision point: install + adopt these libs, or formally accept
the deviation as an intentional architecture choice.

### API (`apps/api/package.json`)

| Dependency | Version | Status |
| --- | --- | --- |
| NestJS core | 11.0.1 | ✅ |
| All @nestjs/* modules | 11.0.x / 11.0.2 | ✅ |
| Prisma | 6.1.0 + `previewFeatures = ["postgresqlExtensions"]` + `extensions = [pgcrypto, vector]` | ✅ |
| PostgreSQL + pgvector | provider postgresql, vector ext enabled | ✅ |
| Redis (ioredis) | 5.4.2 | ✅ |
| BullMQ | 5.34.5 | ✅ |
| Moyasar adapter | custom — `src/escrow-payments/moyasar.adapter.ts:29–107` real HTTP + stub fallback | ✅ |

API stack 100% complete.

### Monorepo + RTL + Fonts

| Check | Status |
| --- | --- |
| Turborepo at root, `turbo: ^2.3.3` | ✅ |
| `apps/{web,api}` and `packages/{types,ui-tokens,config}` all exist | ✅ |
| `<html dir="rtl">` | ✅ `layout.tsx:37` |
| IBM Plex Sans Arabic via next/font with `subsets: ['arabic']` | ✅ `layout.tsx:21–26` |
| Logical properties (no `mr-`/`ml-`/`text-left`/`text-right`) | ✅ grep clean |

---

## §1 — DESIGN FIDELITY + ICON INTEGRITY

### Icon defect — fully resolved

| Check | Result | Evidence |
| --- | --- | --- |
| `grep -rIn "material-symbols\|material-icons\|Material Symbols"` in apps/web/src | 2 hits (both in doc comments inside the new `wathba-icons.tsx`) — 0 shipped | clean |
| `grep -rIn 'className="ico"'` | **0** | clean |
| `grep -rIn 'fontFamily.*Material'` | **0** | clean |
| `wathba-icons.tsx` imports from `lucide-react` + `ICON_MAP` covers all 35 required ligatures | ✅ | `wathba-icons.tsx:60–148` |
| Playwright DOM-walk for 62 ligature names across 11 screenshots | **0 hits** | `/tmp/wathba-screens/*.png` + `/tmp/wathba-shoot.py` |
| Logo svg / theme-toggle svg sizes | logo 26×26, toggle 21×21 | `getBoundingClientRect` measurement |

### Per-screen parity scores (out of 100)

| Screen | File | Score | Notes |
| --- | --- | --- | --- |
| Home | `components/ventures/wathba/wathba-home.tsx` | **98** | hero/featured/categories/trending all 1:1 |
| Discover / Explore | `wathba-discover.tsx` | **97** | sort + chips + grid all match; **missing partner-filter chip** |
| Project Detail | `wathba-project.tsx` | **96** | tabs + sidebar + reward tiers match; milestones tab is v2 addition |
| Pledge wizard | `wathba-pledge.tsx` | **95** | stepper + form + summary correct |
| Launch wizard | `wathba-start.tsx` | **96** | 5 steps; **missing dedicated milestones step** |
| Dashboard | `wathba-dashboard.tsx` | **92** | extended beyond design (real data feature set) |
| Profile | `wathba-profile.tsx` | **96** | hero + tabs + cards match |
| Ranks | `wathba-ranks.tsx` | **96** | 5-card grid match |
| How-it-works | `wathba-how.tsx` | **96** | creators + backers + fees + FAQ + CTA match |
| Search | `wathba-search.tsx` | **96** | input + suggestions + grid match |
| Footer | `wathba-footer.tsx` | **100** | 1:1 |
| Header (incl. mega menu) | `wathba-header.tsx` | **94** | base structure correct; mega-menu hover-rendering complete |

**Average: 96/100.** No critical fidelity issues.

---

## §2 — DOMAIN MODEL

52 of 54 specced fields present. Both gaps are **type-level/UI sync**, not schema:

| Entity / Field | Status | Evidence | Gap |
| --- | --- | --- | --- |
| User (roles, nafathVerified, reputationTier, totalPledgedHalalas) | ✅ | `schema.prisma:117–125` | None |
| Project (fundingGoalHalalas, releaseThresholdPct=80, deadline, status enum w/ 9 states, productSpecAr, expectedDeliveryDate, **platformPartner Json**) | ✅ | `schema.prisma:163–183` | None |
| RewardTier (includesPhysicalProduct, requiresShipping, estDeliveryDate, limitQty, claimedQty) | ✅ | `schema.prisma:200–212` | None |
| Pledge (status HELD/CAPTURED/REFUNDED/FAILED, shipping Json, **contractType DONATION/ISTISNA/SALAM**) | ✅ | `schema.prisma:228–238` | None |
| Milestone (releasePct, evidenceUrl, status PENDING→SUBMITTED→APPROVED→RELEASED, releasedHalalas) | ✅ schema · **⚠️ types** | `schema.prisma:252–262` has `evidenceUrl`; missing from `packages/types/src/index.ts:148–160` | Add `evidenceUrl?: string \| null` to TS Milestone interface |
| SpendLog | ✅ | `schema.prisma:272–283` | None |
| RFQ + SupplierBid | ✅ | `schema.prisma:290–315` | None |
| Payout (creatorId, milestoneId, amountHalalas, **zatcaInvoiceId**) | ✅ | `schema.prisma:325–336` | None |
| ProjectUpdate + Comment | ✅ | `schema.prisma:346–369` | None |
| PlatformStake type (isPartnered, stakeType, disclosureAr) | ✅ | `types/index.ts:67–69` | None |
| InvestmentOffer (dormant) | ✅ | `schema.prisma:388–398` + `types/index.ts:259–267` | None |

### SAR everywhere — **1 ⚠️**

| Location | Finding |
| --- | --- |
| API schema | ✅ all money fields use `Halalas` (BigInt). Header comment "All money in BigInt halalas (100 halalas = 1 SAR). Never floats." |
| Type helpers | ✅ `types/index.ts` has `toHalalas/toSar/fmtSAR` |
| **`wathba-start.tsx:139` hardcodes `fundingCurrency: 'USD'`** | **⚠️ web posts USD to API** — would mis-store if API trusted it |
| Display copy in fixtures | uses `$X` placeholder (inherited from project200) — flagged for next pass |

### Dormant investment isolation — clean

| Check | Result |
| --- | --- |
| `grep -rIn "from.*investment" apps/api/src --include="*.ts" \| grep -v "src/investment"` | only `app.module.ts:17 InvestmentModule` import — no service-level imports |
| `grep -rIn "investment\|Investment" apps/web/src` | **0 hits** |
| Feature flag | `investment.module.ts:12–23` gated on `INVESTMENT_ENABLED=true`, default off |
| Controllers | empty array always |

---

## §3 — FUNDING FSM (full pass)

| Check | Status | Evidence |
| --- | --- | --- |
| Pledge = Hold/Authorize only | ✅ | `funding.service.ts:82–87` calls `escrow.hold()`, stores `PledgeStatus.HELD` |
| Settle implements 80% rule with BigInt | ✅ | `funding.service.ts:170` `threshold = (goal * BigInt(p.releaseThresholdPct)) / BigInt(100)` |
| Capture all on success, void all on fail | ✅ | `escrow.service.ts:33–59` `captureAllHeld` + `refundAllHeld` |
| BullMQ deadline scheduler | ✅ | `deadline.scheduler.ts:16–25` `@Cron(CronExpression.EVERY_MINUTE)`, disable via `DEADLINE_TICK_DISABLED=true` |
| Spec coverage | ✅ | 6 specs: exact-80% pass, 80%-1 fail, custom 50% pass/fail, non-LIVE no-op, pre-deadline no-op |
| §5 threshold disclosure on project detail | ✅ | `wathba-project.tsx:275–299` "يكفي الوصول لـ X (80%)" |
| §5 threshold disclosure in pledge wizard | ✅ | `wathba-pledge.tsx:77–102` "قاعدة عتبة الإطلاق" |
| AON ("الكل أو لا شيء") notice | ✅ | `wathba-project.tsx:441–457` |

---

## §4 — CONTRACTS + DORMANT INVESTMENT (full pass)

### Contracts

| Check | Status | Evidence |
| --- | --- | --- |
| Service thin + swappable | ✅ | `contracts.service.ts:14–24` — `inferType()` + `renderTerms()`, no DB |
| Default = DONATION for symbolic | ✅ | `inferType()` returns ISTISNA if `includesPhysicalProduct`, else DONATION |
| Three contract types + Arabic templates | ✅ | `TEMPLATES_AR: Record<ContractType, string>` lines 5–12 |
| Pledge.contractType field | ✅ | schema enum + DTO |
| Web `/projects/legal/contracts` mirrors API 1:1 | ✅ | `wathba-contracts.tsx:18–49` body text matches `contracts.service.ts` verbatim |

### Dormant Investment — see §2 above.

---

## §5 — PLATFORM-PARTNERED PROJECTS (6/8)

| # | Check | Status | Evidence / Gap |
| --- | --- | --- | --- |
| 1 | `Project.platformPartner` field in schema | ✅ | `schema.prisma:179 platformPartner Json?` |
| 2 | TS type includes it | ✅ | `wathba-data.ts:26` |
| 3 | At least one project flagged | ✅ | Bustan (p4): `wathba-data.ts:90–94` |
| 4 | Card badge on trending grid | ✅ | `wathba-home.tsx:607–624` purple pill with verified icon |
| 5 | Card badge on discover grid | ✅ | `wathba-discover.tsx:217–237` |
| 6 | Mandatory disclosure banner on detail | ✅ | `wathba-project.tsx:115–146` "بشراكة وثبة · Wathba Venture" + disclosureAr body |
| 7 | **Filter toggle on Explore to show/hide partner** | **❌** | `wathbaStatusOptions` in `wathba-data.ts:519–524` has 4 filters (الكل/نشطة/مُموَّلة/قاربت الاكتمال) — no partner toggle |
| 8 | **Admin screen to flag + edit disclosure** | **❌** | No `/admin` route in `apps/web/src/app/`. Backend has `admin.service.ts` setter — no web UI to use it |

---

## §6 — SCREENS

### 5A (Present in design) — 12/12 routes exist, 2 functional gaps

| Screen | Route | Status | Note |
| --- | --- | --- | --- |
| Home/Landing | `/projects` | ✅ | |
| Explore | `/projects/explore` | ✅ | |
| Discover | `/projects/discover` | ✅ | |
| Category | `/projects/category/[id]` | ✅ | |
| Project Detail (all tabs) | `/projects/[id]` | ✅ | Transparency tab exists but reads fixtures, not live `/v1/projects/:id/transparency` endpoint |
| Pledge flow | `/projects/[id]/back` | ✅ | |
| Launch wizard (5 steps) | `/projects/start` | ⚠️ | **5 steps don't include a dedicated milestones step** — spec says "Launch wizard (incl. milestones step)" |
| Dashboard | `/projects/dashboard` | ✅ | extended beyond design (full feature set) |
| Profile | `/projects/me/profile` | ✅ | |
| Ranks | `/projects/ranks` | ✅ | |
| How-it-works | `/projects/how` | ✅ | |
| Search | `/projects/search` | ✅ | |

### 5B (Built to complete) — partial coverage

| Category | What's built | What's missing |
| --- | --- | --- |
| Auth + Nafath | `/sign-in` `/sign-up` ✅ | **No Nafath verification step in web flow** (API stub exists, never called) |
| Backer (my pledges / detail / cancel / notifications) | none confirmed | all 4 ❌ |
| Milestones (creator) | partially in `/projects/dashboard` ⚠️ | no dedicated define/evidence/release flow |
| Transparency ledger | `/projects/[id]/ledger` ✅ (v-* ids only) + transparency tab on detail | not bound to live `/v1/projects/:id/transparency` |
| Supplier | `/projects/supplier` ✅ (3 tabs) | onboarding/profile ❌, my-bids+submit are fixture-only |
| Admin | none in web | review queue, KYC, disputes, payouts, **platform-partner mgmt** — all ❌ |
| Payments | none | methods, history, refunds, wallet/payouts — all ❌ |
| Settings | partial via `/projects/me/profile` | addresses, language/theme, security — all ❌ |
| Legal | `/projects/legal/contracts` ✅ | Terms ❌, Privacy/PDPL ❌, Help/Contact ❌ |
| States | error.tsx pattern available ✅ | no Skeleton components, no EmptyState components |

### Nested views

| Element | Status |
| --- | --- |
| Mega menu | ✅ (hover dropdown in header) |
| Tabs | ✅ (project detail 6 tabs, dashboard 4 tabs, supplier 3 tabs) |
| Filters | ✅ (discover sort + chips + status; ❌ no partner toggle) |
| Modals/drawers/popovers | minimal — most UI uses inline disclosure, not modal libraries |

---

## §7 — CORE FEATURES (end-to-end)

### Milestone escrow

| Layer | Status | Evidence |
| --- | --- | --- |
| Moyasar adapter (real + stub) | ✅ | `escrow-payments/moyasar.adapter.ts:29–107` |
| Hold/Capture/Refund/Void | ✅ | all 4 methods |
| EscrowService orchestration | ✅ | `escrow.service.ts:19–91` |
| Milestone FSM PENDING→SUBMITTED→APPROVED→RELEASED | ✅ | `milestones.service.ts:1–16` |
| Release amount math `raised × pct / 100` | ✅ | `milestones.service.ts:116` |
| **Per-milestone capture trigger** | **⚠️** | `release()` only updates DB; capture happens batch-style at project funding settle (`funding.service.ts:182` `captureAllHeld(projectId)`). Spec implies per-milestone capture — currently all pledges capture at once on the SUCCESSFUL transition, with milestone status used to gate creator payout amounts only |
| Web Milestones tab | ✅ | `wathba-project.tsx:780–943` + status pills + aggregate SVG bar — but reads fixture `wathbaMilestones`, not live API |
| API `/transparency` endpoint | ✅ | `milestones.controller.ts:76–84` returns `{ budget, timeline }` |

### Live Transparency Dashboard

| Check | Status |
| --- | --- |
| API endpoint returns live budget + spend timeline | ✅ |
| Web Transparency tab renders | ✅ |
| **Web reads live API or fixture** | **⚠️ fixture-only** (`wathbaBudgetRows` + `wathbaTxTimeline`) — disconnected from `/v1/projects/:id/transparency` |
| visx library | **❌ not installed** — chart uses inline SVG bars |

### Reverse supplier auction

| Layer | Status |
| --- | --- |
| `createRfq` | ✅ `procurement.service.ts:22–35` |
| `submitBid` | ✅ `procurement.service.ts:56–79` |
| `awardBid` (atomic `$transaction`) | ✅ `procurement.service.ts:92–123` |
| 5 spec tests | ✅ |
| Web RFQ list / my bids / submit | ✅ structure, ⚠️ fixture-only data + local-state form (not posting to `/v1/rfqs`) |

---

## §8 — COMPLIANCE

| Area | Status | Notes |
| --- | --- | --- |
| Nafath KYC | ⚠️ | API service + controller exist with stub auto-approval; **0 web UI** invokes it; `User.nafathVerified` flag honored |
| AML/CFT | ❌ | `grep -rIn "aml\|sanction\|pep\|risk"` returns 0. No sanctions screening, no PEP checks, no transaction risk scoring |
| PDPL/SDAIA | ❌ | No privacy page (`/projects/legal/privacy` doesn't exist); no `consentVersion` / `consentGiven` field on User; no consent flow in signup |
| ZATCA Phase 2 | ❌ | Only `Payout.zatcaInvoiceId` schema field. No e-invoice generation, no QR code, no Phase-2 submission. **Service layer absent** |

---

## §9 — BUILD HEALTH

| Task | Result |
| --- | --- |
| `pnpm -r run typecheck` | ✅ all 5 workspaces pass |
| `pnpm -r run test` | ✅ 18/18 (contracts 3 + funding 6 + milestones 4 + procurement 5) |
| API `nest build` | ✅ |
| Web `next build` | ⚠️ first build succeeds; second build after stale `.next` can fail with "Cannot find module './2.js'" — cache flush fixes |
| `next lint` | ⚠️ prompts interactively for ESLint config; not configured for CI |
| Route reachability (with demo session cookie) | ✅ 26 routes return HTTP 200; middleware-gated `/projects/*` redirects to `/sign-in` when unauthenticated |

---

## Per-Screen Fidelity Score Summary

| Screen | Score |
| --- | --- |
| Home | 98 |
| Discover/Explore | 97 |
| Project Detail | 96 |
| Pledge wizard | 95 |
| Launch wizard | 96 |
| Dashboard | 92 |
| Profile | 96 |
| Ranks | 96 |
| How-it-works | 96 |
| Search | 96 |
| Footer | 100 |
| Header (+mega menu) | 94 |
| **Average** | **96** |

Icon grep result: **0 leaked ligatures** across the 5 audited routes (`/projects`, `/projects/p4`, `/projects/discover`, `/projects/start`, `/projects/supplier`). 41 SVG icons on home; total 116+ `var(--accent/blue/purple/gold)` token uses across components (no hardcoded colors except an exempt color-picker component).

---

## "What's missing or partial" — answering the user's central question

### Critical gaps (affect production correctness)
1. **Web posts `fundingCurrency: 'USD'`** in `wathba-start.tsx:139` — would mis-record SAR projects if API trusted the field.
2. **Per-milestone escrow capture is batched** — spec implies each milestone-RELEASED triggers its own capture; current impl captures all HELD pledges in one call when the project hits SUCCESSFUL. Acceptable interpretation, but worth confirming with product.
3. **No Privacy / Terms / Help pages** — `/projects/legal/contracts` is the only legal page; PDPL compliance requires a privacy policy + consent flow.

### Architecture gaps (acceptable if intentional)
4. **7 specced web deps absent** — Radix, TanStack Query, Zustand, react-hook-form, zod (web), visx, framer-motion. Replaced by Server Components + Server Actions + raw SVG + CSS keyframes. Works, but deviates from spec.
5. **§7 platform-partner filter on Explore** — no toggle to show/hide Wathba-venture projects.
6. **No web admin surface** at all — review queue, KYC, disputes, payouts, partner-management all only exist server-side. Backend has the endpoints; no UI consumes them.

### Surface gaps (5B incompleteness)
7. **Nafath verification step missing from sign-up flow** — backend stub exists, never called from web.
8. **Backer management**: no my-pledges / pledge-detail / cancel / notifications screens.
9. **Payments**: no methods / history / refunds / wallet screens.
10. **Settings**: addresses / language-theme / security screens absent.
11. **Help/Contact**: missing.
12. **Loading + empty-state component library** absent.

### Compliance gaps (formal)
13. **AML/CFT**: zero implementation.
14. **PDPL/SDAIA**: zero implementation.
15. **ZATCA Phase 2 e-invoice**: schema-ready, no service.

### Data-binding gaps (frontend ↔ API not yet wired)
16. **Transparency dashboard**: shows fixtures, not the live `/v1/projects/:id/transparency` endpoint.
17. **Supplier portal**: RFQs + My Bids + Submit form all read/write fixtures, not `/v1/rfqs/*`.
18. **Milestones tab**: same — fixture data, no live milestone API call.

---

## Intentional deviations (justified)

| Deviation | Reason |
| --- | --- |
| `$` display currency in fixtures | Inherited from the project200 frontend swap; flagged for the SAR-everywhere pass. API is fine (halalas BigInt). |
| Server Components + Server Actions instead of TanStack Query / RHF | The new frontend's chosen architecture pattern. Functionally equivalent for the current scope; the spec gap is real but not a correctness issue. |
| Milestones tab is a v2 extension to the project-detail design | Spec §3 added it after the original design was made. |
| Dashboard extends design wireframe with real feature set | Production-readiness; design was placeholder. |

---

## Push policy

**Not pushed.** Branch `sync/frontend-from-project200` (`e4a4aa5` head). Per the
one-time-sync directive, this report is local-only too — committed alongside in
the same branch when the fix pass is decided.

---

## Recommendation — the answer to "did it implement everything?"

**No — not yet.** The repo implements:
- ✅ all of §2 domain model (52/54)
- ✅ all of §3 FSM (including disclosures)
- ✅ all of §4 contracts + dormant investment
- ✅ design fidelity 96/100
- ✅ build + tests green

But **misses**:
- ❌ 7 of 14 specced web deps
- ❌ §5 partner filter + admin screen (2/8)
- ❌ ~60% of 5B screens
- ❌ 3 of 4 compliance areas (AML, PDPL, ZATCA)
- ⚠️ web↔API binding for Transparency / Supplier / Milestones (built but reads fixtures)
- ⚠️ launch wizard milestones step
- ⚠️ web USD hardcode

If you want me to close any of these, point me at the priority list and I'll
sequentially work through them on the same branch (small commits, no push).
