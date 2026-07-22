import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Batch SEARCH BUG-2 — seed-level guard for the PERMANENT cultural
 * exclusions (Music, LGBTQIA+, occult/divination, romance showcases).
 *
 * Scans every migration: an excluded category slug/name may only appear in
 * an INSERT if a LATER migration deletes it (the 0040 purge pattern). A new
 * seed that re-introduces one fails this suite — it cannot regress silently.
 */

import { EXCLUDED_NAME_FRAGMENTS, EXCLUDED_SLUGS } from './excluded';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'prisma', 'migrations');

// Excluded slugs (exact) + name fragments (Arabic) that must never survive.
// The list itself lives in ./excluded.ts (Batch OPS) so the runtime
// content.categories.* guard and this seed guard can never drift apart.

function migrationsInOrder(): Array<{ name: string; sql: string }> {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => ({
      name,
      sql: readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8'),
    }));
}

describe('permanent-exclusions seed guard', () => {
  const migrations = migrationsInOrder();

  it('the seed DATA file (categories.data.mjs) carries no excluded category', () => {
    // OPS Part 2 aftermath: the 0040 purge cleaned the DB but the seed data
    // still generated music-videos/musical/romance, so any re-seed silently
    // regressed BUG-2 (caught live by policy-guards e2e). The guard now
    // watches the data source itself, not just the migration chain.
    const src = readFileSync(join(__dirname, '..', '..', 'prisma', 'categories.data.mjs'), 'utf8');
    const kebab = (s: string): string =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const leaks: string[] = [];
    for (const [, q] of src.matchAll(/'([^']+)'/g)) {
      if (EXCLUDED_SLUGS.includes(kebab(q!))) {
        leaks.push(`quoted literal '${q}' → excluded slug '${kebab(q!)}'`);
      }
      for (const frag of EXCLUDED_NAME_FRAGMENTS) {
        if (q!.includes(frag)) leaks.push(`quoted literal '${q}' contains «${frag}»`);
      }
    }
    expect(leaks).toEqual([]);
  });

  const deletedBy = (term: string, afterIdx: number): boolean =>
    migrations
      .slice(afterIdx + 1)
      .concat(migrations[afterIdx]!) // same-file insert+delete also counts
      .some((m) => /delete\s+from\s+"?category"?/i.test(m.sql) && m.sql.toLowerCase().includes(term.toLowerCase()));

  it('no excluded category slug survives the migration chain', () => {
    const leaks: string[] = [];
    migrations.forEach((m, i) => {
      const inserts = m.sql.toLowerCase();
      if (!/insert\s+into\s+"?category"?/i.test(m.sql)) return;
      for (const slug of EXCLUDED_SLUGS) {
        // Whole-slug match inside a quoted SQL string literal.
        if (new RegExp(`'${slug}'`).test(inserts) && !deletedBy(`'${slug}'`, i)) {
          leaks.push(`${m.name}: slug '${slug}' inserted and never deleted`);
        }
      }
      for (const frag of EXCLUDED_NAME_FRAGMENTS) {
        if (m.sql.includes(frag) && !deletedBy(frag, i)) {
          leaks.push(`${m.name}: name fragment «${frag}» inserted and never deleted`);
        }
      }
    });
    expect(leaks).toEqual([]);
  });

  it('the 0040 purge migration exists and removes the known leaks', () => {
    const purge = migrations.find((m) => m.name.startsWith('0040'));
    expect(purge).toBeDefined();
    for (const slug of ['music-videos', 'musical', 'romance']) {
      expect(purge!.sql).toContain(`'${slug}'`);
    }
  });
});
