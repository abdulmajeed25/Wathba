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

/**
 * DP2 — and the palette is READABLE, not merely dark.
 *
 * Theme parity alone is not a win: the first build of U1 turned all 18 pages
 * dark and left the milestones <h1> at 1.04:1, a heading you could not see.
 *
 * THE MEASUREMENT IS THE HARD PART, and two naive versions of it lied to me:
 *
 *  · Reading `backgroundColor` literally treats `rgba(5,166,97,.08)` as solid
 *    #05a661. An 8% tint over a near-black ground composites to near-black, so
 *    text that truly sits at ~9:1 was reported at 1.84:1 — 15 false failures,
 *    which I would have "fixed" by breaking working colours. Hence the alpha
 *    compositing below.
 *  · A gradient fill leaves `backgroundColor` transparent, so the probe fell
 *    through to the dark parent and reported near-black behind the green save
 *    buttons — 3 more false failures. Hence the backgroundImage check.
 *
 * 27 reported → 6 real → 0 after the fixes.
 */
test('DP2: dashboard text clears WCAG AA against its real composited ground', async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto('/projects');
  await page.evaluate(() => localStorage.setItem('wathba:theme', 'dark'));
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill('creator@wathba.demo');
  await page.locator('input[name="password"]').fill('Wathba!2026');
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/dashboard|projects/);

  for (const sub of SUBS) {
    await page.goto(`/projects/dashboard/${PID}${sub}`, { waitUntil: 'networkidle' });
    const failures = await page.evaluate(() => {
      const themed = document.querySelector('[data-theme]')!;
      const ground = getComputedStyle(themed).backgroundColor.match(/\d+/g)!.map(Number);
      const rel = (c: number[]) => {
        const s = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * s[0]! + 0.7152 * s[1]! + 0.0722 * s[2]!;
      };
      const ratio = (a: number[], b: number[]) => (Math.max(rel(a), rel(b)) + 0.05) / (Math.min(rel(a), rel(b)) + 0.05);
      const parse = (c: string) => { const m = c.match(/[\d.]+/g); return m && m.length >= 3 ? m.slice(0, 4).map(Number) : null; };
      const over = (fg: number[], bg: number[]) => {
        const a = fg.length > 3 ? fg[3]! : 1;
        return [0, 1, 2].map((i) => Math.round(fg[i]! * a + bg[i]! * (1 - a)));
      };
      const bad: string[] = [];
      document.querySelectorAll('h1,h2,h3,h4,p,span,label,button,a').forEach((el) => {
        if (!el.textContent?.trim() || el.children.length > 0) return;
        const cs = getComputedStyle(el);
        const fg = (cs.color.match(/\d+/g) || []).map(Number).slice(0, 3);
        if (fg.length < 3) return;
        const stack: number[][] = [];
        let gradient = false;
        for (let e: Element | null = el; e; e = e.parentElement) {
          const ecs = getComputedStyle(e);
          // A gradient fill is opaque paint that backgroundColor cannot see.
          // Its first stop is the light end of our brand ramp, so treating it
          // as the ground is the conservative reading.
          const g = ecs.backgroundImage.match(/rgb\([^)]+\)/);
          if (g && ecs.backgroundImage !== 'none') { stack.push(parse(g[0])!); gradient = true; break; }
          const c = parse(ecs.backgroundColor);
          if (!c) continue;
          const a = c.length > 3 ? c[3]! : 1;
          if (a === 0) continue;
          stack.push(c);
          if (a === 1) break;
        }
        void gradient;
        const bg = stack.reverse().reduce((acc, layer) => over(layer, acc), ground);
        const size = parseFloat(cs.fontSize);
        const need = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700) ? 3 : 4.5;
        const r = ratio(fg, bg);
        if (r < need) bad.push(`${r.toFixed(2)}/${need} «${el.textContent!.trim().slice(0, 30)}»`);
      });
      return bad;
    });
    expect(failures, `${sub || '(overview)'} has unreadable text:\n  ${failures.join('\n  ')}`).toEqual([]);
  }
});
