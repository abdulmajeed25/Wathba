-- Additive only: existing published/scheduled campaigns keep their lifecycle.
ALTER TABLE "Project" ADD COLUMN "applicationApprovedAt" TIMESTAMP(3);
