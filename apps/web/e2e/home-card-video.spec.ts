import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Stage 1 item 12 — hover-video on the project cards.
 *
 * The premise had to be built before it could be tested. There was no
 * per-project video in the schema, the API or the data: the campaign page
 * rendered a YouTube iframe whose id was a hardcoded constant in a web fixture,
 * the same clip for every project. `Project.videoUrl` (migration 0059) is the
 * real field, and it is null for almost every project — so the assertions here
 * are written around a MIXED dataset and would be meaningless without one.
 *
 * V1 is the requirement the user stated. The rest exist because each is a way
 * the feature could ship looking correct while being wrong: preloading video on
 * a page nobody hovers, firing on a phone tap, playing four at once, or racing
 * the LCP.
 */

const GLYPH = '[aria-label="هذا المشروع يحتوي على فيديو"]';

/** The LCP guard in wathba-card-video.tsx. Hovering earlier must do nothing. */
const LCP_PROTECTION_MS = 2000;

async function trendingCardWithVideo(page: Page): Promise<Locator> {
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: /المشاريع الرائجة/ }) });
  const card = section.locator('a', { has: page.locator(GLYPH) }).first();
  await expect(card, 'no trending card carries a video — the dataset is wrong, not the feature').toBeVisible();
  return card;
}

test('V1: hovering a trending card mounts a muted, playing video; leaving pauses it', async ({
  page,
}) => {
  await page.goto('/projects');
  const card = await trendingCardWithVideo(page);

  // Nothing is fetched until hover: the element does not exist yet.
  await expect(page.locator('video')).toHaveCount(0);

  // Past the LCP guard before hovering, or the hover is correctly ignored.
  await page.waitForTimeout(LCP_PROTECTION_MS + 100);
  await card.hover();

  const video = card.locator('video');
  await expect(video, 'hover did not mount a <video>').toHaveCount(1);

  // Playing, and muted. `muted` is asserted from the live property rather than
  // the attribute: an unmuted autoplay is blocked by the browser, so a test
  // that only read the attribute could pass while nothing ever played.
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0), {
      message: 'the video mounted but never started playing',
      timeout: 5000,
    })
    .toBe(true);
  expect(await video.evaluate((v: HTMLVideoElement) => v.muted), 'video is not muted').toBe(true);
  expect(await video.evaluate((v: HTMLVideoElement) => v.loop), 'video does not loop').toBe(true);

  // Leaving reverts to the image.
  await page.mouse.move(0, 0);
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.paused).catch(() => true), {
      message: 'the video kept playing after the pointer left',
      timeout: 3000,
    })
    .toBe(true);
});

test('V1b: a hover that lands INSIDE the LCP window still plays, once it opens', async ({
  page,
}) => {
  await page.goto('/projects');
  const card = await trendingCardWithVideo(page);
  await card.scrollIntoViewIfNeeded();

  // THE BUG THIS PINS. The window used to be a yes/no check that returned early
  // inside the intent timer, which threw the hover away. React only synthesises
  // onMouseEnter again after a real leave-and-re-enter, so a pointer that landed
  // during the first two seconds — the normal thing to do, the page has just
  // painted — never got a second chance. Measured before the fix: pointer down
  // at t=60ms and held still, window open at t=2000ms, and at t=5012ms there was
  // still no <video>. It reads as "hover-video is broken".
  //
  // The pointer lands and does NOT move again for the rest of this test.
  await card.hover();
  expect(
    await page.evaluate(() => document.documentElement.dataset.cardVideoWindow),
    'the hover did not land inside the window — this test cannot prove anything',
  ).toBe('shut');
  expect(await card.locator('video').count(), 'nothing may mount while the window is shut').toBe(0);

  // No further pointer input. The guard has to wait itself out and re-arm.
  await expect
    .poll(() => card.locator('video').count(), {
      message: 'the video never started for a pointer that arrived early and stayed',
      timeout: 8000,
    })
    .toBe(1);
  await expect
    .poll(() => card.locator('video').evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0), {
      message: 'it mounted but never played',
      timeout: 6000,
    })
    .toBe(true);
});

test('V2: nothing video-related is fetched before a hover', async ({ page }) => {
  const videoRequests: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'media' || /\.(mp4|webm)(\?|$)/i.test(r.url())) videoRequests.push(r.url());
  });

  await page.goto('/projects');
  await page.waitForLoadState('networkidle');
  // Scroll the whole page: the two carousels are far below the fold, and a
  // naive implementation that mounts <video preload="metadata"> would fetch
  // here even though nobody hovered.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);

  expect(videoRequests, `video was fetched with no hover: ${videoRequests.join(', ')}`).toEqual([]);
  expect(await page.locator('video').count(), 'a <video> element existed before any hover').toBe(0);
});

test('V3: the ▶ affordance appears on cards that have video, and only those', async ({ page }) => {
  await page.goto('/projects');

  const glyphs = await page.locator(GLYPH).count();
  expect(glyphs, 'no card advertises a video').toBeGreaterThan(0);

  // The dataset is deliberately mixed. If every card had a glyph, the component
  // would be ignoring videoUrl and the assertion above would pass anyway.
  const cards = await page.locator('a.lift, .wathba-trend-grid > a').count();
  expect(cards, 'no project cards found at all').toBeGreaterThan(glyphs);
});

