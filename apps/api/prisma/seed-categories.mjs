// Batch CAT / Part 1 — seed the full category tree + backfill Project.categoryId.
// Idempotent: safe to re-run. Run right after `prisma migrate deploy`.
//
//   node prisma/seed-categories.mjs
import { PrismaClient } from '@prisma/client';
import { TREE, LEGACY_TOPLEVEL_MAP, kebab } from './categories.data.mjs';

/** Upsert one node by (parentId, slug) — findFirst avoids Prisma's null-in-
 *  compound-unique-where limitation for top-level rows (parentId = null). */
async function upsertNode(prisma, { slug, nameAr, nameEn, parentId, sortOrder }) {
  const existing = await prisma.category.findFirst({ where: { slug, parentId } });
  const data = { slug, nameAr, nameEn, parentId, sortOrder, isActive: true };
  return existing
    ? prisma.category.update({ where: { id: existing.id }, data })
    : prisma.category.create({ data });
}

async function seedTree(prisma) {
  let tops = 0;
  let subs = 0;
  for (const [i, top] of TREE.entries()) {
    const parent = await upsertNode(prisma, {
      slug: top.slug, nameAr: top.nameAr, nameEn: top.nameEn,
      parentId: null, sortOrder: i + 1,
    });
    tops += 1;
    for (const [j, child] of top.children.entries()) {
      await upsertNode(prisma, {
        slug: kebab(child.en), nameAr: child.ar, nameEn: child.en,
        parentId: parent.id, sortOrder: j + 1,
      });
      subs += 1;
    }
  }
  console.log(`[seed-categories] tree ready: ${tops} top-level, ${subs} subcategories`);
}

async function backfill(prisma) {
  // Legacy enum → matching new top-level node.
  for (const [enumVal, slug] of Object.entries(LEGACY_TOPLEVEL_MAP)) {
    const node = await prisma.category.findFirst({ where: { slug, parentId: null } });
    if (!node) continue;
    const r = await prisma.project.updateMany({
      where: { category: enumVal, categoryId: null },
      data: { categoryId: node.id },
    });
    if (r.count) console.log(`[seed-categories] backfilled ${r.count} ${enumVal} → ${slug}`);
  }

  // Music removed (0040 purge; BUG-2 permanent exclusion): legacy MUSIC
  // projects land on the film-video TOP-LEVEL node — the LEGACY_TOPLEVEL_MAP
  // above already routes MUSIC → 'film-video', nothing more to do here.

  const orphans = await prisma.project.count({ where: { categoryId: null } });
  if (orphans) console.log(`[seed-categories] ${orphans} project(s) still without a category (legacy category was null)`);
}

/** Reusable entry — used by seed-e2e.mjs so Playwright has a populated tree. */
export async function seedCategories(prisma) {
  await seedTree(prisma);
  await backfill(prisma);
}

// Run standalone: `node prisma/seed-categories.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const prisma = new PrismaClient();
  seedCategories(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
