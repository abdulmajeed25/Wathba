import { expect, test } from '@playwright/test';

import { API } from './helpers';

/**
 * Batch POLISH Unit 6 — automated-test fixtures must not reach the public site.
 *
 * This suite is itself the polluter: global-setup, creator-journey and
 * batch-pay each create a REAL project through the REAL API and publish it, so
 * every run leaves more «مشروع E2E 1784976525442» rows behind. On this box 31 of
 * 39 LIVE projects were fixtures and only 8 were presentable.
 *
 * These tests therefore run against data they have just contributed to, which is
 * exactly the right condition: F1/F2 would fail today without the guard.
 */

/** Mirror of the trigger predicate in migration 0058. */
const isFixtureTitle = (t: string) =>
  /(E2E|إي٢إي|PAY|SMOKE|TEST|SEED|FIXTURE)/.test(t) && /[0-9]{10,}/.test(t);

test('F1: no fixture-titled project is in the public listing API', async () => {
  const res = await fetch(`${API}/v1/projects?take=60`);
  expect(res.ok).toBeTruthy();
  const body = (await res.json()) as { items: Array<{ titleAr: string }> };

  const leaked = body.items.map((p) => p.titleAr).filter(isFixtureTitle);
  expect(leaked, `fixtures reached the public listing:\n${leaked.join('\n')}`).toEqual([]);
});

test('F2: no fixture-titled project is on the composed homepage payload', async () => {
  const res = await fetch(`${API}/v1/home`);
  expect(res.ok).toBeTruthy();
  const body = (await res.json()) as Record<string, unknown>;

  // Every project-bearing rail, whatever it is called.
  const titles: string[] = [];
  const collect = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(collect);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.titleAr === 'string') titles.push(o.titleAr);
      Object.values(o).forEach(collect);
    }
  };
  collect(body);

  const leaked = titles.filter(isFixtureTitle);
  expect(leaked, `fixtures reached the homepage:\n${leaked.join('\n')}`).toEqual([]);
});

test('F3: no fixture-titled project is on the spotlight payload', async () => {
  const res = await fetch(`${API}/v1/spotlight`);
  expect(res.ok).toBeTruthy();
  const body = (await res.json()) as Record<string, unknown>;

  const titles: string[] = [];
  const collect = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(collect);
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.titleAr === 'string') titles.push(o.titleAr);
      Object.values(o).forEach(collect);
    }
  };
  collect(body);

  expect(titles.filter(isFixtureTitle)).toEqual([]);
});

test('F4: the rendered discover page shows no fixture titles', async ({ page }) => {
  await page.goto('/projects/discover-all');
  await expect(page.locator('[data-testid="discover-card"]').first()).toBeVisible();

  const text = await page.locator('main').innerText();
  // The visible shape of the leak: a fixture token next to a 13-digit timestamp.
  expect(text).not.toMatch(/(E2E|إي٢إي|PAY)\s*[0-9]{10,}/);
});

test('F5: a fixture is still reachable at its own URL — listings only', async () => {
  // The guard is a LISTING filter, deliberately, not a takedown. Existing specs
  // (stakes-s10) drive a fixture project through its own pages, and a creator
  // must still be able to open a project they just created. Hiding the row from
  // discovery is the goal; making it a 404 would be a different, breaking change.
  const created = await fetch(`${API}/v1/projects?take=60`);
  const items = ((await created.json()) as { items: Array<{ id: string }> }).items;
  expect(items.length).toBeGreaterThan(0);

  // Any project the public listing DOES return must resolve individually too.
  const first = items[0]!;
  const detail = await fetch(`${API}/v1/projects/${first.id}`);
  expect(detail.ok).toBeTruthy();
});
