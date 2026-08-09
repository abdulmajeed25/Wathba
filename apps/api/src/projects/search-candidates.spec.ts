import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SearchService } from './search.service';

/**
 * Batch DISCOVERY-ENGINE Unit 3 — one definition of "this project matches".
 *
 * There were two, and they had silently diverged: /v1/search matched title,
 * body, creator, category and tag, while /v1/discover's `?q=` matched title and
 * body only. The reader saw «تقنية» in the header suggest, clicked through to
 * the results page, and got nothing. No error, no failing test — the two pages
 * simply disagreed about the same word.
 *
 * These are structural guards, not behavioural ones. The behaviour is asserted
 * end-to-end in e2e/arabic-search.spec.ts and e2e/facet-richness.spec.ts; what
 * a unit test can do is make the DUPLICATION impossible to reintroduce quietly.
 */

const SRC = join(__dirname, '..');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');

describe('the shared candidate set', () => {
  it('covers all five match surfaces', () => {
    const sql = SearchService.candidateIds('تقنية');
    const text = sql.sql;

    // Each arm is a separate index scan. Losing one is a recall regression that
    // shows up as "search got worse" months later, with nothing to point at.
    expect(text).toContain('"searchVector" @@');
    expect(text).toContain('<% wathba_normalize_arabic(p."titleAr")');
    expect(text).toContain('"User" u2');
    expect(text).toContain('"Category" c2');
    expect(text).toContain('"ProjectTag" xt');
  });

  it('normalises the LIKE pattern in SQL, on both sides', () => {
    const text = SearchService.candidateIds('الأحياء').sql;

    // The bug this batch exists to fix, in miniature: normalise the column and
    // not the pattern (or the reverse) and «الاحياء» never meets «الأحياء».
    // Building the pattern in SQL is what keeps one normaliser for both sides.
    const likeArms = text.match(/LIKE \(\$\d+\)/g) ?? [];
    expect(likeArms).toHaveLength(0);
    expect(text).toContain("LIKE ('%' || wathba_normalize_arabic(");
  });

  it('is a UNION of single-predicate arms, never one OR-ed WHERE', () => {
    const text = SearchService.candidateIds('تقنية').sql;

    // Measured in Unit 4: a multi-arm OR spanning Project, User, Category and
    // Tag cannot become a bitmap index scan, so Postgres fell back to a Seq
    // Scan on Project AND on User. 16ms → 4.6ms after the rewrite. An OR
    // reappearing here would be a 3x latency regression that still returns the
    // right rows, so nothing would fail.
    expect(text).toContain('UNION');
    expect(text).not.toMatch(/WHERE[^)]*\bOR\b/);
  });

  it('parameterises the query text rather than interpolating it', () => {
    const sql = SearchService.candidateIds("'; DROP TABLE \"Project\"; --");
    expect(sql.sql).not.toContain('DROP TABLE');
    // The literal survives as a BOUND VALUE, never as query text. (`Prisma.Sql`
    // is a type-only export at runtime, so identity is asserted this way.)
    expect(sql.values).toContain("'; DROP TABLE \"Project\"; --");
  });

  it('is the only thing discover uses for ?q=', () => {
    const src = read('discover/discover.service.ts');
    const block = src.slice(src.indexOf('if (f.q) {'), src.indexOf('return c;'));

    expect(block).toContain('SearchService.candidateIds(f.q)');
    // A second, hand-rolled predicate in this block is exactly how the two
    // pages drifted the first time.
    expect(block).not.toContain('websearch_to_tsquery');
    expect(block).not.toContain('<%');
  });
});
