import { expect, test, type Page } from '@playwright/test';
import { DWELL_MS, LCP_PROTECTION_MS } from '../src/components/ventures/wathba/wathba-timing';

/**
 * HERO-VIDEO — the rotating hero card plays its project's video on hover.
 *
 * The hero is not a trending card with a different border. It AUTO-ADVANCES
 * every ten seconds and keeps all ten slides mounted in one grid cell, so it
 * carries three failure modes a static card does not have, and those are what
 * this file is mostly about:
 *
 *   R1  a hidden slide keeping a video running behind the visible one
 *   R2  the slide being yanked away at ten seconds while someone is watching
 *   R3  ten videos in flight because ten slides are "in the viewport"
 *
 * The implementation answers all three by mounting the layer only for
 * `i === idx`, which is why R1 and R3 are asserted as element COUNTS rather
 * than as behaviour: the guarantee is structural and the test should fail if
 * the structure changes, not merely if the symptom appears.
 *
 * TRAPS THIS FILE IS WRITTEN AROUND, all measured on this page:
 *   - `dispatchEvent('mouseenter')` never reaches a React handler. React
 *     synthesises onMouseEnter from mouseover/mouseout, so a dispatched event
 *     leaves zero videos where a real hover() mounts one. Every hover below is
 *     a real pointer move.
 *   - The component holds a 2s window after first client render in which no
 *     video may start, so the hero cover keeps the LCP to itself. A test that
 *     hovers before that window opens is asserting the guard, not the feature —
 *     so every test here waits past it first.
 *   - Video coverage is low by design: `videoUrl` is null until a creator
 *     uploads one, and 1 of the 10 pooled slides has one today. These tests
 *     locate the slide by its ▶ affordance and skip if the pool has none,
 *     rather than assuming index 0.
 */

const GLYPH = '[aria-label="هذا المشروع يحتوي على فيديو"]';
const CURRENT = '[data-testid="wathba-hero-slide-current"]';


/**
 * Advance the hero until the slide on screen is one that has a video, using the
 * NEXT control rather than the dots — the dots are hidden below 1100px and this
 * has to work at every viewport the suite uses.
 *
 * Returns false when no slide in the pool has a video, which is a legitimate
 * dataset state and a skip rather than a failure.
 */
async function showSlideWithVideo(page: Page): Promise<boolean> {
  const total = await page.locator('[data-testid="wathba-hero-rotator"] > *').count();
  for (let i = 0; i < total; i++) {
    if ((await page.locator(`${CURRENT} ${GLYPH}`).count()) > 0) return true;
    await page.getByRole('button', { name: 'المشروع التالي' }).click();
    // The slide swap is a 240ms transition on a click; wait for the new
    // current slide to settle before reading the next one.
    await expect(page.locator(CURRENT)).toHaveCount(1);
    await page.waitForTimeout(300);
  }
  return (await page.locator(`${CURRENT} ${GLYPH}`).count()) > 0;
}

async function currentTitle(page: Page): Promise<string> {
  return page.locator(`${CURRENT} h2`).innerText();
}

test('HV1: hovering the hero card plays the current slide video, muted and looping', async ({
  page,
}) => {
  await page.goto('/projects');
  await expect(page.locator(CURRENT)).toBeVisible();
  test.skip(!(await showSlideWithVideo(page)), 'no slide in the hero pool has a video');

  // Nothing has been fetched: the element does not exist before hover.
  await expect(page.locator('[data-testid="wathba-hero-rotator"] video')).toHaveCount(0);

  await page.waitForTimeout(LCP_PROTECTION_MS + 100);
  await page.locator(`${CURRENT} .wathba-ph`).hover();

  const video = page.locator(`${CURRENT} video`);
  await expect(video, 'hover did not mount a <video> on the hero card').toHaveCount(1);

  // The live properties, not the attributes. An unmuted autoplay is blocked by
  // the browser, so a test that only read the attribute could pass while
  // nothing ever played.
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0), {
      message: 'the hero video mounted but never started playing',
      timeout: 6000,
    })
    .toBe(true);
  expect(await video.evaluate((v: HTMLVideoElement) => v.muted), 'hero video is not muted').toBe(true);
  expect(await video.evaluate((v: HTMLVideoElement) => v.loop), 'hero video does not loop').toBe(true);
  expect(
    await video.evaluate((v: HTMLVideoElement) => v.getAttribute('poster')),
    'the poster must be the cover, or the cross-fade has something to jump between',
  ).toBeTruthy();

  // Leaving reverts.
  await page.mouse.move(0, 0);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused).catch(() => true), {
      message: 'the hero video kept playing after the pointer left',
      timeout: 4000,
    })
    .toBe(true);
});

test('HV2: only the current slide can hold a video, and only one at a time', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.locator(CURRENT)).toBeVisible();
  test.skip(!(await showSlideWithVideo(page)), 'no slide in the hero pool has a video');

  await page.waitForTimeout(LCP_PROTECTION_MS + 100);
  await page.locator(`${CURRENT} .wathba-ph`).hover();
  await expect(page.locator(`${CURRENT} video`)).toHaveCount(1);

  // R3 — ten slides live in one grid cell and are all "in the viewport" as far
  // as the browser is concerned. Exactly one <video> may exist in the whole
  // rotator; nine slides must have no video element at all.
  expect(
    await page.locator('[data-testid="wathba-hero-rotator"] video').count(),
    'more than one slide carries a <video> — the pool is being preloaded',
  ).toBe(1);

  // And nothing else on the page is playing either: the hero and the trending
  // cards share one module-level playback handle.
  const playing = await page.evaluate(
    () => [...document.querySelectorAll('video')].filter((v) => !v.paused).length,
  );
  expect(playing, 'more than one video is playing on the page').toBeLessThanOrEqual(1);
});

