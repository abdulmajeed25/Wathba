-- Creator-CC / CC-23: user reports/flags on comments.
-- Hand-written per house rule (protects the searchVector generated column).

ALTER TABLE "Comment" ADD COLUMN "reportCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CommentReport" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "commentId"  UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "reasonAr"   TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommentReport_commentId_reporterId_key" ON "CommentReport"("commentId", "reporterId");
CREATE INDEX "CommentReport_commentId_idx" ON "CommentReport"("commentId");

ALTER TABLE "CommentReport" ADD CONSTRAINT "CommentReport_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
