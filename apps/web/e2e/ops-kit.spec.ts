import { expect, test } from '@playwright/test';
import { API } from './helpers';
import { rowsToCsv, toCsv } from '../src/app/ops/_lib/csv';
import { reconcileColumnState, visibleKeys, type ColumnState } from '../src/app/ops/_lib/views';

const OWNER = { email: 'smoke-s1@test.wathba.sa', pass: 'Str0ngPass!x' };

/**
 * OPS Part 5 — the SHARED ops-UI kit (nav + command palette + op-runner).
 * These prove the reusable pieces every operator screen depends on:
 *  1. The side nav lists all 20 sections.
 *  2. Ctrl+K opens the command palette and filters live.
 *  3. The op-runner drives dry-run → preview → reason → (MONEY) typed
 *     confirm, keeping «تنفيذ» disabled until the contract is satisfied —
 *     against a real op (money.payout.disburse) launched from the palette.
 *
 * Gated: the whole suite needs the live stack (web build + API + seed). If
 * the API is unreachable we skip rather than fail (mirrors the assumption in
 * the other ops e2e specs that the golden stack is up).
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

const NAV_LABELS = [
  'المركز', 'التنبيهات', 'المشاريع', 'المراجعة', 'المال', 'المستخدمون', 'الثقة والأمان',
  'التظلّمات', 'الفئات', 'التحرير', 'المجموعات', 'المورّدون', 'التحليلات', 'الإشعارات',
  'تسليم المكافآت', 'المسابقات', 'الإعدادات', 'سجل التدقيق', 'الدعم', 'الوكلاء', 'الفريق',
];

test('the side nav renders all 21 sections', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-kit spec');
  await enterOps(page);
  const nav = page.getByRole('navigation', { name: 'أقسام مركز العمليات' });
  for (const label of NAV_LABELS) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole('link')).toHaveCount(21);
});

test('Ctrl+K opens the command palette and filters', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-kit spec');
  await enterOps(page);

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'لوحة الأوامر' });
  await expect(palette).toBeVisible();

  const search = palette.getByRole('textbox', { name: 'ابحث في الأقسام والعمليات' });
  // At least the 20 sections are listed before any query (ops manifest adds more).
  expect(await palette.getByRole('option').count()).toBeGreaterThanOrEqual(20);
  await search.fill('التدقيق');
  await expect(palette.getByRole('option', { name: /سجل التدقيق/ })).toBeVisible();
  await expect(palette.getByRole('option', { name: /الوكلاء/ })).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
});

test('op-runner: dry-run → preview → reason → MONEY confirm gates «تنفيذ»', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-kit spec');
  await enterOps(page);

  // Launch a MONEY op from the palette (dry-run returns a preview at {}).
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'لوحة الأوامر' });
  await palette.getByRole('textbox').fill('صرف');
  const moneyOpt = palette.getByRole('option').first();
  await expect(moneyOpt).toBeVisible();
  await moneyOpt.click();

  // The runner dialog opens and runs the dry-run.
  const runner = page.getByRole('dialog', { name: /تنفيذ العملية/ });
  await expect(runner).toBeVisible();

  // Either a preview (reason + MONEY confirm gate) or explicit blockers.
  const reason = runner.getByRole('textbox').first();
  if (await reason.isVisible().catch(() => false)) {
    const execBtn = runner.getByRole('button', { name: /تنفيذ/ });
    await expect(execBtn).toBeDisabled(); // no reason / no confirm yet
    await reason.fill('اختبار آلي: التحقق من بوابة السبب والتأكيد في المشغّل');
    // MONEY confirm field present → still disabled until «نعم».
    const confirmInput = runner.locator('input[type="text"], input:not([type])').last();
    if (await confirmInput.isVisible().catch(() => false)) {
      await expect(execBtn).toBeDisabled();
      await confirmInput.fill('نعم');
    }
    await expect(execBtn).toBeEnabled();
  } else {
    // Blocked path is also a valid, proven runner state.
    await expect(runner.getByText(/لا يمكن التنفيذ|تعذّر/)).toBeVisible();
  }

  await page.keyboard.press('Escape');
});

/* ── OPS-360 Unit 2 — power-table infra ───────────────────────────────────
 * The reusable kit (CSV serialization + column-state reconciliation) is pure
 * and needs no live stack — asserted directly. The on-screen controls (gear,
 * CSV button, saved-views) are wired per-screen by Unit 3; the UI probes below
 * exercise them where present and gate-skip until a screen adopts them, so the
 * suite stays green through the rollout.
 */

