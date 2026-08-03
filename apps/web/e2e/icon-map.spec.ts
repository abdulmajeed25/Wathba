import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * Every Icon ligature must resolve to a real glyph.
 *
 * `Icon` maps Material-Symbols names (what the design speaks) onto lucide
 * components, and an unmapped name falls back to AlertCircle — a warning
 * circle — deliberately, "so a missing mapping is loud, not silent". It was
 * loud for a long time and nobody looked: three creator-dashboard tabs and the
 * «الداعمون» stat card shipped showing a warning circle where their icon
 * belonged.
 *
 * Two tests, because they cover holes the other one cannot see.
 */

const SRC = join(__dirname, '..', 'src');
const ICONS = join(SRC, 'components', 'ventures', 'wathba', 'wathba-icons.tsx');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules') walk(p, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

test('I1: every icon name written in the source has an ICON_MAP entry', () => {
  const map = readFileSync(ICONS, 'utf8');
  const body = map.split('const ICON_MAP')[1]?.split('};')[0] ?? '';
  const keys = new Set([...body.matchAll(/^\s*([a-z_0-9]+)\s*:/gm)].map((m) => m[1]));
  // A guard that reads an empty map would pass everything.
  expect(keys.size, 'the ICON_MAP parse must actually find entries').toBeGreaterThan(50);

  // Three shapes reach `Icon`: the JSX prop, a `icon:` field in a data array
  // (the notification kind map, the wizard steps), and an `icon=` prop passed
  // through a wrapper component.
  const PATTERNS = [
    /<Icon\s+name="([a-z_0-9]+)"/g,
    /\bicon:\s*'([a-z_0-9]+)'/g,
    /\bicon="([a-z_0-9]+)"/g,
  ];

  const missing: string[] = [];
  for (const file of walk(SRC)) {
    const src = readFileSync(file, 'utf8');
    src.split('\n').forEach((line, i) => {
      for (const re of PATTERNS) {
        for (const m of line.matchAll(re)) {
          if (!keys.has(m[1])) missing.push(`${relative(SRC, file)}:${i + 1}  ${m[1]}`);
        }
      }
    });
  }

  expect(
    missing,
    `these names render the AlertCircle fallback — add them to ICON_MAP in ` +
      `wathba-icons.tsx:\n  ${missing.join('\n  ')}`,
  ).toEqual([]);
});

test('I2: no fallback glyph is painted on any public page', async ({ page }) => {
  // I1 cannot see names that arrive at runtime — category icons come from the
  // API, and so does the kind on a notification. This one can, but only for
  // pages it can reach, which is why both exist.
  //
  // AlertCircle is imported ONLY as the fallback (no ICON_MAP key points at
  // it), so any `lucide-circle-alert` in the DOM is by definition a miss.
  const PAGES = ['/projects', '/projects/discover-all', '/spotlight', '/projects/ranks', '/projects/how'];

  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForTimeout(900);
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('svg')]
        .filter((s) => /circle-alert|alert-circle/.test(s.getAttribute('class') ?? ''))
        .map((s) => (s.parentElement?.textContent ?? '').trim().slice(0, 40)),
    );
    expect(bad, `${path} paints ${bad.length} fallback glyph(s), beside: ${bad.join(' · ')}`).toEqual(
      [],
    );
  }
});
