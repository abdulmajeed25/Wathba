-- CLOSEOUT C4 — appeals hardening.

-- 1) A hidden comment is an enforcement action too, and it was the one the
--    appellant had no route to contest.
ALTER TYPE "AppealKind" ADD VALUE IF NOT EXISTS 'CONTENT_TAKEDOWN';

-- 2) "One live appeal per decision" was enforced only in application code
--    (findFirst, then create) — a time-of-check/time-of-use race: two
--    concurrent submissions both pass the check and both insert. Enforce it in
--    the database.
--
--    PARTIAL on purpose. A total unique on (kind, subjectId) would be wrong:
--    an OVERTURNED appeal has undone the enforcement, so if the platform later
--    re-imposes the same action against the same subject, the user must be able
--    to appeal that NEW decision. Only the states that genuinely block a new
--    appeal are covered — the two open ones plus UPHELD (already re-examined,
--    and the decision is final).
CREATE UNIQUE INDEX IF NOT EXISTS "Appeal_live_one_per_decision_key"
  ON "Appeal" ("kind", "subjectId")
  WHERE "status" IN ('SUBMITTED', 'UNDER_REVIEW', 'UPHELD');

-- 3) A dedicated trust & safety permission for the appeals queue. Until now
--    adjudication rode `moderation.queue`, so appeals access could not be
--    granted without handing over the whole moderation surface. The
--    original-actor (four-eyes) exclusion is domain logic and still overrides
--    this permission: it lets you INTO the queue, never onto your own case.
--
--    Permissions live in the OpsRole.permissions TEXT[] (same shape as 0050).
--    OWNER holds '*' so it needs no entry. Idempotent via array_append guarded
--    on NOT the-value-already-present.
UPDATE "OpsRole"
   SET "permissions" = array_append("permissions", 'trust.appeals'),
       "updatedAt"   = CURRENT_TIMESTAMP
 WHERE "key" IN ('OPS_MANAGER', 'MODERATOR')
   AND NOT ('trust.appeals' = ANY ("permissions"));
