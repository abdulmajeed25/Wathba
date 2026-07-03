-- Creator-CC / CC-02: per-pledge fulfillment bookkeeping (KS "Status" column).
-- Hand-written per house rule (protects the searchVector generated column).
-- PURELY informational — no money path reads rewardStatus.

CREATE TYPE "RewardFulfillmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SENT');

ALTER TABLE "Pledge"
  ADD COLUMN "rewardStatus" "RewardFulfillmentStatus" NOT NULL DEFAULT 'PENDING';

-- Backer-roster fulfillment filter.
CREATE INDEX "Pledge_projectId_rewardStatus_idx" ON "Pledge"("projectId", "rewardStatus");
