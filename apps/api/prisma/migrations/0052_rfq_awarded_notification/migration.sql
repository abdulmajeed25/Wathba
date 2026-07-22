-- Batch OPS-GAPS R2 — notify the winning supplier when an RFQ is awarded
-- (by the creator or by the operator override). Hand-written.

ALTER TYPE "NotificationKind" ADD VALUE 'RFQ_AWARDED';
