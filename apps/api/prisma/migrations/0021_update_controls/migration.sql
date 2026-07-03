-- Creator-CC / CC-12: project-update pin, backer-only visibility, scheduling.
-- Hand-written per house rule (protects the searchVector generated column).

CREATE TYPE "UpdateVisibility" AS ENUM ('PUBLIC', 'BACKERS_ONLY');

ALTER TABLE "ProjectUpdate" ADD COLUMN "pinned"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProjectUpdate" ADD COLUMN "pinnedAt"   TIMESTAMP(3);
ALTER TABLE "ProjectUpdate" ADD COLUMN "visibility" "UpdateVisibility" NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "ProjectUpdate" ADD COLUMN "publishAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProjectUpdate" ADD COLUMN "notifiedAt" TIMESTAMP(3);

-- Existing updates are already published + already notified — backfill so the
-- scheduler never re-fans-out historical updates and ordering stays stable.
UPDATE "ProjectUpdate" SET "publishAt" = "date", "notifiedAt" = "date";

CREATE INDEX "ProjectUpdate_projectId_pinned_publishAt_idx"
  ON "ProjectUpdate"("projectId", "pinned", "publishAt");
