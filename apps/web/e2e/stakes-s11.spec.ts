import { expect, test } from '@playwright/test';
import { API, apiSignin, seededIds, signUpAndVerify, uniqueEmail } from './helpers';

const SMOKE_EMAIL = 'smoke-s1@test.wathba.sa';
const SMOKE_PASS = 'Str0ngPass!x';
const E2E_PASS = 'E2eStrongPass!7';

/**
 * STAKES/S-11 — engagement payoffs:
 *  F-05 follower fan-out on publish (in-app CREATOR_NEW_PROJECT + bell)
 *  F-14 active nav (aria-current) · bell mark-all-read · mobile sheet account items
 *  F-18 completeness nudge · comment-reply actor profile link
 */

async function uiSignIn(page: import('@playwright/test').Page, email: string, pass: string) {
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(pass);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'));
}

test('F-05 + D3: follower is notified on publish; bell marks all read', async ({ page }) => {
  // Fresh follower follows the smoke creator.
  const followerEmail = uniqueEmail('follower');
  await signUpAndVerify(page, 'متابع إي٢إي', followerEmail, '3344556677');
  const followerTok = await apiSignin(followerEmail, E2E_PASS);
  const smokeTok = await apiSignin(SMOKE_EMAIL, SMOKE_PASS);
  const smokeAuth = { authorization: `Bearer ${smokeTok}`, 'content-type': 'application/json' };
  const smoke = (await fetch(`${API}/v1/users/me`, { headers: smokeAuth }).then((r) => r.json())) as { id: string };

  const follow = await fetch(`${API}/v1/creators/${smoke.id}/follow`, {
    method: 'POST',
    headers: { authorization: `Bearer ${followerTok}` },
  });
  expect(follow.ok).toBe(true);

  // Smoke publishes a NEW project (draft → submit → self-approve as admin).
  const proj = (await fetch(`${API}/v1/projects`, {
    method: 'POST',
    headers: smokeAuth,
    body: JSON.stringify({
      titleAr: `مشروع فان-آوت ${Date.now()}`,
      shortDescAr: 'اختبار إشعار المتابعين عند النشر',
      category: 'TECH',
      storyAr: 'قصة اختبار آلي طويلة بما يكفي لتجاوز حد المئتي حرف. '.repeat(6),
      fundingGoalHalalas: 100000,
      durationDays: 30,
    }),
  }).then((r) => r.json())) as { id: string };
  await fetch(`${API}/v1/projects/${proj.id}/submit`, { method: 'POST', headers: smokeAuth });
  const approve = await fetch(`${API}/v1/admin/projects/${proj.id}/review`, {
    method: 'POST',
    headers: smokeAuth,
    body: JSON.stringify({ decision: 'approve' }),
  });
  expect(approve.ok).toBe(true);

  // The follower has the CREATOR_NEW_PROJECT notification (fan-out is async → poll).
  await expect
    .poll(
      async () => {
        const inbox = (await fetch(`${API}/v1/notifications/me`, {
          headers: { authorization: `Bearer ${followerTok}` },
        }).then((r) => r.json())) as { items: Array<{ kind: string; payload: { projectId?: string } }> };
        return inbox.items.some((n) => n.kind === 'CREATOR_NEW_PROJECT' && n.payload.projectId === proj.id);
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  // D3 — the bell shows the unread badge; "mark all read" clears it inline.
  await page.goto('/projects');
  const bellBtn = page.getByRole('button', { name: /إشعار غير مقروء/ });
  await expect(bellBtn).toBeVisible();
  await bellBtn.click();
  await expect(page.getByText('مشروع جديد ممن تتابعه').first()).toBeVisible();
  await page.getByRole('button', { name: /تحديد الكل كمقروء/ }).click();
  await expect(page.getByRole('button', { name: 'الإشعارات' })).toBeVisible();
});

test('F-14 (D5): the top nav marks the current page', async ({ page }) => {
  await page.goto('/projects/how');
  const current = page.locator('nav a[aria-current="page"]');
  await expect(current).toHaveText('كيف تعمل');
});

test('F-14 (D6): the mobile sheet carries the account items when signed in', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await uiSignIn(page, SMOKE_EMAIL, SMOKE_PASS);
  await page.goto('/projects');
  await page.getByRole('button', { name: 'القائمة' }).click();
  const sheet = page.getByRole('menu', { name: 'التنقل' });
  await expect(sheet.getByRole('menuitem', { name: 'الإعدادات' })).toBeVisible();
  await expect(sheet.getByRole('menuitem', { name: 'تعهداتي' })).toBeVisible();
  await expect(sheet.getByRole('menuitem', { name: 'لوحة مشاريعي' })).toBeVisible();
});

test('F-18 (C8): the completeness nudge shows for an incomplete profile', async ({ page }) => {
  await signUpAndVerify(page, 'ناقص الملف', uniqueEmail('incomplete'), '5566778899');
  await page.goto('/projects/me/profile');
  const nudge = page.getByTestId('profile-completeness').first();
  await expect(nudge).toBeVisible();
  await expect(nudge).toContainText('أكمل ملفك');
  await expect(nudge.getByRole('link', { name: /أكمله الآن/ })).toHaveAttribute('href', '/projects/settings');

  await page.goto('/projects/settings');
  await expect(page.getByTestId('profile-completeness').first()).toBeVisible();
});

test('F-18 (C10): comment-reply notification links the actor profile', async ({ page }) => {
  const { projectId } = seededIds();
  // Smoke posts the parent comment, a fresh user replies.
  const smokeTok = await apiSignin(SMOKE_EMAIL, SMOKE_PASS);
  const parent = (await fetch(`${API}/v1/projects/${projectId}/comments`, {
    method: 'POST',
    headers: { authorization: `Bearer ${smokeTok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ bodyAr: `تعليق أصلي ${Date.now()}` }),
  }).then((r) => r.json())) as { id: string };

  const replierEmail = uniqueEmail('replier');
  await signUpAndVerify(page, 'رادّ إي٢إي', replierEmail, '6677889900');
  const replierTok = await apiSignin(replierEmail, E2E_PASS);
  const replierAuth = { authorization: `Bearer ${replierTok}`, 'content-type': 'application/json' };

  // Commenting requires being a backer — a HELD pledge counts (the S-11
  // eligibility fix; CAPTURED-only had locked comments during live campaigns).
  const tiersRaw = (await fetch(`${API}/v1/projects/${projectId}/reward-tiers`).then((r) =>
    r.json(),
  )) as Array<{ id: string }> | { items: Array<{ id: string }> };
  const tiers = Array.isArray(tiersRaw) ? tiersRaw : tiersRaw.items;
  const pledge = await fetch(`${API}/v1/pledges`, {
    method: 'POST',
    headers: replierAuth,
    body: JSON.stringify({
      projectId,
      tierId: tiers[0]!.id,
      amountHalalas: 5000,
      source: 'tok_sandbox_e2e',
    }),
  });
  expect(pledge.ok).toBe(true);

  const reply = await fetch(`${API}/v1/projects/${projectId}/comments`, {
    method: 'POST',
    headers: replierAuth,
    body: JSON.stringify({ bodyAr: 'ردّ اختباري', parentId: parent.id }),
  });
  expect(reply.ok).toBe(true);

  // Smoke's inbox shows the reply with the actor linked to /u/.
  await page.context().clearCookies();
  await uiSignIn(page, SMOKE_EMAIL, SMOKE_PASS);
  await page.goto('/projects/notifications');
  await expect(page.getByText('ردّ رادّ إي٢إي على تعليقك').first()).toBeVisible();
  const actorLink = page.getByRole('link', { name: /ملف رادّ إي٢إي/ }).first();
  await expect(actorLink).toBeVisible();
  await expect(actorLink).toHaveAttribute('href', /\/u\//);
});
