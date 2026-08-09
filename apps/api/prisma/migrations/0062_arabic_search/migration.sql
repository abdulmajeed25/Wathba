-- ----------------------------------------------------------------------------
-- Batch DISCOVERY-ENGINE — real Arabic search.
--
-- Hand-written per house rule. This migration also ENDS the searchVector
-- sidecar: the tsvector column, its function and its indexes were maintained in
-- prisma/_raw/searchVector.sql, applied by hand after every deploy, and
-- documented in three places as a step that must not be forgotten. An
-- environment that forgot it 500s on search AND discover. That is a latent
-- outage kept alive by a convention, so it moves into the chain here.
--
-- WHAT WAS ACTUALLY BROKEN.
--
-- The normaliser stripped harakat and tatweel and nothing else. Arabic readers
-- routinely omit hamza, so the single most common query shape missed entirely:
--
--     search «الاحياء»  →  0 results
--     search «الأحياء»  →  3 results        (the same three projects)
--
-- Those are two different tokens to Postgres because أ (U+0623) is a
-- PRECOMPOSED codepoint, not alef + a combining mark, so `translate` over
-- combining characters never sees it. Same for ة/ه and ى/ي. The correct regex
-- has existed in this repo since the ops command palette was written; it was
-- never applied to the public search path.
--
-- WHY THE COLUMN IS DROPPED AND REBUILT RATHER THAN THE FUNCTION REPLACED.
-- CREATE OR REPLACE on an IMMUTABLE function that a generated column depends on
-- is accepted by Postgres and does NOT recompute the stored values. The column
-- would keep the old tokens forever while the query used the new ones — every
-- search silently worse, nothing failing. A drop-and-add forces the rewrite.
-- 1,244 rows here; on a large table this wants a maintenance window.
--
-- The old function name is KEPT as a thin wrapper. Nothing outside this batch
-- calls it, but a function that has been in a database for months is an API,
-- and removing one to save four lines is how a deploy breaks something nobody
-- remembered was there.
-- ----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── the normaliser ──────────────────────────────────────────────────────────
-- Two translate() passes, because the two classes of character are different
-- problems: the first REMOVES combining marks, the second FOLDS precomposed
-- letters onto their base form.
CREATE OR REPLACE FUNCTION wathba_normalize_arabic(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT translate(
    translate(
      lower(COALESCE(t, '')),
      -- REMOVE: harakat (fathatan…sukun), maddah, the two combining hamzas,
      -- and tatweel. Unchanged from the original function.
      E'ًٌٍَُِّْٕٓٔـ',
      ''
    ),
    -- FOLD: alef variants → ا, ta-marbuta → ه, alef-maksura → ي, and the
    -- Arabic-Indic digits → their ASCII counterparts so «٢٠٣٠» finds «2030».
    E'أإآٱةى٠١٢٣٤٥٦٧٨٩',
    E'اااا' || E'هي' || '0123456789'
  )
$$;

-- Back-compat shim. See the header note.
CREATE OR REPLACE FUNCTION wathba_strip_arabic_diacritics(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT wathba_normalize_arabic(t)
$$;

-- ── the search vector ───────────────────────────────────────────────────────
-- Weights unchanged: title A, short description B, story C. Creator name,
-- category names and tags are NOT here and cannot be — a generated column
-- cannot read another table. They are matched by JOIN in the query, which is
-- why the ranking blends ts_rank with explicit bonuses rather than relying on
-- setweight alone.
ALTER TABLE "Project" DROP COLUMN IF EXISTS "searchVector";

ALTER TABLE "Project"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', wathba_normalize_arabic("titleAr")),     'A') ||
    setweight(to_tsvector('simple', wathba_normalize_arabic("shortDescAr")), 'B') ||
    setweight(to_tsvector('simple', wathba_normalize_arabic("storyAr")),     'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS "Project_searchVector_gin"
  ON "Project" USING gin ("searchVector");

-- ── trigram, on the NORMALISED title ────────────────────────────────────────
-- The existing Project_titleAr_trgm is on the raw column, so it could never
-- serve a normalised comparison — the query normalised both sides and the index
-- held neither. This one matches what the query actually asks.
--
-- It also replaces `similarity(a, b) > 0.25` with the `<%` operator, which is
-- both indexable AND correct for short queries: similarity() compares against
-- the WHOLE title, so «جدا» against «طيف — جداريات الجوف» scores 0.158 and never
-- cleared the threshold, while word_similarity scores 0.750.
CREATE INDEX IF NOT EXISTS "Project_titleAr_norm_trgm"
  ON "Project" USING gin (wathba_normalize_arabic("titleAr") gin_trgm_ops);

-- Creator and tag labels, for the widened match. Category already has one
-- (migration 0041) but on the raw column, so it gets the normalised twin.
CREATE INDEX IF NOT EXISTS "User_name_norm_trgm"
  ON "User" USING gin (wathba_normalize_arabic("name") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Category_nameAr_norm_trgm"
  ON "Category" USING gin (wathba_normalize_arabic("nameAr") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Tag_nameAr_norm_trgm"
  ON "Tag" USING gin (wathba_normalize_arabic("nameAr") gin_trgm_ops);