test('V4: a touch device gets no video', async ({ browser }) => {
  const ctx = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  await page.goto('/projects');
  await page.waitForTimeout(LCP_PROTECTION_MS + 100);

  // The emulation is asserted BEFORE the behaviour. Without this the test
  // passes whenever the touch emulation silently fails to apply — it would be
  // asserting "no video happened" in a context that was never touch at all.
  const looksLikeTouch = await page.evaluate(
    () => !window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  );
  expect(looksLikeTouch, 'touch emulation did not take — this test would prove nothing').toBe(true);

  // A REAL hover, not dispatchEvent('mouseenter'). React synthesises enter and
  // leave from mouseover/mouseout, so a dispatched mouseenter never reaches the
  // handler: measured on desktop, dispatchEvent left 0 videos where a real
  // hover mounted 1. The first draft of this test used dispatch and passed
  // while proving nothing.
  const card = page.locator('.wathba-trend-grid > a', { has: page.locator(GLYPH) }).first();
  await expect(card).toBeVisible();
  await card.hover();
  await page.waitForTimeout(600);

  expect(await page.locator('video').count(), 'a hover-equivalent started a video on touch').toBe(0);
  await ctx.close();
});

test('V5: prefers-reduced-motion suppresses the video entirely', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/projects');
  await page.waitForTimeout(LCP_PROTECTION_MS + 100);

  const card = await trendingCardWithVideo(page);
  await card.hover();
  await page.waitForTimeout(600);

  expect(await page.locator('video').count(), 'an autoplaying loop under reduced-motion').toBe(0);
});

/**
 * The LCP window.
 *
 * NOT covered here: "a hover DURING the window is refused". That needs a
 * pointer on a card inside 2s of load, which nothing in this environment can
 * do. What is covered is the gate the refusal reads — shut early, open later —
 * plus V1 (hover past the window does mount) and V2 (nothing loads unhovered).
 */
test('V6: the LCP window is shut for the first 2s and open after', async ({ page }) => {
  // Sampled from INSIDE the page, on the page's own timers. Every attempt to
  // assert this from the harness failed for a different reason and none of them
  // were the feature:
  //   - a plain early hover() raced real time; hover() alone took 9.2s
  //   - clock.install() does not freeze time (measured: 3288ms across 3s real)
  //   - clock.pauseAt() does freeze it, and stalls the entrance reveal so the
  //     cards never become visible at all
  // The page timing its own samples is immune to all three.
  // A MutationObserver records every state the gate passes through, with the
  // time it happened. Sampling at fixed offsets from navigation was wrong: the
  // window is relative to when the component's chunk evaluates, which measured
  // ~4s in here, so a 3.2s sample read "shut" on a gate that was working
  // perfectly.
  await page.addInitScript(() => {
    const w = window as unknown as { __states: Array<{ v: string; t: number }> };
    w.__states = [];
    const rec = () => {
      const v = document.documentElement?.dataset.cardVideoWindow;
      if (v && w.__states[w.__states.length - 1]?.v !== v) w.__states.push({ v, t: Date.now() });
    };
    // observe(document), not observe(document.documentElement): an init script
    // runs at document-start, where documentElement does not exist yet.
    // observe(null) THROWS, which killed the rest of this script silently — the
    // recorded list stayed empty while the attribute was visibly changing, and
    // the test read that as "the gate never fired".
    new MutationObserver(rec).observe(document, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-card-video-window'],
    });
    rec();
  });

  await page.goto('/projects');

  const states = () =>
    page.evaluate(() => (window as unknown as { __states: Array<{ v: string; t: number }> }).__states);

  await expect
    .poll(async () => (await states()).map((s) => s.v).join(','), { timeout: 30_000 })
    .toBe('shut,open');

  // The gate must actually have HELD, not flicker through both states. Without
  // this the test would pass against `dataset.x = 'shut'; dataset.x = 'open'`
  // on consecutive lines.
  //
  // Half the window, not the window itself: these are OBSERVATION timestamps,
  // and MutationObserver batches its callbacks, so the recorded gap runs short
  // of the real one by however long the main thread was busy. Asserting
  // >= 1850ms measured 1680ms under full-suite load — a correct guard failing on
  // observer lag. Half still separates "held ~2s" from a flicker, which is the
  // only distinction this assertion exists to make.
  const s = await states();
  const held = s[1]!.t - s[0]!.t;
  expect(held, `the window was shut for only ${held}ms — that is a flicker, not a guard`)
    .toBeGreaterThanOrEqual(LCP_PROTECTION_MS / 2);
});

test('V7: only one card plays at a time', async ({ page }) => {
  await page.goto('/projects');
  await page.waitForTimeout(LCP_PROTECTION_MS + 100);

  const cards = page.locator('.wathba-trend-grid > a', { has: page.locator(GLYPH) });
  const n = await cards.count();
  test.skip(n < 2, `needs two trending cards with video, found ${n}`);

  await cards.nth(0).hover();
  await expect.poll(() => cards.nth(0).locator('video').evaluate((v: HTMLVideoElement) => !v.paused).catch(() => false), { timeout: 5000 }).toBe(true);

  await cards.nth(1).hover();
  await expect
    .poll(
      async () =>
        page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !(v as HTMLVideoElement).paused).length),
      { message: 'more than one card was playing at once', timeout: 5000 },
    )
    .toBeLessThanOrEqual(1);
});
