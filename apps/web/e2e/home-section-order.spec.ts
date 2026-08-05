import { expect, test } from '@playwright/test';

import { API } from './helpers';

/**
 * The homepage is ONE ordered list, and the order lives in data.
 *
 * It used to be two lists: seven blocks hardcoded in wathba-home.tsx, then the
 * admin-composed magazine underneath. Nothing below could ever rise above
 * anything on top, so the page's strongest evidence — a featured project told
 * properly, campaigns about to close, success stories — sat permanently BELOW
 * the creator call-to-action, which a reader takes for the end of the page.
 *
 * These assert the two properties that made the reorder worth doing, rather
 * than pinning the exact sequence (which is data, and operators may change it).
 */

const heading = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('heading', { name, exact: false }).first();

async function topOf(page: import('@playwright/test').Page, name: string): Promise<number> {
  const h = heading(page, name);
  await expect(h, `heading «${name}» must exist`).toBeVisible();
  return h.evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
}

test('T1: the proof comes before the ask', async ({ page }) => {
  await page.goto('/projects');
  // Scroll once so every lazy section has laid out.
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    window.scrollTo(0, 0);
  });

  const featured = await topOf(page, 'مشروع مميز');
  const stories = await topOf(page, 'قصص نجاح');
  const cta = await topOf(page, 'عندك فكرة');

  // Before: featured sat at 3878 and the CTA at 3348 — the evidence was BELOW
  // the closing ask, in the stretch of page a reader treats as an appendix.
  expect(featured, 'the featured project must sit above the creator CTA').toBeLessThan(cta);
  expect(stories, 'success stories must sit above the creator CTA').toBeLessThan(cta);
});

test('T2: there is only one creator ask, and nothing duplicates it', async ({ page }) => {
  await page.goto('/projects');
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    window.scrollTo(0, 0);
  });

  const cta = await topOf(page, 'عندك فكرة');
  const banner = await topOf(page, 'قوة الإيمان بالفكرة');

  // These two both ask «ابدأ مشروعك» and used to touch: gapAbove measured −1px.
  // Two identical asks adjacent halve the weight of each. They do not have to
  // be in any particular order — they have to not read as one moment.
  expect(Math.abs(banner - cta), 'the two creator asks must not sit on top of each other').toBeGreaterThan(400);
});

test('T3: the running order comes from HomepageSection, not from the code', async ({ page, request }) => {
  // The point of the refactor: reordering the homepage is a data change through
  // content.homepage-section.update, not a deploy. If the rendered order stops
  // following the API, the whole exercise has silently reverted.
  const res = await request.get(`${API}/v1/home`);
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { sections: Array<{ key: string }> };
  const apiOrder = body.sections.map((s) => s.key);
  expect(apiOrder.length, 'the API should drive a real running order').toBeGreaterThan(10);

  // Every code-owned section must be registered, or it renders only via the
  // safety net in wathba-home.tsx and can never be reordered by an operator.
  for (const key of ['categories', 'trending', 'transparency', 'backer_ranks', 'how_it_works', 'creator_cta']) {
    expect(apiOrder, `«${key}» must be registered in HomepageSection`).toContain(key);
  }

  await page.goto('/projects');
  // The magazine sections carry data-section; assert the DOM follows the API
  // for the subset that marks itself.
  const domKeys = await page.locator('[data-section]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-section')!),
  );
  const expected = apiOrder.filter((k) => domKeys.includes(k));
  expect(domKeys, 'rendered magazine order must follow the API order').toEqual(expected);
});
