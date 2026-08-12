-- ----------------------------------------------------------------------------
-- Batch ACCOUNT — the third follow relation, and two invariants the product
-- has always described but never enforced.
--
-- Hand-written per house rule. Idempotent. See docs/audits/ACCOUNT-AUDIT.md.
--
-- WHAT THIS IS *NOT*. The batch asked for three new tables (CreatorFollow,
-- ProjectFollow, ProjectSave) and a migration splitting one overloaded relation
-- into them. The audit found two of the three already exist and are populated —
-- CreatorFollow (schema.prisma:1044) and SavedProject (:1519), the latter
-- field-for-field identical to the proposed ProjectSave — and that saves and
-- follows were never overloaded in the first place: a save has no notification
-- wiring and never did. So there is nothing to split and nothing to backfill.
-- Creating ProjectSave would have produced a second bookmarks table, and the
-- "split" migration would have moved zero rows while reading like a safeguard.
--
-- What was actually missing is the OTHER half: there is no way to subscribe to
-- a project's updates at all. A reader who wants "tell me what happens" has
-- only the silent bookmark. That is the one table below.
-- ----------------------------------------------------------------------------


-- ── 1. ProjectFollow — the notification subscription ────────────────────────
--
-- Deliberately NOT merged into SavedProject with an `isFollowing` flag. They
-- are different acts with different lifetimes: a bookmark is "read later" and
-- is usually cleared once read; a follow is "tell me what happens" and outlives
-- the reading. One table with a flag would make un-saving silently unsubscribe
-- you, which is precisely the overloading this batch exists to prevent.
CREATE TABLE IF NOT EXISTS "ProjectFollow" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "userId"    UUID        NOT NULL,
  "projectId" UUID        NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProjectFollow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectFollow_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectFollow_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- The uniqueness IS the idempotency: POST /follow twice is one row, so the
-- endpoint can be safely retried by a flaky client without a read-then-write.
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectFollow_userId_projectId_key"
  ON "ProjectFollow" ("userId", "projectId");

-- Fan-out direction: "who follows project X" is the query the publish/update
-- notification path runs, so projectId leads.
CREATE INDEX IF NOT EXISTS "ProjectFollow_projectId_idx"
  ON "ProjectFollow" ("projectId");

-- Read direction: "projects I follow", newest first, for /following.
CREATE INDEX IF NOT EXISTS "ProjectFollow_userId_createdAt_idx"
  ON "ProjectFollow" ("userId", "createdAt");


-- ── 2. No self-following ────────────────────────────────────────────────────
--
-- The batch asked for `CHECK (followerId <> creatorId)`. That constraint cannot
-- be written here: CreatorFollow does not carry a creator USER id, it carries
-- `creatorProfileId` → CreatorProfile.userId (schema.prisma:1047-1049), and a
-- CHECK cannot dereference another table. A trigger is the only DB-level form
-- this invariant can take against the existing shape.
--
-- The API already refuses (creators.service.ts:203-205). This is defence in
-- depth for the paths that do not go through it — seeds, backfills, ops SQL.
CREATE OR REPLACE FUNCTION "wathba_reject_self_follow"() RETURNS TRIGGER AS $$
DECLARE
  target_user UUID;
BEGIN
  SELECT "userId" INTO target_user FROM "CreatorProfile" WHERE "id" = NEW."creatorProfileId";
  IF target_user = NEW."followerId" THEN
    RAISE EXCEPTION 'a user cannot follow themselves (userId=%)', NEW."followerId"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "CreatorFollow_no_self_follow" ON "CreatorFollow";
CREATE TRIGGER "CreatorFollow_no_self_follow"
  BEFORE INSERT OR UPDATE ON "CreatorFollow"
  FOR EACH ROW EXECUTE FUNCTION "wathba_reject_self_follow"();