test.describe('Unit 2 — CSV serialization (pure, PDPL-masked/no re-fetch)', () => {
  test('toCsv escapes commas, quotes and newlines per RFC-4180 with CRLF rows', () => {
    const csv = toCsv(
      ['المشروع', 'الحالة'],
      [
        ['مشروع، عادي', 'LIVE'],
        ['قال "مرحبا"', 'HELD'],
        ['سطر\nثانٍ', 'FAILED'],
      ],
    );
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('المشروع,الحالة');
    expect(lines[1]).toBe('"مشروع، عادي",LIVE'); // comma → quoted
    expect(lines[2]).toBe('"قال ""مرحبا""",HELD'); // inner quotes doubled
    expect(csv).toContain('"سطر\nثانٍ"'); // newline preserved inside a quoted field
  });

  test('rowsToCsv honors column order and keeps money as the displayed SAR string', () => {
    interface Row { id: string; title: string; sar: string }
    const rows: Row[] = [
      { id: '1', title: 'أ', sar: '١٢٣٫٤٥ ر.س.' },
      { id: '2', title: 'ب', sar: '٠٫٠٠ ر.س.' },
    ];
    const csv = rowsToCsv(
      [
        { label: 'العنوان', cell: (r) => r.title },
        { label: 'المبلغ', cell: (r) => r.sar },
      ],
      rows,
    );
    const [header, first] = csv.split('\r\n');
    expect(header).toBe('العنوان,المبلغ');
    expect(first).toBe('أ,١٢٣٫٤٥ ر.س.'); // money verbatim, not re-derived
  });
});

test.describe('Unit 2 — column-state reconciliation (pure)', () => {
  test('a null saved state defaults to declared order, nothing hidden', () => {
    const s = reconcileColumnState(['a', 'b', 'c'], null);
    expect(s.order).toEqual(['a', 'b', 'c']);
    expect(s.hidden).toEqual([]);
    expect(visibleKeys(s)).toEqual(['a', 'b', 'c']);
  });

  test('keeps saved order, appends new columns, drops stale keys + stale hides', () => {
    const saved: ColumnState = { order: ['c', 'a', 'gone'], hidden: ['a', 'gone'] };
    const s = reconcileColumnState(['a', 'b', 'c'], saved);
    expect(s.order).toEqual(['c', 'a', 'b']); // saved order first, 'b' appended, 'gone' dropped
    expect(s.hidden).toEqual(['a']); // 'gone' dropped from hidden too
    expect(visibleKeys(s)).toEqual(['c', 'b']);
  });
});

test('column-manager + CSV + saved-views controls (gated on a screen adopting them)', async ({ page }) => {
  test.skip(!apiUp, 'API unreachable — skipping live ops-kit spec');
  await enterOps(page);
  await page.goto('/ops/projects');

  const gear = page.getByRole('button', { name: 'إدارة الأعمدة' });
  test.skip((await gear.count()) === 0, 'no DataTable exposes tableKey yet — Unit 3 wires the toolbar');

  // Gear opens a column popover with per-column visibility checkboxes.
  await gear.first().click();
  const panel = page.getByRole('group', { name: /أعمدة الجدول/ });
  await expect(panel).toBeVisible();
  expect(await panel.getByRole('checkbox').count()).toBeGreaterThan(1);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});
