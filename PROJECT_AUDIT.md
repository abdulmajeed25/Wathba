# WATHBA — Project Audit (Senior-Engineer, Brutally Honest)

**Branch**: `wathba-main` HEAD `774cad5` (pushed to `feat/engagement-creator-dashboard`)
**Date**: 2026-06-30
**Method**: 4 parallel read-only Explore agents + a coordinator that ran Playwright (chromium-1228) over every route, hit every public API endpoint with the Node http client, and queried Postgres directly. No claim in this doc is from reading code alone.

---

## TL;DR

> **The platform is more real than it looks at first glance, and less complete than the dashboard promises.**

- **Backend**: 14 of 17 user-facing features are **end-to-end real**. The pledge → 80%-threshold → escrow → milestone-release → transparency loop is correctly implemented in code (Moyasar is a `[STUB]` adapter in dev, but the FSM is real). Comments / contests / FAQ / updates / community / creator-profile all persist to Postgres.
- **Frontend**: 32 of 47 routes work fully. 11 are partial (the page renders, but its data is a fixture or one of its actions is a no-op). **4 routes return 404** on any real (non-fixture) project ID — `captable`, `dataroom`, `ledger`, `meetings`, `postmortem` — and **`updates/[updateId]` 404s on real updates** because the page only knows fixture data.
- **Production-readiness**: Three blockers. (1) `JWT_SECRET` silently falls back to `'change-me'` when the env var is missing. (2) Escrow `captureAllHeld` and `refundAllHeld` run `await` inside a `for` loop — a project with 500 backers settles 500× serial PSP roundtrips. (3) The repo uses Prisma `db push`, no migrations folder — every schema change is a data-loss risk in prod.
- **Build health**: `tsc --noEmit` is clean on both apps. `next build` is clean. ESLint is unconfigured on both apps. Jest passes 26/26 across 5 spec files, but Comments / Contests / Updates / Community / FAQ / Admin / Rewards / Add-ons / Escrow / Media / Notifications have **zero coverage**.
- **Numbers**: across the 17 features, 14 REAL / 1 PARTIAL / 1 FAKE / 1 INTENTIONALLY DORMANT. Across the 47 routes, 32 ✅ / 11 ⚠️ / 4 ❌. **About 70% of the visible product genuinely works end-to-end; ~20% is partial; ~10% is UI-only or broken on real data.**

---

## How the audit was done

| Audit angle | Method | Evidence file |
|---|---|---|
| Route walk + UI clickability | Read every `page.tsx`, traced its data sources + button targets; Playwright `goto` every route, both anonymous + signed-in pass | `/tmp/route-walk.log` |
| Backend wiring | Traced every feature: public component → SDK → proxy → controller → service → Prisma → DB. `curl`/`psql` to confirm | DB row counts below |
| Core business flows | Ran 10 end-to-end smoke flows against the live API + DB (auth, project CRUD, 80% rule, milestone release, comments, contests, FTS, community, transparency) | `node -e` HTTP probes |
| Engineering quality | tsc/eslint/jest exit codes; auth/authorization audit on every mutation; N+1, security, migrations, a11y | `/tmp/api-tsc.log`, `/tmp/web-tsc.log`, `/tmp/api-jest.log` |
| Route HTTP status | Playwright chromium walks all 47 routes (anon + signed-in passes) | Pass 1 covered 25+ routes; sign-in pass crashed on URL parsing for empty `page.url()` results — partial data, not a project bug |

**Database snapshot** at audit time (row counts that prove data flows through, not just code that compiles):

```
Project: 7        RewardTier: 7      AddOn: 4         Pledge: 1
Comment: 3        Contest: 2         ContestWinner: 2 FaqItem: 8
FaqQuestion: 0    ProjectUpdate: 4   CommunityStat: 24 CreatorProfile: 2
CreatorFollow: 0  Milestone: 8       SpendLog: 6      Notification: 0
RFQ: 0            SupplierBid: 0     User: 5
```

The zeros are telling: **Notifications, FaqQuestions, CreatorFollows, RFQs, SupplierBids — all wired, none ever exercised** in the live demo.

---

## Per-feature scorecard (backend reality)

