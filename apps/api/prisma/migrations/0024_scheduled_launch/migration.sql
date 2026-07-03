-- Creator-CC / CC-20: scheduled go-live.
-- Hand-written per house rule (protects the searchVector generated column).
-- Touches "Project" — re-apply prisma/_raw/searchVector.sql after this runs.
-- ALTER TYPE ADD VALUE is a standalone additive enum change (auto-committed).

ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED' AFTER 'UNDER_REVIEW';

ALTER TABLE "Project" ADD COLUMN "scheduledLaunchAt" TIMESTAMP(3);
