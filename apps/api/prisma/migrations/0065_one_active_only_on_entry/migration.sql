-- ----------------------------------------------------------------------------
-- Batch ACCOUNT / U6 — fix: the one-active-project trigger must fire on ENTRY
-- to the active set, not on every transition inside it.
--
-- WHAT WENT WRONG. 0064's trigger checked "does this creator hold another
-- non-terminal project?" on every INSERT and on every UPDATE OF status. That is
-- correct for a creator ACQUIRING a second active project, and wrong for a
-- project MOVING between active states — because a grandfathered creator holds
-- more than one by design, so the check found a sibling every time.
--
-- Measured on the demo box: creator@wathba.demo holds LIVE, FUNDED, LIVE,
-- FUNDED, and LIVE -> PAUSED was refused with PROJECT_ACTIVE_EXISTS. The same
-- refusal would have hit:
--
--   SCHEDULED -> LIVE   the launch scheduler, on every scheduled campaign
--   PAUSED    -> LIVE   a creator resuming their own campaign
--   LIVE      -> FUNDED the funding close path
--
-- for every creator the rule deliberately grandfathered. The invariant would
-- have quietly frozen their projects in place — an enforcement bug that reads
-- like a platform outage, and one no unit test would have found because the
-- trigger only misbehaves against data that predates it.
--
-- THE RULE, STATED PROPERLY. "At most one active project" is a rule about
-- TAKING ON another one. It is enforced when a row ENTERS the active set:
--
--   · INSERT of an active row, or
--   · UPDATE where the row was OUTSIDE the set and is now inside it
--     (a terminal project being revived, or a resubmission).
--
-- A row already inside the set may move within it freely. Nobody gains a second
-- active project by pausing the one they have.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "wathba_reject_second_active_project"() RETURNS TRIGGER AS $$
DECLARE
  other_id UUID;
  active_set TEXT[] := ARRAY['DRAFT','UNDER_REVIEW','SCHEDULED','LIVE','PAUSED','FUNDED','IN_PRODUCTION'];
BEGIN
  IF NEW."isTestFixture" THEN
    RETURN NEW;
  END IF;

  -- Not entering the active set at all.
  IF NOT (NEW."status"::TEXT = ANY(active_set)) THEN
    RETURN NEW;
  END IF;

  -- Already inside it: a move within the set is not an acquisition. This is the
  -- clause 0064 was missing.
  IF TG_OP = 'UPDATE' AND OLD."status"::TEXT = ANY(active_set) THEN
    RETURN NEW;
  END IF;

  SELECT "id" INTO other_id
    FROM "Project"
   WHERE "createdById" = NEW."createdById"
     AND "id" <> NEW."id"
     AND "isTestFixture" = FALSE
     AND "status"::TEXT = ANY(active_set)
   LIMIT 1;

  IF other_id IS NOT NULL THEN
    RAISE EXCEPTION 'PROJECT_ACTIVE_EXISTS: creator % already holds active project %',
      NEW."createdById", other_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
