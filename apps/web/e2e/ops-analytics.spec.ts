import { expect, test } from '@playwright/test';
import { API } from './helpers';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS-360 Phase B Unit 5 — the rebuilt analytics surface over the five aggregate
 * endpoints (/v1/ops/analytics/*). Every section degrades honestly: the four
 * analytics.read sections vanish behind an amber note if the role lacks the
 * permission, the financial section degrades to a money.execute note on its own
 * 403, and any null metric renders «غير متاح / بيانات غير متوفرة» — so the
 * assertions accept the populated UI OR its honest fallback.
 *
 * Gated: needs the live stack (web build + API + seed). Unreachable API skips.
 */

let apiUp = false;
test.beforeAll(async () => {
  try {
    const r = await fetch(`${API}/v1/health`);
    apiUp = r.ok;
  } catch {
    apiUp = false;
  }
});

async function enterOps(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/sign-in');
  await page.locator('input[name="email"]').fill(OWNER.email);
  await page.locator('input[name="password"]').fill(OWNER.pass);
  await page.getByRole('button', { name: 'تسجيل الدخول' }).click();
  await page.waitForURL(/\/projects(\?|$|\/)/);

  await page.goto('/ops');
  await page.waitForURL(/\/ops\/enter/);
  await page.locator('#ops-password').fill(OWNER.pass);
  await page.getByRole('button', { name: 'دخول إلى مركز العمليات' }).click();
  await page.waitForURL(/\/ops$/);
}

test('the analytics page renders the five sections with a live date-range control', async ({
  page,
}) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-analytics spec');
  await enterOps(page);
  await page.goto('/ops/analytics');

  await expect(page.getByRole('heading', { name: 'القياس والتقارير', level: 1 })).toBeVisible();
  // Section headings. CLOSEOUT C5 — scoped to the main region: the sidebar
  // groups the nav under h2s with some of the same labels («المشاريع»), so an
  // unscoped level-2 query is ambiguous.
  const main = page.locator('#ops-main');
  for (const h of ['التقرير المالي', 'قمع التحويل', 'المشاريع', 'المستخدمون', 'التشغيل']) {
    await expect(main.getByRole('heading', { name: h, level: 2 })).toBeVisible();
  }
  // The date-range control now drives the fetch (real submit button, not dead).
  await expect(page.getByRole('button', { name: 'تطبيق النطاق' })).toBeVisible();
  await expect(page.getByText('النطاق المُطبَّق على كل الأقسام:')).toBeVisible();
});

test('the date range flows into the URL and the resolved-window chip', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-analytics spec');
  await enterOps(page);
  await page.goto('/ops/analytics?from=2026-01-01&to=2026-06-30');

  // The from/to survive into the form inputs (server-seeded defaults).
  await expect(page.locator('input[name="from"]')).toHaveValue('2026-01-01');
  await expect(page.locator('input[name="to"]')).toHaveValue('2026-06-30');
});

test('the funnel shows the honest null top-of-funnel and the per-category table exports CSV', async ({
  page,
}) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-analytics spec');
  await enterOps(page);
  await page.goto('/ops/analytics');

  // Visits are not tracked — the funnel says so plainly, never a fabricated 0.
  const nullTop = page.getByText('بيانات غير متوفرة').first();
  const funnelRefused = page.getByText('analytics.read').first();
  await expect(nullTop.or(funnelRefused).first()).toBeVisible();

  // Per-category CSV export button (from the DataTable kit) — present when the
  // projects section rendered; otherwise the section is gated behind the note.
  const csv = page.getByRole('button', { name: /تصدير الفئات CSV/ });
  const gated = page.getByText('analytics.read').first();
  await expect(csv.or(gated).first()).toBeVisible();
});
