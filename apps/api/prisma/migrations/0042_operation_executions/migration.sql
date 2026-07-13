-- OPS Part 0 — idempotency + replay ledger for registry-executed operations.
-- Every execute() claims a row (unique idempotencyKey); a replay with the same
-- key + inputHash returns the stored result instead of re-mutating; a replay
-- with a different inputHash is refused (409).
CREATE TABLE "OperationExecution" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL,
    "riskTier" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "OperationExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationExecution_idempotencyKey_key" ON "OperationExecution"("idempotencyKey");
CREATE INDEX "OperationExecution_operationKey_createdAt_idx" ON "OperationExecution"("operationKey", "createdAt");
CREATE INDEX "OperationExecution_actorId_createdAt_idx" ON "OperationExecution"("actorId", "createdAt");
