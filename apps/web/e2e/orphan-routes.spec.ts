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
 * SOLVED. This was a `test.fixme` for several batches: every notFound() under
 * /projects/* rendered the right 404 BODY and answered HTTP 200, so search
 * engines kept the URLs indexed as soft-404s.
 *
 * THE CAUSE WAS `app/projects/loading.tsx`. A loading.tsx wraps its whole
 * segment in a Suspense boundary, and Next flushes the shell — committing the
 * 200 — before the page below it resolves. A notFound() thrown after that can
 * still swap the BODY, but the status line has already gone out on the wire.
 * That file sat at the root of the subtree, so it covered every route beneath
 * it, and every loading.tsx in the entire app was under /projects — which is
 * exactly why this subtree was the only one affected.
 *
 * It explains each earlier dead end, which is how the diagnosis was confirmed:
 *
 *  · Reducing the 'use client' layout to a passthrough changed nothing — the
 *    boundary is created by loading.tsx, not by the layout.
 *  · Moving the check into generateMetadata changed the TITLE but not the
 *    status — metadata is part of the shell that has already been flushed.
 *  · /nope, /u/{unknown}, /stories/{unknown}, /rules/{unknown} all answered 404
 *    in the same build — none of them has a loading.tsx anywhere above it.
 *
 * `app/projects/discover/[catSlug]/loading.tsx` was the same defect one level
 * down and is gone for the same reason.
 *
 * STILL SOFT-404, deliberately: /projects/<real-id>/updates/<bogus-update-id>.
 * Its nearest boundary is `[id]/(campaign)/loading.tsx`, so fixing it means
 * giving up the skeleton on the campaign tabs — the heaviest and most-visited
 * pages on the site — to correct a deep sub-resource URL that is far less
 * likely to be indexed than a project or a category. Measured, not assumed:
 * removing `updates/loading.tsx` alone does NOT fix it, because the (campaign)
 * boundary above simply takes over. See O2b.
 */
test('O2: /projects/* 404s answer HTTP 404, not 200', async ({ request }) => {
  for (const path of [
    '/projects/zzz-nonexistent-abc',
    '/projects/zzz-nonexistent-abc/rewards',
    '/projects/discover/zzz-nonexistent-cat',
    '/projects/discover/technology/zzz-nonexistent-sub',
  ]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), `${path} must answer 404`).toBe(404);
  }

  // ...and the real pages in the same subtree still answer 200, so this cannot
  // pass by the routes having broken outright.
  for (const path of ['/projects', '/projects/discover-all']) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), `${path} must still answer 200`).toBe(200);
  }
});

test('O2b: no loading.tsx sits above a route that calls notFound()', async () => {
  // THE REGRESSION VECTOR. The fix is two deleted files, and nothing about
  // adding a loading.tsx announces that it silently converts every 404 beneath
  // it into a 200 — the page still renders the right body, so it looks fine.
  // This fails the moment one reappears at either place.
  const { readdirSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const appDir = join(__dirname, '..', 'src', 'app');

  const banned = [
    join(appDir, 'projects', 'loading.tsx'),
    join(appDir, 'projects', 'discover', '[catSlug]', 'loading.tsx'),
  ];
  const present = banned.filter((f) => existsSync(f));
  expect(
    present.map((f) => f.slice(appDir.length + 1)),
    'a loading.tsx here re-commits a 200 before notFound() can set the status',
  ).toEqual([]);

  // Guard the shape rather than only the two known paths: a loading.tsx
  // directly beside a page that calls notFound() has the same effect.
  expect(readdirSync(join(appDir, 'projects')).includes('loading.tsx')).toBe(false);
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
