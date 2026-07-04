-- Batch CAT / Part 2 — editorial "Projects We Love" flag (مختارات وثبة).
-- ADMIN-only toggle (audited); drives the `staff_pick` discovery filter.
ALTER TABLE "Project" ADD COLUMN "isStaffPick" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Project_isStaffPick_status_idx" ON "Project"("isStaffPick", "status");
