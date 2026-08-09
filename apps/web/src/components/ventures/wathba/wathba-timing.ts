/**
 * Timing constants the e2e suite also has to know.
 *
 * These three were declared inside the components that use them, and the specs
 * that wait them out declared their OWN copies of the same numbers. Nothing
 * connected the two. The failure that produces is not a broken test — it is a
 * retired one: raise `HOVER_INTENT_MS` to 700 and `home-card-video`'s 600ms
 * "no video mounted on touch" assertion still passes, because it now checks
 * that before a video could ever have mounted. Silent, and no re-run reveals it.
 *
 * `timing-constants.spec.ts` used to police that duplication by reading the
 * component sources. This module removes the duplication instead: one
 * declaration, imported by both sides. The guard stays — it now checks the
 * margins between these values and the waits built on them, which is a
 * relationship a shared constant cannot express on its own.
 *
 * A PLAIN .ts MODULE, deliberately. The components are `'use client'` .tsx, and
 * a Playwright spec importing one drags React and the whole component graph
 * into the test process to read a number. Nothing here imports anything.
 *
 * Only constants the TESTS need live here. Values internal to one component —
 * `FADE_MS`, easing curves, transition lengths nothing asserts on — stay where
 * they are used. This is a seam, not a dumping ground.
 */

/** Hover dwell before a card video is requested. */
export const HOVER_INTENT_MS = 150;

/**
 * No card or hero video may start before this many ms after first client
 * render. The hero cover is the LCP element and a video fetch competing with it
 * is what this protects.
 */
export const LCP_PROTECTION_MS = 2000;

/** How long the hero rotator holds a slide before advancing. */
export const DWELL_MS = 10_000;
