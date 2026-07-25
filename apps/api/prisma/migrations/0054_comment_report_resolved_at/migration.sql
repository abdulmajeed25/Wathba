-- CLOSEOUT C1 — census A4: comment-report moderation throughput was not
-- computable because dismissal HARD-DELETED the rows and no resolution time
-- existed. Mirror ProjectReport.resolvedAt so dismissal keeps history.
ALTER TABLE "CommentReport" ADD COLUMN "resolvedAt" TIMESTAMP(3);

CREATE INDEX "CommentReport_resolvedAt_createdAt_idx"
  ON "CommentReport" ("resolvedAt", "createdAt");
