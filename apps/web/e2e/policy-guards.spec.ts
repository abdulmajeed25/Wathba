import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

import { expect, test } from '@playwright/test';

import { API } from './helpers';

/**
 * Batch SEARCH Part 4 — policy guards that fail the gate on regression:
 *  BUG-1: Wathba is SAR-ONLY — no '$'-rendered money anywhere in web source
 *         (formatSar in src/lib/i18n/format.ts is the single money renderer).
 *  BUG-2: permanent cultural exclusions — no music/romance/occult/LGBTQIA+
 *         category may come back from the live API, and no «موسيقى» chip or
 *         fixture may return to the web source.
 */

const WEB_SRC = join(__dirname, '..', 'src');

test('BUG-1 guard: no dollar-rendered money in web source (formatSar is exclusive)', () => {
  // $<digit> inside string literals ('.. $25 ..'), or a currency:'USD'.
  const out = execSync(
    `grep -rn --include='*.ts' --include='*.tsx' -E "\\\\$[0-9]|currency: ?'USD'|'\\\\$'" ${WEB_SRC} || true`,
    { encoding: 'utf8' },
  )
    .split('\n')
    // Template interpolations (`${x}`) are code, not currency.
    .filter((l) => l && !l.includes('${'))
    .filter((l) => !l.includes('policy-guards'));
  expect(out).toEqual([]);
});

test('BUG-2 guard: no excluded terms in web fixtures/chips', () => {
  const out = execSync(
    `grep -rn --include='*.ts' --include='*.tsx' "موسيقى\\|MUSIC" ${WEB_SRC} || true`,
    { encoding: 'utf8' },
  )
    .split('\n')
    // The lucide icon-map key music_note is a glyph alias, not content.
    .filter((l) => l && !l.includes('music_note') && !l.includes('BUG-2'));
  expect(out).toEqual([]);
});

test('BUG-2 guard: the live category tree contains no excluded category', async () => {
  const res = await fetch(`${API}/v1/categories`);
  expect(res.ok).toBe(true);
  const body = (await res.json()) as { items?: unknown[] } | unknown[];
  const flat = JSON.stringify(body);
  for (const term of ['music-videos', '"musical"', '"romance"', 'موسيق', 'رومانس', 'lgbt', 'tarot']) {
    expect(flat.toLowerCase()).not.toContain(term.toLowerCase());
  }
});

test('BUG-2 guard: the music fixture project is gone from the seeded UI', async ({ page }) => {
  await page.goto('/projects/discover-all');
  await expect(page.getByText('وتر — ألبوم موسيقى', { exact: false })).toHaveCount(0);
  await expect(page.getByText('38,900')).toHaveCount(0);
});

test('BUG-1 render check: fixture money renders in SAR on the wizard fixture data', () => {
  const wizard = readFileSync(join(WEB_SRC, 'lib', 'stores', 'launch-wizard.ts'), 'utf8');
  expect(wizard).toContain('ر.س');
  expect(wizard).not.toMatch(/\$\d/);
});
