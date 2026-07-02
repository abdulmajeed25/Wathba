-- Sprint 5 / #5: dispute/chargeback handling.
-- Hand-written per house rule (protects the searchVector generated column).
-- ALTER TYPE ADD VALUE only *adds* the labels here; no statement in this
-- migration uses them, so it is transaction-safe on PG16.

ALTER TYPE "PledgeStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';
ALTER TYPE "LedgerEntryType" ADD VALUE IF NOT EXISTS 'DISPUTE';
