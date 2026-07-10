import { expect, test } from '@playwright/test';
import { API, apiSignin, seededIds, signUpAndVerify, uniqueEmail } from './helpers';

const SMOKE_EMAIL = 'smoke-s1@test.wathba.sa';
const SMOKE_PASS = 'Str0ngPass!x';
const ADMIN_EMAIL = 'admin@wathba.demo';
const ADMIN_PASS = 'Wathba!2026';

/**
 * STAKES/S-8 — community & discovery polish:
 *  K1 live comments (compose → edit within window → (معدّل) → delete)
 *  K2/K3 report → admin moderation queue (hide / dismiss)
 *  L1 header typeahead · L4 search filters · J3 similar rail API
 */

async function uiSignIn(page: import('@playwright/test').Page, email: string, pass: string) {
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(pass);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'));
}

test('K1: creator composes, edits (معدّل) and deletes a live comment', async ({ page }) => {
  const { projectId } = seededIds();
  // The smoke user OWNS the seeded project — creators can always comment.
  await uiSignIn(page, SMOKE_EMAIL, SMOKE_PASS);
  // TABS — comments are a real sub-route now.
  await page.goto(`/projects/${projectId}/comments`);

  const stamp = `تعليق إي٢إي ${Date.now()}`;
  const compose = page.getByLabel('أضف تعليقاً');
  await compose.scrollIntoViewIfNeeded();
  await compose.fill(stamp);
  await page.getByRole('button', { name: 'انشر التعليق' }).click();
  await expect(page.getByText(stamp)).toBeVisible();

  // Edit inside the 15-min window → the (معدّل) marker appears.
  const row = page.locator('article', { hasText: stamp }).first();
  await row.getByRole('button', { name: /تعديل/ }).click();
  await page.getByLabel('تعديل التعليق').fill(`${stamp} — معدّل`);
  await row.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText(`${stamp} — معدّل`)).toBeVisible();
  await expect(page.getByText('(معدّل)')).toBeVisible();

  // Delete own comment — S-13: the styled RTL confirm dialog (no more
  // native window.confirm, which rendered LTR and off-design).
  await page.locator('article', { hasText: stamp }).first().getByRole('button', { name: /حذف/ }).click();
  const dialog = page.getByRole('alertdialog', { name: 'حذف هذا التعليق نهائياً؟' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'حذف' }).click();
  await expect(page.getByText(`${stamp} — معدّل`)).not.toBeVisible();
});

test('K2/K3: reports land in the admin moderation queue and can be dismissed', async ({ page }) => {
  const { projectId } = seededIds();

  // Seed one reported comment + one project report via the API.
  const smokeTok = await apiSignin(SMOKE_EMAIL, SMOKE_PASS);
  const commentRes = await fetch(`${API}/v1/projects/${projectId}/comments`, {
    method: 'POST',
    headers: { authorization: `Bearer ${smokeTok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ bodyAr: `تعليق للإبلاغ ${Date.now()}` }),
  });
  expect(commentRes.ok).toBe(true);
  const comment = (await commentRes.json()) as { id: string };

  const reporterEmail = uniqueEmail('reporter');
  await signUpAndVerify(page, 'مُبلّغ إي٢إي', reporterEmail, '8899001122');
  const reporterTok = await apiSignin(reporterEmail, 'E2eStrongPass!7');
  const rep1 = await fetch(`${API}/v1/projects/${projectId}/comments/${comment.id}/report`, {
    method: 'POST',
    headers: { authorization: `Bearer ${reporterTok}` },
  });
  expect(rep1.ok).toBe(true);
  const rep2 = await fetch(`${API}/v1/projects/${projectId}/report`, {
    method: 'POST',
    headers: { authorization: `Bearer ${reporterTok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ reasonAr: 'اختبار إي٢إي' }),
  });
  expect(rep2.ok).toBe(true);

  // Admin sees both in the البلاغات tab, then dismisses them.
  await page.context().clearCookies();
  await uiSignIn(page, ADMIN_EMAIL, ADMIN_PASS);
  await page.goto('/projects/admin');
  await page.getByRole('tab', { name: 'البلاغات' }).click();

  const modComment = page.locator('[data-testid="mod-comment"]', { hasText: 'تعليق للإبلاغ' }).first();
  await expect(modComment).toBeVisible();
  await modComment.getByRole('button', { name: 'تجاهل البلاغات' }).click();
  await expect(
    page.locator('[data-testid="mod-comment"]', { hasText: 'تعليق للإبلاغ' }),
  ).toHaveCount(0);

  const modProject = page.locator('[data-testid="mod-project"]').first();
  await expect(modProject).toBeVisible();
  await modProject.getByRole('button', { name: 'تجاهل البلاغات' }).click();
  await expect(page.locator('[data-testid="mod-project"]')).toHaveCount(0);
});

test('L1/L4/J3: typeahead, search filters, similar API', async ({ page, request }) => {
  // L1 — header typeahead surfaces the seeded category tree.
  await page.goto('/projects');
  const box = page.getByRole('combobox', { name: 'بحث' });
  await box.fill('تقنية');
  await expect(page.getByRole('option').first()).toBeVisible();

  // L4 (Batch SEARCH Part 3) — the results page is the UNIFIED discover
  // surface: ?q= + the advanced sidebar, all URL-encoded and combinable.
  await page.goto('/projects/search?q=مشروع&cat=technology&status=live');
  await expect(page.getByTestId('discover-total')).toContainText('نتيجة عن');
  const aside = page.getByLabel('عوامل التصفية');
  await expect(aside).toBeVisible();
  // Toggling the active status filter off drops it from the URL, keeps q.
  await aside.getByText('نشطة').click();
  await expect(page).toHaveURL((url) => !url.searchParams.has('status') && url.searchParams.get('q') === 'مشروع');

  // J3 — the similar endpoint answers with a card list for the seeded project.
  const { projectId } = seededIds();
  const res = await request.get(`${API}/v1/projects/${projectId}/similar`);
  expect(res.status()).toBe(200);
  const json = (await res.json()) as { items: unknown[] };
  expect(Array.isArray(json.items)).toBe(true);
});
