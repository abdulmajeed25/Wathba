-- Batch POLISH Unit 6 — keep automated-test fixtures off the public site.
--
-- The browsable dataset is full of rows titled «مشروع E2E 1784976525442»,
-- «حملة PAY 1785073243239» and «مشروع إي٢إي …». They are not seed data: the
-- Playwright suite creates real projects through the real API (e2e/global-setup.ts,
-- creator-journey.spec.ts, batch-pay.spec.ts) and publishes them, so every run
-- leaves more behind. On this box 31 of 39 LIVE projects were fixtures and only
-- 8 were presentable.
--
-- WHY A GENERATED FLAG AND NOT A FILTER IN EACH QUERY: a title-pattern check
-- copied into five services is a check that one day gets forgotten by the sixth.
-- The database decides instead, on write, and every public read filters on one
-- boolean column.
--
-- WHY THE PREDICATE NEEDS BOTH HALVES: a real Arabic project could legitimately
-- be called «مشروع الاختبار» ("the testing project"), and a real one could
-- legitimately contain a number. Neither alone is evidence. A fixture token AND
-- a 10+ digit run (a JS Date.now() timestamp) together are — no human types a
-- 13-digit number into a campaign title.
--
-- Nothing is deleted. Existing rows are flagged, not removed: the fixtures are
-- still there for anyone who wants them, they simply stop being public. That
-- also means this is safe on an environment that has no fixtures at all, where
-- it flags nothing.

ALTER TABLE "Project" ADD COLUMN "isTestFixture" BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION "wathba_project_mark_test_fixture"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."isTestFixture" :=
    NEW."titleAr" ~ '(E2E|إي٢إي|PAY|SMOKE|TEST|SEED|FIXTURE)'
    AND NEW."titleAr" ~ '[0-9]{10,}';
  RETURN NEW;
END;
$$;

-- BEFORE INSERT OR UPDATE OF "titleAr": recomputed whenever the title is the
-- thing that changed, and never re-derived on an unrelated column write (a
-- pledge bumping raisedHalalas must not pay for a regex).
CREATE TRIGGER "project_mark_test_fixture"
  BEFORE INSERT OR UPDATE OF "titleAr" ON "Project"
  FOR EACH ROW EXECUTE FUNCTION "wathba_project_mark_test_fixture"();

-- Backfill with the same predicate the trigger uses.
UPDATE "Project"
SET "isTestFixture" = true
WHERE "titleAr" ~ '(E2E|إي٢إي|PAY|SMOKE|TEST|SEED|FIXTURE)'
  AND "titleAr" ~ '[0-9]{10,}';

-- Public listings are all (isTestFixture = false, status) lookups now.
CREATE INDEX "Project_isTestFixture_status_idx" ON "Project" ("isTestFixture", "status");
