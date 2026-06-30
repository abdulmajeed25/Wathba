-- ----------------------------------------------------------------------------
-- Wathba — Postgres FTS bits we manage *outside* Prisma (N2).
--
-- Prisma's @db.Generated doesn't compose with a user-defined function, so the
-- generated `searchVector` column + the diacritic-stripping function are
-- applied via raw SQL. Idempotent — safe to re-run after `prisma db push`
-- drops the column.
--
-- Why: kasra / fatha / damma / sukun shouldn't break Arabic search matches.
--      سرب == سِرب  →  both must hit the same tsvector token.
-- ----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Parameter name kept as "t" to match the original deployment (CREATE OR
-- REPLACE refuses to rename parameters; renaming would force a DROP first).
DROP FUNCTION IF EXISTS wathba_strip_arabic_diacritics(text) CASCADE;
CREATE FUNCTION wathba_strip_arabic_diacritics(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT translate(
    COALESCE(t, ''),
    -- harakat (fathatan, dammatan, kasratan, fatha, damma, kasra, shadda,
    -- sukun, hamza-above, hamza-below, alef-maksura tatweel) + tatweel
    E'ًٌٍَُِّْٕٓٔـ',
    ''
  )
$$;

ALTER TABLE "Project"
  DROP COLUMN IF EXISTS "searchVector";

ALTER TABLE "Project"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', wathba_strip_arabic_diacritics("titleAr")),     'A') ||
    setweight(to_tsvector('simple', wathba_strip_arabic_diacritics("shortDescAr")), 'B') ||
    setweight(to_tsvector('simple', wathba_strip_arabic_diacritics("storyAr")),     'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS "Project_searchVector_gin"
  ON "Project" USING GIN ("searchVector");

CREATE INDEX IF NOT EXISTS "Project_titleAr_trgm"
  ON "Project" USING GIN ("titleAr" gin_trgm_ops);
