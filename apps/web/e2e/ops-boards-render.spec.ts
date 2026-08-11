import { expect, test } from '@playwright/test';


/**
 * Every ops board answers 200.
 *
 * /ops/discovery answered HTTP 500 in production for an unknown length of
 * time. Its DTO declared `window: { … days: number }` while the API's
 * ResolvedWindow has always called that field `defaultDays`, so
 * `data.window.days` was undefined and `arInt(undefined)` threw on render.
 *
 * A HAND-WRITTEN DTO THAT DISAGREES WITH THE SERVICE COMPILES PERFECTLY. tsc
 * checked the page against the page's own idea of the payload, which is the one
 * thing it cannot falsify — the shape is asserted, not derived.
 *
 * Nothing caught it because nothing looked. The contrast spec walks three
 * boards, chosen for having "genuinely different furniture", and the ops
 * feature specs each drive one board's behaviour. Twenty-two boards existed and
 * nineteen had no assertion that they render at all. This is the cheapest
 * possible guard for the widest possible gap: navigate to each one and require
 * that it is not an error.
 */

// Every directory under app/ops that is a board. `enter` is the gate itself and
// `_components` / `_lib` are not routes.
const BOARDS = [
  '/ops',
  '/ops/agents',
  '/ops/alerts',
  '/ops/analytics',
  '/ops/appeals',
  '/ops/audit',
  '/ops/categories',
  '/ops/collections',
  '/ops/contests',
  '/ops/discovery',
  '/ops/editorial',
  '/ops/fulfillment',
  '/ops/money',
  '/ops/notifications',
  '/ops/projects',
  '/ops/review',
  '/ops/settings',
  '/ops/suppliers',
  '/ops/support',
  '/ops/team',
  '/ops/trust',
  '/ops/users',
];

// The UI flow, not the API helper: this asserts the boards a human reaches
// after the ops gate, so it must go through that gate the same way.
const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

test('OB1: every ops board renders', async ({ page }) => {
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill(OWNER.email);
  await page.locator('input[name="password"]').fill(OWNER.pass);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/projects(\?|$|\/)/);
  await page.goto('/ops');
  await page.waitForURL(/\/ops\/enter/);
  await page.locator('#ops-password').fill(OWNER.pass);
  await page.getByRole('button', { name: 'دخول إلى مركز العمليات' }).click();
  await page.waitForURL(/\/ops$/);

  const broken: string[] = [];
  for (const board of BOARDS) {
    const res = await page.goto(board, { waitUntil: 'load' }).catch(() => null);
    const status = res?.status() ?? 0;
    if (status !== 200) {
      broken.push(`${board} → ${status || 'no response'}`);
      continue;
    }
    // A 200 that rendered the error boundary is still a broken board. The ops
    // shell keeps its heading on every screen, so its absence is the tell.
    const hasMain = await page.locator('#ops-main, main').first().count();
    if (!hasMain) broken.push(`${board} → 200 but no main content`);
  }

  expect(broken, `ops boards not rendering:\n  ${broken.join('\n  ')}`).toEqual([]);
});
