# ACCOUNT-AUDIT — account menu, follow semantics, creator dashboard gating

Phase 1 of Batch ACCOUNT. Read-only. Every claim below carries a `file:line`.
Branch `wathba-main` @ `db18bcf`. Verified against the running box
(web :3000, api :4000) as well as the source.

**Four findings contradict the batch document. Where they do, this audit wins
(§0.3 of the batch). They are listed in §6 and must be reflected in the PR.**

---

## 1.1 The account menu

**Component:** `apps/web/src/components/ventures/wathba/wathba-account-menu.tsx`
— client component, rendered by the global header
(`wathba-header.tsx`). A SECOND, independent copy of the same item list exists
in the mobile hamburger sheet at `wathba-header.tsx:308-316`.

**Item source:** a hardcoded array literal, `wathba-account-menu.tsx:108-115`.
Not config, not permissions, not i18n. Two conditional entries sit outside the
array: `الإدارة` (`:153-157`, `roles.includes('ADMIN')`) and `لوحة مشاريعي`
(`:111`, spread-conditional on `isCreator`).

`isCreator` is computed at `:103` as
`roles.includes('CREATOR') || (createdProjectsCount ?? 0) > 0` — the same
expression is independently re-derived in three other places
(`guard.ts:44`, `guard.ts:56`, `wathba-header.tsx:71`). Four copies of one rule.

### Inventory (as shipped)

| # | Label | Route | Icon | Condition | Line |
|---|---|---|---|---|---|
| — | *(name + @handle + role)* | `/u/{handle ?? id}` | — | always | `:141-151` |
| 0 | `الإدارة` | `/projects/admin` | shield | `ADMIN` | `:153-157` |
| 1 | `ملفي العام` | `/u/{handle ?? id}` | person | always | `:109` |
| 2 | `الملف الشخصي` | `/projects/me/profile` | **history** | always | `:110` |
| 3 | `لوحة مشاريعي` | `/projects/dashboard` | query_stats | `isCreator` | `:111` |
| 4 | `تعهداتي` | `/projects/me/pledges` | volunteer_activism | always | `:112` |
| 5 | `المشاريع المحفوظة` | `/projects/discover-all?only=saved` | bookmark | always | `:113` |
| 6 | `الإعدادات` | `/projects/settings` | tune | always | `:114` |
| 7 | `تسجيل الخروج` | `signOutAction` | logout | always | `:164-168` |

Note #5: saved projects is **not a page** — it is a query-param filter on the
discover surface. There is no `/saved` route.

### Accessibility

| Requirement | State | Evidence |
|---|---|---|
| `role="menu"` / `menuitem` | ✅ | `:139`, `:154`, `:159`, `:165` |
| `aria-expanded` on trigger | ✅ | `:127` |
| `aria-haspopup="menu"` | ✅ | `:126` |
| Esc closes + returns focus | ✅ | `:65` → `close(true)` → `:52` |
| Click-outside closes | ✅ | `:55-62` (mousedown) |
| **Roving tabindex / arrow keys** | ❌ **absent** | `:64-75` implements a Tab *trap* only. No `ArrowDown`/`ArrowUp`/`Home`/`End`. A `role="menu"` without arrow-key navigation is a WCAG/APG violation — the role promises an interaction model the widget does not implement. |
| Focus-visible ring | ⚠️ | no explicit `:focus-visible` style on `row` (`:195-198`); relies on UA default |
| `prefers-reduced-motion` | n/a | no transition on the panel |

**Mobile:** the panel is `position:absolute`, `minWidth:220` (`:187-191`) — no
bottom sheet, no breakpoint handling. On small screens the header instead
renders the separate hamburger list (`wathba-header.tsx:308-316`), which is a
DIFFERENT list that omits `المشاريع المحفوظة` and the admin row. **The two
menus have already drifted.**

**RTL:** correct. The panel uses `insetInlineEnd: 0` (`:188`), rows use
`textAlign:'start'` (`:197`), gap-based icon placement. No hardcoded
`left`/`right` in this file.

---

## 1.2 Profile duplication — `ملفي العام` vs `الملف الشخصي`

### What each route actually renders

