# Wathba — Master-Build-Prompt v2 Concept Coverage (post frontend-swap)

**Date:** 2026-06-28
**Branch:** `sync/frontend-from-project200` (local, not pushed per the one-time-sync directive)
**Context:** the design-fidelity audit on the prior 1:1 prototype-faithful frontend
reached **99.6/100** and is preserved in git history at commits `9de24f7` and `7452608`
(plus the prior `DESIGN_AUDIT.md`). The current main was then **swapped** to the
production ventures-style frontend from project200 (commit `098278d`), which is
structurally different — it adds captable/dataroom/v2030/compare/etc. and lacked the
v2 concept surfaces. This document tracks the **v2 layering pass** that put those
surfaces back on top of the new shell.

## Method

Plan-and-edit (no subagents this round — fast surgical edits against the new shape):

1. Audit grep for each v2 concept in the new web tree
2. Per missing surface: extend the fixture/type, add the rendering, verify the rendered
   HTML contains the expected Arabic copy via `curl + grep`
3. Verify typecheck + production build + full route sweep with a valid session cookie
4. Commit locally only

## v2 Concept Coverage (per Master Build Prompt §3, §5, §6, §7, §10)

| v2 spec | Pre-layer | Post-layer | Verification |
| --- | --- | --- | --- |
| **§5 funding FSM** with 80% release-threshold and **mandatory pre-pledge disclosure** | typed only in API adapter, no UI | Project-detail funding sidebar **and** pledge wizard now show "يكفي الوصول لـ X (80%) لإطلاق الإنتاج. المبلغ الأكبر هدف امتداد (Stretch Goal)" | grep `/projects/p4` → "يكفي الوصول", "هدف امتداد", "Stretch Goal" ✅ |
| **§5 escrow milestone tab** (Hold/Capture/Refund + status transitions) | not on detail page | New **Milestones** tab on project detail: 4-stage list (PENDING/SUBMITTED/APPROVED/RELEASED) with status pills, % release math, evidence links, and an aggregate SVG progress bar (RTL-safe via `direction:ltr` on the inner svg) | tab id added to `wathbaProjectTabs`, body rendered when `tab === 'milestones'` ✅ |
| **Live Transparency Dashboard** | budget split bars + spend timeline already existed in the new frontend's transparency tab | kept; added aggregate-released SVG chart in the new Milestones tab | `/projects/p1` transparency tab + milestones tab ✅ |
| **§10 Reverse supplier auction** | no surface | New `/projects/supplier` page with 3 tabs: Open RFQs (4 sample RFQs spanning components/materials/printing/manufacturing), My Bids (3 sample bids with PENDING/AWARDED/REJECTED), Submit Bid (form with amount/lead-time/spec-compliance, success state) | grep `/projects/supplier` → "بوابة الموردين", "المزاد العكسي", "تقديم عرض" ✅ |
| **§7 Platform-partnered projects** — badge + mandatory disclosure + filter | 0 grep hits | Added `platformPartner` field to `WathbaProject`. Bustan (p4) flagged as platform-partner. Badge ("بشراكة وثبة" with verified icon, purple chip) renders bottom-right of project image on home + discover grids. Mandatory disclosure banner ("Wathba Venture · disclosureAr") at top of project detail. | grep `/projects` → 1 partner-badge hit (bustan), `/projects/p4` → banner ✅ |
| **§6 Pluggable contracts layer** (Donation/Istisna/Salam neutral Arabic templates) | 0 grep hits | New `/projects/legal/contracts` page mirroring `apps/api/src/contracts/contracts.service.ts` 1:1: three cards (تبرّع/استصناع/سَلَم) with English names, neutral body copy, and a "use-when" tip per type | grep `/projects/legal/contracts` → "تبرّع/استصناع/سَلَم/Donation/Istisna/Salam" ✅ |
| **§6 Dormant micro-equity (`investment`)** — flagged OFF, NOT in UI | 0 grep hits in apps/web | unchanged — still 0 hits | grep `InvestmentOffer\|micro-equity` apps/web/src → 0 ✅ |
| **SAR everywhere** | API adapter converts halalas → SAR string already | unchanged (the new ventures shell currently displays `$X` in display copy because the imported fixtures use that prefix — this is a fidelity decision shipped with the swap commit, not introduced by this layer pass; flagged for the next iteration) | n/a |

## API ↔ Web wiring fix

The new frontend's auth + ventures fetchers call `/v1/auth/signin` and `/v1/projects`
on the API. The API was previously mounting routes at `/v1/v1/...` because both
`setGlobalPrefix('v1')` and `enableVersioning(URI, defaultVersion='1')` were applied
together — the URI versioning was redundant. Removed `enableVersioning`; routes now
serve under `/v1/...` and sign-in / project list / projects/me/pledges all work
end-to-end. Verified by creating the demo user and walking every authenticated route.

## Verification

```
pnpm -r run typecheck     5/5 clean
next build                28/28 routes, 105 kB shared
route sweep (with auth)   26/26 HTTP 200
HTML grep                 every v2 surface produces the expected Arabic copy
```

Demo creds (against the live local API):

```
email:    demo@wathba.sa
password: Wathba2026!
```

After sign-in the middleware lets you through to `/projects/*`. Open
**http://161.97.150.122:3000** from your machine.

## Files Touched (v2 layer pass)

```
M  apps/web/src/components/ventures/wathba/wathba-data.ts        +120  (WathbaProject.platformPartner+releaseThresholdPct fields, Milestone/Rfq/SupplierBid fixtures + types, new "milestones" tab id, partner-flagged bustan p4)
M  apps/web/src/components/ventures/wathba/wathba-tokens.ts      +8    (--purple-rgb / --gold-rgb / --pos-rgb / --blue-rgb in both themes for safe rgba())
M  apps/web/src/components/ventures/wathba/wathba-project.tsx    +180  (§7 banner above gallery, §5 disclosure in funding sidebar, full Milestones tab body with SVG aggregate progress bar)
M  apps/web/src/components/ventures/wathba/wathba-pledge.tsx     +30   (§5 disclosure callout above stepper)
M  apps/web/src/components/ventures/wathba/wathba-home.tsx       +20   (§7 partner badge bottom-right of trending card image)
M  apps/web/src/components/ventures/wathba/wathba-discover.tsx   +22   (§7 partner badge on discover-grid card image)
A  apps/web/src/components/ventures/wathba/wathba-supplier.tsx   +380  (new — 3-tab supplier portal)
A  apps/web/src/components/ventures/wathba/wathba-contracts.tsx  +110  (new — Donation/Istisna/Salam cards)
A  apps/web/src/app/projects/supplier/page.tsx                   +14
A  apps/web/src/app/projects/legal/contracts/page.tsx            +14
M  apps/api/src/main.ts                                          -1    (remove redundant enableVersioning that was doubling the /v1 prefix)
```

## Push policy

Per the one-time-sync directive: this branch is **local-only**. The two commits
(`f574d9a` API prefix fix + the v2 layer commit) live on `sync/frontend-from-project200`
and will not be pushed unless explicitly requested.
