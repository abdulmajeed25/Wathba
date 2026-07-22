-- Batch OPS-GAPS R1 — the appeals workflow: an appellant (banned user or
-- rejected-project creator) submits one appeal per decision; a different
-- operator than the original decider reviews it (four-eyes).
-- Hand-written.

CREATE TYPE "AppealKind" AS ENUM ('ACCOUNT_BAN', 'PROJECT_REJECTION');

CREATE TYPE "AppealStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'UPHELD', 'OVERTURNED', 'PARTIALLY_GRANTED');

ALTER TYPE "NotificationKind" ADD VALUE 'APPEAL_RECEIVED';
ALTER TYPE "NotificationKind" ADD VALUE 'APPEAL_DECIDED';

CREATE TABLE "Appeal" (
    "id" UUID NOT NULL,
    "kind" "AppealKind" NOT NULL,
    "subjectId" UUID NOT NULL,
    "submittedById" UUID NOT NULL,
    "reasonAr" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'SUBMITTED',
    "decidedById" UUID,
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Appeal_kind_subjectId_idx" ON "Appeal"("kind", "subjectId");
CREATE INDEX "Appeal_status_createdAt_idx" ON "Appeal"("status", "createdAt");
CREATE INDEX "Appeal_submittedById_idx" ON "Appeal"("submittedById");
