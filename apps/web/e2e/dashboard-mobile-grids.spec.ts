import { expect, test } from '@playwright/test';

import { apiSignin } from './helpers';

/**
 * The creator dashboard, on a phone.
 *
 * `DashboardShell` was `grid-template-columns: 260px 1fr`, and at 360 that 1fr
 * computed to ONE HUNDRED PIXELS: the sidebar kept its full width at every
 * viewport, so all 17 per-project routes squeezed the dashboard into a 100px
 * column and overflowed to 659-934px. The heading was clipped at the edge and
 * body copy wrapped to about one word per line.
 *
 * WHY NO EXISTING GUARD CAUGHT IT. The public mobile sweep looked for
 * horizontal overflow — and these routes are behind auth, so nothing
 * unauthenticated could reach them to overflow in the first place. The page
 * grids that survived that sweep failed the OTHER way: `repeat(N, 1fr)` never
 * overflows, its tracks SHRINK, so a four-up stat row reports perfectly clean
 * while each cell is 65px wide. One criterion finds half the problem, which is
 * why this asserts both.
 */

const NARROW = { width: 360, height: 740 };
// A track this narrow cannot hold a card's title, its figure and its label.
const MIN_TRACK = 150;

test.describe('dashboard at 360', () => {
  let jwt: string;

  test.beforeAll(async () => {
    jwt = await apiSignin('smoke-s1@test.wathba.sa', 'Str0ngPass!x');
  });

  // THE COOKIE GOES ON THE HOST THE TESTS ACTUALLY VISIT, which is baseURL.
  //
  // This used to read `page.url()`, and in a beforeEach that is ALWAYS
  // 'about:blank' — Playwright hands each test a fresh page. So the ternary's
  // other branch never ran and the domain was hard-coded to 127.0.0.1, while
  // baseURL is localhost:3123. A cookie on 127.0.0.1 is not sent to localhost,
  // so every test here was signed out: three skipped themselves on the line
  // below and DG(nav) failed outright.
  test.beforeEach(async ({ context, page, baseURL }) => {
    const host = new URL(baseURL ?? 'http://localhost:3123').hostname;
    await context.addCookies([
      { name: 'wathba_session', value: jwt, domain: process.env.E2E_COOKIE_DOMAIN ?? host, path: '/' },
    ]);
    await page.setViewportSize(NARROW);
  });

  for (const route of ['/projects/dashboard', '/projects/settings', '/projects/me/profile']) {
    test(`DG(${route}): no sideways scroll and no crushed grid`, async ({ page }) => {
      const res = await page.goto(route);
      test.skip(!res || res.status() >= 400, `${route} unavailable`);
      // ASSERT, do not skip. A signed-out redirect makes every check below
      // vacuously true, and skipping on it meant the session breaking looked
      // exactly like the grid being fine — which is what happened: these three
      // reported clean for a whole run while never loading the dashboard at
      // all. The comment at the top of this file warns about precisely this
      // failure mode; the guard against it was itself an instance of it.
      expect(page.url(), `bounced to sign-in — the session cookie is not reaching ${route}`)
        .not.toContain('/sign-in');

      const m = await page.evaluate((MIN_TRACK) => {
        const de = document.documentElement;
        const crushed: Array<{ tracks: number[]; text: string }> = [];
        for (const el of document.querySelectorAll('*')) {
          const cs = getComputedStyle(el);
          if (cs.display !== 'grid' && cs.display !== 'inline-grid') continue;
          const tracks = cs.gridTemplateColumns
            .split(' ')
            .map(parseFloat)
            .filter((n) => !Number.isNaN(n));
          if (tracks.length < 2) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) continue;
          if (Math.min(...tracks) < MIN_TRACK) {
            crushed.push({
              tracks: tracks.map((t) => Math.round(t)),
              text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
            });
          }
        }
        return { scrollW: de.scrollWidth, clientW: de.clientWidth, crushed };
      }, MIN_TRACK);

      expect(m.scrollW, `${route} scrolls sideways at 360`).toBeLessThanOrEqual(m.clientW + 1);
      expect(
        m.crushed,
        `grid tracks under ${MIN_TRACK}px at 360:\n` +
          m.crushed.map((c) => `  [${c.tracks}] "${c.text}"`).join('\n'),
      ).toEqual([]);
    });
  }

  test('DG(nav): the side-nav becomes a strip, and stays visible', async ({ page }) => {
    // THE PROJECT ID COMES FROM THE API, not from clicking a link on the
    // listing page. The link-following version skipped silently — and a
    // skipping test reads exactly like a passing one, which is how this whole
    // class of defect survived in the first place. Asking /v1/projects/mine
    // depends on one thing instead of on the listing page also rendering.
    const api = process.env.E2E_API_URL ?? 'http://127.0.0.1:4000';
    const mine = await fetch(`${api}/v1/projects/mine`, {
      headers: { authorization: `Bearer ${jwt}` },
    })
      .then((r) => r.json())
      .catch(() => null);
    const pid = Array.isArray(mine) ? mine[0]?.id : mine?.items?.[0]?.id;
    expect(pid, 'the signed-in creator owns no project — cannot test the shell').toBeTruthy();

    const res = await page.goto(`/projects/dashboard/${pid}`);
    expect(res?.status(), 'the per-project dashboard must load').toBeLessThan(400);
    expect(page.url(), 'must not have been bounced to sign-in').not.toContain('/sign-in');

    const nav = page.locator('.wathba-dash-nav');
    await expect(nav, 'the shell nav must be present').toHaveCount(1);

    const m = await nav.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        dir: cs.flexDirection,
        overflowX: cs.overflowX,
        visible: cs.display !== 'none' && cs.visibility !== 'hidden' && r.height > 0,
        links: el.querySelectorAll('a').length,
        widthWithinViewport: r.width <= document.documentElement.clientWidth + 1,
      };
    });

    // The standing rule is that the nav does not hide on mobile. It changes
    // AXIS, not presence — so every link must still be here, on screen.
    expect(m.visible, 'the nav must stay visible on a phone').toBe(true);
    expect(m.links, 'every nav link must survive the axis change').toBeGreaterThan(10);
    expect(m.dir, 'the nav must lie down into a strip at 360').toBe('row');
    // ...and the strip must scroll itself rather than widen the page. Without
    // min-width:0 on the aside this passed `row` while pushing the page to
    // 1728px, which was worse than the sidebar it replaced.
    expect(m.overflowX, 'the strip must scroll, not stretch the page').toMatch(/auto|scroll/);
    expect(m.widthWithinViewport, 'the strip must not exceed the viewport').toBe(true);
  });
});