**`/u/[handle]`** → `apps/web/src/app/u/[handle]/page.tsx` →
`WathbaPublicProfile`. Public + anonymous. Renders avatar, name, `@handle`,
city, join date, the three stat counters, a follow button, and the creator's
`createdProjects` grid. Data: `GET /v1/profiles/{handleOrId}`
(`wathba.ts:1086-1093`).

**`/projects/me/profile`** → `apps/web/src/app/projects/me/profile/page.tsx`
→ `WathbaProfile`, fed by `listMyBackings()`, `listMySaved()`, `getMe()`
(`page.tsx:5,14`). It renders **the signed-in user's backings and saved
projects** — a private activity list. It is not a profile in the identity
sense, and it renders nothing a visitor could see.

Its menu icon is already `history` (`wathba-account-menu.tsx:110`).

### Which one the app links to

| Target | Inbound links | Sites |
|---|---|---|
| `/u/[handle]` | **5** | `wathba-settings.tsx:119`, `wathba-notifications.tsx:303`, `dashboard/wathba-dashboard-backers.tsx:318`, `wathba-creator-tab.tsx:129`, `:138` |
| `/projects/me/profile` | **3** | `wathba-account-menu.tsx:110`, `wathba-header.tsx:313`, `wathba-pledge.tsx:856` |

Every *contextual* link in the product (a backer row, a comment author, a
notification actor, the campaign creator tab) points at `/u/`. The three links
to `/projects/me/profile` are all "my account" entry points.

### Verdict: **DISTINCT** — mislabelled, not duplicated

`/u/[handle]` is the identity surface. `/projects/me/profile` is a private
backer-activity view wearing the label `الملف الشخصي`. The duplication the
batch describes is a **labelling** collision, not a routing one: two menu rows
say "profile" while pointing at two genuinely different things.

**This triggers the batch's own contingency** (§2.1, second bullet): the route
is a history/activity view, so it is renamed to `النشاط` and re-routed rather
than deleted. The batch predicted this from the clock icon; the audit confirms
it from the data the page loads.

---

## 1.3 Follow / watch / save

### What exists

| Concept | Model | Line | Endpoints | Public? | Notifies? |
|---|---|---|---|---|---|
| Follow a **creator** | `CreatorFollow` | `schema.prisma:1044-1054` | `POST`/`DELETE /v1/creators/:userId/follow` (`creators.controller.ts:84,96`), `GET :userId/followers` (`:53`) | **public** (`followersCount`) | **yes** — `CREATOR_NEW_PROJECT` fan-out |
| Save a **project** | `SavedProject` | `schema.prisma:1519-1530` | `POST`/`DELETE /v1/discover/saved/:projectId` (`discover.controller.ts:55,63`) | private | **no** |
| Follow a **project** | — | — | — | — | — |

**`ProjectFollow` does not exist in any form.** No model, no table, no endpoint,
no button, no hook. This is the one genuinely missing relation of the three.

### Shape of what exists vs what the batch proposes

`CreatorFollow` targets **`CreatorProfile`**, not `User`:

```
followerId       → User            (relation "Follower")
creatorProfileId → CreatorProfile  (schema.prisma:1047-1049)
@@unique([followerId, creatorProfileId])
```

The batch's §3.1 proposes `creatorId → User`. These are not the same key. A
user with no `CreatorProfile` row cannot currently be followed at all.

`SavedProject` is already **field-for-field identical** to the proposed
`ProjectSave` — same columns, same `@@unique([userId, projectId])`, same
`@@index([userId, createdAt])` (`schema.prisma:1519-1530`).

### Overloading check: **none found**

Saving and following are already separate relations with separate endpoints,
and `SavedProject` has no notification wiring — grep for `SavedProject` across
`apps/api/src` returns only `discover.service.ts` and `creators.service.ts`,
neither of which touches `notifications`. **A save is already silent.** The
"one relation doing two jobs" the batch anticipates is not present.

The real defect is the inverse: there is **no way to subscribe to a project's
updates at all**. A backer who wants "tell me what happens" has only the
bookmark, which tells them nothing.

### Follower fan-out

`notifications.service` fans out `CREATOR_NEW_PROJECT` to `creatorFollow`
rows on publish, skipping the creator themselves and respecting opt-in
(`notifications.service.spec.ts:7,27,48,50`). So creator-follow → notification
is live today.

### The profile counters — **not broken**

Rendered at `wathba-public-profile.tsx:87-93` from `profile.stats.*`, via
`Stat` → `arabicCount(value)` (`:174-183`).

