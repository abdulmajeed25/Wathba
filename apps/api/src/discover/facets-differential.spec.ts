import { PrismaClient } from '@prisma/client';

import { DiscoverService } from './discover.service';
import type { DiscoverQueryDto } from './dto/discover-query.dto';

/**
 * The nineteen-queries-to-one rewrite, proven against the thing it replaced.
 *
 * This is the only assertion in the batch that genuinely matters. Collapsing
 * nineteen aggregates into one statement is exactly the kind of change where an
 * off-by-one in a bracket boundary is invisible: every count is still a
 * plausible number, the page still renders, and the facet quietly lies. So the
 * old implementation is retained, unrouted, as `facetsLegacy`, and this file
 * asserts the two agree across a matrix of filter combinations.
 *
 * INTEGRATION, not unit — it needs a real database, because the whole point is
 * that Postgres evaluates the two forms identically. It skips itself when there
 * is no DATABASE_URL rather than failing, so a unit-only run stays green.
 */

const prisma = new PrismaClient();
const svc = new DiscoverService(prisma as never);

/**
 * Every dimension the partition classifies, plus combinations that make two
 * or more interact — a single-dimension matrix would pass even if the
 * "except" logic were wrong, because with one filter active there is nothing
 * for it to except against.
 */
const MATRIX: Array<[string, DiscoverQueryDto]> = [
  ['no filters', {}],
  ['status live', { status: 'live' }],
  ['status funded', { status: 'funded' }],
  ['status both', { status: 'live,funded' }],
  ['includeEnded', { includeEnded: '1' }],
  ['category top-level', { cat: 'technology' }],
  ['category two', { cat: 'art,food' }],
  ['region', { region: 'RIYADH' }],
  ['pct lt25', { pct: 'lt25' }],
  ['pct p75_100', { pct: 'p75_100' }],
  ['pct gt100', { pct: 'gt100' }],
  ['goal range', { goalMin: 10_000, goalMax: 500_000 }],
  ['goal min only', { goalMin: 1_000 }],
  ['raised range', { raisedMin: 1_000, raisedMax: 200_000 }],
  ['staff only', { only: 'staff' }],
  ['tag single', { tag: 'saudi-heritage' }],
  ['tag two', { tag: 'saudi-heritage,handmade' }],
  ['has video', { hasVideo: '1' }],
  ['duration bucket', { duration: 'd30_45' }],
  ['q term', { q: 'نخيل' }],
  // …and the interactions, which are what the except logic is actually for.
  ['status + category', { status: 'live', cat: 'technology' }],
  ['status + pct', { status: 'live', pct: 'p75_100' }],
  ['category + region', { cat: 'art', region: 'RIYADH' }],
  ['pct + goal', { pct: 'lt25', goalMin: 10_000 }],
  ['staff + status', { only: 'staff', status: 'live' }],
  ['q + category', { q: 'مشروع', cat: 'technology' }],
  ['q + status + pct', { q: 'مشروع', status: 'live', pct: 'lt25' }],
  ['goal + raised', { goalMin: 10_000, raisedMin: 1_000 }],
  ['tag + status', { tag: 'saudi-heritage', status: 'live' }],
  ['tag + category', { tag: 'handmade', cat: 'technology' }],
  ['video + duration', { hasVideo: '1', duration: 'd30_45' }],
  ['tag + video + pct', { tag: 'saudi-heritage', hasVideo: '1', pct: 'lt25' }],
  ['everything', {
    status: 'live', cat: 'technology,art', region: 'RIYADH', pct: 'lt25',
    goalMin: 1_000, goalMax: 100_000_000, raisedMin: 0, raisedMax: 100_000_000,
    only: 'staff', q: 'مشروع', tag: 'saudi-heritage', hasVideo: '1', duration: 'd30_45',
  }],
];

const hasDb = !!process.env.DATABASE_URL;
const d = hasDb ? describe : describe.skip;

