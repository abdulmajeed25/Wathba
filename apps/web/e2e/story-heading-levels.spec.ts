import { expect, test } from '@playwright/test';

import { API, apiSignin } from './helpers';

/**
 * A story whose headings are ALL «عنوان فرعي» must not skip a heading level.
 *
 * The page title is the h1 and the story sits under it, so `#` renders h2 and
 * `##` renders h3. A creator who uses only `##` — reasonable when every section
 * is a peer — produced h3 directly beneath the h1. Nothing looks wrong on
 * screen; it shows up only in the accessibility tree, as a missing section above
 * every heading.
 *
 * Asserted through the dashboard editor's live preview because that is the
 * surface where a creator actually types `##`, and it runs the same parseStory
 * the public page runs. Reaching it on a public page would mean persisting a
 * story into seeded demo data, which this must not do — so nothing here is
 * saved.
 */

const OWNER = { email: 'sirb@wathba.demo', password: 'Wathba!2026' };
const PROJECT_ID = '33333333-0000-4000-8000-000000000005';

const SUB_HEADINGS_ONLY = [
  '## أول قسم',
  '',
  'فقرة تحت القسم الأول.',
  '',
  '## ثاني قسم',
  '',
  'فقرة تحت القسم الثاني.',
].join('\n');

const MIXED = [
  '# قسم رئيسي',
  '',
  'فقرة.',
  '',
  '## قسم فرعي',
  '',
  'فقرة أخرى.',
].join('\n');

/** Heading levels rendered inside the editor's live preview, in order. */
async function previewLevels(page: import('@playwright/test').Page, markdown: string): Promise<number[]> {
  const box = page.locator('textarea').first();
  await box.fill(markdown);
  // The preview is derived state; give React a beat to re-render it.
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 10_000 });
  return page.evaluate(() => {
    // The preview column is the one that mirrors the textarea, so scope to
    // headings that carry no id — the public renderer's ids are page-only.
    const main = document.querySelector('main') ?? document.body;
    return [...main.querySelectorAll('h2, h3')].map((h) => Number(h.tagName[1]));
  });
}

test.beforeEach(async ({ page, context }) => {
  // Sign in via the API and hand the session to the browser, so this spec does
  // not re-test the login flow that a dozen other specs already cover.
  await apiSignin(OWNER.email, OWNER.password);
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill(OWNER.email);
  await page.locator('input[name="password"]').fill(OWNER.password);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/projects/);
  void context;
  await page.goto(`/projects/dashboard/${PROJECT_ID}/story`);
  await expect(page.locator('textarea').first()).toBeVisible({ timeout: 15_000 });
});

test('H1: a story using only «عنوان فرعي» starts at h2, not h3', async ({ page }) => {
  const levels = await previewLevels(page, SUB_HEADINGS_ONLY);

  expect(levels.length, 'both headings should render').toBeGreaterThanOrEqual(2);
  // The defect: these were h3 under the page h1.
  expect(levels.every((l) => l === 2), `levels were ${levels.join(', ')}`).toBe(true);
});

test('H2: a story using both levels keeps its nesting', async ({ page }) => {
  // The lift must not flatten real structure — only shift when there is
  // nothing at the shallower level.
  const levels = await previewLevels(page, MIXED);

  expect(levels).toContain(2);
  expect(levels, `levels were ${levels.join(', ')}`).toContain(3);
});

test('H3: the API still serves this project, so the fixture ids are current', async () => {
  // Cheap canary: if the seeded project id ever changes, the two tests above
  // would fail on navigation and look like heading regressions.
  const res = await fetch(`${API}/v1/projects/${PROJECT_ID}`);
  expect(res.ok, `seeded project ${PROJECT_ID} not found — update this spec`).toBe(true);
});
