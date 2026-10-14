ALTER TYPE "ProjectChangeStatus" ADD VALUE 'CONSENT_OPEN';
CREATE TYPE "ProjectChangeDecision" AS ENUM ('ACCEPT', 'DECLINE');
ALTER TABLE "ProjectChangeRequest" ADD COLUMN "consentOpenedAt" TIMESTAMP(3);
CREATE TABLE "ProjectChangeResponse" (
  "id" UUID NOT NULL,
  "requestId" UUID NOT NULL,
  "pledgeId" UUID NOT NULL,
  "clientRequestId" UUID NOT NULL,
  "decision" "ProjectChangeDecision" NOT NULL,
  "pledgeSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectChangeResponse_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectChangeResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProjectChangeRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProjectChangeResponse_pledgeId_fkey" FOREIGN KEY ("pledgeId") REFERENCES "Pledge"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProjectChangeResponse_pledgeId_clientRequestId_key" ON "ProjectChangeResponse"("pledgeId", "clientRequestId");
CREATE INDEX "ProjectChangeResponse_requestId_pledgeId_createdAt_idx" ON "ProjectChangeResponse"("requestId", "pledgeId", "createdAt");
