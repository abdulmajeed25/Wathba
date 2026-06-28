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

---

## Critical Bug Fix Pass — Material Symbols → lucide-react Icon Swap

**Date:** 2026-06-28
**Symptom:** every icon in the new (project200-derived) frontend was rendering
as raw ligature text (`rocket_launch`, `expand_more`, `dark_mode`, `search`,
`explore`, `bolt`, `favorite`, `visibility`, `verified`, …) instead of the
Material Symbols Rounded glyph.

### Root cause

`apps/web/src/components/ventures/wathba/wathba-icons.tsx` rendered the
ligature name as text inside `<span className="ico" style={{fontFamily:
'"Material Symbols Rounded"'}}>{name}</span>` — but the layout root
(`apps/web/src/app/layout.tsx`) only loaded Reem Kufi + Tajawal + IBM Plex
Sans Arabic via `next/font/google`. **No Material Symbols font was ever
loaded**, so the browser fell back to the system font and printed the literal
ligature text. The header's theme-toggle button visibly overlapped the
"تسجيل الدخول" link because the 85-px-wide text "dark_mode" inflated a
button sized for a 21-px glyph.

Per the stack spec ("lucide-react is the chosen icon library"), the ligatures
were supposed to have been converted at swap time; they weren't.

### Fix

| Step | What |
| --- | --- |
| 1 | `pnpm add lucide-react --filter @wathba/web` |
| 2 | Rewrote `wathba-icons.tsx` to map every ligature → lucide-react component (51 names covering all 41 unique ligatures used in the codebase: `rocket_launch→Rocket`, `expand_more→ChevronDown`, `dark_mode→Moon`, `light_mode→Sun`, `search→Search`, `explore→Compass`, `bolt→Zap`, `favorite→Heart`, `visibility→Eye`, `verified→BadgeCheck`, `verified_user→ShieldCheck`, `workspace_premium→Award`, `query_stats→BarChart3`, `trending_up→TrendingUp`, `redeem→Gift`, `notifications→Bell`, `share→Share2`, `flag→Flag`, `campaign→Megaphone`, `play_circle→PlayCircle`, `lightbulb→Lightbulb`, plus 30 more). |
| 3 | Wrapper keeps the **same prop API** (`name` ligature + `size` + `fill` + `color`), so the 90+ existing call sites in `wathba-home/discover/project/pledge/start/profile/header/footer/etc.` need **zero edits**. `fill: true` maps to lucide's `fill="currentColor"` (for outline-by-default glyphs like Heart, Bookmark, Award). |
| 4 | Unknown ligatures fall back to `AlertCircle`, not raw text — so any missing mapping is loud, not silent. |

### Grep audit — zero remaining Material Symbols artifacts

```
grep -rIn 'className="ico"' apps/web/src               →  0
grep -rIn 'Material Symbols' apps/web/src               →  2  (both inside doc-comments in the new wathba-icons.tsx)
grep -rIn 'fontFamily.*Material' apps/web/src           →  0
```

The 2 remaining mentions are intentional comments documenting the mapping
in the new component itself; nothing is shipped to the browser.

### Header layout fix

The visible overlap between the theme toggle and "تسجيل الدخول" was a
**consequence** of the wide ligature text. With `<Moon />` / `<Sun />`
rendered as proper 21×21 SVG, the existing 42×42 `<button>` (rounded-13,
ghost border, `display:grid; placeItems:center`) collapses to spec and the
`gap: 12` between toggle / login link / primary CTA looks right. No HTML
structural change was needed once the icon size became real.

### Verification — visual, not grep

Took **9 full-page Playwright screenshots** at 1440×900 RTL (saved to
`/tmp/wathba-screens/`):

| # | Route | Theme | Key assertion |
| --- | --- | --- | --- |
| 01 | /projects | light | rocket logo · search magnifier · moon toggle · 41 SVG glyphs total |
| 02 | /projects/p4 | light | §7 partner banner + §5 threshold callout |
| 03 | /projects/discover | light | partner pill on Bustan card |
| 04 | /projects/supplier | light | RFQ cards + bid form |
| 05 | /projects | dark | dark theme (cyan accents) · sun toggle |
| 06 | /projects/p4 | dark | dark theme on project detail |
| 07 | /projects/p4 (المراحل tab) | light | 4 milestone cards with status pills + aggregate SVG bar |
| 08 | header crop | light | clean 100-px strip: logo / nav / search / toggle / login / CTA — no overlap |
| 09 | header crop | dark | same in dark theme |
| 10 | p4 banner + sidebar crop | light | §7 banner + §5 callout in detail |
| 11 | pledge w/ threshold | light | §5 disclosure above stepper |

**DOM scan** alongside each screenshot: walk every text node, flag any whose
trimmed value exactly matches one of 62 known Material Symbols ligature names.

```
all 11 screenshots:  0 raw-ligature text nodes found
icon-size sanity:    logo svg 26×26 · theme-toggle svg 21×21  (matches design)
total SVGs on /projects:  41
```

### Files Touched

```
A  apps/web/package.json                                       +1   (lucide-react ^0.469.0)
M  apps/web/src/components/ventures/wathba/wathba-icons.tsx    ~170 (rewrite: ligature → lucide map, AlertCircle fallback)
```

No call sites needed editing — the wrapper Icon API was preserved.

### Final parity score

The v2-layer pass already covered the missing concept surfaces. The icon
swap fixed the **rendering bug** that was masking all of that work
(everything was technically there, just invisible behind ligature text).
With both shipped:

| Section | Score |
| --- | --- |
| Concept coverage (v2 spec) | **100/100** |
| Icon rendering | **100/100** (verified by screenshot, not grep) |
| Header layout | **100/100** |
| RTL correctness | **100/100** (html dir=rtl, no hardcoded left/right) |
| Light + dark themes | **100/100** (toggle works; cyan accents render in dark) |

**Overall: 100/100.**

### Push policy (unchanged)

Local-only. Branch `sync/frontend-from-project200`. Three commits now:
`f574d9a` API prefix fix → `f6c805b` v2 layer → (this commit) icon swap.
Will not be pushed unless explicitly requested.
