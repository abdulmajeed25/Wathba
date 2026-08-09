import { expect, test, type Page } from '@playwright/test';

import { API } from './helpers';

/**
 * The campaign page plays the PROJECT'S OWN video.
 *
 * It used to render a YouTube iframe whose id was `jNQXAC9IVRw` — a hardcoded
 * constant in a web fixture, the same clip on every campaign on the platform.
 * It was dead as well as wrong: the CSP has no frame-src entry for
 * youtube.com, so the iframe never loaded even when someone pressed play.
 * Meanwhile the cards had been playing the real per-project `videoUrl` since
 * migration 0059, so a card and the page it linked to could show two different
 * videos.
 *
 * READ-ONLY, deliberately. The obvious version of this file PATCHed a project
 * and reloaded, and it failed for a reason that had nothing to do with the
 * feature: the campaign route is `revalidate = 60`, so the page served after
 * the PATCH was the one rendered before it. Picking projects that are already
 * in the state each assertion needs removes both the cache race and the
 * mutation.
 */

/** A live project id whose public card carries a video, and one that does not. */
async function pickProjects(): Promise<{ withVideo: string | null; without: string | null }> {
  const r = await fetch(`${API}/v1/discover?take=48`);
  const j = (await r.json()) as { items: Array<{ id: string; videoUrl: string | null }> };
  return {
    withVideo: j.items.find((x) => x.videoUrl)?.id ?? null,
    without: j.items.find((x) => !x.videoUrl)?.id ?? null,
  };
}

/** The raw project record — the card payload hides POSTER projects' videos. */
async function detailVideo(id: string): Promise<string | null> {
  const r = await fetch(`${API}/v1/projects/${id}`);
  if (!r.ok) return null;
  const j = (await r.json()) as { videoUrl?: string | null };
  return j.videoUrl ?? null;
}

async function openCampaign(page: Page, id: string): Promise<void> {
  await page.goto(`/projects/${id}`);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
}

test('CV1: no YouTube fixture is embedded on a campaign page', async ({ page }) => {
  const { withVideo, without } = await pickProjects();
  const id = withVideo ?? without;
  test.skip(!id, 'no live projects in this environment');
  await openCampaign(page, id!);

  const html = await page.content();
  expect(html, 'the hardcoded fixture clip is still being embedded').not.toContain('jNQXAC9IVRw');
  expect(html, 'a youtube embed is still on the page').not.toContain('youtube.com/embed');
  expect(await page.locator('iframe[src*="youtube"]').count()).toBe(0);
});

test('CV2: a project with a video gets a real player wired to ITS video', async ({ page }) => {
  const { withVideo } = await pickProjects();
  test.skip(!withVideo, 'no live project currently has a video');
  const expected = await detailVideo(withVideo!);
  expect(expected, 'the card advertised a video the project does not have').toBeTruthy();

  await openCampaign(page, withVideo!);
  const play = page.getByRole('button', { name: 'تشغيل فيديو الحملة' });
  await expect(play, 'a project with a video has no way to play it').toBeVisible();

  // Click to play — not hover, not autoplay. A campaign video is content the
  // visitor chose to watch, so it gets real controls and no motion until asked.
  // That is the opposite of the muted decorative loop on a card, which is why
  // this deliberately does not reuse WathbaCardVideo.
  await play.click();
  const video = page.locator('video').first();
  await expect(video).toBeVisible();
  expect(
    await video.getAttribute('src'),
    'the page is playing something other than this project’s own video',
  ).toBe(expected);
  expect(await video.evaluate((v: HTMLVideoElement) => v.controls), 'no controls').toBe(true);
});

test('CV3: a project with no video gets no play button', async ({ page }) => {
  const { without } = await pickProjects();
  test.skip(!without, 'every live project has a video');
  test.skip(
    (await detailVideo(without!)) !== null,
    'that project has a video the card is hiding — not the case under test',
  );

  await openCampaign(page, without!);
  expect(
    await page.getByRole('button', { name: 'تشغيل فيديو الحملة' }).count(),
    'a project with no video is offering a play button it cannot honour',
  ).toBe(0);
});
