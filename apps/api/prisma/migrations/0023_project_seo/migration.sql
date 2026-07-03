-- Creator-CC / CC-22: SEO/social fields on Project.
-- Hand-written per house rule (protects the searchVector generated column).
-- Touches "Project" — re-apply prisma/_raw/searchVector.sql after this runs.

ALTER TABLE "Project" ADD COLUMN "slug"            TEXT;
ALTER TABLE "Project" ADD COLUMN "ogImage"         TEXT;
ALTER TABLE "Project" ADD COLUMN "metaDescription" TEXT;

CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
