-- Creator-CC / CC-11 + CC-13: public transparency change-log.
-- Hand-written per house rule (protects the searchVector generated column).

CREATE TABLE "ProjectChangeLog" (
    "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "actorId"   UUID,
    "field"     TEXT NOT NULL,
    "summaryAr" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectChangeLog_projectId_createdAt_idx"
  ON "ProjectChangeLog"("projectId", "createdAt");

ALTER TABLE "ProjectChangeLog" ADD CONSTRAINT "ProjectChangeLog_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
