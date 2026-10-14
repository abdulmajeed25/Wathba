-- Additive only. Historical payouts are not reclassified or resubmitted.
ALTER TABLE "Payout"
  ADD COLUMN "providerRef" TEXT,
  ADD COLUMN "providerStatus" TEXT,
  ADD COLUMN "providerCheckedAt" TIMESTAMP(3),
  ADD COLUMN "providerSequenceNumber" TEXT,
  ADD COLUMN "providerSourceId" TEXT;
CREATE UNIQUE INDEX "Payout_providerRef_key" ON "Payout"("providerRef");
