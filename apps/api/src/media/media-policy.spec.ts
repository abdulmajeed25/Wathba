import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { ALLOWED_KINDS } from './media.service';

/**
 * The media bucket's public-read policy is a security boundary with no other
 * guard on it.
 *
 * `evidence/` holds payout proof and KYC documents and lives in the SAME bucket
 * as the public media (which is why the bucket is called venture-evidence), so
 * the ONLY thing keeping those documents private is that one string never
 * appearing in the public list. A bucket-wide grant, or an absent-minded "open
 * everything the API accepts", is a data leak rather than a broken image — and
 * it would not fail a test, break a page, or look wrong in review.
 *
 * That is exactly how `hero/` and `reward/` got in: the list was first written
 * as "every ALLOWED_KIND except evidence", by symmetry with MediaService rather
 * than by checking that anything writes there. Nothing was exposed, because
 * both prefixes were empty. The next such slip may not be so lucky.
 *
 * The policy lives in a plain .mjs beside the seeds because it is also run
 * directly (`node --env-file=.env prisma/media-policy.mjs`). Jest here is CJS
 * with rootDir=src, so it can neither import ESM nor reach outside src — and
 * reconfiguring it for one spec would put 686 passing tests through a transform
 * change for no benefit. So the module is evaluated by Node itself, exactly as
 * the script loads it, and this asserts on what that real load produces.
 */
const POLICY = join(__dirname, '..', '..', 'prisma', 'media-policy.mjs');
const BUCKET = 'venture-evidence';

interface Statement {
  Effect: string;
  Principal: { AWS: string[] };
  Action: string[];
  Resource: string[];
}

function loadPolicy(): { prefixes: string[]; statement: Statement } {
  const src =
    `import { PUBLIC_PREFIXES, buildStatement } from ${JSON.stringify(POLICY)};` +
    `process.stdout.write(JSON.stringify({ prefixes: PUBLIC_PREFIXES, statement: buildStatement(${JSON.stringify(BUCKET)}) }));`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', src], {
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

describe('media bucket public-read policy', () => {
  it('never grants public read to evidence/', () => {
    const { prefixes, statement } = loadPolicy();
    expect(prefixes).not.toContain('evidence');

    // Asserted on the rendered ARNs too, not just the prefix list: a typo like
    // 'evidence-thumbs', or a stray bucket-wide '*', would pass the check above.
    for (const arn of statement.Resource) {
      expect(arn).not.toMatch(/\/evidence/);
      expect(arn).not.toBe(`arn:aws:s3:::${BUCKET}/*`);
    }
  });

  it('grants exactly the prefixes that have a producer', () => {
    // Change this list ONLY in the same commit as the producer that writes there.
    //   demo-covers <- prisma/seed-project-covers.mjs
    //   story       <- wathba-dashboard-story-editor.tsx (kind: 'story')
    //   avatar      <- wathba-settings.tsx, wathba-dashboard-creator-profile-editor.tsx
    const { prefixes } = loadPolicy();
    expect([...prefixes].sort()).toEqual(['avatar', 'demo-covers', 'story']);
  });

  /**
   * The invariant the other tests cannot see, and the one that actually failed.
   *
   * Two lists describe the same system from opposite ends — what the API will
   * ACCEPT an upload for, and what anonymous visitors can READ — and they drift
   * silently in both directions:
   *
   *   a kind with no public prefix  -> the upload succeeds, then 403s on read
   *   a public prefix with no kind  -> a standing anonymous grant on a path
   *                                    nothing writes to (this is what happened)
   *
   * `demo-covers` is the one legitimate asymmetry: it is written by
   * prisma/seed-project-covers.mjs, not through an upload kind. `evidence` is
   * the other, in the opposite direction, and is the whole reason this matters.
   */
  it('the accepted kinds and the public prefixes agree', () => {
    const { prefixes } = loadPolicy();

    const PRIVATE_KINDS = ['evidence']; // payout proof + KYC. Never public.
    const NON_UPLOAD_PREFIXES = ['demo-covers']; // seed-written, no upload kind.

    const shouldBePublic = ALLOWED_KINDS.filter((k) => !PRIVATE_KINDS.includes(k));
    const expected = [...NON_UPLOAD_PREFIXES, ...shouldBePublic].sort();

    expect([...prefixes].sort()).toEqual(expected);
  });

  it('grants read only, scoped to one bucket, and never lists it', () => {
    const { statement } = loadPolicy();
    expect(statement.Effect).toBe('Allow');
    expect(statement.Principal.AWS).toEqual(['*']);
    // s3:ListBucket would turn every public prefix into a browsable index of
    // uploads. Keys are UUIDs precisely so that being linked is the only way in.
    expect(statement.Action).toEqual(['s3:GetObject']);
    for (const arn of statement.Resource) {
      expect(arn.startsWith(`arn:aws:s3:::${BUCKET}/`)).toBe(true);
      expect(arn.endsWith('/*')).toBe(true);
    }
  });
});