Live payload for `/v1/profiles/nakhil` on the running box:

```json
"stats": {"backedCount": 0, "createdCount": 1, "followersCount": 0}
```

Rendered result, verified in-browser at `http://161.97.150.122:3000/u/nakhil`:
`٠` · `١` · `٠`.

**The "bare dot" in the bug report is `٠` — U+0660 ARABIC-INDIC DIGIT ZERO,
which is glyphically a dot.** It is not a loading state, not a null, not a
broken query. The middle counter renders `١` = 1, matching `createdCount: 1`
exactly. Acceptance criterion §6.6 ("render real numbers, including 0, never a
blank") is **already satisfied**.

The genuine issue is legibility: at 22px, `٠` beside `١` reads as absence. That
is a display decision (a `min-width`, or Western digits for stat tiles), not a
data fix. See §6 contradiction (d).

---

## 1.4 Creator dashboard

### Routes — per-project already exists

- `/projects/dashboard` — picker/overview (`app/projects/dashboard/page.tsx`)
- `/projects/dashboard/[id]` — **per-project dashboard**, with 17 sub-routes:
  `activity, analytics, backers, comments, community, contests, creator, faq,
  milestones, payouts, preview, rewards, rfqs, settings, story, updates`

The batch's §4.2 asks for `/dashboard/projects/[id]`. **A per-project dashboard
already exists** under a different path with substantially the whole feature
set built.

### Gating today

| Layer | Enforcement | Evidence |
|---|---|---|
| Middleware | session cookie required for `/projects/dashboard/*` | `[id]/layout.tsx:11-13` (comment) |
| `/projects/dashboard` | `requireCreator()` → non-creators redirected to `/projects/start` | `page.tsx:21`, `guard.ts:42-47` |
| `/projects/dashboard/[id]` | **owner check** → non-owners `redirect('/projects/dashboard')`; missing → `notFound()` | `[id]/layout.tsx:24-25` |
| **status check** | ❌ **none** | the owner of a `DRAFT` project reaches the full dashboard |

So ownership is enforced; **project state is not**. §4.1's requirement is
partially met — the missing half is status, and the response is a redirect
rather than a 403.

### Zero / draft / submitted / rejected states

`listMyApplications()` is a **stub that returns `null`**
(`wathba.ts:294-300`: *"No /applications endpoint on Wathba apps/api yet"*).
The dashboard passes it into `WathbaDashboard` (`page.tsx:26,31`), so the
"applications" concept renders from nothing. There is no request/application
model in the schema at all — `grep '^model .*(Request|Review|Submission)'`
returns zero rows.

### The status enum — **differs from the batch**

`schema.prisma:90-102`:

```
DRAFT · UNDER_REVIEW · SCHEDULED · LIVE · PAUSED · SUCCESSFUL
FAILED · FUNDED · IN_PRODUCTION · DELIVERED · REFUNDED
```

There is **no `REJECTED`, no `APPROVED`, no `DRAFT_SUBMITTED`, no `IN_REVIEW`,
no `CANCELLED`.**

**A rejected project sits in `DRAFT` with `reviewFeedback` set** —
`appeals.service.ts:199` states it explicitly: *"a rejected project sits in
DRAFT with reviewFeedback"*, and `projects.service.ts:404` clears
`reviewFeedback` on resubmit. Rejection is a (status, field) pair, not a status.

Terminal, by domain reading: `SUCCESSFUL`, `FAILED`, `DELIVERED`, `REFUNDED`.
Non-terminal: `DRAFT`, `UNDER_REVIEW`, `SCHEDULED`, `LIVE`, `PAUSED`,
`FUNDED`, `IN_PRODUCTION`.

### One-active-project — **enforced nowhere**

`submitForReview` (`projects.service.ts:380-395`) checks exactly three things:
Nafath verification (`:386`), `status === DRAFT` (`:391`), and story length
≥ 200 (`:394`). **No check against the creator's other projects.** No partial
unique index in the schema, no client-side block. A user may hold any number of
concurrent live projects today.

Cooldown: **no concept exists** — no field, no config key, no code path.

---

## 1.5 Parity gaps (verified, not copied)

| Kickstarter item | Wathba equivalent | Verified status |
|---|---|---|
| Profile | `ملفي العام` → `/u/[handle]` | **exists, canonical** (5 inbound links) |
| — | `الملف الشخصي` → `/projects/me/profile` | **mislabelled activity view** — rename, don't delete (§1.2) |
| Saved projects | `المشاريع المحفوظة` | **exists as a filter, not a page** — `?only=saved`, no `/saved` route |
| Recommended for you | — | **missing** — but see §7.2, a recommender exists server-side |
| Following | — | **missing page**; `CreatorFollow` data exists and is populated |
| Settings | `الإعدادات` → `/projects/settings` | exists |
| Messages | — | **missing entirely** — no model, no endpoint, no route |
| Activity | — | **missing as a feed**; `/projects/me/profile` is the closest thing |
| Created projects + count | `لوحة مشاريعي` → `/projects/dashboard` | exists; count not shown in menu |
| + Create new project | `/projects/start`, `/projects/submit` | **exists as routes, missing from the menu** |
| Per-project entry w/ thumbnail | `/projects/dashboard/[id]` | **route exists**, not surfaced in the menu |
| — | `تعهداتي` → `/projects/me/pledges` | Wathba-only, keep |
| — | `الإدارة` → `/projects/admin` | Wathba-only, ADMIN-gated, keep |

---

## 2. Contradictions with the batch document

Listed for the PR description, per §0.3.

**(a) Two of the three "new" tables already exist.** `CreatorFollow`
(`schema.prisma:1044`) and `SavedProject` (`:1519`) are live and populated.
Only `ProjectFollow` is genuinely missing. Creating `ProjectSave` as specified
would duplicate `SavedProject` field-for-field. → Add `ProjectFollow`; **reuse**
`SavedProject`; extend `CreatorFollow` rather than replace it.

**(b) There is no data to migrate.** §3.2 assumes an ambiguous relation to
split. Saves and creator-follows are already separate, and saves already do not
notify. → The §3.2 data migration has **no rows to move**. The correct
migration is additive (one new table); a splitting migration would be a no-op
dressed as a safeguard.

**(c) The project status enum is different, and `REJECTED` is not a status.**
§4.3's non-terminal set `{DRAFT_SUBMITTED, IN_REVIEW, APPROVED, LIVE}` matches
no value in the schema. Rejection = `DRAFT` + `reviewFeedback != null`. → The
partial unique index and the API guard must be written against the real enum,
and "rejected" must be detected as a field pair.

**(d) The profile counters already work.** §1.3's premise (bare dot = broken)
is a misreading of `٠`. → §6.6 is already met. Any change here is a legibility
decision, and it should be made deliberately or not at all.

**(e) Per-project dashboards already exist** at `/projects/dashboard/[id]` with
17 sub-routes and an owner guard. §4.2 proposes `/dashboard/projects/[id]` as
new. → Add the missing **status** gate to the existing route; do not build a
parallel tree. Moving the path would break 17 sub-routes for no user-visible
gain.

---

## 3. Open questions — evidence for §7

**§7.2 `مقترَح لك`** — a recommender **exists server-side**:
`discover.service.ts` supports `only=recommended` and a
`recommendedCatIds` filter (`facets-differential.spec.ts:187` exercises both).
So this ships as a **page over the existing heuristic**, not a new engine.

**§7.3 `الرسائل`** — **no messaging system exists.** No model, no endpoint, no
route, no component. Per the batch's own instruction ("if not, this row is
deferred rather than stubbed"), **this row is deferred.**

**§7.5 `تعهداتي`** — `/projects/me/pledges` renders `listMyBackings()`, which
is not status-filtered; active and past pledges arrive in one list. Whether a
split is wanted is a product call, not a code constraint.

**§7.1 cooldown durations** and **§7.4 the project-follow label** are owner
decisions with no code evidence to offer. Both are blocking for merge.

---

## 4. What Phase 1 changes about the plan

1. Schema work shrinks to **one** new table (`ProjectFollow`) plus a
   self-follow check constraint — not three tables and a splitting migration.
2. `الملف الشخصي` is **renamed and re-routed**, not deleted (§1.2 verdict).
3. Dashboard work is **a status gate on an existing route**, not a new route
   tree.
4. `الرسائل` is **deferred**, not built.
5. `مقترَح لك` is **a page over an existing recommender**, not a new engine.
6. The counters need **no data fix**.
