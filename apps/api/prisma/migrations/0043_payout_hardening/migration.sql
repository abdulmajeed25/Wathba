-- OPS-0 census corrections (Batch OPS Part 0), hand-written.
--
-- Correction #3 — payout send hardening:
--   · SENDING: atomic PENDING→SENDING claim while the provider call is in
--     flight. A concurrent tick (cron + manual ops trigger) can never
--     double-send; a crash mid-flight leaves the row visibly stuck in
--     SENDING instead of silently re-payable.
--   · failureReason: PayoutStatus.FAILED becomes reachable — a terminal
--     provider rejection records why (it silently stayed PENDING before).
--
-- Correction #2 — commission withholding (offset settlement of the ZATCA
-- invoice): the disburser now transfers gross − (commission + VAT) and
-- persists both legs. amountHalalas remains the GROSS released amount.
ALTER TYPE "PayoutStatus" ADD VALUE 'SENDING';

ALTER TABLE "Payout" ADD COLUMN "feeWithheldHalalas" BIGINT;
ALTER TABLE "Payout" ADD COLUMN "netHalalas" BIGINT;
ALTER TABLE "Payout" ADD COLUMN "failureReason" TEXT;
-- When the SENDING claim was taken; stale claims (crash mid-send) are
-- surfaced every disburse tick and never auto-resent.
ALTER TABLE "Payout" ADD COLUMN "claimedAt" TIMESTAMP(3);

-- Ledger leg for the withheld commission: PAYOUT_SENT (net) + COMMISSION
-- (withheld) sum to the gross release, so the journal keeps reconciling.
ALTER TYPE "LedgerEntryType" ADD VALUE 'COMMISSION';
