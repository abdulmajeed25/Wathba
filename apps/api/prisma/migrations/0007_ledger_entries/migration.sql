-- Sprint 1 / P1-602: append-only money journal.
-- Hand-written per house rule (protects the searchVector generated column).

CREATE TYPE "LedgerEntryType" AS ENUM ('HOLD_AUTHORIZED', 'CAPTURE', 'VOID', 'REFUND', 'PAYOUT_SENT');

CREATE TABLE "LedgerEntry" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "entryType"     "LedgerEntryType" NOT NULL,
    "amountHalalas" BIGINT NOT NULL,
    "pspRef"        TEXT NOT NULL,
    "pledgeId"      UUID,
    "payoutId"      UUID,
    "projectId"     UUID,
    "source"        TEXT NOT NULL DEFAULT 'sync-path',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LedgerEntry_pspRef_idx" ON "LedgerEntry"("pspRef");
CREATE INDEX "LedgerEntry_projectId_createdAt_idx" ON "LedgerEntry"("projectId", "createdAt");
CREATE INDEX "LedgerEntry_pledgeId_idx" ON "LedgerEntry"("pledgeId");
CREATE INDEX "LedgerEntry_entryType_createdAt_idx" ON "LedgerEntry"("entryType", "createdAt");
