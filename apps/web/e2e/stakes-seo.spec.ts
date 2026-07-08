import { expect, test } from '@playwright/test';
import { seededIds } from './helpers';

/**
 * STAKES/S-6 — SEO, crawl & sharing: robots + sitemap (N2 N3), JSON-LD (N5),
 * the /p/[slug] route with UUID fallback (N6), and the per-network share
 * popover (I1).
 */

test('robots.txt blocks the gated surfaces and points at the sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('Disallow: /projects/admin');
  expect(body).toContain('Disallow: /projects/dashboard');
  expect(body).toContain('Disallow: /api/');
  expect(body).toContain('Sitemap:');
});

test('sitemap.xml lists the static set, categories and live projects', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('/projects/discover');
  expect(body).toContain('/projects/legal/terms');
  // Category tree entries (seeded taxonomy).
  expect(body).toContain('/projects/discover/technology');
});

test('campaign page carries JSON-LD + the per-network share popover; /p/ resolves a UUID', async ({ page }) => {
  const { projectId } = seededIds();

  // N6 — the human-readable route accepts the UUID fallback.
  await page.goto(`/p/${projectId}`);
  await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();

  // I1 — share popover with the four targets.
  await page.getByRole('button', { name: /شارك/ }).first().click();
  await expect(page.getByRole('menuitem', { name: 'X' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'واتساب' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'تيليغرام' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'نسخ الرابط' })).toBeVisible();
  // The X intent link carries the campaign URL.
  const xHref = await page.getByRole('menuitem', { name: 'X' }).getAttribute('href');
  expect(xHref).toContain('x.com/intent/post');
});
