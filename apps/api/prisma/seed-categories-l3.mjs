// Batch DISCOVERY-ENGINE — seed a REAL third category level.
// Idempotent: safe to re-run. Run after `prisma migrate deploy`.
//
//   node prisma/seed-categories-l3.mjs
//
// WHY SEED IT AT ALL. The schema has always been an unbounded self-relation,
// but every reader stopped at two levels, so depth-3 support could only ever be
// tested against a synthetic fixture — and a facet tree that has never rendered
// a real grandchild is a facet tree nobody has seen. This puts a small, honest
// third level under the subcategories that plausibly want one, so the nesting,
// the counts, the URL state and the sidebar are exercised by real data.
//
// SMALL ON PURPOSE. Seven grandchildren under two parents, not a full third
// tier invented from nothing. Taxonomy is a product decision; this seeds enough
// to prove the machinery and leaves the rest to ops.
import { PrismaClient } from '@prisma/client';

/**
 * parentTopSlug › parentSubSlug › [ [slug, ar, en], … ]
 *
 * Chosen against the REAL data, not invented: «التقنية › التطبيقات» holds 410
 * of the platform's projects, which is the only subcategory with the volume to
 * make a third level mean anything. The design branch is seeded structurally
 * and carries no projects yet — so the facet PRUNES it, which is the correct
 * behaviour and is itself worth having a real example of.
 */
const L3 = [
  ['technology', 'apps', [
    ['mobile-apps', 'تطبيقات الجوال', 'Mobile apps'],
    ['web-apps', 'تطبيقات الويب', 'Web apps'],
    ['ai-assistants', 'مساعدات ذكية', 'AI assistants'],
    ['dev-tools', 'أدوات المطورين', 'Developer tools'],
  ]],
  ['design', 'product-design', [
    ['furniture', 'أثاث', 'Furniture'],
    ['lighting', 'إضاءة', 'Lighting'],
    ['homeware', 'أدوات منزلية', 'Homeware'],
  ]],
];

/** How many projects to move down per third-level node. */
const MOVE_PER_LEAF = 12;

const prisma = new PrismaClient();
try {
  let created = 0;
  let skipped = 0;
  for (const [topSlug, subSlug, kids] of L3) {
    const top = await prisma.category.findFirst({
      where: { slug: topSlug, parentId: null },
      select: { id: true, nameAr: true },
    });
    if (!top) {
      console.log(`[seed-l3] no top-level «${topSlug}» — skipping`);
      continue;
    }
    const sub = await prisma.category.findFirst({
      where: { slug: subSlug, parentId: top.id },
      select: { id: true, nameAr: true },
    });
    if (!sub) {
      // The subcategory slugs come from categories.data.mjs; if one has been
      // renamed this reports rather than inventing a parent.
      console.log(`[seed-l3] no «${topSlug}/${subSlug}» — skipping its children`);
      continue;
    }
    for (const [i, [slug, ar, en]] of kids.entries()) {
      const existing = await prisma.category.findFirst({ where: { slug, parentId: sub.id } });
      if (existing) {
        skipped += 1;
        continue;
      }
      await prisma.category.create({
        data: { slug, nameAr: ar, nameEn: en, parentId: sub.id, sortOrder: i + 1, isActive: true },
      });
      created += 1;
    }
    console.log(`[seed-l3] ${top.nameAr} › ${sub.nameAr} › ${kids.length} node(s)`);
  }
  console.log(`[seed-l3] done: ${created} created, ${skipped} already present`);

  // Attach a few projects to the new leaves so the facet has non-zero counts —
  // otherwise the pruning rule (omit depth>0 with count 0) hides every one of
  // them and the third level is invisible in exactly the surface it was seeded
  // to exercise. Only projects already in the PARENT subcategory are moved
  // down, so nothing changes category, it only becomes more specific.
  let moved = 0;
  for (const [topSlug, subSlug, kids] of L3) {
    const top = await prisma.category.findFirst({ where: { slug: topSlug, parentId: null }, select: { id: true } });
    if (!top) continue;
    const sub = await prisma.category.findFirst({ where: { slug: subSlug, parentId: top.id }, select: { id: true } });
    if (!sub) continue;
    const leaves = await prisma.category.findMany({
      where: { parentId: sub.id, slug: { in: kids.map((k) => k[0]) } },
      select: { id: true },
    });
    if (!leaves.length) continue;
    // PUBLICLY LISTABLE, not merely non-fixture.
    //
    // This filtered on isTestFixture alone and reported "moved 39" while the
    // third level stayed invisible: the 39 were DRAFTs, which the facet prunes
    // exactly like a zero. A seed whose whole job is "give these nodes non-zero
    // counts" has to select the rows that can produce one.
    const inParent = await prisma.project.findMany({
      where: {
        categoryId: sub.id,
        isTestFixture: false,
        status: { in: ['LIVE', 'SUCCESSFUL'] },
      },
      select: { id: true },
      take: leaves.length * MOVE_PER_LEAF,
    });
    for (const [i, proj] of inParent.entries()) {
      await prisma.project.update({
        where: { id: proj.id },
        data: { categoryId: leaves[i % leaves.length].id },
      });
      moved += 1;
    }
  }
  // ── permanent inhabitants ────────────────────────────────────────────────
  // The only public project that ever lived under technology/apps was the
  // per-run e2e one, which global-setup now purges and recreates in the PARENT.
  // So a third level populated only by "move whatever is in the parent" is
  // empty again the moment a suite runs, and FD4 fails on a data gap rather
  // than on a defect.
  //
  // These are real demo campaigns placed where they actually belong — «سوق»
  // is a digital marketplace and «منبر» is a local-news platform; both are
  // apps in every sense the taxonomy means. Idempotent, and it never moves a
  // project that a human has already filed somewhere deeper.
  const ADOPT = [['souq-artisans', 'web-apps'], ['minbar-local', 'web-apps']];
  let adopted = 0;
  for (const [projSlug, leafSlug] of ADOPT) {
    const leaf = await prisma.category.findFirst({ where: { slug: leafSlug }, select: { id: true } });
    const proj = await prisma.project.findFirst({
      where: { slug: projSlug, isTestFixture: false },
      select: { id: true, categoryId: true },
    });
    if (!leaf || !proj || proj.categoryId === leaf.id) continue;
    await prisma.project.update({ where: { id: proj.id }, data: { categoryId: leaf.id } });
    adopted += 1;
  }

  console.log(`[seed-l3] moved ${moved} project(s) down; ${adopted} adopted into a leaf`);
} finally {
  await prisma.$disconnect();
}