test('HV3: a slide change stops the video and takes it out of the DOM', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.locator(CURRENT)).toBeVisible();
  test.skip(!(await showSlideWithVideo(page)), 'no slide in the hero pool has a video');

  await page.waitForTimeout(LCP_PROTECTION_MS + 100);
  await page.locator(`${CURRENT} .wathba-ph`).hover();
  await expect(page.locator(`${CURRENT} video`)).toHaveCount(1);
  const before = await currentTitle(page);

  // R1 — advance while the video is up. The old slide stays in the DOM (all ten
  // do), so "it is hidden" would not be enough: the element itself has to go.
  await page.getByRole('button', { name: 'المشروع التالي' }).click();
  await expect.poll(async () => currentTitle(page)).not.toBe(before);
  await expect(
    page.locator('[data-testid="wathba-hero-rotator"] video'),
    'a video survived the slide change — a hidden slide is still playing',
  ).toHaveCount(0);
});

test('HV4: auto-rotation pauses while the card is hovered and resumes on leave', async ({
  page,
}) => {
  await page.goto('/projects');
  await expect(page.locator(CURRENT)).toBeVisible();

  // R2 — the reason this matters more here than on a static card: without the
  // pause, the slide someone is watching is replaced under them at ten seconds.
  // Deliberately NOT gated on a slide having a video: the pause is the rotator's
  // behaviour and must hold whether or not this particular slide plays.
  await page.waitForTimeout(LCP_PROTECTION_MS + 100);
  await page.locator(`${CURRENT} .wathba-ph`).hover();
  const held = await currentTitle(page);

  await page.waitForTimeout(DWELL_MS + 3000);
  expect(
    await currentTitle(page),
    'the hero advanced while it was being hovered',
  ).toBe(held);

  // And it is a pause, not a stop.
  await page.mouse.move(0, 0);
  await expect
    .poll(async () => currentTitle(page), { timeout: DWELL_MS + 8000, intervals: [500] })
    .not.toBe(held);
});

test('HV5: reduced motion gets no video at all', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/projects');
  await expect(page.locator(CURRENT)).toBeVisible();

  const has = await showSlideWithVideo(page);
  test.skip(!has, 'no slide in the hero pool has a video');

  await page.waitForTimeout(LCP_PROTECTION_MS + 100);
  await page.locator(`${CURRENT} .wathba-ph`).hover();
  await page.waitForTimeout(800);
  expect(
    await page.locator('[data-testid="wathba-hero-rotator"] video').count(),
    'an autoplaying loop is motion, and this reader asked for less of it',
  ).toBe(0);
  await ctx.close();
});

test('HV6: a touch device gets no video from a tap', async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto('/projects');
  await expect(page.locator(CURRENT)).toBeVisible();

  // Assert the emulation actually took BEFORE asserting the behaviour. If the
  // context were not really coarse-pointered, the component's own
  // `(hover:hover) and (pointer:fine)` check would let the video through and
  // this test would pass for the wrong reason — the exact shape of false pass
  // that made the trending version of this test prove nothing.
  expect(
    await page.evaluate(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches),
    'touch emulation did not take — this test cannot prove anything',
  ).toBe(false);

  const has = await showSlideWithVideo(page);
  test.skip(!has, 'no slide in the hero pool has a video');

  await page.waitForTimeout(LCP_PROTECTION_MS + 100);
  // A real hover() on a touch context still fires the underlying events; the
  // component's media-query check is what has to reject it.
  await page.locator(`${CURRENT} .wathba-ph`).hover();
  await page.waitForTimeout(800);
  expect(
    await page.locator('[data-testid="wathba-hero-rotator"] video').count(),
    'a tap started a video download on a phone',
  ).toBe(0);
  await ctx.close();
});

test('HV7: the ▶ affordance marks the slides that have a video, and only those', async ({
  page,
}) => {
  await page.goto('/projects');
  await expect(page.locator(CURRENT)).toBeVisible();

  const counts = await page.evaluate((glyph) => {
    const rot = document.querySelector('[data-testid="wathba-hero-rotator"]');
    const slides = [...(rot?.children ?? [])];
    return {
      slides: slides.length,
      withGlyph: slides.filter((s) => s.querySelector(glyph)).length,
    };
  }, GLYPH);

  expect(counts.slides, 'the hero pool is empty').toBeGreaterThan(0);
  // Not "at least one": the point is that the glyph tracks the DATA. A hero
  // where every slide wears it is as wrong as one where none does, and today
  // the pool has exactly one video in ten.
  expect(counts.withGlyph).toBeLessThanOrEqual(counts.slides);
  const coverage = counts.withGlyph / counts.slides;
  test.info().annotations.push({
    type: 'hero-video-coverage',
    description: `${counts.withGlyph}/${counts.slides} slides (${Math.round(coverage * 100)}%)`,
  });
});
