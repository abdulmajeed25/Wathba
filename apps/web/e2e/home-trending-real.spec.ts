import { expect, test } from '@playwright/test';

/**
 * The homepage's primary discovery grid must show REAL projects.
 *
 * It did not, for as long as it has existed. listVentures() mapped
 * `slug: p.id` (a UUID), adaptApiVenture() looked that up against the demo
 * fixtures' titleEn ('Sirb', 'Hekaya'), never matched, returned null for every
 * live row, and the page fell back to the eight bundled fixtures — with
 * fixture funding numbers, fixture backer counts, and links to /projects/p1.
 *
 * The whole suite passed throughout. A fixture always renders: the grid looked
 * complete, correct and well-crafted, so nothing ever complained. These
 * assertions are written against the things a fixture CANNOT fake — that the
 * cards resolve to projects the API actually serves.
 */

test('T1: the trending grid renders projects the API actually serves', async ({ page, request }) => {
  const res = await request.get(`${process.env.E2E_API_URL ?? 'http://localhost:4000'}/v1/projects`);
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { items: Array<{ slug: string | null; titleAr: string }> };
  const liveSlugs = new Set(body.items.map((p) => p.slug).filter(Boolean) as string[]);
  expect(liveSlugs.size, 'the API must serve real projects for this to mean anything').toBeGreaterThan(3);

  await page.goto('/projects');
  const grid = page.locator('section', { has: page.getByRole('heading', { name: 'المشاريع الرائجة' }) });
  const cards = grid.locator('a[href^="/projects/"]');
  // evaluateAll does NOT auto-wait — it reads whatever is in the DOM at that
  // instant and happily returns []. Anchor on an auto-waiting assertion first,
  // or this test reports "0 cards" as a failure of the page rather than of its
  // own timing (it did exactly that, once, before this line existed).
  await expect(cards.first()).toBeAttached();
  const hrefs = await cards.evaluateAll((els) =>
    els.map((e) => (e as HTMLAnchorElement).getAttribute('href')!.replace('/projects/', '')),
  );
  expect(hrefs.length, 'the grid should render cards').toBeGreaterThan(3);

  // Every card must point at a project the API returned. The demo fixtures use
  // ids p1…p8, which are not in that set — so this fails loudly on a fallback.
  const strangers = hrefs.filter((h) => !liveSlugs.has(h));
  expect(strangers, 'cards linking to something the API does not serve').toEqual([]);
});

test('T2: every trending card carries its real cover', async ({ page }) => {
  await page.goto('/projects');
  const grid = page.locator('section', { has: page.getByRole('heading', { name: 'المشاريع الرائجة' }) });
  await grid.scrollIntoViewIfNeeded();

  const imgs = grid.locator('img');
  await expect(imgs.first()).toBeVisible();
  const count = await imgs.count();
  expect(count, 'the platform sells creative work — the grid must show it').toBeGreaterThan(3);

  const broken = await imgs.evaluateAll((els) =>
    els.filter((e) => {
      const i = e as HTMLImageElement;
      return i.complete && i.naturalWidth === 0;
    }).length,
  );
  expect(broken, 'covers that failed to decode').toBe(0);
});

test('T3: the cover box reserves its space, so covers cost no layout shift', async ({ page }) => {
  // This page measures CLS ~0.001 across a full scroll and that number was
  // worked for. Eight covers must not be what spends it: the media box is a
  // fixed height with the image absolutely filling it.
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        const s = e as PerformanceEntry & { hadRecentInput?: boolean; value: number };
        if (!s.hadRecentInput) (window as unknown as { __cls: number }).__cls += s.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await page.goto('/projects', { waitUntil: 'load' });
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
  await page.waitForTimeout(900);

  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls, 'cumulative layout shift after a full scroll').toBeLessThan(0.05);

  // And the cards stay on one baseline: real titles wrap where fixture titles
  // did not, so the title box reserves two lines.
  const grid = page.locator('section', { has: page.getByRole('heading', { name: 'المشاريع الرائجة' }) });
  const heights = await grid.locator('a[href^="/projects/"]').evaluateAll((els) =>
    Array.from(new Set(els.map((e) => Math.round(e.getBoundingClientRect().height)))),
  );
  expect(heights.length, `cards must share one height, got ${heights.join('/')}`).toBe(1);
});
