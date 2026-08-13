import { expect, test } from '@playwright/test';

import { signUpAndVerify, uniqueEmail } from './helpers';

/**
 * Batch ACCOUNT / U7 — the three concepts, end to end.
 *
 * The batch exists because following a creator, following a PROJECT and saving
 * a project were one blurred idea in the UI. These specs assert the thing that
 * makes them three: that the acts are INDEPENDENT. Following does not save,
 * saving does not follow, and unfollowing does not clear a bookmark.
 *
 * Asserted through the LISTS, not through button colour. A control can look
 * toggled and write nothing — that exact bug shipped once in this batch, when
 * the follow button posted a slug to an endpoint expecting a uuid, the API
 * 400'd, and the optimistic update rolled back. It looked like a working UI
 * until someone counted rows. So every assertion here ends at /following or
 * /saved, which can only show what was actually persisted.
 */

const NEW_USER = (): { email: string; nid: string } => ({
  email: uniqueEmail('acct'),
  // The signup wizard requires a 10-digit national id.
  nid: `1${String(Date.now()).slice(-9)}`,
});

test.describe('account — follow and save are three separate acts', () => {
  /**
   * FIXME — the CONTROLS THIS TESTS DO NOT EXIST YET.
   *
   * The campaign page still renders «ذكّرني»: a bell-icon button with no
   * onClick and no handler (wathba-campaign-rail.tsx). Wiring it to
   * ProjectFollow, beside a separate save, was listed as work to carry into the
   * menu unit and was never actually carried — the API, the /following page and
   * the menu all landed, and the one surface a reader would use to follow a
   * project did not.
   *
   * Kept as fixme rather than deleted or left red: it is the executable
   * description of the missing half, and it flips on the moment the controls
   * ship. The other two tests in this file pass and are enforcing today.
   */
  test.fixme('follow a project, then save it, then unfollow: the save survives', async ({ page }) => {
    const { email, nid } = NEW_USER();
    await signUpAndVerify(page, 'داعم اختبار', email, nid);

    // A fresh account follows and saves nothing.
    await page.goto('/following');
    await expect(page.getByRole('tab', { name: 'مبدعون أتابعهم' })).toBeVisible();
    await page.getByRole('tab', { name: 'مشاريع أتابعها' }).click();
    await expect(page.locator('.wathba-follow-empty')).toBeVisible();

    // Open a real campaign and use both controls.
    await page.goto('/projects/discover-all');
    const firstCard = page.locator('a[href^="/projects/"]').first();
    await firstCard.click();
    await page.waitForLoadState('networkidle');

    const follow = page.locator('button[aria-pressed]:not([aria-label])').first();
    const save = page.locator('button[aria-pressed][aria-label]').first();
    await expect(follow).toBeVisible();
    await expect(save).toBeVisible();

    // The two controls must not be the same control wearing two labels.
    await expect(follow).toHaveAttribute('aria-pressed', 'false');
    await expect(save).toHaveAttribute('aria-pressed', 'false');

    await follow.click();
    await expect(follow).toHaveAttribute('aria-pressed', 'true');
    // Following must NOT have saved.
    await expect(save).toHaveAttribute('aria-pressed', 'false');

    await save.click();
    await expect(save).toHaveAttribute('aria-pressed', 'true');

    // Both persisted — asserted through the lists, which only show real rows.
    await page.goto('/following');
    await page.getByRole('tab', { name: 'مشاريع أتابعها' }).click();
    await expect(page.locator('.wathba-follow-list li')).toHaveCount(1);

    await page.goto('/saved');
    await expect(page.getByRole('tab', { name: 'المحفوظة' })).toHaveAttribute('aria-selected', 'true');

    // Unfollow from the list, and the BOOKMARK MUST SURVIVE. This is the whole
    // point of the split: un-following is not un-saving.
    await page.goto('/following');
    await page.getByRole('tab', { name: 'مشاريع أتابعها' }).click();
    await page.locator('.wathba-follow-list li button').first().click();
    await expect(page.locator('.wathba-follow-empty')).toBeVisible();

    await page.goto('/saved');
    await expect(page.getByRole('tab', { name: 'المحفوظة' })).toHaveAttribute('aria-selected', 'true');
    // A save with no follow is a legitimate state; the page must still render it.
    await expect(page.locator('.wathba-follow-empty')).toHaveCount(0);
  });
});

test.describe('account menu — the interaction model it advertises', () => {
  test('role=menu really implements arrow keys, Esc and focus return', async ({ page }) => {
    const { email, nid } = NEW_USER();
    await signUpAndVerify(page, 'داعم قوائم', email, nid);
    await page.goto('/projects');

    const trigger = page.locator('button[aria-label^="حساب"]').first();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const panel = page.locator('[role="menu"][aria-label="حسابي"]');
    await expect(panel).toBeVisible();

    // ArrowDown must move focus. A role="menu" that only traps Tab announces an
    // interaction model it does not implement — WCAG 2.2 4.1.2.
    await page.keyboard.press('ArrowDown');
    const first = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    await page.keyboard.press('ArrowDown');
    const second = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    expect(second).not.toBe(first);

    // End jumps to the last focusable — sign out.
    await page.keyboard.press('End');
    const last = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    expect(last).toContain('تسجيل الخروج');

    // Esc closes AND returns focus to the trigger.
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('every menu destination resolves — no dead rows', async ({ page }) => {
    const { email, nid } = NEW_USER();
    await signUpAndVerify(page, 'داعم روابط', email, nid);
    await page.goto('/projects');
    await page.locator('button[aria-label^="حساب"]').first().click();

    const hrefs = await page.locator('[role="menu"] a[role="menuitem"]').evaluateAll(
      (els) => els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? ''),
    );
    expect(hrefs.length).toBeGreaterThan(4);

    // «الرسائل» is DEFERRED, not stubbed — there is no messaging system, and a
    // menu row that opens nothing is worse than an absent one.
    expect(hrefs.some((h) => h.includes('/messages'))).toBe(false);

    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect(res.status(), `${href} must not 404/500`).toBeLessThan(400);
    }
  });
});
