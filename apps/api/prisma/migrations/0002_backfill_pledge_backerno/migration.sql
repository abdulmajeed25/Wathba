-- Tier 1.3 — Backfill legacy NULL backerNo values, then flip the column NOT NULL.
--
-- Pre-migration state: `Pledge.backerNo Int?` (nullable for pre-engagement-phase
-- rows that were inserted before FundingService.pledge() learnt to assign one).
-- Runtime always sets it now; this migration retro-fills any historical rows
-- and constrains the column.
--
-- Backfill rule: per project, assign sequential 1..N to rows that have NULL
-- backerNo, ordered by createdAt asc (the original pledge order). New rows
-- continue at max(backerNo) + 1, which is what the funding service already
-- does. Within a project the [projectId, backerNo] @@unique constraint stops
-- collisions.
--
-- Note: this does NOT drop or recreate the `searchVector` generated tsvector
-- column on Project. That column is managed outside Prisma (see
-- prisma/_raw/searchVector.sql); leaving it alone here is intentional.

WITH numbered AS (
  SELECT p.id,
         COALESCE(
           max_existing.max_backer,
           0
         ) + ROW_NUMBER() OVER (PARTITION BY p."projectId" ORDER BY p."createdAt" ASC, p.id ASC) AS new_backer_no
  FROM "Pledge" p
  LEFT JOIN LATERAL (
    SELECT MAX(p2."backerNo") AS max_backer
    FROM "Pledge" p2
    WHERE p2."projectId" = p."projectId" AND p2."backerNo" IS NOT NULL
  ) max_existing ON TRUE
  WHERE p."backerNo" IS NULL
)
UPDATE "Pledge" p
SET "backerNo" = n.new_backer_no
FROM numbered n
WHERE p.id = n.id;

-- Now constrain the column. If any NULLs remain (which they shouldn't after the
-- backfill above), this will error and roll back — safer than silently shipping
-- a half-applied migration.
ALTER TABLE "Pledge" ALTER COLUMN "backerNo" SET NOT NULL;