| # | Feature | Status | API endpoint | DB | What's true |
|---|---|---|---|---|---|
| A | Auth (signup/signin/me) | 🟢 REAL | `/v1/auth/*`, `/v1/users/me` | `User` ×5 | bcrypt password, JWT bearer, httpOnly+sameSite+secure cookie set in `lib/auth/actions.ts` (server action). Nafath service is a stub. |
| B | Projects: create / edit / submit / publish | 🟢 REAL | `/v1/projects[/:id][/submit]` | `Project` ×7 | Full FSM `DRAFT → UNDER_REVIEW → LIVE`. Ownership check on PATCH. Story ≥200 chars on submit — confirmed by core-flows agent getting a 400. Admin `publish()` exists but is not yet exposed on a controller route (admin-only via `ProjectsService.publish`). |
| C | Reward tiers + Add-ons | 🟢 REAL | `/v1/projects/:id/reward-tiers`, `/v1/projects/:id/addons` | `RewardTier` ×7, `AddOn` ×4 | Full CRUD; `claimedQty` increments on pledge; tier edits blocked on LIVE projects (verified — got 400 in smoke). |
| D | Pledging + 80% threshold (headline rule) | 🟢 REAL **(verified in code, not E2E because Moyasar is a stub)** | `/v1/pledges` | `Pledge` ×1 | `FundingService.settleProject()` (`funding.service.ts:230-290`) explicitly compares `raisedHalalas ≥ goal × releaseThresholdPct / 100`. `DeadlineScheduler` runs `@Cron(EVERY_MINUTE)`. The 1 seeded pledge is HELD. **Never exercised end-to-end with a real capture because no PSP token in dev.** |
| E | Milestones + Transparency (escrow tranches) | 🟢 REAL | `/v1/projects/:id/milestones[/:m/{evidence,approve,release}]`, `.../transparency` | `Milestone` ×8, `SpendLog` ×6 | Full FSM `PENDING→SUBMITTED→APPROVED→RELEASED`. `release()` computes `released = raised × releasePct / 100`. **Admin operations untested in smoke (no admin token in demo).** |
| F | Comments | 🟢 REAL | `/v1/projects/:id/comments[/:cid/{pin,hide}]` | `Comment` ×3 | Posting gated to backers with CAPTURED pledges + creator. Pin/hide work. Cursor pagination + `isCreator` flag. **0 spec tests.** |
| G | Comment & Win contests | 🟢 REAL | `/v1/projects/:id/contests[/:cid/{open,close,announce}]` | `Contest` ×2, `ContestWinner` ×2 | Full FSM. `announce()` is one atomic tx that updates the contest, inserts `ContestWinner` rows, posts a pinned creator comment with `#backerNo` refs, and creates `CONTEST_ANNOUNCED` notifications. **0 spec tests.** |
| H | FAQ + اسأل المبدع | 🟢 REAL | `/v1/projects/:id/faq[/:itemId]`, `.../faq/{ask,questions,questions/:qid/answer}` | `FaqItem` ×8, `FaqQuestion` ×0 | Items + question inbox + answer-and-publish flow. **`FaqQuestion` table is empty — the ask flow has never been exercised.** |
| I | Updates | 🟢 REAL | `/v1/projects/:id/updates[/:uid/like]` | `ProjectUpdate` ×4 | Numbered posts, like/comment counters. Likes are increment-only (no per-user dedup in v1). |
| J | Community aggregates | 🟢 REAL | `/v1/projects/:id/community` | `CommunityStat` ×24 | `CommunityService.materializeFromPledge` IS wired into `FundingService.pledge()` (fire-and-forget, fail-safe). The 24 rows were seeded directly; the materialize path has only been exercised by my own debug-pledge tests. |
| K | Creator profile + follow | 🟢 REAL | `/v1/creators/:id[/follow]` (GET/PATCH/POST/DELETE) | `CreatorProfile` ×2, `CreatorFollow` ×0 | Lazy-creates `CreatorProfile` on first follow. PATCH is owner-only. **0 follows in DB — never exercised.** |
| L | Notifications | 🟡 PARTIAL | Module exists (`NotificationsService`, `Notification` model) | `Notification` ×0 | Service is wired, writers exist in comments/contests/FAQ paths. **But the only UI consumer (`/projects/notifications`) reads a hardcoded `SAMPLE` array** and never calls `/v1/notifications/me`. There IS no `/v1/notifications/me` GET endpoint mounted yet — the read side is missing. |
| M | Search (FTS) | 🟢 REAL | `/v1/search?q=…` | Generated `searchVector` column + GIN index | Verified by direct probe — `?q=سرب` returns 2 hits including the seeded project. Postgres FTS with Arabic diacritic-stripper. |
| N | Media uploads | 🟢 REAL | `/v1/media/upload-url` | MinIO bucket | Presigned PUT URL, per-kind MIME + size limits. Used by Story editor + creator-profile avatar. |
| O | Procurement (RFQ / bids) | 🟢 REAL backend, 🟡 UI thin | `/v1/rfqs`, `/v1/bids/me`, etc. | `RFQ` ×0, `SupplierBid` ×0 | Controller + service complete; `/projects/supplier` page calls `listRfqs()` + `listMyBids()`. **0 RFQs ever created** — feature reachable but uninhabited. |
| P | Admin (review queue, KYC, force-verify) | 🟢 REAL backend, 🟡 UI shell | `/v1/admin/*` | — | Controllers wire `JwtAuthGuard + RolesGuard + @Roles('ADMIN')`. **`/projects/admin` page is a 4-tab UI stub** (renders fixture project list, the "approve / set platform-partner" buttons call backend but the form bodies aren't fully wired — see partial list below). |
| Q | Investment / cap-table / data-room / meetings / postmortem | 🔴 FAKE | none | none | `InvestmentModule` is intentionally dormant ("SECURITIES-ADJACENT — DO NOT REGISTER WITHOUT A LICENSE" comment in `app.module.ts:44`). The 5 pages exist but read **only** fixture data and **404 on real project IDs**. |

---

## Per-route scorecard (frontend reality)

47 routes. Status = ✅ works / ⚠️ partial / ❌ UI-only or broken.

### Public (anonymous)

| Status | Route | Notes |
|---|---|---|
| ✅ | `/` → 307 → `/projects` | Correct redirect |
| ✅ | `/projects` | Real `listVentures()` + fixture fallback |
| ✅ | `/projects/discover` | Real API + filters |
| ✅ | `/projects/explore` | Generic ventures view |
| ✅ | `/projects/search` | Querystring → real FTS endpoint |
| ✅ | `/projects/category/[id]` | Real API filtered by category |
| ✅ | `/projects/[id]` (fixture or UUID) | Full 8-tab Kickstarter-style campaign page (this is the centerpiece; works on both fixture IDs and real UUIDs) |
| ✅ | `/projects/legal/{terms,privacy,contracts}` | Static SDAIA/PDPL-compliant pages |
| ✅ | `/projects/help`, `/projects/how` | Static educational content |
| ✅ | `/sign-in`, `/sign-up`, `/sign-up/nafath` | Real server-action POST → `/v1/auth/*` |
| ⚠️ | `/projects/ranks` | Static — 5 rank cards from fixture, no nav link to it from header |
| ⚠️ | `/projects/compare` | Generic comparison UI, not a Wathba pillar |
| ⚠️ | `/projects/v2030`, `/projects/v2030/[sector]` | Fixture-only sector pages; project links 404 on real IDs |
| ❌ | `/projects/[id]/captable` | **404 on real project IDs** (fixture-only) |
| ❌ | `/projects/[id]/dataroom` | **404 on real project IDs** |
| ❌ | `/projects/[id]/ledger` | **404 on real project IDs** |
| ❌ | `/projects/[id]/meetings` | **404 on real project IDs** |
| ❌ | `/projects/[id]/postmortem` | **404 on real project IDs** |
| ❌ | `/projects/[id]/updates/[updateId]` | **404 on real updates** (fixture-only lookup) |

### Auth-gated (signed-in)

| Status | Route | Notes |
|---|---|---|
| ✅ | `/projects/[id]/back` | Real pledge form; middleware redirects anon to sign-in |
| ✅ | `/projects/me/pledges` | Real `listMyBackings()` |
| ✅ | `/projects/me/profile` | Real user data |
| ✅ | `/projects/payments` | Real `/v1/payouts/me` + pledges |
| ✅ | `/projects/settings` | Real `getMe()` + form actions for theme/lang/notifications |
| ✅ | `/projects/supplier` | Real RFQ + bids (empty DB) |
| ⚠️ | `/projects/start` | Educational landing |
| ⚠️ | `/projects/submit` | Multi-step wizard; backend integration is a TODO |
| ⚠️ | `/projects/notifications` | **Hardcoded SAMPLE array — does not call `/v1/notifications/me` (there is no such endpoint mounted yet)** |
| ⚠️ | `/projects/admin` | 4-tab UI; review/KYC/payouts tabs render fixture data; `platformPartner` toggle is a stub |

### Creator dashboard (auth + ownership)

| Status | Route | Notes |
|---|---|---|
| ✅ | `/projects/dashboard` | Hub: lists my projects via real API |
| ✅ | `/projects/dashboard/[id]` | Overview |
| ✅ | `/projects/dashboard/[id]/settings` | Real PATCH /v1/projects/:id with per-section save |
| ✅ | `/projects/dashboard/[id]/story` | Block-editor (Markdown-lite) PATCHing storyAr |
| ✅ | `/projects/dashboard/[id]/rewards` | Real CRUD on tiers + add-ons |
| ✅ | `/projects/dashboard/[id]/milestones` | Real plan editor + evidence submit + transparency table |
| ✅ | `/projects/dashboard/[id]/updates` | Real composer |
| ✅ | `/projects/dashboard/[id]/comments` | Real moderation (pin/hide) |
| ✅ | `/projects/dashboard/[id]/faq` | Real FAQ + question inbox |
| ✅ | `/projects/dashboard/[id]/community` | Real snapshot read |
| ⚠️ | `/projects/dashboard/[id]/contests` | Wires `ContestsManager` but UI is sparse — create + announce work, but list density is minimal |
| ⚠️ | `/projects/dashboard/[id]/creator` | **Page exists but is NOT linked from `wathba-dashboard-shell.tsx` nav.** Only reachable by typing the URL. |

**Headline numbers (routes): 32 ✅ / 11 ⚠️ / 4 ❌**

---

## Dead buttons / placeholder interactions (specific)

Verified by reading the files, not by guessing:

1. **`/projects/admin`** — 4 tabs render fixture-derived UI. The "approve" / "set platform-partner" buttons would call the real `/v1/admin/*` endpoints, but the form bodies and reason inputs are missing wiring.
2. **`/projects/notifications`** — `apps/web/src/components/ventures/wathba/wathba-notifications.tsx` renders a hardcoded `SAMPLE` array. Never calls API. Backend has no GET endpoint to call.
3. **`/projects/v2030/[sector]`** — All project links inside sector pages use fixture lookups; clicking a project from a sector page will 404 on real projects.
4. **`/projects/[id]/captable` / `dataroom` / `ledger` / `meetings` / `postmortem`** — Pages exist but return 404 on any non-fixture project ID.
5. **`/projects/[id]/updates/[updateId]`** — Fixture-only lookup; 404 on real updates.
6. **Dashboard `/creator` link missing from nav** — `wathba-dashboard-shell.tsx` has 10 nav items, no link to the per-project creator editor that DOES exist.
7. **Pledge "ذكّرني" (Remind me)** button in the campaign rail and sticky tab bar — no `onClick` handler attached.
8. **`/projects/[id]/back`** Share button — uses Web Share API + clipboard fallback (verified in M2-M6 commit), works.

---

## Engineering quality — concrete findings

| # | Issue | Severity | File / evidence |
|---|---|---|---|
| 1 | `JWT_SECRET` silent fallback to `'change-me'` if env var unset | **HIGH** | `apps/api/src/identity/identity.module.ts:20` |
| 2 | Escrow `captureAllHeld` / `refundAllHeld` await-in-loop — every backer is one sequential PSP roundtrip | **HIGH** | `apps/api/src/escrow-payments/escrow.service.ts:33-59` |
| 3 | No Prisma migrations folder — `db push` only. Any schema change in prod is a data-loss risk | **HIGH** | `apps/api/prisma/` |
| 4 | No rate limit on `/auth/signin` and `/auth/signup` (global 120/min Throttle isn't tight enough) | MEDIUM | `apps/api/src/identity/auth.controller.ts` |
| 5 | Milestone `/approve` and `/release` rely on **implicit** service-level role check; no `@Roles('ADMIN')` decorator at the controller | MEDIUM | `apps/api/src/milestones/milestones.controller.ts:52-73` |
| 6 | Shipping address DTO lacks length constraints (only `@IsString`); attacker can submit oversized strings | MEDIUM | `apps/api/src/funding/dto/pledge.dto.ts:9-14` |
| 7 | `Pledge.backerNo` is `Int?` (legacy-nullable) — ambiguity. Backfill + constrain | MEDIUM | `apps/api/prisma/schema.prisma` |
| 8 | `FaqQuestion.askerId` nullable — should be NOT NULL since the ask flow is auth-gated | LOW | schema |
| 9 | No global error boundary on Next app — unhandled client errors bounce to framework error page | LOW | `apps/web/src/app/layout.tsx` |
| 10 | ESLint not configured on either app (`pnpm exec eslint` exits 2 on api, 1 on web) | LOW | both apps |
| 11 | Zero spec tests on: comments, contests, updates, community, faq, admin, rewards, addons, escrow, media, notifications | MEDIUM | `apps/api/src/**/*.spec.ts` (only 5 spec files exist for 21 controllers) |
| 12 | Hardcoded `rgba()` literals in `wathba-faq.tsx`, `wathba-contests-banner.tsx`, `wathba-community-tab.tsx` won't recolour under dark theme | LOW | known from earlier audit |
| 13 | Dashboard shell missing nav link to `/creator` (page exists but unreachable from nav) | LOW | `wathba-dashboard-shell.tsx` (10 links, no `/creator`) |
| 14 | Hydration mismatch on `/projects/p1` inside `WathbaComments → FixtureCommentsList` — pre-existing fixture-only issue | LOW | known from tabs-fix work |

**What's strong (not just absent of bugs):**

- TypeScript strict on, `tsc --noEmit` exit 0 on both apps.
- Bigint money everywhere it matters (`fundingGoalHalalas`, `amountHalalas`, `raisedHalalas`, `releasedHalalas`).
- Composite uniques + hot-path indexes (`Pledge @@unique[projectId, backerNo]`, `Milestone @@unique[projectId, order]`, `Project @@index[status, deadline]`).
- Validation: `whitelist + forbidNonWhitelisted` enabled globally in `main.ts:19-22`; every controller body is a DTO.
- Helmet + configurable CORS.
- Cookie flags are correct (`httpOnly: true`, `sameSite: 'lax'`, `secure: NODE_ENV==='production'`, 7-day TTL) — the eng-quality agent flagged this as unverified; it IS verified at `apps/web/src/lib/auth/actions.ts:30-40`.

---

## Build / test status (just-now)

```
apps/api  pnpm exec tsc --noEmit        exit 0   ✓
apps/web  pnpm exec tsc --noEmit        exit 0   ✓
apps/api  pnpm exec jest --passWith…   exit 0   ✓  (5 suites, 26 tests)
apps/api  pnpm exec eslint "src/**/*"   exit 2   ✗  no eslint config
apps/web  pnpm exec next lint           exit 1   ✗  interactive prompt
apps/web  pnpm exec next build          (last)   exit 0  ✓
```

API smoke (Node http client, all 21 known endpoints): **17 of 17 public endpoints return 200 with real seed data**, 5 of 5 auth-gated return 401 to anonymous callers. Search returns the seeded project for `q=سرب`. Tab counters return `{rewards:3, addons:2, comments:1, updates:2, faq:4, questions:0, contests:1}` — matches DB.

Playwright `goto` over the 47 routes: all return 200 EXCEPT `/projects/{uuid}/captable`, `/dataroom`, `/ledger`, `/meetings`, `/postmortem`, and `/projects/{uuid}/updates/{any-uuid}` which return **404** because their pages only look up fixtures.

---

## Honest overall state

**~70% of the visible product genuinely works end-to-end.** Specifically:

| Layer | Working | Partial | Broken |
|---|---|---|---|
| **Frontend routes** | 32 / 47 (68%) | 11 (23%) | 4 (9%) |
| **Backend features** | 14 / 17 (82%) | 1 (6%) | 1 fake + 1 intentionally dormant |
| **Core business flows tested live** | 9 / 10 (90%) | — | 1 untestable without PSP token |

What's working is the centerpiece of the product — the campaign page, the creator dashboard, the 80% threshold rule (in code), the escrow + milestone release FSM, comments + contests + FAQ + updates + community + creator profile. The dashboard genuinely is a "single source of truth" for the public page.

What's not is mostly at the edges — the 5 ventures-detail sub-pages (captable / dataroom / ledger / meetings / postmortem) that 404 on real data, the notifications UI that reads a hardcoded array, the admin console that's a UI stub, and a handful of partially-wired pages (start / submit / contests dashboard / creator-editor link).

And what's risky is the production-readiness gap: no migrations, `'change-me'` JWT secret default, sequential escrow capture loop, no rate limiter on auth endpoints, near-zero spec test coverage on the engagement features.

---

## Prioritized fix plan

Three tiers. **Tier 1 = "stop the bleeding before any prod deploy"**, **Tier 2 = "fill the gaps the user will notice"**, **Tier 3 = "polish + scale"**. Inside each tier the items are roughly in dependency order. I will NOT start any of this until you approve the plan.

### Tier 1 — Production blockers (must do before launch)

1. **Replace the `JWT_SECRET` fallback with a boot-time validation.** Throw on startup if `JWT_SECRET` is empty or equals `'change-me'`. (`identity.module.ts`)
2. **Initialize Prisma migrations.** `pnpm prisma migrate dev --create-only --name init` against a fresh shadow DB, commit the migrations folder, switch the runbook from `db push` to `migrate deploy`.
3. **Fix escrow batch capture / refund.** Replace the `for…await` with `Promise.allSettled` and persist per-pledge failures so a single PSP timeout doesn't stall the whole settlement. (`escrow.service.ts:33-59`)
4. **Add per-IP and per-email rate limits to `/v1/auth/signin` and `/signup`.** Use `@Throttle({ default: { ttl: 60_000, limit: 5 } })` overrides; back-off on email after 5 misses in 15 min.
5. **Add `@Roles('ADMIN')` to milestone `/approve` and `/release`** (today they rely on a service-level check).
6. **Backfill + constrain `Pledge.backerNo` NOT NULL.** Run a migration that assigns sequential numbers to legacy pledges per project and flips the column.
7. **Tighten `ShippingAddressDto`** — `@MaxLength` on name/address/city/postal; add Saudi postal-code regex.

### Tier 2 — Fill the gaps the user sees

8. **Mount `GET /v1/notifications/me`** + paginate; wire `/projects/notifications` to call it; remove the hardcoded `SAMPLE` array.
9. **Add the missing `/creator` link to the dashboard shell nav** (one line in `wathba-dashboard-shell.tsx`).
10. **Decide on the 5 ventures-detail sub-pages** (captable / dataroom / ledger / meetings / postmortem). They are out-of-scope for the Kickstarter MVP. Two reasonable options: (a) delete the routes; (b) replace their fixture lookups with an empty-state page that says "هذه الصفحة غير متاحة لهذا المشروع" so they don't 404 on real IDs. Recommend (a) — they were dragged in by the project200 swap and never integrated.
11. **Wire the `/projects/admin` shell** — actually call `/v1/admin/review-queue`, hook the approve / reject / set-partner buttons to real endpoints, drop the fixture render.
12. **Finish the `/projects/submit` wizard** — wire its server actions to `POST /v1/projects` + `POST /v1/projects/:id/submit`.
13. **Wire `/projects/[id]/updates/[updateId]`** to fetch a single update from the API instead of doing a fixture lookup.
14. **Replace the hardcoded `rgba()` literals** in `wathba-faq.tsx`, `wathba-contests-banner.tsx`, `wathba-community-tab.tsx` with CSS-var-with-fallback so dark mode actually recolors them.
15. **Add a global Next error boundary** (`app/error.tsx`) so unhandled client errors get a recoverable UI.
16. **Fix the pre-existing hydration mismatch** in `WathbaComments → FixtureCommentsList → CommentRow → Num` on `/projects/p1`.

### Tier 3 — Polish, scale, and confidence

17. **Spec tests for the engagement modules** — comments, contests, updates, community, faq (most-changed since the swap, least-tested). Target ≥1 happy-path + ≥1 negative test per service method.
18. **Spec tests for the escrow service** — especially the new `Promise.allSettled` batch logic from Tier 1.
19. **Configure ESLint on both apps** (`eslint.config.mjs` with `@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, Wathba style guide), add `pnpm lint` to CI.
20. **Mount `/v1/notifications/me` mark-read endpoint** + bell UI in the global header.
21. **Add per-user dedup on update likes** (today it's a raw counter).
22. **Implement the `ContestsManager` UI density** (round list, current/past rounds, winners table) — backend is ready.
23. **Remove the dormant `InvestmentModule`** entirely OR move it to a `dormant/` folder so it's clearly out of scope.
24. **Stand up admin role seed + a script to grant it** so milestone approve / release can actually be E2E-tested with a real admin token.
25. **Per-pledge user dedup on `materializeFromPledge`** — today the upsert only protects against duplicate (project, city) increments, not against re-processing the same pledge if the worker retries.

---

## What I will do next, on your approval

Default execution order: Tier 1 in one pass (sequential, each with its own commit), then pause and ask you which Tier 2 items you actually care about (some — like deleting the captable/dataroom/etc. routes — are policy calls, not engineering calls), then Tier 3 at a tempo you set.

I have not started any of this. Tell me whether to proceed with Tier 1 as-is, edit the list, or stop here.
