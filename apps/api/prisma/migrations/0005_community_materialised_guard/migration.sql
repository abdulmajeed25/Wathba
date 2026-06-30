-- Tier 3.5 — Per-pledge idempotency guard for community aggregates.
--
-- CommunityService.materializeFromPledge is called as a fire-and-forget after
-- the pledge tx commits. If a worker / scheduler ever retries it (network
-- blip, restart, manual re-run), the upserts on CommunityStat happily
-- increment again — double-counting the same backer.
--
-- This table is the dedup lock: the service tries to INSERT a row keyed on
-- pledgeId before doing any aggregate work. A PK collision means "already
-- materialised, skip". No backfill needed — existing CommunityStat rows came
-- from the seed, not from this code path, so leaving the table empty until
-- new pledges arrive is correct.

CREATE TABLE "CommunityMaterialised" (
  "pledgeId"  uuid                        NOT NULL,
  "appliedAt" timestamp(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityMaterialised_pkey" PRIMARY KEY ("pledgeId")
);

ALTER TABLE "CommunityMaterialised"
  ADD CONSTRAINT "CommunityMaterialised_pledgeId_fkey"
    FOREIGN KEY ("pledgeId") REFERENCES "Pledge"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
