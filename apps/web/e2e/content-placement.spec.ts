import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { seededIds, signUpAndVerify, uniqueEmail } from './helpers';

/**
 * Batch CONTENT Part 2 — PLACEMENT.
 *
 * Part 1 built the rules and help pages; this asserts they are reachable from
 * the moment that raises the question. A policy nobody can find from the screen
 * it governs is decoration, and decoration passes every smoke test: the page
 * renders, the link resolves, and no one ever arrives.
 *
 * Each test below names the surface and the question the reader has there.
 */

/* ── the footer ─────────────────────────────────────────────────────────── */

test('P1: every footer destination resolves — derived from the DOM, not a list', async ({
  page,
}) => {
  // Deliberately NOT a hardcoded array: a hardcoded list keeps passing after
  // someone adds a fourteenth link, which is exactly when it stops being a
  // check on the footer and becomes a check on the list.
  await page.goto('/projects');
  const hrefs = await page.locator('footer a[href^="/"]').evaluateAll((els) =>
    Array.from(new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? ''))),
  );
  expect(hrefs.length, 'footer should link a real content tree').toBeGreaterThan(15);

  const broken: string[] = [];
  for (const href of hrefs) {
    // Strip the fragment before requesting. A goto() that differs from the
    // current URL only by its hash performs no navigation at all and returns
    // null — which reads as "status 0, broken" and is purely an artefact of
    // the instrument. Whether #contact exists is P4's job, not this one's.
    const resp = await page.goto(href.split('#')[0]!);
    const status = resp?.status() ?? 0;
    // 307 is the auth gate on account pages — a correct answer to a signed-out
    // visitor. 404/5xx is not.
    if (status !== 200 && status !== 307) broken.push(`${href} → ${status}`);
  }
  expect(broken, 'footer links that do not resolve').toEqual([]);
});

test('P2: the footer groups trust as its own column, including enforcement', async ({ page }) => {
  await page.goto('/projects');
  const footer = page.locator('footer');

  for (const title of ['اكتشف', 'للمبدعين', 'الثقة والقواعد', 'المساعدة وحسابك', 'الشركة والقانون']) {
    await expect(footer.getByText(title, { exact: true }), `column «${title}»`).toBeVisible();
  }

  // The enforcement policy was previously reachable only from inside the rules
  // hub — a reader had to already be in the rules to learn what happens after
  // a report.
  await expect(footer.locator('a[href="/rules/enforcement"]')).toHaveCount(1);
});

/* ── the header ─────────────────────────────────────────────────────────── */

test('P3: mobile offers «المساعدة» without hunting for the footer', async ({ page }) => {
  // Below 1000px the desktop nav collapses into this sheet (wathba-shell media
  // queries), and mobile is where scrolling to the footer costs the most.
  await page.setViewportSize({ width: 480, height: 900 });
  await page.goto('/projects');

  await page.getByRole('button', { name: /القائمة|menu/i }).first().click();
  const sheet = page.locator('.wathba-mob-sheet');
  await expect(sheet.locator('a[href="/projects/help"]')).toHaveCount(1);
});

/* ── deep-linkable answers ──────────────────────────────────────────────── */

test('P4: help answers are individually addressable', async ({ page }) => {
  // Before this the whole help centre had exactly one anchor (#contact), so no
  // contextual link could do better than "here is a 16-question FAQ, good luck".
  await page.goto('/projects/help#q1');
  const q1 = page.locator('#q1');
  await expect(q1).toBeVisible();
  // #q1 must be the charging question specifically — an anchor that resolves to
  // the wrong answer is worse than no anchor, because it looks correct.
  await expect(q1).toContainText('يُخصم');
});

/* ── the contextual cross-links ─────────────────────────────────────────── */

