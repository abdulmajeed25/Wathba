-- ----------------------------------------------------------------------------
-- Batch DISCOVERY-ENGINE Unit 5 — filters that learn which filters matter.
--
-- Hand-written per house rule.
--
-- WHAT THIS IS. A nightly job counts which facets readers actually applied over
-- a rolling 30-day window and promotes the top ones onto the homepage as a
-- second, labelled chip row. The curated row above it is untouched — this adds
-- a row, it does not replace an editorial decision with an average.
--
-- THIS IS THE FIRST READER OF AnalyticsEvent. The table has been written since
-- the STAKES batch and read by nothing; ops-analytics.service.ts ships a
-- user-facing note saying so, and that note is corrected in the same change.
--
-- PDPL. The aggregate groups by (key, value) and NOTHING ELSE. There is no
-- per-user filter profile here and there is no way to build one from this
-- table: `anonId` and `userId` are never selected, never grouped, never stored
-- on a PopularFacet row. The events themselves keep the posture they were
-- written with — no IP, no user-agent, a random client-generated anonId — and
-- this migration adds the retention bound they never had.
--
-- WHY (key, value) IS THE PRIMARY KEY. A facet IS its dimension and its value;
-- «tag=saudi-heritage» is one thing, not a row that can exist twice. A uuid id
-- would let a re-run insert a duplicate that the read path would then render
-- twice, and the bug would look like a rendering bug.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "PopularFacet" (
  -- The discover-all query param and its value: ('tag','saudi-heritage'),
  -- ('cat','technology.ai'), ('region','RIYADH'), ('duration','lt30').
  "key"         TEXT        NOT NULL,
  "value"       TEXT        NOT NULL,

  -- Resolved ONCE at recompute time, not per render. A tag renamed in ops
  -- shows its new name on the next nightly pass; the alternative is a join
  -- per homepage render against four different label tables.
  "labelAr"     TEXT        NOT NULL,
  "href"        TEXT        NOT NULL,

  -- What the window measured. `score` is the ranking number and `eventCount`
  -- is the raw evidence behind it; they are equal today, and they are separate
  -- columns so a future weighting (recency, dwell, conversion) does not have to
  -- destroy the count it was derived from.
  "score"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "eventCount"  INTEGER     NOT NULL DEFAULT 0,

  -- COLD START. A seeded row is a sensible guess, not a measurement, and it
  -- says so. Seeds carry the row until real traffic clears the threshold, then
  -- step aside. Without this the homepage ships an empty row on launch day and
  -- looks broken for a month.
  "isSeed"      BOOLEAN     NOT NULL DEFAULT false,

  -- An editor's override of the machine. A pinned row is never deactivated by
  -- the nightly pass — see the scheduler.
  "isPinned"    BOOLEAN     NOT NULL DEFAULT false,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "sortOrder"   INTEGER     NOT NULL DEFAULT 0,

  "windowStart" TIMESTAMP(3),
  "computedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PopularFacet_pkey" PRIMARY KEY ("key", "value")
);

-- The homepage read, and nothing else: active rows, pinned first, then score.
CREATE INDEX IF NOT EXISTS "PopularFacet_active_rank_idx"
  ON "PopularFacet" ("isActive", "isPinned" DESC, "sortOrder", "score" DESC);

-- ── the recompute's own index ───────────────────────────────────────────────
-- AnalyticsEvent already has (name, createdAt), which serves the window scan.
-- What it does not have is anything for the GROUP BY, and a btree cannot help
-- a group over two json extractions anyway. At the volumes here the scan is
-- the right plan; this partial index keeps the nightly pass off the rows that
-- can never match, which is most of the table.
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_discovery_window_idx"
  ON "AnalyticsEvent" ("createdAt")
  WHERE "name" IN ('filter_applied', 'search_performed');

-- ── cold start ──────────────────────────────────────────────────────────────
-- Eight guesses, chosen to span DIFFERENT dimensions rather than eight tags —
-- a first-day reader should see that the row is about filters, not that the
-- platform has tags. Every one of these is a filter that returns results today.
--
-- ON CONFLICT DO NOTHING so re-running the chain never resurrects a seed the
-- nightly pass has already retired.
INSERT INTO "PopularFacet" ("key", "value", "labelAr", "href", "isSeed", "sortOrder") VALUES
  ('status',   'live',            'حملات نشطة',        '/projects/discover-all?status=live',           true, 0),
  ('pct',      'p75_100',         'على وشك الاكتمال',  '/projects/discover-all?pct=p75_100',           true, 1),
  ('only',     'staff',           'اختيار المحررين',   '/projects/discover-all?only=staff',            true, 2),
  ('hasVideo', '1',               'فيها فيديو',        '/projects/discover-all?hasVideo=1',            true, 3),
  -- «تنتهي قريباً» as a SORT, not a duration bucket. The first draft of this
  -- seed used duration=lt30 and it returned ZERO — no campaign in the catalogue
  -- runs under 30 days — which is the same defect «قريبة منك» had: a filter
  -- offered prominently that always leads nowhere. Caught by the e2e assertion
  -- written to prevent exactly that, on the seed row of the person who wrote it.
  -- The nightly pass now verifies every promoted row still returns results.
  ('sort',     'ending',          'تنتهي قريباً',      '/projects/discover-all?sort=ending',           true, 4),
  ('region',   'RIYADH',          'الرياض',            '/projects/discover-all?region=RIYADH',         true, 5),
  ('cat',      'technology',      'التقنية',           '/projects/discover-all?cat=technology',        true, 6),
  ('sort',     'newest',          'الأحدث',            '/projects/discover-all?sort=newest',           true, 7)
ON CONFLICT ("key", "value") DO NOTHING;
