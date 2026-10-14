CREATE TYPE "ProjectChangeStatus" AS ENUM ('SUBMITTED', 'ACCEPTED_FOR_PREPARATION', 'REJECTED', 'WITHDRAWN');
CREATE TABLE "ProjectChangeRequest" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "requestedById" UUID NOT NULL,
  "clientRequestId" UUID NOT NULL,
  "reasonAr" TEXT NOT NULL,
  "before" JSONB NOT NULL,
  "proposed" JSONB NOT NULL,
  "status" "ProjectChangeStatus" NOT NULL DEFAULT 'SUBMITTED',
  "reviewedById" UUID,
  "reviewNoteAr" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectChangeRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectChangeRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProjectChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProjectChangeRequest_projectId_clientRequestId_key" ON "ProjectChangeRequest"("projectId", "clientRequestId");
CREATE INDEX "ProjectChangeRequest_projectId_createdAt_idx" ON "ProjectChangeRequest"("projectId", "createdAt");
CREATE INDEX "ProjectChangeRequest_status_createdAt_idx" ON "ProjectChangeRequest"("status", "createdAt");
