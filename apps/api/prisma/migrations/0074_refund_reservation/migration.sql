-- Additive: historical pledges are not refunded or reclassified.
ALTER TABLE "Pledge"
  ADD COLUMN "refundRequestedAt" TIMESTAMP(3),
  ADD COLUMN "refundReservedHalalas" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "refundIssue" TEXT;
ALTER TABLE "Pledge" ADD CONSTRAINT "Pledge_refund_reservation_nonnegative" CHECK ("refundReservedHalalas" >= 0);
