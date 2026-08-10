import { expect, test } from '@playwright/test';

/**
 * Batch PAGE-PARITY U2 — the auth pages carry the platform theme.
 *
 * Six routes rendered outside the design system: no `data-theme`, no palette,
 * no mark. The first screen a new user ever sees said nothing about Wathba,
 * and a reader who had chosen dark got a white page.
 *
 * The input assertion is the one that matters most. When the theme root gained
 * a text colour but the fields kept `bg-white`, the result was near-white text
 * in a white box — you could not see what you were typing. A "does it render"
 * check passes happily through that.
 */
const ROUTES = ['/sign-in', '/sign-up', '/forgot-password', '/reset-password', '/verify-email'];

test('AT1: auth pages paint the chosen theme, and their fields are usable in it', async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto('/projects');
  await page.evaluate(() => localStorage.setItem('wathba:theme', 'dark'));

  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(new URL(page.url()).pathname, `${route} redirected`).toBe(route);

    const d = await page.evaluate(() => {
      const themed = document.querySelector('[data-theme]');
      if (!themed) return null;
      const bg = getComputedStyle(themed).backgroundColor.match(/\d+/g)!.map(Number);
      const rel = (c: number[]) => {
        const s = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * s[0]! + 0.7152 * s[1]! + 0.0722 * s[2]!;
      };
      const input = document.querySelector('input:not([type=hidden]):not([type=checkbox])');
      let field: { ratio: number } | null = null;
      if (input) {
        const cs = getComputedStyle(input);
        const fg = (cs.color.match(/\d+/g) || []).map(Number).slice(0, 3);
        const fb = (cs.backgroundColor.match(/\d+/g) || []).map(Number).slice(0, 3);
        if (fg.length === 3 && fb.length === 3) {
          field = { ratio: (Math.max(rel(fg), rel(fb)) + 0.05) / (Math.min(rel(fg), rel(fb)) + 0.05) };
        }
      }
      return {
        theme: themed.getAttribute('data-theme'),
        lum: Math.round(bg[0]! * 0.299 + bg[1]! * 0.587 + bg[2]! * 0.114),
        hasMark: !!document.querySelector('a[href="/projects"]'),
        field,
      };
    });

    expect(d, `${route} has no themed root`).not.toBeNull();
    expect(d!.theme, `${route} theme`).toBe('dark');
    expect(d!.lum, `${route} painted a light ground (lum ${d!.lum}) under dark`).toBeLessThan(90);
    expect(d!.hasMark, `${route} offers no way back to the platform`).toBe(true);
    if (d!.field) {
      // 4.5 is the text minimum; a field you cannot read is unusable, not merely
      // low-contrast. This measured 1.0 when the box stayed white.
      expect(d!.field.ratio, `${route} field text vs its own fill`).toBeGreaterThan(4.5);
    }
  }
});
