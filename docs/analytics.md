# وثبة — Product analytics (STAKES/O1 O2 O3)

## Privacy posture (O3 — PDPL)
- **No IP address and no user-agent are ever read or stored** — the
  `AnalyticsEvent` table has no columns for them (privacy by construction).
- Anonymous visitors carry a **random** `anonId` (localStorage `wathba_anon_id`,
  `crypto.randomUUID()`); it is derived from nothing and links to nothing.
- Authenticated events attach `userId` **from the JWT only** (never the body).
  Account events are covered by the PDPL consent accepted at signup; the
  privacy page discloses this layer.
- Event names are **whitelisted server-side** (`EVENT_WHITELIST`); unknown
  names are silently dropped, so the table cannot become a free-form sink.
- PDPL erasure: `AnalyticsEvent.userId` rows are covered by the account
  anonymization flow (no PII beyond the uuid linkage).

## Event catalogue (O1)
| Event | Fired from | Carries |
|---|---|---|
| `page_view` | `PageViewTracker` (shell, every route change) | `path`, `anonId` |
| `signup` | `signUpAction` (server, post-cookie) | `userId` |
| `verify` | `verifyNafathAction` (server, post-confirm) | `userId` |
| `pledge_started` | `WathbaPledge` mount | `projectId`, viewer |
| `pledge_completed` | `POST /api/pledges` BFF on 2xx | `userId` |
| `project_submitted` | `POST /api/projects/:id/submit` BFF on 2xx | `projectId`, `userId` |

## Funnels (O2)
1. **Backer activation**: `page_view(/projects)` → `signup` → `verify` →
   `pledge_started` → `pledge_completed`.
2. **Campaign conversion** (per project): `page_view(/projects/:id | /p/:slug)`
   → `pledge_started(projectId)` → `pledge_completed`.
3. **Creator activation**: `signup` → `verify` → `page_view(/projects/submit)`
   → `project_submitted`.

Query them straight off `AnalyticsEvent` (indexed `name, createdAt`), e.g.:

```sql
SELECT date_trunc('day', "createdAt") d,
       count(*) FILTER (WHERE name = 'pledge_started')   AS started,
       count(*) FILTER (WHERE name = 'pledge_completed') AS completed
FROM "AnalyticsEvent"
WHERE "createdAt" > now() - interval '30 days'
GROUP BY 1 ORDER BY 1;
```
