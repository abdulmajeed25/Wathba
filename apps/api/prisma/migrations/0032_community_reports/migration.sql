-- STAKES / S-8 (K1 K3): comment edit window + project reporting.
-- Hand-written per house rule. Touches "Comment" + new "ProjectReport";
-- does NOT alter "Project" columns (relation only — no searchVector re-apply).

ALTER TABLE "Comment" ADD COLUMN "editedAt" TIMESTAMP(3);

CREATE TABLE "ProjectReport" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId"  UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "reasonAr"   TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProjectReport_projectId_fkey" FOREIGN KEY ("projectId")
        REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProjectReport_projectId_reporterId_key" ON "ProjectReport"("projectId", "reporterId");
CREATE INDEX "ProjectReport_projectId_idx" ON "ProjectReport"("projectId");
CREATE INDEX "ProjectReport_resolvedAt_createdAt_idx" ON "ProjectReport"("resolvedAt", "createdAt");
