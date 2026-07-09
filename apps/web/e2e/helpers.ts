import { expect, type Page } from '@playwright/test';

export const API = process.env.E2E_API_URL ?? 'http://localhost:4001';
const PASS = 'E2eStrongPass!7';

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@e2e.wathba.sa`;
}

/** STAKES/S-12 F-11 — pull the emailed verification link out of the stubbed
 *  outbox (the dev-mailbox seam; only exists when the mailer is stubbed). */
export async function verificationLinkFor(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const r = await fetch(`${API}/v1/auth/dev-mailbox?to=${encodeURIComponent(email)}`);
    if (r.ok) {
      const msgs = (await r.json()) as Array<{ html: string }>;
      for (const m of msgs.reverse()) {
        const match = /href="([^"]*\/verify-email\?token=[^"]+)"/.exec(m.html);
        if (match) return match[1]!.replace(/&amp;/g, '&');
      }
    }
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error(`no verification email for ${email}`);
}

/** Sign up through the real UI (incl. PDPL consent), consume the emailed
 *  verification link (STAKES/S-12 — the session is minted by the link, not
 *  the signup POST), then finish Nafath (stub). */
export async function signUpAndVerify(page: Page, name: string, email: string, nid: string): Promise<void> {
  await page.goto('/sign-up');
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASS);
  await page.locator('input[name="acceptTerms"]').check();
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
  // Uniform landing — both new + duplicate paths say "check your inbox".
  await expect(page).toHaveURL(/verify-email\?sent=1/);

  const link = await verificationLinkFor(email);
  await page.goto(link.replace(/^https?:\/\/[^/]+/, '')); // same-origin path
  await page.getByRole('button', { name: 'فعّل حسابي' }).click();

  await expect(page).toHaveURL(/sign-up\/nafath/);
  await page.locator('input[name="nationalId"]').fill(nid);
  await page.getByRole('button', { name: 'أرسل طلب التحقق' }).click();
  await page.waitForURL(/\/projects(\?|$|\/)/);
}

export async function signInUI(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASS);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/projects(\?|$|\/)/);
}

export async function apiSignin(email: string, password: string): Promise<string> {
  const r = await fetch(`${API}/v1/auth/signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`signin failed: ${r.status}`);
  return ((await r.json()) as { accessToken: string }).accessToken;
}
export const E2E_PASSWORD = PASS;

import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export function seededIds(): { projectId: string; rfqId: string; slug: string } {
  return JSON.parse(
    readFileSync(join(tmpdir(), 'wathba-e2e-ids.json'), 'utf8'),
  ) as { projectId: string; rfqId: string; slug: string };
}
