-- Creator-CC / CC-14: pause/unpause a LIVE campaign.
-- Hand-written per house rule (protects the searchVector generated column).
-- Touches "Project" — re-apply prisma/_raw/searchVector.sql after this runs.
-- ALTER TYPE ADD VALUE is a standalone additive enum change (auto-committed).

ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'PAUSED' AFTER 'LIVE';

ALTER TABLE "Project" ADD COLUMN "pausedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "pausedMsAccrued" BIGINT NOT NULL DEFAULT 0;