test('P5: the pledge sheet answers "when is my card charged?"', async ({ page }) => {
  // The pledge flow is auth-gated in middleware (BACK_RE), NOT in the page
  // component — reading the page alone says it is public, and signed out you
  // get a 307 and an endless wait for a button that was never rendered.
  const email = uniqueEmail('pledge-help');
  await signUpAndVerify(page, 'داعم', email, String(1000000000 + Math.floor(Math.random() * 8e8)));

  const { projectId } = seededIds();
  await page.goto(`/projects/${projectId}/back`);

  // Step 1 → 2 → 3; the payment step is where the money question is live.
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'متابعة' }).click();
  }
  await expect(page.getByRole('heading', { name: 'طريقة الدفع' })).toBeVisible();

  // Scoped to <main>: the footer legitimately links the refund policy and the
  // contracts page too, so a page-wide count measures the footer, not this
  // step. The point of the test is that the answer is reachable HERE, at the
  // moment the reader is handing over a card — not somewhere on the document.
  const sheet = page.locator('main');
  for (const href of ['/projects/help#q1', '/projects/legal/refund-policy', '/projects/legal/contracts']) {
    await expect(sheet.locator(`a[href="${href}"]`), `pledge step 3 must link ${href}`).toHaveCount(1);
  }
});

test('P6: the report dialog says what counts as a violation', async ({ page }) => {
  const { projectId } = seededIds();
  await page.goto(`/projects/${projectId}`);

  const trigger = page.getByRole('button', { name: /الإبلاغ عن هذا المشروع/ });
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'سبب البلاغ' });
  await expect(dialog).toBeVisible();
  // The reporter is asked to judge the project against rules the dialog never
  // showed them, and told nothing about what the report sets in motion.
  await expect(dialog.locator('a[href="/rules/enforcement"]')).toHaveCount(1);
});

test('P7: the transparency dashboard names the standard it measures against', async ({ page }) => {
  const { projectId } = seededIds();
  await page.goto(`/projects/${projectId}/transparency`);

  await expect(page.locator('a[href="/rules/creators"]')).toHaveCount(1);
  await expect(page.locator('a[href="/rules/projects"]')).toHaveCount(1);
});

/* ── transactional email ────────────────────────────────────────────────── */

test('P8: every link in a transactional email points at a route that exists', async ({
  page,
}) => {
  // This is the check that found the live defect: accountReactivated sent every
  // unbanned user to {{APP_URL}}/signin, and the real route is /sign-in. The
  // placeholder is substituted at send time (EmailService), so the 404 shipped
  // to real inboxes — and no test could see it, because email links are the one
  // part of the product nothing ever loads.
  const src = readFileSync(
    join(process.cwd(), '..', 'api', 'src', 'email', 'email-templates.ts'),
    'utf8',
  );
  const paths = Array.from(
    new Set(Array.from(src.matchAll(/\{\{APP_URL\}\}(\/[A-Za-z0-9/_-]*)/g), (m) => m[1]!)),
  );
  expect(paths.length, 'email templates should contain APP_URL links').toBeGreaterThan(4);

  const broken: string[] = [];
  for (const p of paths) {
    const resp = await page.goto(p);
    const status = resp?.status() ?? 0;
    if (status !== 200 && status !== 307 && status !== 308) broken.push(`${p} → ${status}`);
  }
  expect(broken, 'email links that 404').toEqual([]);
});

/* ── the appeal surface ─────────────────────────────────────────────────── */

test('P9: the appeal page links the policy the decision was made under', async ({ page }) => {
  // Signed out, /appeal bounces to sign-in, so asserting the link needs a real
  // session. A plain verified account is enough: the PAGE gates on a session
  // cookie only — it is the appeals SERVICE that enforces BANNED at submit.
  const email = uniqueEmail('appeal-link');
  await signUpAndVerify(page, 'مُتظلّم', email, String(1000000000 + Math.floor(Math.random() * 8e8)));

  await page.goto('/appeal');
  await expect(page.getByRole('heading', { name: 'تقديم تظلّم' })).toBeVisible();
  // The appellant is asked to argue against a decision without being shown the
  // rules it was made under, or how the review that follows works.
  await expect(page.locator('a[href="/rules/enforcement"]')).toHaveCount(1);
});
