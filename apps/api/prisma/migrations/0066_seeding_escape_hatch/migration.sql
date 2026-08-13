-- ----------------------------------------------------------------------------
-- Batch ACCOUNT / U8 — let a SEED build a fixture world the product forbids.
--
-- THE COLLISION. 0064 exempts rows flagged `isTestFixture`, on the reasoning
-- that the e2e suite drives one account through many concurrent campaigns. That
-- exemption turned out to be too narrow: seed-e2e-search.mjs creates three
-- projects for one creator and they MUST carry isTestFixture = false, because
-- search EXCLUDES flagged rows (stated at seed-e2e-search.mjs:31) — a flagged
-- fixture would be unfindable and the search specs would fail instead.
--
-- So the seed could not satisfy both rules at once: flag the rows and search
-- cannot see them; leave them unflagged and the trigger refuses to create them.
-- Measured: the runner died at seed with
--   PROJECT_ACTIVE_EXISTS: creator e2e5ea11-…-0001 already holds active project
-- and the whole suite has been unable to start since 0064 landed.
--
-- THE HATCH. A session GUC the trigger honours:
--
--   SET wathba.seeding = 'on'      -- or via the libpq `options` parameter
--
-- It is deliberately NOT a row flag and NOT a role check:
--
--   · A row flag was already tried and is what collided with search.
--   · A role check would grant the exemption to anything running as that role,
--     including the API. This is scoped to a CONNECTION that has said, in one
--     unmissable line, that it is building fixtures.
--
-- current_setting(..., true) returns NULL rather than raising when the setting
-- is absent, so ordinary traffic — which never sets it — takes the guard
-- unchanged. There is no default and no way to enable it accidentally: a
-- connection either asked for the exemption or did not.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "wathba_reject_second_active_project"() RETURNS TRIGGER AS $$
DECLARE
  other_id UUID;
  active_set TEXT[] := ARRAY['DRAFT','UNDER_REVIEW','SCHEDULED','LIVE','PAUSED','FUNDED','IN_PRODUCTION'];
BEGIN
  -- The escape hatch. A seeding connection is building a world, not making a
  -- product decision, and the product rule is about what a CREATOR may do.
  IF coalesce(current_setting('wathba.seeding', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW."isTestFixture" THEN
    RETURN NEW;
  END IF;

  IF NOT (NEW."status"::TEXT = ANY(active_set)) THEN
    RETURN NEW;
  END IF;

  -- 0065: a move WITHIN the active set is not an acquisition.
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

-- The self-follow guard gets the same courtesy, for the same reason: a seed
-- that needs to construct a follow graph should not be blocked by a rule about
-- what a PERSON may do.
CREATE OR REPLACE FUNCTION "wathba_reject_self_follow"() RETURNS TRIGGER AS $$
DECLARE
  target_user UUID;
BEGIN
  IF coalesce(current_setting('wathba.seeding', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;
  SELECT "userId" INTO target_user FROM "CreatorProfile" WHERE "id" = NEW."creatorProfileId";
  IF target_user = NEW."followerId" THEN
    RAISE EXCEPTION 'a user cannot follow themselves (userId=%)', NEW."followerId"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
