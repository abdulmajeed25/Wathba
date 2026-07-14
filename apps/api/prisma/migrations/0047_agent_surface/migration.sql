-- OPS Part 4 — the agent surface: AgentAccount (a principal with a role,
-- never OWNER, never money) + AgentDryRun (the no-blind-writes record).
-- Hand-written.

CREATE TABLE "AgentAccount" (
    "id" UUID NOT NULL,
    "nameAr" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "roleId" UUID NOT NULL,
    "tokenHash" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentAccount_tokenHash_key" ON "AgentAccount"("tokenHash");

ALTER TABLE "AgentAccount"
    ADD CONSTRAINT "AgentAccount_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "OpsRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AgentDryRun" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "operationKey" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentDryRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentDryRun_agentId_operationKey_inputHash_createdAt_idx"
    ON "AgentDryRun"("agentId", "operationKey", "inputHash", "createdAt");
