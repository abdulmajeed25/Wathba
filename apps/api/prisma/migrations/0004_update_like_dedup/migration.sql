-- Tier 3.4 — Per-user dedup on ProjectUpdate likes.
--
-- Pre-migration: POST /v1/projects/:id/updates/:uid/like blindly incremented
-- ProjectUpdate.likeCount on every call — a logged-in user could spam likes
-- by reposting. Adds an UpdateLike join table keyed on (updateId, userId)
-- so the service can:
--   1. INSERT on first like        → likeCount + 1
--   2. DELETE on toggle-off        → likeCount - 1
--   3. throw on duplicate insert   → constraint enforces idempotency
--
-- Backfill: existing likeCount values stay (they're a denormalised counter,
-- not derivable from join rows that don't exist yet). New likes from now on
-- write join rows; the counter stays in sync atomically.

CREATE TABLE "UpdateLike" (
  "updateId"  uuid                        NOT NULL,
  "userId"    uuid                        NOT NULL,
  "createdAt" timestamp(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UpdateLike_pkey" PRIMARY KEY ("updateId", "userId")
);

CREATE INDEX "UpdateLike_userId_idx" ON "UpdateLike" ("userId");

ALTER TABLE "UpdateLike"
  ADD CONSTRAINT "UpdateLike_updateId_fkey"
    FOREIGN KEY ("updateId") REFERENCES "ProjectUpdate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UpdateLike"
  ADD CONSTRAINT "UpdateLike_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
