import { expect, test } from '@playwright/test';

import { signUpAndVerify, uniqueEmail } from './helpers';

/**
 * The creator-facing duration cap must be the platform's cap.
 *
 * The wizard stopped at 90 days — a number that appears nowhere else in the
 * system. The API accepts 7–120 (project.dto.ts @Max(120), with
 * projects.service checking the live projects.durationHardMaxDays setting) and
 * «قواعد المشاريع» §6 publishes exactly that range. So the published rules told
 * a creator they could request up to 120 days with approval, and the form then
 * refused to let them type it. Nothing failed: the input simply clamped, and
 * the rules page went on saying otherwise.
 *
 * This drives a real submission at 100 days — above the old cap and above the
 * 60-day self-serve tier — because the only assertion worth making is that the
 * form and the API agree.
 */

const OVER_OLD_CAP = '100';

test('a creator can submit the 100-day campaign the rules say they may request', async ({
  page,
}) => {
  await signUpAndVerify(page, 'مبدع المدة', uniqueEmail('duration'), '2234567891');

  await page.goto('/projects/submit');
  const title = `مشروع المدة ${Date.now()}`;
  await page.locator('input[name="titleAr"]').fill(title);
  await page.locator('textarea[name="shortDescAr"]').fill('وصف قصير لاختبار مدة الحملة الطويلة');
  await page.locator('button[role="option"][data-cat-slug="technology"]').click();
  await page.locator('button[role="option"][data-sub-slug="apps"]').click();
  await page.getByRole('button', { name: 'التالي →' }).click();
  await page.locator('textarea[name="storyAr"]').fill('قصة المشروع لاختبار المدة. '.repeat(12));
  await page.getByRole('button', { name: 'التالي →' }).click();

  // The funding step: goal + duration.
  await page.locator('input[name="fundingGoalSar"]').fill('5000');
  const duration = page.locator('input[name="durationDays"]');
  await expect(duration, 'the input must allow the API bound').toHaveAttribute('max', '120');
  await duration.fill(OVER_OLD_CAP);

  // The step gate must accept it too — the cap lived in BOTH the input's max
  // attribute and the step-validity check, and fixing only one would leave the
  // «التالي» button dead with no explanation on screen.
  const next = page.getByRole('button', { name: 'التالي →' });
  await expect(next, '100 days must pass the funding-step gate').toBeEnabled();
  await next.click();
  await page.getByRole('button', { name: 'التالي →' }).click();

  // The review step echoes what will be sent.
  await expect(page.getByText(`المدة: ${OVER_OLD_CAP} يوم`)).toBeVisible();

  await page.getByTestId('rules-ack').locator('input[type="checkbox"]').check();
  const landed = page.waitForURL('**/projects/dashboard/**', { timeout: 40_000 });
  void page.getByRole('button', { name: 'إرسال للمراجعة' }).click().catch(() => undefined);
  await landed;

  // Reaching the dashboard already means the API accepted 100 days — the server
  // action would have thrown instead of redirecting. Read it back from the
  // creator's own settings form to prove it PERSISTED as 100, and because that
  // form carried the identical 90-day cap: a duration this wizard can now
  // submit must also be one the editor can hold.
  // The wizard lands on .../dashboard/<id>/preview, so take the ID out of the
  // path rather than appending to it.
  const projectId = /\/projects\/dashboard\/([^/?#]+)/.exec(page.url())?.[1];
  expect(projectId, 'submission should land on a real project dashboard').toBeTruthy();
  await page.goto(`/projects/dashboard/${projectId}/settings`);

  // The duration editor is the only number input on this form bounded at 120
  // (the threshold input is capped at 100), so the attribute identifies it
  // AND asserts the corrected bound. The value assertion is the one that
  // matters: max="120" alone would pass whatever duration had been stored.
  const durationInput = page.locator('input[type="number"][max="120"]');
  await expect(durationInput, 'the settings editor must hold the duration it was given').toHaveValue(
    OVER_OLD_CAP,
  );
});

test('the wizard states the 60-day approval tier instead of only enforcing it', async ({ page }) => {
  // Past 60 days, approval REQUIRES an explicit approvedDurationDays grant
  // (projects.ops duration-grant-required). A creator who submits 75 days with
  // no idea a grant is needed stalls in review with nothing on screen saying
  // why — the rule was enforced in the operator console and stated nowhere the
  // creator would look.
  await signUpAndVerify(page, 'مبدع التلميح', uniqueEmail('duration-hint'), '2234567892');
  await page.goto('/projects/submit');

  await page.locator('input[name="titleAr"]').fill('مشروع تلميح المدة');
  await page.locator('textarea[name="shortDescAr"]').fill('وصف قصير لاختبار تلميح المدة');
  await page.locator('button[role="option"][data-cat-slug="technology"]').click();
  await page.locator('button[role="option"][data-sub-slug="apps"]').click();
  await page.getByRole('button', { name: 'التالي →' }).click();
  await page.locator('textarea[name="storyAr"]').fill('قصة المشروع لاختبار التلميح. '.repeat(12));
  await page.getByRole('button', { name: 'التالي →' }).click();

  // Scoped to the duration field's own <label> (the Field wrapper). Page-wide
  // would be wrong twice over: the review step also links /rules/projects in
  // its acknowledgment block, and every step stays in the DOM behind `hidden`.
  const durationField = page.locator('label:has(input[name="durationDays"])');
  await expect(durationField).toContainText('٦٠');
  await expect(durationField).toContainText('موافقة مسبقة');
  await expect(durationField.locator('a[href="/rules/projects"]')).toHaveCount(1);
});
