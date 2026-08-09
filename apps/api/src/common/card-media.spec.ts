import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cardVideoUrl } from './card-media';

/**
 * The card-media rule, and the guarantee that it is the ONLY rule.
 *
 * This is a unit test rather than an e2e one on purpose, and the reason is
 * worth recording: the only LIVE project the browser suite owns is the
 * golden-journey project, and that project has no cover (`mediaUrls: []`) so it
 * never appears in the discover feed — there is no public card payload for it
 * to assert against. Reaching for a project the suite does not own would mean
 * seeding a second LIVE project into public listings, which shifts the counts
 * every other spec reads. The rule is one pure function; test it as one, and
 * test that nothing bypasses it.
 */

describe('cardVideoUrl', () => {
  it('passes the video through on the default', () => {
    expect(cardVideoUrl({ videoUrl: 'https://x/a.mp4', cardMedia: 'VIDEO' })).toBe('https://x/a.mp4');
  });

  it('hides the video when the creator chose a poster card', () => {
    expect(cardVideoUrl({ videoUrl: 'https://x/a.mp4', cardMedia: 'POSTER' })).toBeNull();
  });

  it('is inert when there is no video, in either direction', () => {
    expect(cardVideoUrl({ videoUrl: null, cardMedia: 'VIDEO' })).toBeNull();
    expect(cardVideoUrl({ videoUrl: null, cardMedia: 'POSTER' })).toBeNull();
  });
});

/**
 * Every card payload goes through the rule.
 *
 * A source guard, because the failure it catches is a fifth surface being added
 * later that emits `videoUrl: p.videoUrl` directly and quietly ignores the
 * creator's choice. Scanned as whole-file content rather than line by line —
 * a per-line scan is blind to anything a formatter has split across lines, and
 * would report a clean pass while missing exactly the case it was written for.
 */
describe('the rule has no bypass', () => {
  const CARD_SERVICES = [
    'home/home.service.ts',
    'home/hero.service.ts',
    'discover/discover.service.ts',
  ];

  it.each(CARD_SERVICES)('%s resolves videoUrl through cardVideoUrl', (rel) => {
    const src = readFileSync(join(__dirname, '..', rel), 'utf8');
    expect(src).toContain('cardVideoUrl');
    // `videoUrl: p.videoUrl` (or r.videoUrl) is the shape of a bypass. The
    // SELECT clauses that list `videoUrl: true` are a different shape and are
    // not matched here.
    const bypass = /videoUrl:\s*(?:\(?\s*)?[a-z]\.videoUrl/i.exec(src);
    expect(bypass?.[0] ?? null).toBeNull();
  });

  it('the project DETAIL deliberately does not, and says so', () => {
    const src = readFileSync(join(__dirname, '..', 'projects/projects.service.ts'), 'utf8');
    // The detail payload is the creator's and the campaign page's view: it
    // carries the raw video plus the flag, so choosing POSTER hides the video
    // from cards without destroying it.
    expect(src).toContain('cardMedia: p.cardMedia');
    expect(src).toContain('videoUrl: p.videoUrl');
  });
});
