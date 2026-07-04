-- Batch DISC / Part 1 — curated collections (حملات وثبة) + saved projects
-- (bookmarks). Hand-written per house rule (protects Project.searchVector).

-- Collections ---------------------------------------------------------------
CREATE TABLE "Collection" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug"          TEXT NOT NULL,
    "nameAr"        TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "isActive"      BOOLEAN NOT NULL DEFAULT false,
    "showInMenu"    BOOLEAN NOT NULL DEFAULT false,
    "sortOrder"     INTEGER NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
CREATE INDEX "Collection_isActive_sortOrder_idx" ON "Collection"("isActive", "sortOrder");

CREATE TABLE "ProjectCollection" (
    "collectionId" UUID NOT NULL,
    "projectId"    UUID NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCollection_pkey" PRIMARY KEY ("collectionId", "projectId")
);
CREATE INDEX "ProjectCollection_projectId_idx" ON "ProjectCollection"("projectId");
ALTER TABLE "ProjectCollection" ADD CONSTRAINT "ProjectCollection_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectCollection" ADD CONSTRAINT "ProjectCollection_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bookmarks -----------------------------------------------------------------
CREATE TABLE "SavedProject" (
    "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId"    UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedProject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SavedProject_userId_projectId_key" ON "SavedProject"("userId", "projectId");
CREATE INDEX "SavedProject_userId_createdAt_idx" ON "SavedProject"("userId", "createdAt");
ALTER TABLE "SavedProject" ADD CONSTRAINT "SavedProject_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedProject" ADD CONSTRAINT "SavedProject_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Perf: composite indexes for the discover facet/list hot paths (Batch DISC).
CREATE INDEX IF NOT EXISTS "Project_status_categoryId_idx" ON "Project"("status", "categoryId");
CREATE INDEX IF NOT EXISTS "Project_status_raisedHalalas_idx2" ON "Project"("status", "raisedHalalas");
