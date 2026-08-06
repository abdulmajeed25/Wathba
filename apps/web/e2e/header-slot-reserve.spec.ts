import { expect, test } from '@playwright/test';

/**
 * The header's account slot reserves its box on EVERY viewport.
 *
 * The component says so in its own comment — "reserves the same box in all
 * three states, so the swap cannot move anything" — and desktop honours it with
 * min-width:206px. Mobile explicitly opted out with min-width:0, so the loading
 * state was 0px wide and the compact «ابدأ» button appeared at ~1.3s when
 * /api/me answered, reflowing the header.
 *
 * The measured CLS cost was small (the header grows 1px), so this is a
 * correctness fix rather than a Core Web Vitals rescue — but a control that
 * appears out of nothing after a second is worth removing on its own terms.
 */

test('S1: the slot holds its width on mobile while /api/me is still pending', async ({ page }) => {
  // Hang the request so the loading state is the one under test.
  await page.route('**/api/me', () => {});
  await page.setViewportSize({ width: 360, height: 800 });
  // 'load', not 'domcontentloaded': the pillar's <style> block lives INSIDE the
  // wrapper, so at DCL the min-width rule may not have been parsed yet and the
  // slot legitimately measures 0. Asserting there tests the parser, not the
  // reservation — it made this spec flaky exactly once before this comment.
  await page.goto('/projects', { waitUntil: 'load' });

  const slot = page.locator('.wathba-account-slot');
  await expect(slot).toBeAttached();
  // The rule is applied before the box is measured.
  await expect
    .poll(() => slot.evaluate((el) => getComputedStyle(el).minWidth))
    .not.toBe('0px');
  const w = await slot.evaluate((el) => Math.round(el.getBoundingClientRect().width));
  // 0 was the bug. 59px is the widest mobile state (the signed-out CTA).
  expect(w, 'the loading slot must reserve the space the CTA will need').toBeGreaterThanOrEqual(59);
});

test('S2: reserving it costs the tight mobile header nothing', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/projects');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow, 'the 360px header must not scroll sideways').toBe(false);
});
