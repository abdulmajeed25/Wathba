-- Batch SEARCH BUG-2 — permanent cultural exclusions, seed-level purge.
-- Music leaked past the removal amendment as two subcategory rows, and the
-- romance showcase survived under film-video. All three carry 0 projects
-- (verified); the guard tests (api: exclusions-guard.spec.ts, web:
-- e2e/policy-guards.spec.ts) fail if any excluded category returns.
-- NOTE: the legacy ProjectCategory enum VALUE 'MUSIC' stays (Postgres can't
-- drop enum values in-place); it is dead — no UI offers it and the API maps
-- it to the film-video top-level node.

DELETE FROM "Category" WHERE slug IN ('music-videos', 'musical', 'romance');
