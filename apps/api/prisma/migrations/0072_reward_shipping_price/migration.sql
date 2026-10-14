-- Unknown historical shipping prices remain unknown; no retroactive repricing.
ALTER TABLE "RewardTier" ADD COLUMN "shippingHalalas" BIGINT;
ALTER TABLE "Pledge" ADD COLUMN "shippingHalalas" BIGINT;
