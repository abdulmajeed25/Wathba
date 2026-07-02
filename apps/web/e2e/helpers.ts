import { expect, type Page } from '@playwright/test';

export const API = process.env.E2E_API_URL ?? 'http://localhost:4001';
const PASS = 'E2eStrongPass!7';

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@e2e.wathba.sa`;
}

/** Sign up through the real UI (incl. PDPL consent) and finish Nafath (stub). */
export async function signUpAndVerify(page: Page, name: string, email: string, nid: string): Promise<void> {
  await page.goto('/sign-up');
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASS);
  await page.locator('input[name="acceptTerms"]').check();
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
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
export function seededIds(): { projectId: string; rfqId: string } {
  return JSON.parse(
    readFileSync(join(tmpdir(), 'wathba-e2e-ids.json'), 'utf8'),
  ) as { projectId: string; rfqId: string };
}
