import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EVENT_WHITELIST, sanitizeFacetProps } from '../events/events.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { DiscoverService } from './discover.service';
import { PopularFacetsService, POPULAR_FACET_TUNING, hrefFor } from './popular-facets.service';

/**
 * Batch DISCOVERY-ENGINE Unit 5 — the promoter, and the promise it makes.
 *
 * The behaviour worth testing here is not "does it rank" — it is the three
 * things that would fail silently:
 *   1. the aggregate must never touch anonId/userId (PDPL),
 *   2. the ingest must not let `filter_applied` become a free-form data sink,
 *   3. cold-start seeds must not vanish before real data can fill the row.
 */

/**
 * A prisma double.
 *
 * Typed as its own literal and cast only where it is handed to the constructor.
 * Intersecting the double with PrismaService makes `mockResolvedValue` infer
 * `never` on every method — `nest build` and `jest` both accept it and
 * `tsc --noEmit` does not, which is how a broken typecheck ships green. That
 * happened once in this batch already.
 */
function makePrisma() {
  const empty = (_args?: unknown) => Promise.resolve([] as unknown[]);
  return {
    $queryRaw: jest.fn(),
    popularFacet: {
      // `recompute` calls findMany TWICE with different `where` clauses — the
      // stale-row sweep (isSeed:false, isPinned:false) and the dead-end check
      // (isActive only). A double that ignores `where` answers both with the
      // same rows, so a PINNED row comes back from the sweep that would never
      // have returned it, and the test blames the wrong step. Ask the caller.
      findMany: jest.fn(empty),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    analyticsEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    category: { findMany: jest.fn().mockResolvedValue([]) },
    tag: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

/**
 * Answer `findMany` the way the real query would: the stale sweep excludes
 * pinned and seeded rows, the dead-end check sees every active row.
 */
function promotedRows(
  db: ReturnType<typeof makePrisma>,
  rows: Array<{ key: string; value: string; isPinned: boolean; labelAr: string; isSeed?: boolean }>,
): void {
  db.popularFacet.findMany.mockImplementation((args: unknown) => {
    const where = (args as { where?: { isSeed?: boolean } }).where ?? {};
    if (where.isSeed !== undefined) {
      // The stale sweep: measured, unpinned rows only.
      return Promise.resolve(
        rows.filter((r) => !r.isPinned && !r.isSeed).map((r) => ({ key: r.key, value: r.value })),
      );
    }
    return Promise.resolve(rows);
  });
}

/**
 * `total` is what the dead-end guard asks for. Default 1 — "this filter leads
 * somewhere" — so the cold-start and label tests are not silently reshaped by
 * the guard they are not about.
 */
const svc = (
  db: ReturnType<typeof makePrisma>,
  total = 1,
): PopularFacetsService =>
  new PopularFacetsService(
    db as unknown as PrismaService,
    { list: jest.fn().mockResolvedValue({ total }) } as unknown as DiscoverService,
  );

describe('PDPL — the aggregate cannot become a profile', () => {
  const SRC = readFileSync(join(__dirname, 'popular-facets.service.ts'), 'utf8');

  it('never selects or groups an identifier', () => {
    // A source scan, deliberately. The guarantee is a property of the QUERY
    // TEXT, and a behavioural test against a mock would pass just as happily
    // with `GROUP BY anonId` in the string.
    const sql = SRC.slice(SRC.indexOf('SELECT "props"'), SRC.indexOf('LIMIT ${PROMOTED_LIMIT * 3}'));
    expect(sql).toContain('GROUP BY 1, 2');
    expect(sql).not.toContain('anonId');
    expect(sql).not.toContain('userId');
    expect(sql).not.toMatch(/\bpath\b/);
  });

  it('stores no identifier on a promoted row', () => {
    const written = SRC.slice(SRC.indexOf('create: {'), SRC.indexOf('// Retire the cold-start'));
    expect(written).not.toContain('anonId');
    expect(written).not.toContain('userId');
  });

  it('bounds retention — the table had none before this unit', async () => {
    const db = makePrisma();
    db.analyticsEvent.deleteMany.mockResolvedValue({ count: 7 });
    const now = new Date('2026-08-09T00:00:00Z');

    const { deleted } = await svc(db).purge(now);

    expect(deleted).toBe(7);
    const arg = db.analyticsEvent.deleteMany.mock.calls[0]![0] as {
      where: { createdAt: { lt: Date } };
    };
    const days = (now.getTime() - arg.where.createdAt.lt.getTime()) / 86_400_000;
    expect(days).toBe(POPULAR_FACET_TUNING.RETENTION_DAYS);
    // The purge must never reach into the window the promoter reads.
    expect(days).toBeGreaterThan(POPULAR_FACET_TUNING.WINDOW_DAYS);
  });
});

describe('the ingest whitelist', () => {
  it('accepts the two discovery events', () => {
    expect(EVENT_WHITELIST.has('filter_applied')).toBe(true);
    expect(EVENT_WHITELIST.has('search_performed')).toBe(true);
  });

  it('keeps a known facet pair', () => {
    expect(sanitizeFacetProps({ key: 'tag', value: 'saudi-heritage' }))
      .toEqual({ key: 'tag', value: 'saudi-heritage' });
  });

  it.each([
    ['an unknown dimension', { key: 'email', value: 'a@b.com' }],
    ['the search term', { key: 'q', value: 'مشروع' }],
    ['a missing value', { key: 'tag' }],
    ['a non-string value', { key: 'tag', value: 12 }],
    ['nothing at all', undefined],
  ])('drops %s', (_label, props) => {
    expect(sanitizeFacetProps(props as Record<string, unknown>)).toBeNull();
  });

  it('drops a value long enough to be a payload', () => {
    expect(sanitizeFacetProps({ key: 'tag', value: 'x'.repeat(200) })).toBeNull();
  });

  it('strips everything except the pair', () => {
    // The referral blob rides on every other event (STAKES/S-14). It must not
    // ride on these — it would end up in the GROUP BY's json path.
    const out = sanitizeFacetProps({ key: 'region', value: 'RIYADH', ref: 'partner-x', extra: 1 });
    expect(out).toEqual({ key: 'region', value: 'RIYADH' });
  });
});

describe('cold start', () => {
  it('keeps the seeds while there is not enough real data to fill the row', async () => {
    const db = makePrisma();
    // Three measured facets — a real signal, but not eight.
    db.$queryRaw.mockResolvedValue([
      { key: 'status', value: 'live', n: 90n },
      { key: 'hasVideo', value: '1', n: 40n },
      { key: 'duration', value: 'lt30', n: 30n },
    ]);

    const out = await svc(db).recompute(new Date('2026-08-09T04:00:00Z'));

    expect(out.promoted).toBe(3);
    // Retiring seeds here would leave the homepage with three chips where
    // there were eight — a visible downgrade caused by the system working.
    expect(out.retiredSeeds).toBe(0);
    expect(db.popularFacet.updateMany).not.toHaveBeenCalled();
  });

  it('retires the seeds once measured facets can fill the row', async () => {
    const db = makePrisma();
    db.popularFacet.updateMany.mockResolvedValue({ count: 8 });
    db.$queryRaw.mockResolvedValue(
      Object.entries({
        live: 90n, funded: 80n,
      }).map(([value, n]) => ({ key: 'status', value, n })).concat(
        [['p75_100', 70n], ['p50_75', 60n], ['p25_50', 50n], ['p0_25', 45n]].map(
          ([value, n]) => ({ key: 'pct', value: value as string, n: n as bigint }),
        ),
        [['1', 40n]].map(([value, n]) => ({ key: 'hasVideo', value: value as string, n: n as bigint })),
        [['lt30', 30n]].map(([value, n]) => ({ key: 'duration', value: value as string, n: n as bigint })),
      ),
    );

    const out = await svc(db).recompute();

    expect(out.promoted).toBe(8);
    expect(out.retiredSeeds).toBe(8);
    // A pinned seed is an editor's decision and survives the machine.
    const where = db.popularFacet.updateMany.mock.calls[0]![0] as { where: { isPinned: boolean } };
    expect(where.where.isPinned).toBe(false);
  });

  it('needs real evidence, not one curious reader', () => {
    // The HAVING lives in SQL, so this asserts the threshold it is built from.
    expect(POPULAR_FACET_TUNING.MIN_EVENTS).toBeGreaterThanOrEqual(10);
  });
});

describe('labels', () => {
  it('drops a facet it cannot name in Arabic rather than showing its slug', async () => {
    const db = makePrisma();
    // A tag that was deactivated between the click and the recompute.
    db.$queryRaw.mockResolvedValue([{ key: 'tag', value: 'ghost-tag', n: 500n }]);
    db.tag.findMany.mockResolvedValue([]);

    const out = await svc(db).recompute();

    expect(out.promoted).toBe(0);
    expect(db.popularFacet.upsert).not.toHaveBeenCalled();
  });

  it('resolves a dot-path category to its leaf node', async () => {
    const db = makePrisma();
    db.$queryRaw.mockResolvedValue([{ key: 'cat', value: 'technology.ai', n: 100n }]);
    db.category.findMany.mockResolvedValue([{ slug: 'ai', nameAr: 'الذكاء الاصطناعي' }]);

    await svc(db).recompute();

    const arg = db.popularFacet.upsert.mock.calls[0]![0] as { create: { labelAr: string } };
    expect(arg.create.labelAr).toBe('الذكاء الاصطناعي');
  });
});

describe('dead ends', () => {
  it('retires a promoted facet that leads to an empty list', async () => {
    const db = makePrisma();
    db.$queryRaw.mockResolvedValue([]);
    promotedRows(db, [
      { key: 'duration', value: 'lt30', isPinned: false, isSeed: true, labelAr: 'تنتهي قريباً' },
    ]);

    // THE REAL BUG THIS UNIT SHIPPED AND CAUGHT: the cold-start row «تنتهي
    // قريباً» was seeded as duration=lt30, and no campaign in the catalogue runs
    // under thirty days. The homepage was one deploy from prominently offering
    // a filter that always returns nothing — the exact defect «قريبة منك» had.
    const out = await svc(db, 0).recompute();

    expect(out.deadEnds).toBe(1);
    const arg = db.popularFacet.update.mock.calls[0]![0] as { data: { isActive: boolean } };
    expect(arg.data.isActive).toBe(false);
  });

  it('reports a pinned dead end but does not overrule the editor', async () => {
    const db = makePrisma();
    db.$queryRaw.mockResolvedValue([]);
    promotedRows(db, [{ key: 'tag', value: 'quiet-tag', isPinned: true, labelAr: 'وسم هادئ' }]);

    const out = await svc(db, 0).recompute();

    // Counted and logged, so it surfaces on /ops/discovery — but a pin is a
    // decision, and a person who pinned it should remove it themselves.
    expect(out.deadEnds).toBe(1);
    expect(db.popularFacet.update).not.toHaveBeenCalled();
  });

  it('leaves a facet that still returns rows alone', async () => {
    const db = makePrisma();
    db.$queryRaw.mockResolvedValue([]);
    // A SEED, so the stale-row sweep skips it and the only step that could
    // touch this row is the dead-end guard. A measured row here would be
    // demoted for falling out of an empty window — correct behaviour, but a
    // different mechanism, and the test would be asserting the wrong one.
    promotedRows(db, [
      { key: 'status', value: 'live', isPinned: false, isSeed: true, labelAr: 'حملات نشطة' },
    ]);

    const out = await svc(db, 519).recompute();

    expect(out.deadEnds).toBe(0);
    expect(db.popularFacet.update).not.toHaveBeenCalled();
  });
});

describe('the destination', () => {
  it('is the same URL shape a sidebar click produces', () => {
    expect(hrefFor('tag', 'saudi-heritage')).toBe('/projects/discover-all?tag=saudi-heritage');
    // Encoded, so a value with a separator in it cannot forge a second param.
    expect(hrefFor('cat', 'technology.ai&only=staff')).not.toContain('&only=staff');
  });
});
