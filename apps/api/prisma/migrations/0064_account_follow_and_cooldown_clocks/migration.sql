-- ----------------------------------------------------------------------------
-- Batch ACCOUNT / U1 — the missing follow relation, and the two timestamps the
-- cooldown rule needs in order to be a rule rather than an approximation.
--
-- Hand-written per house rule. Idempotent. Evidence: /root/account-audit.md.
--
-- ── WHY THIS IS ONE TABLE AND NOT THREE ────────────────────────────────────
-- The batch brief assumed follow/save were conflated into one overloaded
-- relation and asked for a three-way split. The audit measured otherwise:
-- CreatorFollow (schema.prisma:1044, 252 rows) and SavedProject (:1519, 167
-- rows) already exist, are already separate, and a save has never notified
-- anyone — SavedProject appears in exactly two services, neither of which
-- touches notifications. There is nothing to split and no ambiguous row to
-- classify.
--
-- What was actually missing is the opposite of the diagnosis: there is no way
-- to subscribe to a project at all. The one affordance that implied it —
-- «ذكّرني» on the campaign rail — is a bell icon with no onClick and no
-- handler. So this migration is purely ADDITIVE, moves ZERO rows, and its
-- down-path is a DROP.
--
-- Copying the 167 existing saves into ProjectFollow would opt 167 people into
-- notifications they never asked for. That is the one thing this migration
-- must never do.
-- ----------------------------------------------------------------------------


-- ── 1. ProjectFollow — «متابعة المشروع», the notification subscription ──────
--
-- Deliberately NOT a boolean on SavedProject. A save is "read later" and gets
-- cleared once read; a follow is "tell me what happens" and outlives the
-- reading. One table with a flag would make un-saving silently unsubscribe
-- you — precisely the overloading this batch exists to prevent.
CREATE TABLE IF NOT EXISTS "ProjectFollow" (
  "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "userId"    UUID         NOT NULL,
  "projectId" UUID         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProjectFollow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectFollow_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectFollow_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- The uniqueness IS the idempotency: POST /follow twice is one row, so a
-- retried request from a flaky client needs no read-then-write.
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectFollow_userId_projectId_key"
  ON "ProjectFollow" ("userId", "projectId");

-- "who follows project X" — the fan-out direction, used on publish/update.
CREATE INDEX IF NOT EXISTS "ProjectFollow_projectId_idx"
  ON "ProjectFollow" ("projectId");

-- "projects I follow", newest first — the /following read direction.
CREATE INDEX IF NOT EXISTS "ProjectFollow_userId_createdAt_idx"
  ON "ProjectFollow" ("userId", "createdAt");


-- ── 2. The two cooldown clocks ─────────────────────────────────────────────
--
-- The audit found the proposed cooldown had nothing accurate to count from:
--
--   · "30 days after a successful and SETTLED project" — Project has no
--     settlement date. The available field, updatedAt, moves on any edit, so
--     a creator who fixes a typo restarts their own waiting period.
--   · "7 days after a REJECTED project" — rejection is not even a status.
--     A rejected project sits in DRAFT with reviewFeedback set
--     (appeals.service.ts:199), so the only record of WHEN is an AuditLog row.
--
-- Owner's decision was to add the fields rather than approximate. Both are
-- NULLABLE with no backfill, and that is load-bearing, not laziness:
--
--   NULL = "this predates the rule" = no cooldown.
--
-- which is exactly the grandfathering decision — the rule applies to new
-- submissions only and never retroactively. A backfill would apply a waiting
-- period to creators who finished their campaigns before the period existed.
--
-- FAILED deliberately gets NO new column: it counts from `deadline`, which is
-- already accurate and already immutable in practice for a closed campaign.
-- There is no CANCELLED status in this schema, so that clock is dropped.
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "settledAt"  TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);

