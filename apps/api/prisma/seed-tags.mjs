// Batch DISCOVERY-ENGINE — seed the curated tag vocabulary.
// Idempotent: safe to re-run. Run right after `prisma migrate deploy`.
//
// Upserts by slug, so an ops edit to a label survives a re-run — the seed owns
// which tags EXIST, not what they are currently called. Nothing is deactivated
// or deleted here: a tag ops has retired stays retired.
//
//   node prisma/seed-tags.mjs [--attach]
//
// --attach additionally gives demo projects a plausible tag or two so the facet
// and the search weighting have something to show. It skips fixtures and any
// project that already carries tags, so it cannot overwrite real creator input.
import { PrismaClient } from '@prisma/client';

import { TAGS } from './tags.data.mjs';

async function seedVocabulary(prisma) {
  let created = 0;
  let updated = 0;
  for (const t of TAGS) {
    const existing = await prisma.tag.findUnique({ where: { slug: t.slug } });
    if (existing) {
      // Label + ordering only. isActive and usageCount belong to ops and to the
      // attach path respectively; a re-run must not resurrect a retired tag.
      await prisma.tag.update({
        where: { slug: t.slug },
        data: { nameAr: t.ar, nameEn: t.en, sortOrder: t.group },
      });
      updated += 1;
    } else {
      await prisma.tag.create({
        data: { slug: t.slug, nameAr: t.ar, nameEn: t.en, sortOrder: t.group },
      });
      created += 1;
    }
  }
  console.log(`[seed-tags] vocabulary ready: ${created} created, ${updated} refreshed`);
}

/**
 * Attach 1-3 tags to demo projects, chosen from the project's own text so the
 * result is plausible rather than random — a dates farm gets «الزراعة», not
 * «الفضاء». Falls back to a deterministic pick by id hash when nothing matches,
 * so every seeded project ends up with at least one tag and the facet is not
 * mostly empty.
 */
async function attach(prisma) {
  const tags = await prisma.tag.findMany({ where: { isActive: true }, select: { id: true, slug: true, nameAr: true } });
  const bySlug = new Map(tags.map((t) => [t.slug, t]));

  /** slug → words that imply it, matched against titleAr + shortDescAr. */
  const HINTS = {
    agriculture: ['تمور', 'مزرع', 'زراع', 'نخيل', 'بذور', 'عسل'],
    'saudi-heritage': ['تراث', 'سدو', 'حرف', 'شعبي', 'قديم', 'أصيل'],
    handmade: ['يدوي', 'حرفة', 'صناعة يدوية', 'نسيج', 'سجاد'],
    education: ['تعليم', 'مدرسة', 'طلاب', 'كتاب', 'مكتبة', 'تدريب'],
    'for-children': ['أطفال', 'طفل', 'براعم'],
    health: ['صحة', 'طبي', 'علاج', 'مستشفى'],
    space: ['فضاء', 'تلسكوب', 'نجوم', 'فلك'],
    documentary: ['وثائقي', 'توثيق', 'أرشيف'],
    'arabic-language': ['عربية', 'خط', 'خطوط', 'شعر', 'ديوان', 'رواية'],
    'eco-friendly': ['بيئة', 'مستدام', 'إعادة تدوير', 'طاقة'],
    sport: ['رياضة', 'مشي', 'مسارات', 'دراج'],
    'social-impact': ['مجتمع', 'أثر', 'تطوع', 'دعم'],
    'made-in-saudi': ['سعودي', 'السعودية', 'محلي'],
  };

  const projects = await prisma.project.findMany({
    where: { isTestFixture: false, tags: { none: {} } },
    select: { id: true, titleAr: true, shortDescAr: true },
    take: 400,
  });

  let attached = 0;
  for (const p of projects) {
    const hay = `${p.titleAr} ${p.shortDescAr ?? ''}`;
    const hits = Object.entries(HINTS)
      .filter(([, words]) => words.some((w) => hay.includes(w)))
      .map(([slug]) => bySlug.get(slug))
      .filter(Boolean)
      .slice(0, 3);

    // Deterministic fallback so the facet is not sparse: the id's last hex
    // digit picks a tag. Deterministic, not random, so a re-run is a no-op.
    if (hits.length === 0) {
      const idx = parseInt(p.id.slice(-1), 16) % tags.length;
      hits.push(tags[idx]);
    }
    for (const t of hits) {
      await prisma.projectTag.create({ data: { tagId: t.id, projectId: p.id } }).catch(() => {});
      attached += 1;
    }
  }

  // Recompute every counter from the join table rather than incrementing, so a
  // re-run converges instead of inflating.
  const counts = await prisma.projectTag.groupBy({ by: ['tagId'], _count: { projectId: true } });
  const byId = new Map(counts.map((c) => [c.tagId, c._count.projectId]));
  for (const t of tags) {
    await prisma.tag.update({ where: { id: t.id }, data: { usageCount: byId.get(t.id) ?? 0 } });
  }
  console.log(`[seed-tags] attached ${attached} tag(s) across ${projects.length} project(s)`);
}

/** Reusable entry — used by seed-e2e.mjs so the tag facet and the search
 *  suggest dropdown have a vocabulary to return. Mirrors seedCategories. */
export async function seedTags(prisma) {
  await seedVocabulary(prisma);
}

// Run standalone: `node prisma/seed-tags.mjs [--attach]`
if (import.meta.url === `file://${process.argv[1]}`) {
  const prisma = new PrismaClient();
  try {
    await seedVocabulary(prisma);
    if (process.argv.includes('--attach')) await attach(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
