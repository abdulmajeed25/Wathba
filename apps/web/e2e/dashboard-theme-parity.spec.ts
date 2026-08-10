import { expect, test } from '@playwright/test';

/**
 * Batch PAGE-PARITY U1 — the creator dashboard follows the platform theme.
 *
 * It did not. `dashboard/[id]/layout.tsx` mounts `DashboardShell`, which was a
 * bare <div> outside the design system: no `data-theme`, no palette. A creator
 * who chose dark got 18 white pages carrying an indigo accent instead of the
 * green identity, and nothing failed — the surface simply painted the light
 * values it read from `globals.css :root`.
 *
 * That is invisible to a test that only checks a page renders, which is why
 * this asserts the PAINTED ground rather than the markup: the failure mode was
 * a page that rendered perfectly, in the wrong palette.
 */
const PID = '33333333-0000-4000-8000-000000000003';
const SUBS = ['', '/milestones', '/rewards', '/story', '/backers', '/payouts', '/settings', '/analytics'];

test('DP1: every dashboard sub-page paints the dark palette when dark is chosen', async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto('/projects');
  await page.evaluate(() => localStorage.setItem('wathba:theme', 'dark'));
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill('creator@wathba.demo');
  await page.locator('input[name="password"]').fill('Wathba!2026');
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/dashboard|projects/);

  for (const sub of SUBS) {
    const route = `/projects/dashboard/${PID}${sub}`;
    await page.goto(route, { waitUntil: 'domcontentloaded' });

    // Landed where we asked — a redirect would otherwise score the dashboard
    // index and report parity for a page never visited.
    expect(new URL(page.url()).pathname, `${route} redirected`).toBe(route);

    const d = await page.evaluate(() => {
      const themed = document.querySelector('[data-theme]');
      if (!themed) return null;
      const bg = getComputedStyle(themed).backgroundColor.match(/\d+/g)!.map(Number);
      return {
        theme: themed.getAttribute('data-theme'),
        lum: Math.round(bg[0]! * 0.299 + bg[1]! * 0.587 + bg[2]! * 0.114),
        brand: getComputedStyle(themed).getPropertyValue('--brand-primary').trim(),
      };
    });

    expect(d, `${route} has no themed root at all`).not.toBeNull();
    expect(d!.theme, `${route} theme attribute`).toBe('dark');
    // The painted ground, not the attribute: the attribute can be right while
    // the palette is not, which is precisely what shipped before.
    expect(d!.lum, `${route} painted a light ground (lum ${d!.lum}) under the dark theme`).toBeLessThan(90);
    // Green identity, not the indigo this surface used to carry.
    expect(d!.brand, `${route} brand colour`).toBe('#1fd37e');
  }
});
