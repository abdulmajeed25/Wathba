-- Batch PAY — pledge flexibility & capture rules.
-- New pledge states:
--   PENDING_BNPL   — a BNPL INTENT (counts toward the total; NO contract, no
--                    money until the campaign succeeds at deadline).
--   CAPTURE_GRACE  — capture failed at settlement (card) or BNPL checkout is
--                    due; 72h window with retries at +6h/+24h/+48h.
--   FAILED_CAPTURE — grace expired: subtracted from REALIZED, tier stock
--                    released, creator notified. Terminal.
--   PENDING_REAUTH — long-campaign re-authorization failed; excluded from
--                    realized until the backer refreshes the card. Non-terminal.
ALTER TYPE "PledgeStatus" ADD VALUE IF NOT EXISTS 'PENDING_BNPL';
ALTER TYPE "PledgeStatus" ADD VALUE IF NOT EXISTS 'CAPTURE_GRACE';
ALTER TYPE "PledgeStatus" ADD VALUE IF NOT EXISTS 'FAILED_CAPTURE';
ALTER TYPE "PledgeStatus" ADD VALUE IF NOT EXISTS 'PENDING_REAUTH';

ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'PLEDGE_CANCELLED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'CAPTURE_GRACE';

-- Pledge: payment method + grace/reauth bookkeeping. tierId becomes NULLABLE:
-- true no-reward pledges (Part 3) carry an amount and no tier.
ALTER TABLE "Pledge" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'CARD';
ALTER TABLE "Pledge" ADD COLUMN "graceStartedAt" TIMESTAMP(3);
ALTER TABLE "Pledge" ADD COLUMN "graceExpiresAt" TIMESTAMP(3);
ALTER TABLE "Pledge" ADD COLUMN "captureAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Pledge" ADD COLUMN "reauthorizedAt" TIMESTAMP(3);
ALTER TABLE "Pledge" ALTER COLUMN "tierId" DROP NOT NULL;
CREATE INDEX "Pledge_status_graceExpiresAt_idx" ON "Pledge"("status", "graceExpiresAt");

-- Project: PLEDGED (raisedHalalas, frozen at deadline) vs REALIZED (actually
-- captured) are SEPARATE numbers; payouts compute from REALIZED only.
-- approvedDurationDays: admin-approved 61–120d window (Part 5).
ALTER TABLE "Project" ADD COLUMN "realizedHalalas" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN "approvedDurationDays" INTEGER;

-- Backfill realized for projects already past capture.
UPDATE "Project" p SET "realizedHalalas" = COALESCE(
  (SELECT SUM("amountHalalas" + "addOnsHalalas") FROM "Pledge"
    WHERE "projectId" = p.id AND status = 'CAPTURED'), 0);
