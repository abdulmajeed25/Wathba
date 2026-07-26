-- Batch POLISH Unit 1/2 — reframe the curated editorial content around MERIT.
--
-- Migration 0039 seeded a HERO_BANNER titled «مبدعات سعوديات» ("Saudi women
-- creators"). Per the owner's explicit direction, Wathba's curated surfaces
-- celebrate the WORK — biggest, best, boldest — and are open to every creator
-- without pre-classification by gender, ethnicity or minority status. So this
-- banner is reframed rather than merely hidden: the slot now promotes
-- «تحت الأضواء» (/spotlight), which is the merit-based version of the same idea.
--
-- 0039 is already applied everywhere and migrations are immutable, so the
-- correction lands here as a data migration.
--
-- Note the banner also carried a DEAD link: it pointed at
-- ?collection=saudi-women-creators, a slug that has never existed (the seeded
-- collection is `women-creators`). Fixed by the same statement.
--
-- Idempotent and non-destructive: matches on the exact old title, so re-running
-- is a no-op and an operator's own later edits are never overwritten.

UPDATE "EditorialCard"
SET "titleAr"     = 'تحت الأضواء',
    "bodyAr"      = 'أضخم المشاريع وأنجحها، ومختارات فريق وثبة، وأكثر الأعمال إبداعاً — في صفحة واحدة.',
    "linkUrl"     = '/spotlight',
    "linkLabelAr" = 'شاهد المختارات'
WHERE "kind" = 'HERO_BANNER'
  AND "titleAr" = 'مبدعات سعوديات';

-- The paired collection: identity-defined, inactive since it was seeded, and
-- holding no projects. Removed only when genuinely empty — a collection an
-- operator has since filled is data, and this migration will not discard it.
DELETE FROM "Collection" c
WHERE c."slug" = 'women-creators'
  AND NOT EXISTS (SELECT 1 FROM "ProjectCollection" pc WHERE pc."collectionId" = c."id");
