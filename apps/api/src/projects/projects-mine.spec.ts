import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Batch PAGE-PARITY U4 — the creator dashboard reads real campaigns.
 *
 * Its four KPI tiles were literals: «684,200 ر.س», «2,847», «171%», "ends
 * 28 يناير". The signed-in creator's actual campaigns were 21,000–76,500 SAR
 * with 173–512 backers, and the header named a project they did not own. A
 * fixture always renders, so nothing ever failed.
 */
describe('GET /v1/projects/mine', () => {
  const src = readFileSync(join(__dirname, 'projects.controller.ts'), 'utf8');

  it("is declared BEFORE the ':id' route", () => {
    // Nest matches in declaration order. Behind @Get(':id') this route is
    // unreachable — "mine" is parsed as a project id and the endpoint 404s
    // while looking perfectly well-formed in the source.
    // Match the DECORATOR at the start of a line. A plain indexOf found the
    // same string inside this route's own doc comment and reported the order
    // backwards — the test failed while the code was right.
    // `[ \t]*`, not `\s*`: \s matches newlines, so `^\s*` anchors from an
    // earlier line and search() returns a skewed index. That reported the two
    // routes in the wrong order while the file was correct — the same
    // cross-line trap the numeral guard hit.
    const at = (re: RegExp) => src.search(re);
    const mine = at(/^[ \t]*@Get\('mine'\)/m);
    const byId = at(/^[ \t]*@Get\(':id'\)/m);
    // jest's expect takes ONE argument — no message parameter (Playwright's
    // does, and mixing the two up is a recurring authoring slip). The context
    // lives in the comments above instead.
    expect(mine).toBeGreaterThan(-1);
    expect(byId).toBeGreaterThan(-1);
    expect(mine).toBeLessThan(byId);
  });

  it('requires a session — it is a private surface', () => {
    const block = src.slice(src.indexOf("@Get('mine')"), src.indexOf('async mine('));
    expect(block).toContain('JwtAuthGuard');
    expect(block).not.toContain('OptionalJwtAuthGuard');
  });

  it('scopes strictly to the caller and hides nothing from them', () => {
    const svc = readFileSync(join(__dirname, 'projects.service.ts'), 'utf8');
    const block = svc.slice(svc.indexOf('async listMine('), svc.indexOf('async create('));
    // Only the WHERE clause may not filter. `status: true` in the SELECT is
    // required — the tiles need it — and an earlier version of this assertion
    // rejected the select as if it were a filter.
    const where = block.slice(block.indexOf('where: {'), block.indexOf('select: {'));
    expect(where).toContain('createdById: creatorId');
    // Not the public creator profile: a draft-only creator still has a
    // dashboard, and it must neither 404 nor hide their own campaign.
    expect(where).not.toContain('status');
    expect(where).not.toContain('publishedAt');
    // The tiles need these four or they cannot be truthful.
    for (const f of ['raisedHalalas', 'fundingGoalHalalas', 'backersCount', 'deadline']) {
      expect(block).toContain(f);
    }
  });
});
