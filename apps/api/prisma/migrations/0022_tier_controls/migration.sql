-- Creator-CC / CC-13: reward-tier close (isActive) + time-boxed early-bird price.
-- Hand-written per house rule (protects the searchVector generated column).

ALTER TABLE "RewardTier" ADD COLUMN "isActive"               BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RewardTier" ADD COLUMN "earlyBirdAmountHalalas" BIGINT;
ALTER TABLE "RewardTier" ADD COLUMN "earlyBirdUntil"         TIMESTAMP(3);
