import { expect, test } from '@playwright/test';

/**
 * Batch CONTENT Part 1C — the consolidated content tree.
 *
 * The rule this enforces is "no orphans, no dead links": every content page is
 * reachable from the footer or a hub, and every link a hub makes actually
 * resolves. A content tree rots by accumulating pages nobody links and links to
 * pages nobody kept.
 */

/** Every content destination the footer promises. */
const FOOTER_LINKS = [
  '/projects/discover-all',
  '/projects/how',
  '/rules',
  '/projects/about',
  '/projects/pricing',
  '/projects/handbook',
  '/projects/ranks',
  '/projects/supplier',
  '/projects/help',
  '/projects/legal/terms',
  '/projects/legal/privacy',
  '/projects/legal/refund-policy',
  '/projects/legal/contracts',
  '/stories/protect-your-campaign',
];

test('T1: every footer destination resolves', async ({ page }) => {
  const broken: string[] = [];
  for (const path of FOOTER_LINKS) {
    const resp = await page.goto(path);
    const status = resp?.status() ?? 0;
    // 307 is the auth gate on account pages and is a correct answer for a
    // signed-out visitor; a 404 or 5xx is not.
    if (status !== 200 && status !== 307) broken.push(`${path} → ${status}`);
  }
  expect(broken, 'footer links that do not resolve').toEqual([]);
});

test('T2: the footer actually offers the rules hub and a real contact target', async ({ page }) => {
  await page.goto('/projects');
  const footer = page.locator('footer');

  await expect(footer.locator('a[href="/rules"]'), '«قواعدنا» in the footer').toHaveCount(1);

  // «تواصل معنا» used to drop the reader at the top of a long FAQ.
  const contact = footer.locator('a[href="/projects/help#contact"]');
  await expect(contact, 'contact points at the form').toHaveCount(1);
});

test('T3: the rules pages link the flows they describe', async ({ page }) => {
  // A policy that cannot reach the flow it documents is half a policy. These
  // are the cross-links the content layer is supposed to provide.
  const required: Array<[string, string]> = [
    ['/rules/enforcement', '/appeal'],
    ['/rules/enforcement', '/stories/protect-your-campaign'],
    ['/rules/creators', '/projects/help'],
    ['/rules/projects', '/rules/prohibited'],
  ];

  for (const [from, to] of required) {
    await page.goto(from);
    // At least one: every rules page also carries a standing footer link to the
    // help centre, so /rules/creators legitimately links it twice.
    const count = await page.locator(`main a[href="${to}"]`).count();
    expect(count, `${from} must link ${to}`).toBeGreaterThan(0);
  }
});

test('T4: inline markdown never leaks as literal syntax', async ({ page }) => {
  // The rules bodies are ops-editable markdown. If the renderer loses a mark,
  // the page still renders — as raw `[text](/url)` and `**bold**` in the middle
  // of a policy. It looks broken to a reader and fine to a smoke test.
  for (const slug of ['projects', 'creators', 'prohibited', 'ai', 'enforcement']) {
    await page.goto(`/rules/${slug}`);
    const body = await page.locator('article').innerText();
    expect(body, `${slug}: unrendered link syntax`).not.toMatch(/\]\(\//);
    expect(body, `${slug}: unrendered emphasis`).not.toContain('**');
  }
});

test('T5: the sitemap carries the whole content tree', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.ok()).toBe(true);
  const xml = await res.text();

  for (const path of ['/rules', '/rules/prohibited', '/projects/legal/contracts', '/spotlight']) {
    expect(xml, `${path} missing from the sitemap`).toContain(`${path}<`);
  }
});
