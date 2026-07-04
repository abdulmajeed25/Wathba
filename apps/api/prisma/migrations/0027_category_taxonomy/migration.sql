-- Batch CAT / Part 1 — two-level Category tree + Project.categoryId + region.
-- Hand-written per house rule (protects the Project.searchVector generated
-- column; never `prisma migrate dev`). Data backfill + full-tree seed live in
-- prisma/seed-categories.mjs (idempotent), run right after this migration.

-- 1) Saudi administrative regions -------------------------------------------
CREATE TYPE "ProjectRegion" AS ENUM (
  'RIYADH', 'MAKKAH', 'MADINAH', 'QASSIM', 'EASTERN', 'ASIR', 'TABUK',
  'HAIL', 'NORTHERN_BORDERS', 'JAZAN', 'NAJRAN', 'BAHAH', 'JAWF'
);

-- 2) Category tree -----------------------------------------------------------
CREATE TABLE "Category" (
    "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug"      TEXT NOT NULL,
    "nameAr"    TEXT NOT NULL,
    "nameEn"    TEXT NOT NULL,
    "parentId"  UUID,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Slug unique within a parent (the /[catSlug]/[subSlug] route resolves a child
-- by (parent, slug)).
CREATE UNIQUE INDEX "Category_parentId_slug_key" ON "Category"("parentId", "slug");
-- Top-level slug global uniqueness — a partial index, because NULL parentIds
-- compare distinct in a normal composite unique.
CREATE UNIQUE INDEX "Category_toplevel_slug_key" ON "Category"("slug") WHERE "parentId" IS NULL;
CREATE INDEX "Category_parentId_sortOrder_idx" ON "Category"("parentId", "sortOrder");
CREATE INDEX "Category_slug_idx" ON "Category"("slug");

-- 3) Project — canonical taxonomy + region ----------------------------------
-- Legacy enum becomes nullable (new top-level categories have no equivalent).
ALTER TABLE "Project" ALTER COLUMN "category" DROP NOT NULL;
ALTER TABLE "Project" ADD COLUMN "categoryId" UUID;
ALTER TABLE "Project" ADD COLUMN "region" "ProjectRegion";

ALTER TABLE "Project" ADD CONSTRAINT "Project_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Project_categoryId_status_idx" ON "Project"("categoryId", "status");
CREATE INDEX "Project_region_status_idx" ON "Project"("region", "status");
