// Batch PAGE-PARITY — remove accumulated e2e debris from the public catalogue.
//
//   node prisma/purge-e2e-debris.mjs [--keep N] [--dry]
//
// WHAT THIS IS FOR. `e2e/global-setup.ts` creates «مشروع الرحلة الذهبية {ts}»
// on every run, and those rows are PUBLIC ON PURPOSE — in CI it is the only
// project that exists, and two specs need it listed (category-discovery needs a
// card on technology/apps, stakes-s10 F-10 needs /p/{slug} in the sitemap).
// So they are correctly not fixture-flagged.
//
// The bug is not that they are public. It is that they ACCUMULATE: 429 of them
// had piled up since 2026-07-26, 95.3% of the browsable catalogue, which made
// every discovery surface look broken — one category holding 95.7% of projects,
// one funding bucket holding 95.7%, search results that are mostly empty
// hatched boxes because debris has no cover image.
//
// WHY NOT WIDEN THE FIXTURE GUARD. That was tried in an earlier batch: migration
// 0058's predicate was extended to catch «الرحلة الذهبية», which silently
// reverted a deliberate decision and failed both specs above. It was reverted.
// Presentability is a per-SURFACE rule, not a listing rule — the rotating hero
// already filters titles with a 10+ digit run in its own SQL for exactly this.
//
// The right fix is neither hiding nor tolerating: keep ONE, delete the backlog.
// global-setup calls this before creating the run's project, so the catalogue
// holds a single golden-journey row instead of a year's worth.
//
// SAFETY. This deletes projects and their children, including PLEDGES. It
// therefore REFUSES to run if any pledge under the matched set belongs to an
// account outside the test domains — a money row from a real backer must never
// be removed by a housekeeping script, and the check is what makes this safe to
// run anywhere rather than only on a box someone has eyeballed first.
import { PrismaClient } from '@prisma/client';

/** Only ever these. A prefix, not a regex over user-authored titles. */
const DEBRIS_PREFIXES = ['مشروع الرحلة الذهبية', 'مشروع فان-آوت'];
/** Accounts whose money rows are disposable. Anything else aborts the run. */
const TEST_DOMAINS = /@(e2e|test)\.wathba\.sa$|@wathba\.demo$/;

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const keepIdx = args.indexOf('--keep');
const keep = keepIdx >= 0 ? Number(args[keepIdx + 1]) : 0;

const prisma = new PrismaClient();
try {
  const matched = await prisma.project.findMany({
    where: { OR: DEBRIS_PREFIXES.map((p) => ({ titleAr: { startsWith: p } })) },
    select: { id: true, titleAr: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  // Keep the newest `keep` so a caller can leave the current run's row alone.
  const doomed = matched.slice(keep);
  if (doomed.length === 0) {
    console.log(`[purge] nothing to remove (${matched.length} matched, keeping ${keep})`);
    process.exit(0);
  }
  const ids = doomed.map((p) => p.id);

  // ── the refusal ──────────────────────────────────────────────────────────
  const pledges = await prisma.pledge.findMany({
    where: { projectId: { in: ids } },
    select: { id: true, backer: { select: { email: true } } },
  });
  const outsiders = pledges.filter((p) => !TEST_DOMAINS.test(p.backer?.email ?? ''));
  if (outsiders.length > 0) {
    console.error(
      `[purge] ABORT — ${outsiders.length} pledge(s) under the matched projects belong to ` +
        `non-test accounts. A housekeeping script does not delete a real backer's money row.`,
    );
    process.exit(1);
  }

  console.log(
    `[purge] ${matched.length} matched · keeping ${keep} · removing ${doomed.length} ` +
      `(${pledges.length} test pledges attached)${dry ? '  [DRY RUN]' : ''}`,
  );
  if (dry) process.exit(0);

  // Children first — the schema does not cascade every relation, and a partial
  // delete that fails halfway is worse than one that never started.
  const del = async (label, fn) => {
    const { count } = await fn();
    if (count > 0) console.log(`  ${label.padEnd(16)} ${count}`);
  };
  await del('projectTag', () => prisma.projectTag.deleteMany({ where: { projectId: { in: ids } } }));
  await del('comment', () => prisma.comment.deleteMany({ where: { projectId: { in: ids } } }));
  await del('pledge', () => prisma.pledge.deleteMany({ where: { projectId: { in: ids } } }));
  await del('project', () => prisma.project.deleteMany({ where: { id: { in: ids } } }));

  const left = await prisma.project.count({
    where: { isTestFixture: false, status: { in: ['LIVE', 'SUCCESSFUL'] } },
  });
  console.log(`[purge] done — ${left} publicly listable projects remain`);
} finally {
  await prisma.$disconnect();
}
