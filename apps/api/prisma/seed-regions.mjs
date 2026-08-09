// Batch DISCOVERY-ENGINE — give demo projects a region.
// Idempotent: only fills NULLs, never overwrites. Run after migrate deploy.
//
//   node prisma/seed-regions.mjs
//
// WHY. `region` was set on 26 of 517 live projects — 5% — so the location facet
// showed a handful of counts against thirteen options and read as broken. It
// was not broken; it had nothing to count. And «قريبة منك» compounded it: that
// filter REQUIRES a region and returns an empty list without one, while nothing
// in the UI ever set it, so the chip was dead on every surface.
//
// The chip now routes to the location facet instead of guessing (see
// wathba-discover-category.tsx). This gives that facet something to show.
//
// DERIVED FROM THE PROJECT'S OWN TEXT where it can be, so «مزارع القصيم» lands
// in القصيم rather than somewhere random. Everything else is distributed
// deterministically by id hash — deterministic, not random, so a re-run is a
// no-op and two environments seeded from the same data agree.
//
// Fixtures are skipped, as everywhere else.
import { PrismaClient } from '@prisma/client';

/** Region enum → words that imply it, matched against title + description. */
const HINTS = {
  RIYADH: ['الرياض', 'رياض', 'الدرعية', 'الخرج'],
  MAKKAH: ['مكة', 'جدة', 'الطائف', 'رابغ'],
  MADINAH: ['المدينة', 'ينبع', 'العلا'],
  QASSIM: ['القصيم', 'بريدة', 'عنيزة'],
  EASTERN: ['الشرقية', 'الدمام', 'الخبر', 'الأحساء', 'القطيف', 'الجبيل'],
  ASIR: ['عسير', 'أبها', 'خميس مشيط', 'رجال ألمع'],
  TABUK: ['تبوك', 'نيوم', 'ضباء'],
  HAIL: ['حائل'],
  NORTHERN_BORDERS: ['الحدود الشمالية', 'عرعر', 'رفحاء'],
  JAZAN: ['جازان', 'جيزان', 'فرسان'],
  NAJRAN: ['نجران'],
  BAHAH: ['الباحة', 'بلجرشي'],
  JAWF: ['الجوف', 'سكاكا', 'دومة الجندل'],
};

/**
 * The fallback distribution.
 *
 * NOT uniform: a uniform spread across thirteen regions would be its own kind
 * of lie — it would tell a reader that Najran and Riyadh have equal activity.
 * This is weighted toward the population centres so the facet looks like a
 * plausible platform rather than a test fixture.
 */
const WEIGHTED = [
  ...Array(5).fill('RIYADH'),
  ...Array(4).fill('MAKKAH'),
  ...Array(3).fill('EASTERN'),
  ...Array(2).fill('QASSIM'),
  ...Array(2).fill('MADINAH'),
  ...Array(2).fill('ASIR'),
  'TABUK', 'HAIL', 'JAZAN', 'NAJRAN', 'BAHAH', 'JAWF', 'NORTHERN_BORDERS',
];

const prisma = new PrismaClient();
try {
  const rows = await prisma.project.findMany({
    where: { region: null, isTestFixture: false },
    select: { id: true, titleAr: true, shortDescAr: true },
  });

  let byHint = 0;
  let byHash = 0;
  for (const p of rows) {
    const hay = `${p.titleAr} ${p.shortDescAr ?? ''}`;
    const hit = Object.entries(HINTS).find(([, words]) => words.some((w) => hay.includes(w)));
    let region;
    if (hit) {
      region = hit[0];
      byHint += 1;
    } else {
      // Deterministic: the same project always lands in the same region.
      const n = parseInt(p.id.replace(/[^0-9a-f]/g, '').slice(-4), 16);
      region = WEIGHTED[n % WEIGHTED.length];
      byHash += 1;
    }
    await prisma.project.update({ where: { id: p.id }, data: { region } });
  }

  console.log(`[seed-regions] ${byHint} from the project's own text, ${byHash} distributed`);
  const spread = await prisma.project.groupBy({
    by: ['region'],
    where: { isTestFixture: false, region: { not: null } },
    _count: { id: true },
  });
  console.log(
    '[seed-regions] spread:',
    spread
      .sort((a, b) => b._count.id - a._count.id)
      .map((r) => `${r.region}=${r._count.id}`)
      .join(' '),
  );
} finally {
  await prisma.$disconnect();
}
