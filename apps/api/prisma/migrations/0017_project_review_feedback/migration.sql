-- Creator-CC / CC-04: persist admin review feedback + surface it to the creator.
-- Hand-written per house rule (protects the searchVector generated column).
-- Touches "Project" — re-apply prisma/_raw/searchVector.sql after this runs.

ALTER TABLE "Project" ADD COLUMN "reviewFeedback" TEXT;
ALTER TABLE "Project" ADD COLUMN "reviewedAt" TIMESTAMP(3);
