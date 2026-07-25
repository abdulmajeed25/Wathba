-- CLOSEOUT C2 — closing an RFQ told ONLY the winner. The non-winning bidders
-- were left in silence, so their bid sat "pending" forever from their side.
-- RFQ_DECIDED is the neutral courtesy notice sent to them.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'RFQ_DECIDED';
