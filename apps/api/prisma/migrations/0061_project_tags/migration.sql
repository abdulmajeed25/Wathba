-- ----------------------------------------------------------------------------
-- Batch DISCOVERY-ENGINE — project tags.
--
-- Hand-written per house rule (protects the searchVector generated column).
--
-- WHY A CURATED VOCABULARY AND NOT FREE TEXT:
-- Arabic orthography fragments free-form tags in a way Latin script does not.
-- «تقنية», «تقنيه» and «تقنيّة» are one concept and three distinct strings, so a
-- free-text tag field would split the facet into near-duplicate rows that each
-- hold a fraction of the projects — and a facet that under-counts is worse than
-- no facet, because the reader trusts the number. Ops owns the vocabulary;
-- creators own which of it applies to them.
--
-- WHY DEACTIVATE AND NEVER DELETE:
-- A tag that has been used is part of a campaign's published history. Deleting
-- one would silently rewrite every project carrying it. `isActive = false` stops
-- a tag being offered and stops it faceting, and leaves the attachments intact.
-- The ON DELETE CASCADE on ProjectTag therefore only ever fires when a project
-- is genuinely deleted, never as a tag-management side effect.
--
-- WHY usageCount IS DENORMALISED:
-- The creator typeahead orders by popularity on every keystroke. A COUNT over
-- ProjectTag per suggestion is a join nobody needs on a path that runs per
-- character typed. Same trade CommunityStat already makes for per-project
-- aggregates. It is recomputed by the tag operation, so it can only drift if a
-- row is written outside that path.
--
-- Nothing is dropped and no existing row is touched: every project starts with
-- zero tags, which is exactly the behaviour it has today.
-- ----------------------------------------------------------------------------

CREATE TABLE "Tag" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "slug"       TEXT         NOT NULL,
  "nameAr"     TEXT         NOT NULL,
  "nameEn"     TEXT         NOT NULL,
  "isActive"   BOOLEAN      NOT NULL DEFAULT true,
  "usageCount" INTEGER      NOT NULL DEFAULT 0,
  "sortOrder"  INTEGER      NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag" ("slug");

-- The typeahead's ordering: active first, then most-used.
CREATE INDEX "Tag_isActive_usageCount_idx" ON "Tag" ("isActive", "usageCount");

-- Slug shape is constrained for the same reason the category slugs will be:
-- a separator inside a slug makes every path-qualified filter ambiguous.
ALTER TABLE "Tag"
  ADD CONSTRAINT "Tag_slug_shape" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

CREATE TABLE "ProjectTag" (
  "tagId"     UUID         NOT NULL,
  "projectId" UUID         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectTag_pkey" PRIMARY KEY ("tagId", "projectId")
);

-- Both directions are hot: the facet counts group by tag (served by the PK's
-- leading column), the campaign page and the search JOIN read by project.
CREATE INDEX "ProjectTag_projectId_idx" ON "ProjectTag" ("projectId");

ALTER TABLE "ProjectTag"
  ADD CONSTRAINT "ProjectTag_tagId_fkey"
  FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectTag"
  ADD CONSTRAINT "ProjectTag_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trigram index on the Arabic label, matching the one migration 0041 already
-- created for Category."nameAr". This is what makes the tag typeahead forgiving
-- of a partial or slightly misspelled word rather than prefix-only.
CREATE INDEX "Tag_nameAr_trgm_idx" ON "Tag" USING gin ("nameAr" gin_trgm_ops);
