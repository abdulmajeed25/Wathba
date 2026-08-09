import { expect, test } from '@playwright/test';

import { API } from './helpers';

/**
 * Project cover images must actually load.
 *
 * Three independent things have to line up for a cover to appear, and two of
 * them fail quietly:
 *
 *   1. the project has media                → otherwise the empty-state art
 *   2. the object is publicly readable      → otherwise 403, visible in the log
 *   3. the CSP allows the media origin      → otherwise no request is made
 *
 * (3) is the one worth a test. `img-src` lists `https:`, so a media host on
 * plain HTTP is blocked, and a CSP-blocked image produces no network request at
 * all: the network tab is empty, `img.complete` is true, and `naturalWidth` is
 * 0 — indistinguishable from a missing file if you are watching the network.
 * Chromium does log the violation and fires `securitypolicyviolation`, so it is
 * findable; it is just not where you look.
 *
 * C1 asserts on the DECODED image, not on markup or a response. C2 covers the
 * directive C1 cannot reach: media-src, which governs story video that only a
 * creator's upload can produce.
 */

/**
 * Does this environment have project media at all?
 *
 * Asked of the API rather than inferred from the page, and that distinction was
 * itself a bug: /projects/discover-all is ISR-cached, so the first request after
 * the data changes serves stale HTML. Deciding "no media here, skip" from a
 * stale page made the skip flaky — and a spurious skip does not fail, it just
 * silently removes the guard, which is the worst outcome available.
 *
 * CI runs Postgres + Redis with no object storage and a seed that sets no
 * mediaUrls, so there is genuinely nothing to assert on there.
 */
async function environmentHasMedia(): Promise<boolean> {
  const res = await fetch(`${API}/v1/discover?take=24`);
  if (!res.ok) return false;
  const body = (await res.json()) as { items?: { mediaUrls?: string[] }[] };
  return (body.items ?? []).some((i) => (i.mediaUrls?.length ?? 0) > 0);
}

/** Cover <img>s on the page, retrying once past an ISR-stale first response. */
async function coversOnDiscovery(page: import('@playwright/test').Page) {
  const collect = async () => {
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    // Wait for DECODING, not for 1200ms.
    //
    // `naturalWidth === 0` is this test's entire failure signal, and it is also
    // exactly what an image that simply has not finished decoding yet looks
    // like. A fixed sleep therefore turns a slow box into "the CSP is blocking
    // your media origin" — the loudest wrong answer this file can give.
    //
    // Settle when every cover has either decoded or genuinely failed; a real
    // block still lands here with complete=true and naturalWidth=0, so the
    // failure this test exists for is not waited away.
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('img')]
            .filter((i) => /demo-covers|\/venture-/.test((i as HTMLImageElement).src))
            .every((i) => (i as HTMLImageElement).complete),
        null,
        { timeout: 15_000 },
      )
      .catch(() => {});
    return page.evaluate(() =>
      [...document.querySelectorAll('img')]
        .filter((i) => /demo-covers|\/venture-/.test(i.src))
        .map((i) => ({ src: i.src, w: i.naturalWidth })),
    );
  };

  await page.goto('/projects/discover-all');
  let imgs = await collect();
  if (imgs.length === 0) {
    // Second request: ISR has revalidated by now if the first was stale.
    await page.reload();
    imgs = await collect();
  }
  return imgs;
}

test('C1: every project cover on the discovery grid decodes', async ({ page }) => {
  test.skip(!(await environmentHasMedia()), 'no project media in this environment');

  const imgs = await coversOnDiscovery(page);

  // The API says media exists, so the grid must render it. A broken cover still
  // renders an <img> with its src — both failure modes this test exists for
  // (CSP block, 403) land here rather than vanishing — so an empty list at this
  // point is itself the bug.
  expect(imgs.length, 'the API reports project media but the grid rendered no cover').toBeGreaterThan(0);

  const broken = imgs.filter((i) => i.w === 0);
  expect(
    broken,
    `${broken.length}/${imgs.length} cover(s) did not decode. If the network log is ` +
      `empty, the CSP img-src is missing the media origin (NEXT_PUBLIC_MEDIA_URL):\n  ` +
      broken.map((b) => b.src.slice(-46)).join('\n  '),
  ).toEqual([]);
});

test('C2: the media origin is allowed by media-src as well as img-src', async ({ page }) => {
  test.skip(!(await environmentHasMedia()), 'no project media in this environment');

  // Story media is uploaded through the dashboard story editor, which PUTs to
  // the MinIO origin and then renders what came back — so it is governed by
  // media-src (for video) and fails the same invisible way an image does.
  // Creator-uploaded, and the seed has none, so this asserts the policy rather
  // than the pixels.
  //
  // An earlier version of this comment cited wathba-start.tsx. That component
  // was dead code and has been deleted; the live uploaders are the story editor,
  // the settings/profile avatar pickers and the milestones manager.
  //
  // The expected origin comes from media the app ACTUALLY serves, not from
  // NEXT_PUBLIC_MEDIA_URL: the value is baked in at build time and the runner
  // need not have it, and a test reading the same env var the config reads
  // would agree with a misconfiguration rather than catch it.
  const res = await page.goto('/projects/discover-all');
  const csp = (await res?.headerValue('content-security-policy')) ?? '';
  expect(csp, 'the page must send a CSP at all').toContain('img-src');

  const imgs = await coversOnDiscovery(page);
  expect(imgs.length, 'the API reports project media but the grid rendered no cover').toBeGreaterThan(0);
  const origin = new URL(imgs[0].src).origin;

  // An HTTPS origin is already covered by the `https:` source in both
  // directives and needs no explicit entry, so there is nothing to assert.
  test.skip(origin.startsWith('https:'), 'https origins are covered by the https: source');

  for (const directive of ['img-src', 'media-src']) {
    const line = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(directive)) ?? '';
    expect(
      line,
      `${directive} must allow the media origin ${origin} — without it the browser makes no request at all`,
    ).toContain(origin);
  }
});
