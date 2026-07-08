-- STAKES / S-4 (C1-C7): user-level identity surface.
-- Hand-written per house rule. Does NOT touch "Project" (no searchVector re-apply needed).

ALTER TABLE "User" ADD COLUMN "handle"      TEXT;
ALTER TABLE "User" ADD COLUMN "avatarUrl"   TEXT;
ALTER TABLE "User" ADD COLUMN "bioAr"       TEXT;
ALTER TABLE "User" ADD COLUMN "city"        TEXT;
ALTER TABLE "User" ADD COLUMN "websiteUrl"  TEXT;
ALTER TABLE "User" ADD COLUMN "socialLinks" JSONB NOT NULL DEFAULT '[]';

-- Backfill handles from the sanitized email local-part, deduped with a
-- numeric suffix (ordered by account age so the oldest keeps the clean one).
-- Local-parts that sanitize to fewer than 3 chars stay NULL (user picks later).
WITH base AS (
  SELECT id,
         regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_.-]', '', 'g') AS raw,
         row_number() OVER (
           PARTITION BY regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_.-]', '', 'g')
           ORDER BY "createdAt", id
         ) AS rn
  FROM "User"
)
UPDATE "User" u
SET "handle" = CASE WHEN b.rn = 1 THEN b.raw ELSE b.raw || '-' || b.rn::text END
FROM base b
WHERE u.id = b.id AND length(b.raw) >= 3;

CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");