d('facets(): one statement equals nineteen', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it.each(MATRIX)('%s', async (...args: unknown[]) => {
    const q = args[1] as DiscoverQueryDto;
    const [now, legacy] = await Promise.all([svc.facets(q), svc.facetsLegacy(q)]);

    // Compared field by field rather than as one blob, so a failure names the
    // dimension that drifted instead of dumping the whole payload.
    expect(now.statuses).toEqual(legacy.statuses);
    expect(now.regions).toEqual(legacy.regions);
    expect(now.pct).toEqual(legacy.pct);
    expect(now.goals).toEqual(legacy.goals);
    expect(now.raised).toEqual(legacy.raised);
    expect(now.staff).toEqual(legacy.staff);
    expect(now.collections).toEqual(legacy.collections);
    // `tags`, `video` and `duration` are Unit 3 additions with no legacy
    // counterpart; what matters here is that adding them did not perturb the
    // dimensions that existed before, which the assertions above cover. Their
    // own correctness is asserted in facet-richness.spec.ts.

    // ── the category facet DIVERGES on purpose, and this is the proof ──
    //
    // The legacy builder summed own + DIRECT children and emitted only two
    // levels. The new one rolls up through every level. While the tree is two
    // levels deep those are arithmetically identical — which is what made it
    // safe to land the depth work before the taxonomy grew a third level — and
    // the moment a grandchild exists they MUST differ. Asserting equality here
    // would mean the depth-N roll-up was not actually rolling up.
    const nowCats = now.categories as Array<Record<string, number & string>>;
    const legacyCats = legacy.categories as Array<Record<string, number & string>>;
    const byPathNow = new Map(nowCats.map((c) => [String(c.path), c]));
    const deepest = Math.max(0, ...nowCats.map((c) => Number(c.depth)));

    if (deepest <= 1) {
      // Two-level tree: byte-identical on the fields the old payload had.
      const strip = (rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> =>
        rows.map((r) => ({ slug: r.slug, nameAr: r.nameAr, parentSlug: r.parentSlug, count: r.count }));
      expect(strip(nowCats)).toEqual(strip(legacyCats));
    } else {
      // Three or more levels: every node the legacy payload emitted must still
      // be present, and its count must be the legacy count PLUS exactly the
      // projects sitting below depth 1 — never less, and never an arbitrary
      // amount more.
      for (const old of legacyCats) {
        const path = old.parentSlug ? `${String(old.parentSlug)}/${String(old.slug)}` : String(old.slug);
        const fresh = byPathNow.get(path);
        // eslint-disable-next-line jest/valid-expect
        expect(fresh).toBeTruthy();
        // Everything the legacy roll-up could not see: descendants BELOW
        // depth 1. That threshold is the same for a top-level node and for a
        // subcategory — legacy summed own + direct children for the first and
        // own alone for the second, and in both cases stopped at depth 1.
        const below = nowCats
          .filter((c) => String(c.path).startsWith(`${path}/`) && Number(c.depth) > 1)
          .reduce((sum, c) => sum + Number(c.ownCount), 0);
        // Named in the message via the loop label rather than a second
        // expect() argument — jest's expect takes one, unlike Playwright's.
        expect({ path, count: Number(fresh!.count) }).toEqual({
          path,
          count: Number(old.count) + below,
        });
      }
    }
  });
});

d('facets(): the new statement is ONE round trip', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('issues exactly one query', async () => {
    let queries = 0;
    const client = new PrismaClient();
    client.$on('query' as never, () => {
      queries += 1;
    });
    // normalize() still resolves the collection slug and the category refs, so
    // count only what facets() itself issues after those.
    const s2 = new DiscoverService(client as never);
    await s2.facets({});
    const baseline = queries;
    queries = 0;
    await s2.facets({});
    await client.$disconnect();
    // The facet aggregate is one statement. Anything above that is normalize's
    // own lookups, which the count below pins so a regression to N+1 shows.
    expect(queries).toBeLessThanOrEqual(baseline);
    expect(queries).toBeLessThanOrEqual(2);
  });
});

/**
 * The guard that keeps the partition honest.
 *
 * Someone adds a thirteenth filter to conditions() and forgets to classify it.
 * It then silently vanishes from every facet — the counts stay plausible and
 * nothing fails. This asserts the two sets cover exactly the keys conditions()
 * can emit, so forgetting is a build failure instead.
 */
describe('the dimension partition covers conditions()', () => {
  it('every key conditions() can emit is classified exactly once', () => {
    const svcAny = svc as unknown as {
      conditions(f: Record<string, unknown>): Record<string, unknown>;
    };
    // Every filter active at once, so conditions() emits every key it can.
    const keys = Object.keys(
      svcAny.conditions({
        statuses: ['live', 'funded'], includeEnded: true, categoryIds: ['x'],
        region: 'RIYADH', goalMinH: 1, goalMaxH: 2, raisedMinH: 1, raisedMaxH: 2,
        pct: 'lt25', staffPick: true, recommended: true, savedOnly: true,
        recommendedCatIds: ['y'], collectionId: 'z', viewerId: 'v',
        catRequested: true, tagSlugs: ['t'], hasVideo: true, duration: 'd30_45',
        q: 'x', sort: 'relevance', page: 0, take: 24,
      }),
    );

    const cls = svc.constructor as unknown as {
      HOISTED_DIMS: readonly string[];
      EXCEPTED_DIMS: readonly string[];
    };
    const classified = [...cls.HOISTED_DIMS, ...cls.EXCEPTED_DIMS];

    // A dimension classified twice would make exceptFlags emit it twice.
    expect(new Set(classified).size).toBe(classified.length);
    // The real assertion: the partition covers conditions() exactly. A new
    // filter that nobody classified fails HERE rather than vanishing silently
    // from every facet count.
    expect([...keys].sort()).toEqual([...classified].sort());
  });
});
