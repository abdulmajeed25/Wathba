import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import {
  DWELL_MS,
  HOVER_INTENT_MS,
  LCP_PROTECTION_MS,
} from '../src/components/ventures/wathba/wathba-timing';

/**
 * The waits this suite is built on, and the constants they are betting against.
 *
 * ── what this used to be, and why it changed ────────────────────────────────
 * These three constants lived inside the components, and four specs re-declared
 * their own copies of the same numbers. This file policed that duplication by
 * reading the component sources. It no longer has to: `wathba-timing.ts` is now
 * the single declaration and both sides import it, so a changed value moves the
 * specs with it automatically and TC1 has nothing left to check.
 *
 * What a shared constant CANNOT express is the margin. Several specs wait out a
 * timer and then assert that nothing happened — no video, no fetch, no advance.
 * Those waits are numbers chosen to CLEAR a constant, and that relationship
 * lives nowhere in the type system. If `HOVER_INTENT_MS` moves to 700, every
 * import updates and `home-card-video`'s 600ms "no video mounted on touch"
 * assertion still passes — now checking that before a video could ever have
 * mounted. The test does not break. It retires, silently.
 *
 * So this file kept the checks that matter and dropped the one that stopped
 * mattering.
 */

test('TC1: no spec re-declares a shared timing constant', () => {
  // The duplication is gone; this keeps it gone. A future spec that types its
  // own `const LCP_PROTECTION_MS = 2000` gets the old failure mode back for
  // free, and nothing else would notice.
  const shared = ['HOVER_INTENT_MS', 'LCP_PROTECTION_MS', 'DWELL_MS'];
  const offenders: string[] = [];

  for (const file of readdirSync(__dirname).filter((f) => f.endsWith('.spec.ts'))) {
    if (file === 'timing-constants.spec.ts') continue;
    const src = readFileSync(join(__dirname, file), 'utf8');
    for (const name of shared) {
      if (new RegExp(`const ${name}\\s*=\\s*[0-9]`).test(src)) {
        offenders.push(`${file} declares its own ${name}`);
      }
    }
  }

  expect(
    offenders,
    `import from wathba-timing.ts instead:\n  ${offenders.join('\n  ')}`,
  ).toEqual([]);
});

test('TC2: no bare wait is short enough to out-race the hover intent', () => {
  /*
   * These waits have INVERTED risk. A spec sleeps, then asserts that NOTHING
   * happened — no video, no fetch. Too long is harmless; too short and the
   * assertion is made before the thing it forbids could have occurred, and the
   * test passes without testing anything.
   *
   * READ from the specs, not restated here. The first version of this check
   * listed the wait values as literals — which made it a copy of a copy, blind
   * to someone changing 600 to 300 in the spec itself. It has to parse.
   *
   * 3x is the floor: enough that a slow frame or two cannot eat the margin,
   * small enough that a real change to the intent delay trips this instead of
   * being absorbed.
   */
  /*
   * Scoped to waits that PRECEDE A NEGATIVE ASSERTION, which is the whole
   * definition of the group. A first draft scanned every wait in the file and
   * flagged a 300ms pause that exists for a 240ms slide transition — nothing to
   * do with hover intent. A guard that reports waits it does not understand
   * trains people to ignore it.
   */
  const NEGATIVE = /\.toBe\(0\)|\.toEqual\(\[\]\)|toHaveCount\(0\)/;
  const offenders: string[] = [];
  for (const file of ['home-card-video.spec.ts', 'home-hero-video.spec.ts']) {
    const lines = readFileSync(join(__dirname, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      const m = /waitForTimeout\((\d[\d_]*)\)/.exec(line);
      if (!m) return;
      // The assertion it is setting up, within a few lines either side of the
      // message argument that usually sits between them.
      if (!lines.slice(i + 1, i + 6).some((l) => NEGATIVE.test(l))) return;
      const ms = Number(m[1]!.replace(/_/g, ''));
      if (ms / HOVER_INTENT_MS < 3) {
        offenders.push(
          `${file}:${i + 1} waits ${ms}ms then asserts nothing happened — ` +
            `under 3x HOVER_INTENT_MS (${HOVER_INTENT_MS})`,
        );
      }
    });
  }
  expect(
    offenders,
    `a wait this short can assert "nothing happened" before it could have:\n  ${offenders.join('\n  ')}`,
  ).toEqual([]);
});

test('TC3: the hero-hold waits are expressed relative to the dwell, not typed out', () => {
  /*
   * «hover must hold the slide» and «reduced motion must not put the reader on
   * a carousel» wait, then assert the slide did NOT change. A wait shorter than
   * one dwell is vacuous — it would pass against a rotator with the pause logic
   * deleted entirely.
   *
   * Now that DWELL_MS is imported, `DWELL_MS + 4000` tracks the constant by
   * itself and needs no checking — asserting `DWELL_MS + 4000 > DWELL_MS` is a
   * tautology, and an earlier draft of this test shipped exactly that. What
   * still can go wrong is someone typing the number out. A literal at dwell
   * scale is a wait that has stopped tracking anything.
   */
  const offenders: string[] = [];
  for (const file of ['hero-rotator.spec.ts', 'home-hero-video.spec.ts']) {
    const src = readFileSync(join(__dirname, file), 'utf8');
    for (const m of src.matchAll(/waitForTimeout\((\d[\d_]*)\)/g)) {
      const ms = Number(m[1]!.replace(/_/g, ''));
      if (ms >= DWELL_MS / 2) {
        offenders.push(`${file}: waitForTimeout(${ms}) is dwell-scale — write it as DWELL_MS + n`);
      }
    }
  }
  expect(offenders, offenders.join('\n  ')).toEqual([]);
});

test('TC4: the LCP guard is long enough to be worth having', () => {
  // Not a copy check — a sanity bound. This constant exists to keep a video
  // fetch away from the hero cover while it is still the LCP candidate. A value
  // shorter than the intent delay would mean the guard expires before a hover
  // could even register, which is a guard that does nothing.
  expect(LCP_PROTECTION_MS).toBeGreaterThan(HOVER_INTENT_MS);
});
