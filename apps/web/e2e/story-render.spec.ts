import { expect, test } from '@playwright/test';

import { API } from './helpers';

/**
 * The campaign page must render the creator's OWN story.
 *
 * It did not, for the whole life of the project: `storyAr` was written by the
 * seed and by the dashboard editor, and the public page drew a hardcoded
 * fixture instead — the same headings, the same three paragraphs, on every
 * campaign. Nothing failed, because a fixture always renders. The only signal
 * was that two different projects read identically.
 *
 * So S1 asserts the page shows text that exists ONLY in this project's story.
 * Asserting "a story is present" would pass against the fixture and is exactly
 * the vacuous check that hid the bug.
 *
 * S2 covers story VIDEO, which fails invisibly in a second way: a CSP that
 * rejects the media origin issues no request at all, so the <video> is present,
 * the response is never made, and the markup looks perfect. It asserts on
 * `videoWidth`, which is non-zero only if bytes arrived AND decoded.
 */

type StoryProject = { slug: string; storyAr?: string | null };

/**
 * A project whose story has real markdown structure, asked of the API rather
 * than assumed. CI seeds a single project with a plain-prose story and no
 * object storage, so both specs skip there rather than assert on nothing —
 * and a skip that hides a real regression is worse than a failure, which is why
 * each skip below names what it could not find.
 */
async function findStoryProject(needsVideo: boolean): Promise<StoryProject | null> {
  const res = await fetch(`${API}/v1/discover?take=48`);
  if (!res.ok) return null;
  const body = (await res.json()) as { items?: { slug: string }[] };
  for (const item of body.items ?? []) {
    const d = await fetch(`${API}/v1/projects/${item.slug}`);
    if (!d.ok) continue;
    const p = (await d.json()) as StoryProject;
    const s = p.storyAr ?? '';
    if (!/^#{1,6}\s+\S/m.test(s)) continue;
    if (needsVideo && !/\.(mp4|webm)\)/.test(s)) continue;
    return { slug: item.slug, storyAr: s };
  }
  return null;
}

test('S1: the campaign page renders this project\'s own story, not a fixture', async ({ page }) => {
  const project = await findStoryProject(false);
  test.skip(!project, 'no project in this environment has a structured storyAr');

  const headings = [...project!.storyAr!.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => m[1].trim());
  expect(headings.length, 'story should have headings to assert on').toBeGreaterThan(1);

  await page.goto(`/p/${project!.slug}`);

  // Every heading from the source markdown reaches the page...
  for (const h of headings) {
    await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
  }

  // ...and the table of contents links to them rather than to dead anchors.
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="#story-md-"]')].filter(
      (a) => !document.querySelector(a.getAttribute('href')!),
    ).length,
  );
  expect(broken, 'TOC anchors must resolve to rendered headings').toBe(0);

  // The story's headings sit under the page h1 and beside sibling h2 sections,
  // so `#` must render h2. Seeding the sections as `##` instead put h3 directly
  // under the h1 — a skipped level, invisible on screen and only findable in the
  // outline. Asserted on the whole page because the story is what perturbs it.
  const skips = await page.evaluate(() => {
    const out: string[] = [];
    let prev = 1;
    for (const h of document.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
      const lvl = Number(h.tagName[1]);
      if (lvl > prev + 1) out.push(`${h.tagName} "${h.textContent?.trim().slice(0, 30)}" after h${prev}`);
      prev = lvl;
    }
    return out;
  });
  expect(skips, 'heading levels must not skip').toEqual([]);
});

test('S2: a story video is fetched, decoded, and does not autoplay', async ({ page }) => {
  const project = await findStoryProject(true);
  test.skip(!project, 'no project in this environment has a story video');

  await page.goto(`/p/${project!.slug}`);

  const video = page.locator('video').first();
  await expect(video).toBeVisible();

  // videoWidth is 0 until real bytes decode, so this is the assertion a CSP
  // block, a 403 from the bucket, or a wrong URL all fail — none of which are
  // visible in the markup.
  await expect
    .poll(async () => video.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 15_000 })
    .toBeGreaterThan(0);

  expect(
    await video.evaluate((v: HTMLVideoElement) => ({ autoplay: v.autoplay, controls: v.controls })),
  ).toEqual({ autoplay: false, controls: true });
});
