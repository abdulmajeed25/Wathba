import { expect, test } from '@playwright/test';

/**
 * HOME-REVIEW O3 — the three orphan routes.
 *
 * All three resolved 200, all three rendered FIXTURE_VENTURES / FIXTURE_SECTORS
 * — bundled demo data, no API call anywhere — and all three used the pre-Wathba
 * design system. `/projects/v2030` was the sharp one: sitemap.ts DECLARED it to
 * search engines while no page linked it, so a visitor arriving from Google
 * landed on six English sector names (Tourism, Health, Energy, Logistics,
 * Education, AgriTech) on an Arabic-first RTL platform with no way in or back.
 *
 * explore and compare are deleted outright — nothing referenced them and they
 * were never in the sitemap. v2030 is redirected instead, because it is the one
 * Google may already hold.
 */

const NOT_FOUND_HEADING = 'الصفحة غير موجودة';

test('O1: the deleted routes no longer serve a fixture page', async ({ page }) => {
  for (const path of ['/projects/explore', '/projects/compare']) {
    await page.goto(path);
    // The app's global 404 UI, not a campaign shell and not fixture content.
    await expect(page.getByRole('heading', { name: NOT_FOUND_HEADING })).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body, `${path} still shows fixture sector names`).not.toContain('AgriTech');
  }
});

/**
 * KNOWN DEFECT, pre-existing and NOT fixed here — deliberately left as a
 * failing marker rather than omitted, because a spec that simply does not
 * mention the status code would read as though the status were fine.
 *
 * Every notFound() under /projects/* renders the right 404 BODY but answers
 * HTTP 200. It is not caused by this change: the pre-existing notFound() in
 * /projects/[id]/(campaign)/updates/[updateId] behaves identically. Meanwhile
 * /stories/<bogus> and /p/<bogus> both answer a correct 404, so it is scoped to
 * the /projects subtree.
 *
 * The obvious suspect — the 'use client' WathbaProviders layout at
 * app/projects/layout.tsx committing a 200 before notFound() can run — was
 * TESTED AND DISPROVED: rebuilding with that layout reduced to a plain server
 * passthrough still returned 200. The real cause is not yet known.
 *
 * Impact: search engines treat a 200 as a live page, so these URLs stay
 * indexable as soft-404s. Worth its own investigation.
 */
test.fixme('O2: /projects/* 404s should answer HTTP 404, not 200', async ({ request }) => {
  const res = await request.get('/projects/zzz-nonexistent-abc', { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});

test('O3: /projects/v2030 permanently redirects to the real discovery page', async ({
  request,
}) => {
  for (const path of ['/projects/v2030', '/projects/v2030/tourism']) {
    const res = await request.get(path, { maxRedirects: 0 });
    // 308 is Next's permanent redirect (301's method-preserving sibling).
    // Accepting the pair keeps this from failing on that detail while still
    // refusing a temporary 302/307, which would not pass authority on.
    expect([301, 308], `${path} must redirect permanently, got ${res.status()}`).toContain(
      res.status(),
    );
    expect(res.headers()['location'], `${path} destination`).toContain('/projects/discover-all');
  }
});

test('O4: the sitemap no longer declares any of them', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  for (const path of ['/projects/v2030', '/projects/explore', '/projects/compare']) {
    expect(xml, `sitemap still advertises ${path}`).not.toContain(`${path}<`);
  }
  // ...and the canonical discovery page IS still declared, so this cannot pass
  // by the sitemap being empty or broken.
  expect(xml).toContain('/projects/discover-all<');
});

test('O5: no fixture venture data is served on any public route', async ({ request }) => {
  // The English sector names were the tell. If they reappear anywhere, a
  // pre-Wathba fixture view has been reintroduced.
  for (const path of ['/projects', '/projects/discover-all', '/sitemap.xml']) {
    const body = await (await request.get(path)).text();
    for (const sector of ['AgriTech', 'Logistics']) {
      expect(body, `${sector} fixture text leaked onto ${path}`).not.toContain(sector);
    }
  }
});

test('O6: a real campaign still resolves — the guard is narrow', async ({ page }) => {
  // The notFound() guard added to the campaign layout must not catch live
  // projects or the demo fixture ids the rest of the suite still uses.
  for (const path of ['/projects/sirb-drone', '/projects/p1']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: NOT_FOUND_HEADING })).toHaveCount(0);
  }
});
