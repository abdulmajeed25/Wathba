import { expect, test } from '@playwright/test';
import { API, apiSignin, seededIds, signUpAndVerify, uniqueEmail } from './helpers';

const E2E_PASS = 'E2eStrongPass!7';

/**
 * STAKES/S-15 — completeness sweep:
 *  H4 contact form delivers · E5 session list + revoke · L2 recent searches ·
 *  L3 zero-results state · TABS ?tab deep-link · A7 activation email
 */

test('H4: the contact form stores + emails the ticket', async ({ page }) => {
  await page.goto('/projects/help');
  await page.locator('input[name="name"]').fill('متصل إي٢إي');
  await page.locator('input[name="email"]').fill('caller@e2e.wathba.sa');
  await page.locator('textarea[name="messageAr"]').fill('رسالة اختبار آلي طويلة بما يكفي.');
  await page.getByRole('button', { name: 'أرسل الرسالة' }).click();
  await expect(page.getByTestId('contact-sent')).toBeVisible();

  const inbox = (await fetch(`${API}/v1/auth/dev-mailbox?to=${encodeURIComponent('support@wathba.sa')}`).then(
    (r) => r.json(),
  )) as Array<{ subject: string }>;
  expect(inbox.some((m) => m.subject.includes('متصل إي٢إي'))).toBe(true);
});

test('E5: sessions are enumerable and individually revocable', async ({ page }) => {
  const email = uniqueEmail('sessions');
  await signUpAndVerify(page, 'جلسات إي٢إي', email, '3344556699');
  // Two extra API sessions.
  await apiSignin(email, E2E_PASS);
  await apiSignin(email, E2E_PASS);
  const tok = await apiSignin(email, E2E_PASS);
  const auth = { authorization: `Bearer ${tok}` };

  const before = (await fetch(`${API}/v1/users/me/sessions`, { headers: auth }).then((r) => r.json())) as {
    items: Array<{ id: string }>;
  };
  expect(before.items.length).toBeGreaterThanOrEqual(3);

  const kill = await fetch(`${API}/v1/users/me/sessions/${before.items.at(-1)!.id}`, {
    method: 'DELETE',
    headers: auth,
  });
  expect(((await kill.json()) as { revoked: boolean }).revoked).toBe(true);
  const after = (await fetch(`${API}/v1/users/me/sessions`, { headers: auth }).then((r) => r.json())) as {
    items: Array<{ id: string }>;
  };
  expect(after.items.length).toBe(before.items.length - 1);

  // The settings surface lists them.
  await page.goto('/projects/settings?ok=password'); // lands on security tab
  await expect(page.getByTestId('sessions-list')).toBeVisible();
});

test('L2/L3: recent searches persist; zero results shows next steps', async ({ page }) => {
  // L3 — gibberish query → explicit zero-results state.
  await page.goto('/projects/search?q=zzzxqwv');
  await expect(page.getByTestId('zero-results')).toBeVisible();

  // L2 — searching from the header stores a recent entry.
  await page.goto('/projects');
  const box = page.getByRole('combobox', { name: 'بحث' });
  await box.fill('تقنية');
  await box.press('Enter');
  await page.waitForURL(/projects\/search/);
  await page.goto('/projects');
  await box.click();
  await expect(page.getByText('عمليات بحث سابقة')).toBeVisible();
  await expect(page.getByRole('option', { name: /تقنية/ }).first()).toBeVisible();
});

test('TABS: ?tab=comments deep-links into the comments section', async ({ page }) => {
  const { projectId } = seededIds();
  await page.goto(`/projects/${projectId}?tab=comments`);
  const anchor = page.getByText('فقط الداعمون يمكنهم التعليق').first();
  await expect(anchor).toBeVisible();
  // The deep-link must have scrolled the comments block into (or near) view.
  await expect
    .poll(() => anchor.evaluate((el) => el.getBoundingClientRect().top < window.innerHeight + 150))
    .toBe(true);
});

test('A7: activation (not Nafath) sends the welcome-activation email', async ({ page }) => {
  const email = uniqueEmail('activate');
  await signUpAndVerify(page, 'مفعّل إي٢إي', email, '5566778800');
  const inbox = (await fetch(`${API}/v1/auth/dev-mailbox?to=${encodeURIComponent(email)}`).then((r) =>
    r.json(),
  )) as Array<{ subject: string }>;
  expect(inbox.some((m) => m.subject.includes('حسابك مفعّل'))).toBe(true);
});
