-- Batch OPS-PRO Phase 1 — schema ground for the remaining governed
-- operations (dispute resolution, milestone evidence reject, supplier
-- verification) + the append-only LEDGER trigger (parity with the 0046
-- AuditLog chain: money records are as tamper-evident as the audit trail).
-- Hand-written.

-- ── Enum growth ─────────────────────────────────────────────────────────────

ALTER TYPE "NotificationKind" ADD VALUE 'MILESTONE_REJECTED';
ALTER TYPE "NotificationKind" ADD VALUE 'SUPPLIER_VERIFIED';

-- ── User: supplier verification (suppliers.verify) ──────────────────────────

ALTER TABLE "User"
    ADD COLUMN "supplierVerifiedAt" TIMESTAMP(3),
    ADD COLUMN "supplierVerifiedById" UUID,
    ADD COLUMN "supplierVerifyNote" TEXT;

-- ── Milestone: evidence reject feedback (milestones.evidence.reject) ────────

ALTER TABLE "Milestone" ADD COLUMN "reviewFeedbackAr" TEXT;

-- ── Pledge: dispute resolution (money.dispute.resolve) ──────────────────────

ALTER TABLE "Pledge"
    ADD COLUMN "disputeOutcome" TEXT,
    ADD COLUMN "disputeResolvedAt" TIMESTAMP(3);

-- ── LedgerEntry: append-only, tamper-evident (mirror of 0046 AuditLog) ──────
-- The ledger is the money record of truth. It was append-only by convention
-- only (a schema comment); this enforces it at the database so no operation,
-- migration, or hand-query can rewrite financial history. money.ledger.backfill
-- inserts corrective rows — it never updates or deletes, and cannot.

CREATE OR REPLACE FUNCTION ledger_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry is append-only — % is forbidden', TG_OP
    USING ERRCODE = 'raise_exception';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_no_update BEFORE UPDATE ON "LedgerEntry"
    FOR EACH ROW EXECUTE FUNCTION ledger_block_mutation();
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON "LedgerEntry"
    FOR EACH ROW EXECUTE FUNCTION ledger_block_mutation();
CREATE TRIGGER ledger_no_truncate BEFORE TRUNCATE ON "LedgerEntry"
    FOR EACH STATEMENT EXECUTE FUNCTION ledger_block_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON "LedgerEntry" FROM PUBLIC;
