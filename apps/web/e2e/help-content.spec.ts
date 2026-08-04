import { expect, test } from '@playwright/test';

/**
 * Batch CONTENT Part 1B — the help centre and the legal pages it backs onto.
 *
 * These assert the things a Part 0 audit found MISSING, not the wording of what
 * was already there. A content page is easy to test vacuously ("the page has
 * text"), so each check below names a specific mechanic that the code enforces
 * and the copy previously failed to mention.
 */

test('C1: the refund policy documents the cancellation mechanics it omitted', async ({ page }) => {
  await page.goto('/projects/legal/refund-policy');
  const body = await page.locator('main').innerText();

  // The 48h lock is the one a backer is most likely to be caught by, and the
  // legal page they would rely on did not mention it at all.
  expect(body, 'the 48h cancellation lock').toContain('٤٨');
  // Failed capture after a successful campaign — money they expect to move.
  expect(body, 'the 72h failed-capture grace').toContain('٧٢');
  // BNPL is deferred-initiation; without this a backer thinks they signed up
  // for instalments the moment they pledged.
  expect(body.includes('تابي') || body.includes('تمارا'), 'BNPL deferred initiation').toBe(true);
});

test('C2: every legal page carries a last-updated stamp', async ({ page }) => {
  for (const path of [
    '/projects/legal/terms',
    '/projects/legal/privacy',
    '/projects/legal/refund-policy',
    '/projects/legal/contracts',
  ]) {
    await page.goto(path);
    const body = await page.locator('main').innerText();
    expect(body, `${path} has no «آخر تحديث» stamp`).toContain('آخر تحديث');
  }
});

test('C3: the help centre covers the four gaps the audit found', async ({ page }) => {
  await page.goto('/projects/help');
  const body = await page.locator('main').innerText();

  // Each of these existed as a FEATURE with no documentation.
  expect(body, 'supplier participation').toContain('بوابة الموردين');
  expect(body, 'PDPL rights').toContain('PDPL');
  expect(body, 'ZATCA invoices').toContain('ZATCA');
  expect(body, 'session security').toContain('الجلسات النشطة');

  // Erasure is anonymisation with financial records retained — saying "we
  // delete everything" would be a false promise, so the honest caveat is
  // asserted rather than the feature name alone.
  expect(body, 'erasure must not over-promise').toContain('السجلات المالية');
});

test('C4: «تواصل معنا» lands on the contact form, not the top of the FAQ', async ({ page }) => {
  await page.goto('/projects/help#contact');
  const anchor = page.locator('#contact');
  await expect(anchor).toBeVisible();
  await expect(anchor.getByRole('heading', { name: 'راسلنا مباشرة' })).toBeVisible();
});

test('C5: the pledges page uses the right Arabic word', async ({ page }) => {
  // «مكفوفات» is the plural of «مكفوفة» — a blind woman. It was the label on the
  // account page for pledges, and it reached a legal page. The product's own
  // word for a pledge is «تعهّد» everywhere else.
  for (const path of ['/projects/legal/refund-policy', '/projects/help']) {
    await page.goto(path);
    const body = await page.locator('main').innerText();
    expect(body, `${path} still says «مكفوفات»`).not.toContain('مكفوفات');
  }
});

test('C6: the help centre points at the rules hub rather than restating it', async ({ page }) => {
  await page.goto('/projects/help');
  const link = page.locator('main a[href="/rules"]');
  await expect(link).toBeVisible();

  const resp = await page.goto('/rules');
  expect(resp?.status()).toBe(200);
});
