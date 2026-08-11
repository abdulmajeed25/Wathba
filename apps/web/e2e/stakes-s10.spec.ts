import { expect, test } from '@playwright/test';
import { API, apiSignin, seededIds } from './helpers';

const SMOKE_EMAIL = 'smoke-s1@test.wathba.sa';
const SMOKE_PASS = 'Str0ngPass!x';

/**
 * STAKES/S-10 — P0 correctness + the sharing loop:
 *  F-01 hidden backed-count must not crash the public profile
 *  F-03 profile "المحفوظة" tab is LIVE (bookmark → visible, remove → empty state)
 *  F-10 sitemap advertises the /p/[slug] canonical for slugged projects
 *  F-02 link-preview bots get blocking metadata in <head>
 *  F-04 og:image fallback + twitter summary_large_image on campaigns
 */

async function uiSignIn(page: import('@playwright/test').Page, email: string, pass: string) {
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(pass);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'));
}

test('F-01: profile renders (not 500) with backed-count hidden', async ({ page }) => {
  const tok = await apiSignin(SMOKE_EMAIL, SMOKE_PASS);
  const auth = { authorization: `Bearer ${tok}`, 'content-type': 'application/json' };
  const me = (await fetch(`${API}/v1/users/me`, { headers: auth }).then((r) => r.json())) as {
    handle: string | null;
    id: string;
  };
  const handle = me.handle ?? me.id;

  await fetch(`${API}/v1/users/me`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ showBackedCount: false }),
  });
  try {
    await page.goto(`/u/${handle}`);
    // The page must render the profile (previously: null.toLocaleString → 500).
    await expect(page.getByText('مشاريع أنشأها').first()).toBeVisible();
    await expect(page.getByText('مشاريع دعمها')).toHaveCount(0);
  } finally {
    await fetch(`${API}/v1/users/me`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ showBackedCount: true }),
    });
  }
  // Restored: the stat is public again.
  await page.goto(`/u/${handle}`);
  await expect(page.getByText('مشاريع دعمها').first()).toBeVisible();
});

test('F-03: المحفوظة tab shows LIVE bookmarks, and the empty state when none', async ({ page }) => {
  const { projectId } = seededIds();
  const tok = await apiSignin(SMOKE_EMAIL, SMOKE_PASS);
  const auth = { authorization: `Bearer ${tok}` };

  // Start clean, then bookmark the seeded project via the real API.
  await fetch(`${API}/v1/discover/saved/${projectId}`, { method: 'DELETE', headers: auth });
  const save = await fetch(`${API}/v1/discover/saved/${projectId}`, { method: 'POST', headers: auth });
  expect(save.ok).toBe(true);

  await uiSignIn(page, SMOKE_EMAIL, SMOKE_PASS);
  await page.goto('/projects/me/profile');
  await page.getByRole('tab', { name: 'المحفوظة' }).click();
  await expect(page.getByText('مشروع الرحلة الذهبية').first()).toBeVisible();

  // Remove EVERY bookmark (earlier aborted runs leave orphans on the shared
  // smoke user) → the tab shows the real empty state, never fixtures.
  const savedNow = (await fetch(`${API}/v1/discover?only=saved&take=48`, { headers: auth }).then(
    (r) => r.json(),
  )) as { items: Array<{ id: string }> };
  for (const item of savedNow.items) {
    await fetch(`${API}/v1/discover/saved/${item.id}`, { method: 'DELETE', headers: auth });
  }
  await page.reload();
  await page.getByRole('tab', { name: 'المحفوظة' }).click();
  await expect(page.getByText('لا مشاريع محفوظة بعد')).toBeVisible();
  // exact: the footer carries a plain "اكتشف المشاريع" link too.
  await expect(page.getByRole('link', { name: 'اكتشف المشاريع ←', exact: true })).toBeVisible();
});

test('F-10: sitemap advertises the /p/[slug] canonical and the slug resolves', async ({ page, request }) => {
  const { slug } = seededIds();
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();

  // POLISH Unit 6 — the golden-journey project is deterministic and presentable
  // now, so it is a first-class public project and belongs in the sitemap. The
  // throwaway per-run fixtures are the ones excluded, and batch-polish-fixtures
  // asserts that separately.
  expect(xml).toContain(`/p/${slug}`);
  await page.goto(`/p/${slug}`);
  await expect(page.getByText('مشروع الرحلة الذهبية').first()).toBeVisible();
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute('href', new RegExp(`/p/${slug}$`));
});

test('F-02: link-preview bots receive metadata inside <head> on dynamic pages', async ({ request }) => {
  for (const ua of ['WhatsApp/2.23.20.0', 'Snapchat/12.0 (like Twitterbot)']) {
    for (const path of ['/projects', '/projects/search?q=%D9%85%D8%B4%D8%B1%D9%88%D8%B9']) {
      const res = await request.get(path, { headers: { 'user-agent': ua } });
      expect(res.status()).toBe(200);
      const html = await res.text();
      const headEnd = html.indexOf('</head>');
      const desc = html.indexOf('name="description"');
      expect(desc, `${ua} ${path}: meta description must be in <head>`).toBeGreaterThan(-1);
      expect(desc, `${ua} ${path}: meta description must be in <head>`).toBeLessThan(headEnd);
    }
  }
});

test('F-04: campaign OG card has an image fallback + large twitter card', async ({ request }) => {
  const { projectId } = seededIds();
  const res = await request.get(`/projects/${projectId}`, {
    headers: { 'user-agent': 'Twitterbot/1.0' },
  });
  const html = await res.text();
  // Seeded project has no media → the brand card must back it.
  expect(html).toContain('og-default.png');
  expect(html).toContain('summary_large_image');
  // Funded % rides the description for LIVE campaigns — in ARABIC-INDIC, like
  // every other count and percentage on the platform. This asserted `\d+٪`
  // (Latin digits against the Arabic sign) and was the last place still
  // rendering the mixed form: NS1 scans main/body innerText, so metadata
  // served to link-preview crawlers sits outside its reach and only this
  // assertion covered it.
  expect(html).toMatch(/مُموَّل [٠-٩]+٪/);
  expect(html, 'the share card must not mix numeral systems').not.toMatch(/مُموَّل \d+٪/);
});
