import { expect, test, type Page } from '@playwright/test';

/**
 * HOME-REVIEW D7 — the theme has to outlive the page.
 *
 * It was `useState('light')` and nothing else: the toggle worked until you
 * refreshed. A reader who prefers dark re-picked it on every visit, and a
 * reader whose OS is already set to dark was shown light anyway.
 *
 * The load-bearing claim is not "dark is reachable" — it always was — but that
 * the right theme is on screen BEFORE hydration. So the first test blocks the
 * app's JS chunks outright: with React unable to run, only the inline
 * pre-paint script can have set the palette. A test that let hydration happen
 * would pass just as happily against a `useEffect`-only implementation, which
 * is the flash this exists to remove.
 */

const DARK_BG = '#131210';
const LIGHT_BG = '#f4f6f1';

async function shell(page: Page) {
  const el = page.locator('[data-pillar="ventures"]').first();
  await expect(el).toBeVisible();
  return el.evaluate((n: HTMLElement) => ({
    attr: n.getAttribute('data-theme'),
    bg: n.style.getPropertyValue('--bg').trim(),
  }));
}

/** Seed the stored choice before the page's own scripts run. */
async function store(page: Page, value: string) {
  await page.addInitScript((v) => {
    try {
      window.localStorage.setItem('wathba:theme', v as string);
    } catch {
      /* ignore */
    }
  }, value);
}

test('D1: a stored dark choice paints dark with the app JS blocked entirely', async ({ page }) => {
  await store(page, 'dark');
  // No chunks -> no hydration -> no effects. Whatever theme is on the element
  // was put there by the inline script, during parse.
  await page.route('**/_next/static/chunks/**', (r) => r.abort());

  await page.goto('/projects');
  const s = await shell(page);
  expect(s.attr, 'the attribute the script stamps').toBe('dark');
  expect(s.bg, 'the palette the script applies').toBe(DARK_BG);
});

test('D2: with no stored choice, the OS preference decides', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.route('**/_next/static/chunks/**', (r) => r.abort());
  await page.goto('/projects');
  expect((await shell(page)).bg, 'prefers-color-scheme: dark').toBe(DARK_BG);
  await ctx.close();
});

test('D3: an explicit light choice beats an OS dark preference', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark' });
  const page = await ctx.newPage();
  await store(page, 'light');
  await page.route('**/_next/static/chunks/**', (r) => r.abort());
  await page.goto('/projects');

  // The stored value is the reader's decision; the OS setting is only ever the
  // opening default. Getting this backwards means a reader cannot choose light
  // on a dark machine at all.
  expect((await shell(page)).bg, 'the stored choice must win').toBe(LIGHT_BG);
  await ctx.close();
});

test('D4: the toggle survives a reload', async ({ page }) => {
  await page.goto('/projects');
  const before = await shell(page);
  expect(before.bg, 'the page starts light for a fresh visitor').toBe(LIGHT_BG);

  await page.getByTitle('تبديل النمط').first().click();
  await expect
    .poll(async () => (await shell(page)).bg, { message: 'the toggle applies dark' })
    .toBe(DARK_BG);

  await page.reload();
  const after = await shell(page);
  expect(after.bg, 'a refresh used to put the reader back in light').toBe(DARK_BG);
  expect(after.attr).toBe('dark');
});