-- ── 3. ONE-ACTIVE-PROJECT, as a trigger and NOT a unique index ──────────────
--
-- The batch specified a partial unique index on (createdById) where status is
-- non-terminal. THAT INDEX CANNOT BE CREATED ON ANY EXISTING WATHBA DATABASE.
-- Measured on the demo box before writing this file:
--
--     creators holding >1 non-terminal project ......... 61
--     ... excluding isTestFixture rows .................. 4
--     worst single creator .............................. 482 (fixture)
--     worst non-fixture ................................. 13 (smoke-s1)
--
-- CREATE UNIQUE INDEX would abort on the first duplicate, so the migration
-- would fail closed and the invariant would ship as nothing at all. The
-- alternative — deleting or terminating 60 creators' projects to make the
-- index buildable — is a data rewrite nobody asked for, performed to satisfy
-- a mechanism rather than a requirement.
--
-- A trigger enforces the invariant on every write from now on while tolerating
-- the rows that predate it. That is the honest reading of "a user may hold at
-- most one active project": it is a rule about what you may DO, and it starts
-- when the rule does.
--
-- Fixtures are exempt. The e2e suite drives one account through many concurrent
-- campaigns by design; making the product invariant apply to fixture rows would
-- turn this migration into a test-suite outage.
--
-- The status list is the REAL enum (schema.prisma:90-102). The batch's
-- {DRAFT_SUBMITTED, IN_REVIEW, APPROVED, LIVE} matches no value in this
-- database; there is no APPROVED and no REJECTED. Terminal states are
-- SUCCESSFUL, FAILED, DELIVERED, REFUNDED — everything else ties the creator up.
CREATE OR REPLACE FUNCTION "wathba_reject_second_active_project"() RETURNS TRIGGER AS $$
DECLARE
  other_id UUID;
BEGIN
  IF NEW."isTestFixture" THEN
    RETURN NEW;
  END IF;

  IF NEW."status" NOT IN ('DRAFT','UNDER_REVIEW','SCHEDULED','LIVE','PAUSED','FUNDED','IN_PRODUCTION') THEN
    RETURN NEW;
  END IF;

  -- An UPDATE that leaves a row inside the non-terminal set (e.g. DRAFT →
  -- UNDER_REVIEW on submit) must not count the row against itself.
  SELECT "id" INTO other_id
    FROM "Project"
   WHERE "createdById" = NEW."createdById"
     AND "id" <> NEW."id"
     AND "isTestFixture" = FALSE
     AND "status" IN ('DRAFT','UNDER_REVIEW','SCHEDULED','LIVE','PAUSED','FUNDED','IN_PRODUCTION')
   LIMIT 1;

  IF other_id IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_ACTIVE_EXISTS: creator % already holds active project %',
      NEW."createdById", other_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- INSERT and UPDATE OF status only: an ordinary edit to a live project's story
-- must not re-run the check and fail on the creator's own legacy second row.
DROP TRIGGER IF EXISTS "Project_one_active_per_creator" ON "Project";
CREATE TRIGGER "Project_one_active_per_creator"
  BEFORE INSERT OR UPDATE OF "status" ON "Project"
  FOR EACH ROW EXECUTE FUNCTION "wathba_reject_second_active_project"();


-- ── 4. Ops override for the cooldown ───────────────────────────────────────
--
-- The cooldown DURATIONS live in the settings catalog (settings.catalog.ts,
-- key `projects.cooldownDays`) so ops can edit them through the governed
-- settings.update operation with a written reason and an audit row — not as
-- literals in code, per §4.4.
--
-- This column is the per-USER waiver: "let this creator start now regardless".
-- It is deliberately a timestamp and not a boolean, so a waiver expires by
-- itself rather than being a flag someone forgets to clear.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cooldownWaivedUntil" TIMESTAMP(3);

COMMENT ON COLUMN "User"."cooldownWaivedUntil" IS
  'Batch ACCOUNT — ops waiver of the between-projects cooldown. Written only by the governed users.cooldown.waive operation, which records actor + reason in AuditLog. NULL = no waiver.';
