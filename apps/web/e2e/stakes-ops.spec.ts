import { expect, test } from '@playwright/test';
import { API } from './helpers';

/**
 * STAKES/S-9 — ops, telemetry & perf: PWA basics (Q1), version stamps (Q5),
 * the privacy-respecting event ingest (O1), and the parallelized discover
 * facets staying correct + inside the 300ms budget (M3).
 */

test('Q1: manifest + icon are served with the brand identity', async ({ request }) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.status()).toBe(200);
  const m = (await manifest.json()) as { name: string; theme_color: string; dir: string };
  expect(m.name).toContain('وثبة');
  expect(m.theme_color).toBe('#05a661');
  expect(m.dir).toBe('rtl');

  const icon = await request.get('/icon.svg');
  expect(icon.status()).toBe(200);
});

test('Q5: version stamp in the API /health and the web footer', async ({ page, request }) => {
  const health = await request.get(`${API}/v1/health`);
  expect(health.status()).toBe(200);
  const h = (await health.json()) as { version: string; sha: string | null };
  expect(h.version).toMatch(/^\d+\.\d+\.\d+$/);

  await page.goto('/projects/about');
  await expect(page.locator('footer').getByText(/^v\d+\.\d+\.\d+/)).toBeVisible();
});

test('O1: event ingest accepts whitelisted names and never errors', async ({ request }) => {
  const ok = await request.post('/api/events', {
    data: { name: 'page_view', anonId: 'e2e-anon', path: '/projects' },
  });
  expect(ok.status()).toBe(200);
  expect((await ok.json()) as { ok: boolean }).toEqual({ ok: true });

  // Unknown names are silently dropped — still 200 (analytics never breaks a page).
  const dropped = await request.post('/api/events', {
    data: { name: 'page_view_evil_probe_xxxxx'.slice(0, 30), path: '/x' },
  });
  expect(dropped.status()).toBe(200);
});

test('M3: discover facets stay correct after parallelization and answer fast', async ({ request }) => {
  const t0 = Date.now();
  const res = await request.get(`${API}/v1/discover/facets`);
  const elapsed = Date.now() - t0;
  expect(res.status()).toBe(200);
  const f = (await res.json()) as Record<string, unknown>;
  for (const key of ['statuses', 'categories', 'regions', 'pct', 'goals', 'raised', 'staff', 'collections']) {
    expect(f).toHaveProperty(key);
  }
  const statuses = f.statuses as { live: number };
  expect(statuses.live).toBeGreaterThan(0);
  // The audit bar: < 300ms p95. One warm request must be comfortably inside.
  expect(elapsed).toBeLessThan(300);
});
