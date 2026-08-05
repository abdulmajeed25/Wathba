/**
 * HOME-REVIEW — the homepage's canonical section order.
 *
 * The homepage used to render as two lists: seven blocks hardcoded in
 * wathba-home.tsx, then the admin-composed magazine underneath. Nothing in the
 * second list could ever appear above anything in the first, so the page's
 * strongest evidence — a featured project told properly, campaigns about to
 * close, success stories — sat permanently BELOW the creator call-to-action,
 * which a reader takes for the end of the page.
 *
 * Both halves are now one ordered list driven by HomepageSection.sortOrder, so
 * this table is the homepage's running order. The seven `code` rows below are
 * new: they name sections that already existed but were never registered.
 *
 * WHAT THE ORDER SAYS, act by act:
 *
 *   arrival     ticker → categories → trending      "this place is alive, here is what is in it"
 *   the work    home_stretch → featured             urgency while intent is live, then one story told properly
 *   the case    transparency → stories → interviews → trust   the promise, then the proof
 *   commitment  ranks → how → creator_cta           loyalty after trust; the ONE green band
 *   resources   creators_corner → funding_tips      the next step for whoever said yes
 *   editorial   banners → announcements → program → showcase
 *   exit        fresh_favorites                     a way back into the product, not a dead end
 *
 * hero_banners is deliberately far from creator_cta. It opens with «قوة الإيمان
 * بالفكرة» and a «ابدأ مشروعك» button, and it used to sit 1px below the creator
 * CTA band — two identical asks touching, which halves the weight of both.
 *
 * USAGE
 *   node --env-file=.env prisma/seed-home-order.mjs              # create missing rows only (safe)
 *   node --env-file=.env prisma/seed-home-order.mjs --apply-order # also (re)write sortOrder
 *
 * --apply-order OVERWRITES any ordering an operator set through
 * content.homepage-section.update. That is correct on the deploy that
 * introduces this order, and wrong every time after it.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply-order');

/** owner: `code` = rendered by wathba-home.tsx · `magazine` = editorial payload */
const ORDER = [
  ['live_ticker', 'code'],
  ['categories', 'code'],
  ['trending', 'code'],
  ['home_stretch', 'magazine'],
  ['featured_recommended', 'magazine'],
  ['transparency', 'code'],
  ['success_stories', 'magazine'],
  ['creator_interviews', 'magazine'],
  ['trust_duo', 'magazine'],
  ['backer_ranks', 'code'],
  ['how_it_works', 'code'],
  ['creator_cta', 'code'],
  ['creators_corner', 'magazine'],
  ['funding_tips', 'magazine'],
  ['hero_banners', 'magazine'],
  ['announcements', 'magazine'],
  ['brand_program', 'magazine'],
  ['collection_showcase', 'magazine'],
  ['fresh_favorites', 'magazine'],
];

async function main() {
  const existing = new Map(
    (await prisma.homepageSection.findMany()).map((s) => [s.key, s]),
  );

  let created = 0;
  let reordered = 0;
  const drifted = [];

  for (const [key, owner] of ORDER) {
    const sortOrder = ORDER.findIndex(([k]) => k === key) + 1;
    const row = existing.get(key);

    if (!row) {
      // A code-owned key that is missing would vanish from the page were it not
      // for the fallback in wathba-home.tsx; create it either way.
      await prisma.homepageSection.create({ data: { key, sortOrder, isActive: true } });
      created++;
      console.log(`  + ${key.padEnd(22)} (${owner}) → ${sortOrder}`);
      continue;
    }
    if (row.sortOrder === sortOrder) continue;

    if (!APPLY) {
      drifted.push(`${key}: ${row.sortOrder} → ${sortOrder}`);
      continue;
    }
    await prisma.homepageSection.update({ where: { key }, data: { sortOrder } });
    reordered++;
    console.log(`  ~ ${key.padEnd(22)} (${owner}) ${row.sortOrder} → ${sortOrder}`);
  }

  console.log(`[home-order] ${created} created, ${reordered} reordered.`);
  if (drifted.length) {
    console.warn(
      `[home-order] ${drifted.length} row(s) differ from the canonical order and were LEFT ALONE ` +
        `(pass --apply-order to rewrite):\n    ${drifted.join('\n    ')}`,
    );
  }

  const final = await prisma.homepageSection.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log('\n[home-order] running order:');
  for (const s of final) {
    console.log(`  ${String(s.sortOrder).padStart(3)}  ${s.isActive ? ' ' : '·'} ${s.key}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
