import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * The timing constants the e2e suite waits on are COPIES. This checks them.
 *
 * ── why this exists ─────────────────────────────────────────────────────────
 * Several specs wait out a product timer and then assert that nothing happened:
 * no video was fetched, no autoplay started, the hero did not advance. Each of
 * those waits is a number chosen to clear a constant that lives in a component
 * — `HOVER_INTENT_MS`, `LCP_PROTECTION_MS`, `DWELL_MS` — and none of them
 * imports it. They are hand-typed duplicates, kept in sync by memory.
 *
 * The failure mode is not a flaky test. Raise `HOVER_INTENT_MS` from 150 to 700
 * and `home-card-video`'s 600ms touch assertion still PASSES — it checks that no
 * video mounted, and it now checks that before the video could ever have
 * mounted. The test does not break. It retires, silently, and no re-run reveals
 * it. That is the same shape as every other defect this batch turned up: the
 * instrument reads as a pass.
 *
 * ── why a source scan rather than an import ─────────────────────────────────
 * The constants live inside `'use client'` .tsx components. Importing one into
 * a Playwright spec drags React and the whole component graph into the test
 * process to read a number. `card-media.spec.ts` and `search-candidates.spec.ts`
 * already establish the source-scan pattern in this repo for exactly this: a
 * fact that lives in one file and must be true in another.
 *
 * ── what to do when this fails ──────────────────────────────────────────────
 * Do not just update the copy. The margins below say WHY each wait is the
 * length it is; if the product constant moved, the waits that depend on it have
 * to move with it, or they stop testing anything.
 */

const SRC = join(__dirname, '..', 'src', 'components', 'ventures', 'wathba');
const read = (f: string): string => readFileSync(join(SRC, f), 'utf8');

/** Pull `const NAME = 1_234;` out of a component. Throws rather than returning
 *  a default: a constant that has been RENAMED is exactly the drift this file
 *  is here to catch, and a silent fallback would hide it. */
function constant(file: string, name: string): number {
  const m = new RegExp(`const ${name}\\s*=\\s*([0-9_]+)`).exec(read(file));
  if (!m) throw new Error(`${name} is gone from ${file} — every wait keyed to it is now unanchored`);
  return Number(m[1]!.replace(/_/g, ''));
}

const CARD = 'wathba-card-video.tsx';
const ROTATOR = 'wathba-hero-rotator.tsx';

test('TC1: the copies in the specs still match the components', () => {
  // Each entry is a spec that hard-codes a product constant. The file is read
  // rather than imported so a rename in EITHER direction is caught.
  const copies: Array<{ spec: string; declares: string; source: number }> = [
    { spec: 'home-card-video.spec.ts', declares: 'LCP_PROTECTION_MS', source: constant(CARD, 'LCP_PROTECTION_MS') },
    { spec: 'home-hero-video.spec.ts', declares: 'LCP_PROTECTION_MS', source: constant(CARD, 'LCP_PROTECTION_MS') },
    { spec: 'home-hero-video.spec.ts', declares: 'DWELL_MS', source: constant(ROTATOR, 'DWELL_MS') },
    { spec: 'hero-rotator.spec.ts', declares: 'DWELL', source: constant(ROTATOR, 'DWELL_MS') },
  ];

  for (const c of copies) {
    const src = readFileSync(join(__dirname, c.spec), 'utf8');
    const m = new RegExp(`const ${c.declares}\\s*=\\s*([0-9_]+)`).exec(src);
    expect(m, `${c.spec} no longer declares ${c.declares} — update this guard or the spec`).not.toBeNull();
    expect(
      Number(m![1]!.replace(/_/g, '')),
      `${c.spec} waits on ${c.declares}=${m![1]} but the component now says ${c.source}`,
    ).toBe(c.source);
  }
});

test('TC2: the negative-assertion waits still clear the timer they are betting on', () => {
  const intent = constant(CARD, 'HOVER_INTENT_MS');

  /*
   * These waits are the ones with INVERTED risk. They sleep, then assert that
   * NOTHING happened — no video, no fetch. Too long is harmless; too short and
   * the assertion is made before the thing it forbids could have occurred, and
   * the test passes without testing.
   *
   * `HOVER_INTENT_MS` is not mirrored in any spec, so these numbers are the only
   * record that they were ever chosen against it. 3× is the floor: enough that a
   * slow frame or two cannot eat the margin, small enough that a real change to
   * the intent delay trips this instead of being absorbed.
   */
  const waits: Array<{ where: string; ms: number; why: string }> = [
    { where: 'home-card-video V5 — no fetch without hover', ms: 1500, why: 'nothing may be requested' },
    { where: 'home-card-video V7 — touch does not autoplay', ms: 600, why: 'no <video> may mount' },
    { where: 'home-card-video V8 — reduced motion', ms: 600, why: 'no autoplaying loop' },
  ];

  for (const w of waits) {
    expect(
      w.ms / intent,
      `${w.where}: waits ${w.ms}ms against HOVER_INTENT_MS=${intent}. ` +
        `Too little margin — "${w.why}" would be asserted before it could be violated.`,
    ).toBeGreaterThanOrEqual(3);
  }
});

test('TC3: the hero-hold waits outlast a full dwell', () => {
  const dwell = constant(ROTATOR, 'DWELL_MS');

  // «hover must hold the slide» and «reduced motion must not put the reader on
  // a carousel» both wait, then assert the slide did NOT change. If the wait is
  // shorter than one dwell the rotator was never going to advance anyway, and
  // the assertion is vacuous — it would pass against a rotator with the pause
  // logic deleted entirely.
  for (const [where, ms] of [
    ['hero-rotator: hover holds', dwell + 4000],
    ['hero-rotator: reduced motion', dwell + 4000],
    ['home-hero-video: hover pauses rotation', dwell + 3000],
  ] as const) {
    expect(ms, `${where}: ${ms}ms does not outlast one dwell (${dwell}ms)`).toBeGreaterThan(dwell);
  }
});