COMMENT ON COLUMN "Project"."settledAt" IS
  'Batch ACCOUNT — when the money finished moving: set once this project''s payouts reach PayoutStatus.SENT (escrow-payments/payout.disburser.ts). NOT the campaign end (that is `deadline`) and NOT the outcome decision (funding.service.ts sets SUCCESSFUL/FAILED). NULL = predates the rule, or not settled yet; either way no cooldown is counted from it.';

COMMENT ON COLUMN "Project"."rejectedAt" IS
  'Batch ACCOUNT — when ops rejected this submission. Needed because rejection is NOT a status: a rejected project sits in DRAFT with reviewFeedback set, so without this the only timestamp lives in AuditLog. Cleared on resubmit, alongside reviewFeedback. NULL = never rejected, or predates the rule.';


-- ── 3. Ops waiver of the cooldown ──────────────────────────────────────────
--
-- The DURATIONS live in SETTINGS_CATALOG (settings.catalog.ts) so ops can edit
-- them through the governed settings.update operation with a written reason and
-- an AuditLog row — not as literals in code.
--
-- This column is the per-USER exemption. A timestamp and not a boolean, so a
-- waiver lapses by itself instead of being a flag someone forgets to clear.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cooldownWaivedUntil" TIMESTAMP(3);

COMMENT ON COLUMN "User"."cooldownWaivedUntil" IS
  'Batch ACCOUNT — ops waiver of the between-projects cooldown, written only by a governed operation that records actor + reason in AuditLog. NULL = no waiver.';


-- ── 4. No self-following ───────────────────────────────────────────────────
--
-- The brief asked for CHECK (followerId <> creatorId). That cannot be written
-- against this shape: CreatorFollow carries `creatorProfileId` →
-- CreatorProfile.userId (schema.prisma:1047-1049), not a creator user id, and a
-- CHECK cannot dereference another table. A trigger is the only DB-level form
-- this invariant can take.
--
-- The API already refuses (creators.service.ts:203-205). This covers the paths
-- that do not go through it: seeds, backfills, ops SQL.
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


-- ── 5. ONE-ACTIVE-PROJECT — a trigger, and NOT a partial unique index ──────
--
-- The brief specified a partial unique index on (createdById) where status is
-- non-terminal. THAT INDEX CANNOT BE CREATED ON ANY EXISTING WATHBA DATABASE.
-- Measured on the live box before this file was written:
--
--     creators holding >1 non-terminal project ......... 61
--     ... excluding isTestFixture rows .................. 4
--     worst overall ..................................... 482  (fixture)
--     worst non-fixture ................................. 13   (smoke-s1)
--
-- CREATE UNIQUE INDEX aborts on the first duplicate, so the invariant would
-- have shipped as nothing at all — and the alternative, terminating 60
-- creators' projects to make the index buildable, is a data rewrite performed
-- to satisfy a mechanism rather than a requirement.
--
-- A BEFORE trigger enforces every write from now on and tolerates the rows
-- that predate it. That IS the grandfathering the owner asked for: the rule is
-- about what you may DO, and it starts when the rule does. The four existing
-- non-fixture creators keep what they hold and are blocked only from adding.
--
-- Fixtures are exempt: the e2e suite drives one account through many
-- concurrent campaigns by design (664 non-terminal fixture rows), so applying
-- the product invariant to them would turn this migration into a test outage.
--
-- The status list is the REAL enum (schema.prisma:90-102). The brief's
-- {DRAFT_SUBMITTED, IN_REVIEW, APPROVED, LIVE} matches no value in this
-- database: there is no APPROVED and no REJECTED.
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

  -- An UPDATE that leaves the row inside the non-terminal set (DRAFT →
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
-- must not re-run the check and fail on a grandfathered second row.
DROP TRIGGER IF EXISTS "Project_one_active_per_creator" ON "Project";
CREATE TRIGGER "Project_one_active_per_creator"
  BEFORE INSERT OR UPDATE OF "status" ON "Project"
  FOR EACH ROW EXECUTE FUNCTION "wathba_reject_second_active_project"();
