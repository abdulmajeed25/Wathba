import { expect, test, type Page } from '@playwright/test';
import { signUpAndVerify, uniqueEmail } from './helpers';

/**
 * The ventures header must fit the viewport at every width — and the account
 * control must stay reachable.
 *
 * What happened: the header showed its full desktop configuration (logo + nav +
 * search field + controls) from 881px upward, but that configuration measures
 * 1314px signed-in. Everything from 881 to 1313 overflowed, by up to 433px. The
 * account control is the LAST child of the row, so the entire overflow landed on
 * it: it sat at a negative x, clipped, and a signed-in reader anywhere between
 * 881 and 1280 simply could not open the account menu.
 *
 * Why nothing caught it for months, and why this spec measures the way it does:
 *
 *  1. `[data-pillar="ventures"]` sets `overflow-x: clip`. Clipped overflow does
 *     NOT appear in `document.documentElement.scrollWidth`, so every "does the
 *     page scroll sideways?" check answered no while the header was 433px over.
 *     The only instrument that sees it is the ROW'S OWN scrollWidth, which is
 *     what the assertion below reads.
 *
 *  2. Playwright's default viewport is 1280×720 — the exact width where the
 *     signed-in header overflowed by 34px. Every spec in this suite ran there
 *     and none of them looked at the header box.
 *
 *  3. Visibility is not reachability. The avatar had a non-zero bounding box the
 *     whole time; it was off-screen and clipped. So this asserts a hit test
 *     (`elementFromPoint` at the control's centre resolves to the control),
 *     not `toBeVisible()`.
 *
 * The tiers are asserted too, because "no overflow" is also satisfiable by
 * silently dropping the nav on a desktop, which would be a regression of its
 * own. See wathba-shell.tsx for the measurements behind 1200 and 1000.
 */

/** Widths worth pinning: both tier boundaries, and the sizes people browse at. */
const WIDTHS = [1920, 1440, 1366, 1280, 1200, 1199, 1024, 1000, 999, 900, 768, 480, 390, 360];

interface HeaderState {
  overflow: number;
  field: boolean;
  icon: boolean;
  nav: boolean;
  burger: boolean;
  acctX: number | null;
  acctInViewport: boolean;
  acctHittable: boolean;
}

async function readHeader(page: Page): Promise<HeaderState> {
  // The account slot renders as an aria-hidden placeholder until /api/me
  // answers. Measuring before that measures the placeholder's footprint, not
  // the real one — and the placeholder is deliberately the same width, so the
  // mistake is invisible in the numbers.
  await page
    .waitForFunction(() => !document.querySelector('.wathba-account-slot[aria-hidden]'), null, {
      timeout: 15_000,
    })
    .catch(() => {});

  return page.evaluate(() => {
    const row = document.querySelector('header > div') as HTMLElement;
    const visible = (el: Element | null) => !!el && el.getBoundingClientRect().width > 0;

    // Signed in this is the avatar; signed out it is the «ابدأ مشروعك» CTA.
    // Either way it is the last thing in the row and the first thing to be
    // pushed out of reach.
    const acct =
      document.querySelector('button[aria-haspopup="menu"][aria-label^="حساب"]') ??
      document.querySelector('a[href="/projects/start"]');

    let acctX: number | null = null;
    let acctInViewport = false;
    let acctHittable = false;
    if (acct) {
      const b = acct.getBoundingClientRect();
      acctX = Math.round(b.x);
      acctInViewport = b.x >= -0.5 && b.right <= window.innerWidth + 0.5;
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const hit = cx >= 0 && cx <= window.innerWidth ? document.elementFromPoint(cx, cy) : null;
      acctHittable = !!hit && (hit === acct || acct.contains(hit));
    }

    return {
      overflow: row.scrollWidth - row.clientWidth,
      field: visible(row.querySelector('.wathba-wide-only')),
      icon: visible(row.querySelector('button[aria-label="بحث"]')),
      nav: visible(row.querySelector('nav')),
      burger: visible(row.querySelector('button[aria-label="القائمة"]')),
      acctX,
      acctInViewport,
      acctHittable,
    };
  });
}

async function assertHeaderFits(page: Page, who: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/projects');
    const h = await readHeader(page);
    const at = `${who} @${width}px`;

    expect(h.overflow, `${at}: the header row overflows its own box by ${h.overflow}px`).toBe(0);
    expect(h.acctX, `${at}: no account control in the header at all`).not.toBeNull();
    expect(h.acctInViewport, `${at}: the account control sits at x=${h.acctX}, outside the viewport`).toBe(true);
    expect(h.acctHittable, `${at}: the account control is on-screen but something covers it`).toBe(true);

    // The tier, so "it fits" cannot be achieved by quietly dropping the nav.
    expect(h.field, `${at}: search FIELD expected ${width >= 1200}`).toBe(width >= 1200);
    expect(h.icon, `${at}: search ICON expected ${width < 1200}`).toBe(width < 1200);
    expect(h.nav, `${at}: desktop nav expected ${width >= 1000}`).toBe(width >= 1000);
    expect(h.burger, `${at}: hamburger expected ${width < 1000}`).toBe(width < 1000);
  }
}

/**
 * These two get their own budget, and it is not a workaround.
 *
 * `assertHeaderFits` walks FOURTEEN widths, and each one is a full navigation
 * plus a wait for the account slot to stop being a placeholder — about 5.6s a
 * width, measured. That is ~78s for the signed-in pass, against a 60s default
 * that was never chosen with this test in mind. It had been passing on the
 * margin and went flaky the moment the homepage gained a row.
 *
 * The alternative — dropping widths — is worse: the whole point is that the
 * header is checked at every breakpoint boundary and one either side of it
 * (1200/1199, 1000/999), which is where the 1280 regression that prompted this
 * file actually lived. A slow, complete test beats a fast, partial one.
 */
const HEADER_SWEEP_TIMEOUT = 180_000;

test('H1: the signed-out header fits every width and keeps its CTA reachable', async ({ page }) => {
  test.setTimeout(HEADER_SWEEP_TIMEOUT);
  await assertHeaderFits(page, 'signed out');
});

test('H2: the signed-in header fits every width and keeps the account menu reachable', async ({ page }) => {
  test.setTimeout(HEADER_SWEEP_TIMEOUT);
  // Signed in is the expensive row: it carries the notification bell that the
  // signed-out row does not, and it was the state that broke at 1280.
  await signUpAndVerify(page, 'قارئ الترويسة', uniqueEmail('header'), '2255669900');
  await assertHeaderFits(page, 'signed in');
});

/**
 * There is deliberately NO "click the avatar at 1280" test here, and it is worth
 * saying why so nobody adds one believing it would have caught this.
 *
 * It was written, and it PASSED against the broken build. On that build the
 * avatar sat at x=-34 with its right edge at x=8: 8 clipped pixels of a 42px
 * control were technically on screen. Playwright aims at a VISIBLE point within
 * the element, not its centre, so `avatar.click()` found those 8 pixels and
 * succeeded every time. Nothing scrolled; the element really was unreachable in
 * any human sense.
 *
 * So an interaction test is the wrong instrument for clipped overflow — it is
 * strictly more capable than the reader it is standing in for. The measurements
 * in H1/H2 are the guard: the row's own scrollWidth, plus a hit test at the
 * control's CENTRE, which is the point a person would actually aim for.
 */
