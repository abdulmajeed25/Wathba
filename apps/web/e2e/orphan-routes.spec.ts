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
 *
 * Batch PAGE-PARITY U4 narrowed it further and did NOT solve it:
 *
 *  · Moving the existence check into the page's generateMetadata — which runs
 *    before the shell is committed — changed the TITLE but not the status.
 *    /projects/this-does-not-exist was «مشروع this-does-not-exist · وثبة» and
 *    is now «وثبة», so notFound() is demonstrably firing early. Still 200.
 *  · Every 404 OUTSIDE this subtree answers correctly: /nope, /u/{unknown},
 *    /stories/{unknown} and /rules/{unknown} all return 404 in the same build.
 *
 * So it is specific to the /projects tree and survives an early notFound(),
 * which rules out "the check runs too late" as the explanation. The fabricated
 * title is fixed regardless; the status is not.
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

/**
 * O4 follow-up — the second category URL space.
 *
 * /projects/category/<slug> lost its last inbound link when the homepage chips
 * moved to the canonical /projects/discover/<slug>. It was deleted rather than
 * kept because it FABRICATED: the page resolved the slug against the bundled
 * wathbaCategories fixture with `?? wathbaCategories[0]`, so any unrecognised
 * slug rendered the first fixture category. Measured before the fix,
 * /projects/category/crafts — a real live category — answered 200 with an <h1>
 * of «تقنية».
 *
 * The per-slug map is the whole point of these two tests. A blanket
 * /projects/category/:id -> /projects/discover/:id would look correct and pass
 * a status-only check, while sending `tech` and `film` (renamed to `technology`
 * and `film-video` in the live taxonomy) onto the canonical space's own
 * soft-404: a 200 with no <h1>. That is why O7 follows the redirect and asserts
 * the destination actually renders a heading.
 */
const LEGACY_CATEGORIES: Record<string, string> = {
  tech: '/projects/discover/technology',
  film: '/projects/discover/film-video',
  art: '/projects/discover/art',
  games: '/projects/discover/games',
  design: '/projects/discover/design',
  publishing: '/projects/discover/publishing',
  food: '/projects/discover/food',
};

test('O7: every linked legacy category URL lands on a real category page', async ({ request }) => {
  for (const [slug, destination] of Object.entries(LEGACY_CATEGORIES)) {
    const path = `/projects/category/${slug}`;
    const res = await request.get(path, { maxRedirects: 0 });
    expect([301, 308], `${path} must redirect permanently, got ${res.status()}`).toContain(
      res.status(),
    );
    expect(res.headers()['location'], `${path} destination`).toContain(destination);

    // Following it is what distinguishes a correct map from a plausible one.
    const landed = await request.get(destination);
    expect(landed.status(), destination).toBe(200);
    expect(await landed.text(), `${slug} redirects onto an empty page`).toMatch(/<h1[^>]*>[^<]+/);
  }
});

test('O8: an unknown category slug no longer renders a fabricated page', async ({ request }) => {
  for (const slug of ['crafts', 'zzz-nonexistent-abc']) {
    const path = `/projects/category/${slug}`;
    const res = await request.get(path, { maxRedirects: 0 });
    expect([301, 308], `${path} status`).toContain(res.status());
    expect(res.headers()['location'], `${path} destination`).toContain('/projects/discover-all');
  }

  // «تقنية» — bare, no article — was the fixture's heading, and it was what
  // /projects/category/crafts served. Following the redirect and checking the
  // heading is what proves the fabricated page is gone rather than relocated;
  // a status-only assertion would pass even if the fixture still rendered.
  const body = await (await request.get('/projects/category/crafts')).text();
  const h1 = /<h1[^>]*>([^<]*)/.exec(body)?.[1]?.trim();
  expect(h1, 'landed on nothing at all').toBeTruthy();
  expect(h1, 'the fixture category page is still being served').not.toBe('تقنية');
});

test('O6: a real campaign still resolves — the guard is narrow', async ({ page }) => {
  // The notFound() guard added to the campaign layout must not catch live
  // projects or the demo fixture ids the rest of the suite still uses.
  for (const path of ['/projects/sirb-drone', '/projects/p1']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: NOT_FOUND_HEADING })).toHaveCount(0);
  }
});
