'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { PageViewTracker } from '@/components/analytics/page-view-tracker';
import { WathbaFeedbackProvider } from './wathba-feedback';
import { WathbaFooter } from './wathba-footer';
import { WathbaHeader } from './wathba-header';
import { persistTheme, resolveTheme, SSR_THEME, THEME_INIT_SCRIPT } from './wathba-theme';
import { wathbaCssVars, wathbaKeyframes, type WathbaTheme } from './wathba-tokens';

/**
 * Wathba (وثبة) pillar shell — provides the design's CSS-variable theming,
 * keyframes, header + footer, and a content slot.
 *
 * The variables are inlined as React style props on the wrapper div so we
 * don't pollute global CSS for the rest of the app (the pillar-local scope
 * matches what the design itself does via [data-theme="light"|"dark"]).
 */
export function WathbaShell({
  children,
  defaultTheme = SSR_THEME,
}: {
  children: ReactNode;
  defaultTheme?: WathbaTheme;
}) {
  const [theme, setTheme] = useState<WathbaTheme>(defaultTheme);

  /**
   * HOME-REVIEW D7 — adopt the reader's real theme.
   *
   * This runs AFTER first paint, and that is fine: on a hard load
   * THEME_INIT_SCRIPT has already put the right palette on the wrapper, so
   * this only brings React's state into line with what is on screen (which is
   * what makes the header's toggle show the right icon, and toggle the right
   * way). On a client-side navigation the script does not re-run — React never
   * executes an inserted inline script — and then this IS the mechanism. Both
   * paths resolve by the same rule, so they cannot disagree.
   */
  useEffect(() => {
    setTheme(resolveTheme());
  }, []);

  const setAndPersistTheme = (next: WathbaTheme) => {
    setTheme(next);
    persistTheme(next);
  };

  const styleVars: CSSProperties = {
    ...(wathbaCssVars[theme] as unknown as CSSProperties),
    /**
     * HOME-REVIEW — the motion scale.
     *
     * The surface carried twelve ad-hoc durations (.16 .18 .2 .22 .25 .35 .4
     * .5 .62 .8 1.1 1.4s) and reached for the browser's default `ease` wherever
     * a curve was omitted. Twelve durations is not a decision, it is twelve
     * separate ones — and `ease` is the absence of a choice rather than a
     * choice, weak at both ends where the reader is actually looking.
     *
     * Four steps, named for the EVENT rather than the number, because the
     * event is what decides:
     *   press   — a button answering a finger; must feel like contact
     *   hover   — a colour or border acknowledging a cursor
     *   reveal  — something entering or leaving the page
     *   drift   — the hero's calm auto-advance, the one thing nobody asked for
     *
     * The curve is a strong ease-out for anything entering or leaving: it
     * starts fast, so the reader sees movement in the frame they are watching
     * most. ease-in is deliberately absent — it delays the opening frames and
     * reads as lag no matter how short the duration.
     */
    ['--dur-press' as string]: '120ms',
    ['--dur-hover' as string]: '180ms',
    ['--dur-reveal' as string]: '240ms',
    ['--dur-drift' as string]: '520ms',
    ['--ease-out' as string]: 'cubic-bezier(.23,1,.32,1)',
    ['--ease-in-out' as string]: 'cubic-bezier(.77,0,.175,1)',
    /**
     * HOME-REVIEW — the vertical rhythm. Two values: a new chapter, and the
     * next thing in this one.
     *
     * clamp() rather than a breakpoint, and INLINE rather than in the <style>
     * block below, for one reason each and both were measured:
     *
     *  · Inline, because that block is inside this wrapper. A section styled
     *    `margin-top: var(--gap-act)` computes to 0 while the property is still
     *    undefined and then jumps once it resolves, dragging everything beneath
     *    it. That cost 0.07 CLS on a phone — worse than the rhythm was worth.
     *  · clamp(), because an inline custom property cannot be overridden by a
     *    media query at all, so the mobile step would silently never apply.
     *
     * The ratio stays ~1.7:1 at both ends: the ratio is what a reader perceives
     * as structure, while the absolute height is what makes a rich page feel
     * endless on a 360px screen.
     */
    ['--gap-act' as string]: 'clamp(64px, 8vw, 96px)',
    ['--gap-within' as string]: 'clamp(40px, 5vw, 56px)',
    /**
     * HOME-REVIEW — the vertical rhythm, as tokens so it can breathe less on a
     * phone. Two values only: a new chapter, and the next thing in this one.
     * The mobile pair keeps roughly the same RATIO (1.6–1.7:1) because the
     * ratio is what a reader perceives as structure — while cutting the
     * absolute height, which on a 360px screen is what makes a rich page feel
     * endless rather than organised. Overridden below 760px in the CSS block.
     */
    background:
      'radial-gradient(1200px 700px at 85% -5%,rgba(var(--accent-rgb),.10),transparent 60%),radial-gradient(900px 600px at 0% 0%,rgba(var(--accent2-rgb),.10),transparent 55%),var(--bg)',
    color: 'var(--text)',
    fontFamily: "'IBM Plex Sans Arabic', sans-serif",
    WebkitFontSmoothing: 'antialiased',
    direction: 'rtl',
    minHeight: '100vh',
    transition: 'background .4s, color .4s',
  };

  return (
    <div data-theme={theme} data-pillar="ventures" style={styleVars}>
      {/* HOME-REVIEW D7 — FIRST child, deliberately. It reads
       *  `document.currentScript.parentElement`, so it must sit inside the
       *  element it themes, and it must run before anything below it paints.
       *  See wathba-theme.ts for why it carries a palette instead of just
       *  stamping data-theme the way the ops shell does. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      {/* keyframes + a couple shared utility styles scoped via :where to leak no specificity */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            ${wathbaKeyframes}
            /* STAKES/S-2 — clip residual horizontal overflow (home ticker,
               campaign hero, header slack on the smallest phones) so no page
               scrolls sideways. overflow-x clip (not hidden/auto) keeps
               position:sticky working since it creates no scroll container. */
            [data-pillar="ventures"]{overflow-x:clip}
            [data-pillar="ventures"] .wathba-ph{background-color:var(--ph-bg);background-image:repeating-linear-gradient(135deg,rgba(var(--accent-rgb),.07) 0,rgba(var(--accent-rgb),.07) 2px,transparent 2px,transparent 11px)}
            [data-pillar="ventures"] .wathba-fade{animation:wathba-fadeUp .45s ease both}

            /* ── POLISH — the account slot reserves WIDTH, not just height ──
               /api/me resolves after mount and the signed-out state renders two
               CTAs where the loading placeholder was a 42px square. The slot
               went 94px → 258px wide, which squeezed the nav until IT wrapped
               too (26px → 48px) — so the header grew and every page shifted
               ~0.11. Reserving only the height does not help: the WIDTH change
               is what drives the wrap.
               Below the mobile breakpoint the desktop login link is hidden and
               the header is tight, so the reservation is dropped there. */
            [data-pillar="ventures"] .wathba-account-slot{min-width:206px;height:42px;display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-shrink:0;white-space:nowrap}
            @media (max-width:999px){
              /* HOME-REVIEW — 59px, NOT 0.
                 Dropping the reservation entirely here left the loading state
                 0px wide, so when /api/me answered (~1.3s, measured) the
                 compact «ابدأ» button appeared, the header reflowed, and every
                 section below it moved. That was the homepage's mobile CLS:
                 a single 0.119 shift landing at the exact millisecond of the
                 /me response.
                 The desktop reservation exists for the same reason and the
                 component's own comment states the intent — the slot "reserves
                 the same box in all three states" — so mobile was the case that
                 quietly opted out of it.
                 59px is the widest mobile state (signed out: «ابدأ» at 59px;
                 signed in: the avatar at 42px; loading: empty). It costs the
                 header nothing, because the signed-out header already carries
                 that button and fits. */
              [data-pillar="ventures"] .wathba-account-slot{min-width:59px}
            }

            /* ── POLISH Unit 2 — reveal-on-scroll ─────────────────────────
               The hidden state exists ONLY inside no-preference, so a
               reduced-motion reader can never end up looking at opacity:0
               content even if the JS misbehaves. And it only applies with
               data-revealed="0", which the server never emits — so no-JS and
               first paint are always the finished page. */
            @media (prefers-reduced-motion: no-preference){
              [data-pillar="ventures"] .wathba-reveal{transition:opacity .62s ease,transform .62s cubic-bezier(.22,.68,.24,1)}
              [data-pillar="ventures"] .wathba-reveal[data-revealed="0"]{opacity:.001;transform:translateY(20px)}
              [data-pillar="ventures"] .wathba-reveal[data-revealed="1"]{opacity:1;transform:none}
            }

            /* ── POLISH Unit 3 — category strip ────────────────────────────
               Hover/focus and scrollbar hiding cannot be expressed as inline
               styles, so the strip's interaction states live here. */
            [data-pillar="ventures"] .wathba-catstrip{scrollbar-width:none;-ms-overflow-style:none}
            [data-pillar="ventures"] .wathba-catstrip::-webkit-scrollbar{width:0;height:0;display:none}
            [data-pillar="ventures"] .wathba-cat-pill{transition:background-color .16s ease,color .16s ease}
            [data-pillar="ventures"] .wathba-cat-pill:hover{background-color:rgba(var(--ink-rgb),.06);color:var(--text)}
            [data-pillar="ventures"] .wathba-cat-pill[aria-expanded="true"]:hover,
            [data-pillar="ventures"] .wathba-cat-pill[aria-current="page"]:hover{background-color:rgba(var(--accent-rgb),.18)}
            [data-pillar="ventures"] .wathba-cat-pill:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
            /* Edge fades: pure decoration, so they never take pointer events. */
            [data-pillar="ventures"] .wathba-cat-fade{pointer-events:none;position:absolute;top:0;bottom:0;width:56px;z-index:2}
            [data-pillar="ventures"] .wathba-cat-arrow{transition:opacity .16s ease,background-color .16s ease}
            [data-pillar="ventures"] .wathba-cat-arrow:hover{background-color:var(--surface-3)}
            /* STAKES/S-2 — responsive toggles inlined here so they load on EVERY
               ventures page (Next route-split the globals.css copy off the pages
               that needed it). */
            [data-pillar="ventures"] .wathba-mob-only{display:none}
            [data-pillar="ventures"] .wathba-mob-sheet{display:none}
            @media (max-width:999px){
              [data-pillar="ventures"] .wathba-desk-only{display:none!important}
              [data-pillar="ventures"] .wathba-mob-only{display:inline-flex!important}
              [data-pillar="ventures"] .wathba-mob-sheet{display:flex}
            }

            /* ── The header has THREE tiers, not two ──────────────────────────
               Measured min-content cost of the header row, signed in (the
               expensive case — it carries the bell the signed-out row does not):

                 logo + nav + search + controls   1314px
                 logo + nav +  icon  + controls    998px
                 logo +              + controls    519px

               The row was showing the first configuration from 881px upward, so
               everything from 881 to 1313 overflowed — up to 433px of it. That
               is invisible to document.scrollWidth because [data-pillar] clips
               overflow-x, which is why an earlier audit called the header clean.
               What it cost in practice: the account control is the LAST child,
               so the whole overflow lands on it. It sat at a negative x, clipped
               and un-hittable, and a signed-in reader between 881 and 1280 could
               not open the account menu at all.

               So each configuration now gets the width it actually needs. The
               search field is the flexible one: everything beside it costs a
               fixed 972px, so the field gets (viewport - 972), and the tier
               boundary is simply the width below which that is too little to
               type into — measured 202px at 1200, 102px at 1100.

                 >=1200  the search field (322px at the 1320 cap, 282 at 1280,
                         202 at 1200 — the row is capped at maxWidth:1320, so
                         this tier never gets wider than 322)
                 1000..  the field would be under 200px, so it collapses to the
                  1199   icon that opens the full-screen search sheet. The nav
                         stays: losing it to a hamburger on an 1100px desktop
                         costs discoverability, whereas the icon opens the SAME
                         combobox and costs nothing.
                 <=999   the mobile sheet (was <=880; 881..999 cannot fit the
                         nav, which is what made that band overflow). */
            [data-pillar="ventures"] .wathba-wide-only{display:none}
            [data-pillar="ventures"] .wathba-narrow-only{display:inline-flex}
            @media (min-width:1200px){
              [data-pillar="ventures"] .wathba-wide-only{display:block}
              [data-pillar="ventures"] .wathba-narrow-only{display:none}
            }

            /* The smallest phones. Signed-in the row carries four 42px controls
               (search, bell, avatar, hamburger) beside the wordmark, and it ran
               over by 47px at 360 and 17px at 320. Two things give way, in the
               order of what costs the reader least: the wordmark's Latin
               tagline, which is the widest part of the logo (~59px of its 157)
               and carries no function, then the row's own breathing room.
               !important because the padding and gap are inline styles. */
            @media (max-width:420px){
              [data-pillar="ventures"] .wathba-wordmark-tag{display:none}
              [data-pillar="ventures"] .wathba-header-row{padding-inline:14px!important;gap:16px!important}
            }
            /* STAKES/S-15 (Q3) — print: strip chrome, black-on-white body,
               expand campaign links for paper readers. */
            @media print{
              [data-pillar="ventures"] header,[data-pillar="ventures"] footer,
              [data-pillar="ventures"] nav,[data-pillar="ventures"] aside{display:none!important}
              [data-pillar="ventures"]{background:#fff!important;color:#000!important}
              [data-pillar="ventures"] main *{color:#000!important;background:transparent!important;box-shadow:none!important}
              [data-pillar="ventures"] main a[href^="http"]:after{content:" (" attr(href) ")";font-size:10px}
            }
            /* Batch HOME — magazine utilities. .lift is the dc.html hover
               affordance (referenced across the port but never defined);
               the carousel track hides its scrollbar but stays swipeable;
               duo/row grids stack via CSS (no JS re-layout → zero CLS). */
            [data-pillar="ventures"] .lift{transition:transform .18s ease,box-shadow .18s ease}
            [data-pillar="ventures"] .lift:hover{transform:translateY(-3px);box-shadow:var(--card-shadow-h)}
            @media (prefers-reduced-motion:reduce){
              [data-pillar="ventures"] .lift,[data-pillar="ventures"] .lift:hover{transition:none;transform:none}
            }
            [data-pillar="ventures"] .wathba-carousel-track::-webkit-scrollbar{display:none}

            /* ── Batch HERO — the rotating featured card ─────────────────────
               Three states, so the outgoing slide EXITS rather than snapping: an
               idle slide waits at the enter offset, the current one sits at
               zero, and the one just replaced drifts the other way as it fades.
               A two-state (current / not-current) rule would jump the leaving
               slide to the enter offset the instant it lost the current state.

               --hero-enter is signed by direction rather than hand-maintained:
               the next slide arrives from the side the reader moves TOWARD,
               which is the left in Arabic and the right in English.

               All motion sits inside no-preference; globals.css clamps anything
               that slips through. */
            [data-pillar="ventures"] .wathba-hero-slide{--hero-enter:-16px}
            [dir="ltr"] [data-pillar="ventures"] .wathba-hero-slide{--hero-enter:16px}
            /* visibility, not just opacity. An opacity:0 slide is still
               PAINTED — ten 70px-blur shadows and ten backdrop-filter badges
               were being prepared before the page could show anything, and
               first paint here ran ~500ms behind sibling pages using the same
               shell. visibility:hidden keeps the box in LAYOUT, so the cell
               stays as tall as the tallest slide and the no-shift contract is
               untouched, while removing it from paint entirely.

               The outgoing slide must stay visible while it fades, so its
               visibility flips only after the transition — hence the 0s
               transition delayed by the full duration. */
            [data-pillar="ventures"] .wathba-hero-slide[data-state="idle"]{opacity:0;visibility:hidden;pointer-events:none}
            [data-pillar="ventures"] .wathba-hero-slide[data-state="prev"]{opacity:0;visibility:hidden;pointer-events:none}
            [data-pillar="ventures"] .wathba-hero-slide[data-state="current"]{opacity:1;visibility:visible}
            @media (prefers-reduced-motion:no-preference){
              [data-pillar="ventures"] .wathba-hero-slide{transition:opacity var(--hero-dur,520ms) ease,transform var(--hero-dur,520ms) cubic-bezier(.22,.68,.24,1),visibility 0s linear var(--hero-dur,520ms)}
              [data-pillar="ventures"] .wathba-hero-slide[data-state="idle"]{transform:translateX(var(--hero-enter)) scale(.985)}
              [data-pillar="ventures"] .wathba-hero-slide[data-state="prev"]{transform:translateX(calc(var(--hero-enter) * -.55)) scale(.99)}
              [data-pillar="ventures"] .wathba-hero-slide[data-state="current"]{transform:none;transition-delay:0s}
              /* Promote only the two slides in flight. will-change on all ten
                 made ten composited layers at first paint, which is a cost paid
                 before anything has moved. */
              [data-pillar="ventures"] .wathba-hero-slide[data-state="current"],
              [data-pillar="ventures"] .wathba-hero-slide[data-state="prev"]{will-change:transform,opacity}
              [data-pillar="ventures"] .wathba-hero-bar,
              [data-pillar="ventures"] .wathba-bar{transition:transform var(--dur-reveal) var(--ease-out)}
            }
            /* Grows from the reading start: right in Arabic, left in English.
               .wathba-bar is the same treatment for any funding bar outside the
               hero — see the note on the motion scale above. */
            [data-pillar="ventures"] .wathba-hero-bar,
            [data-pillar="ventures"] .wathba-bar{transform-origin:right center}
            [dir="ltr"] [data-pillar="ventures"] .wathba-hero-bar,
            [dir="ltr"] [data-pillar="ventures"] .wathba-bar{transform-origin:left center}
            [data-pillar="ventures"] .wathba-hero-ctl{width:36px;height:36px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:var(--card);color:var(--text);border:1px solid rgba(var(--ink-rgb),.14);transition:transform .16s ease,border-color .16s ease}
            @media (hover:hover) and (pointer:fine){
              [data-pillar="ventures"] .wathba-hero-ctl:hover{border-color:rgba(var(--accent-rgb),.55)}
            }
            [data-pillar="ventures"] .wathba-hero-ctl:active{transform:scale(.94)}

            /* ── HOME-REVIEW — press feedback on pressable cards ──────────
               The hero controls already answered a press; the project cards —
               the single most-clicked thing on the page — did not. A card that
               does not move under a finger reads as a picture of a card, and
               the reader waits for the navigation to tell them it worked.

               scale(.985) and no more: these are large surfaces, and a big
               card shrinking noticeably looks like it broke rather than like
               it responded. Transform only, so nothing reflows.

               Gated on no-preference like every other transition here, and the
               :active rule sits INSIDE the gate too — a reduced-motion reader
               gets an instant, untransitioned state change rather than none at
               all, which is the point of the preference, not its removal. */
            @media (prefers-reduced-motion: no-preference){
              [data-pillar="ventures"] .wathba-pressable{transition:transform var(--dur-press) var(--ease-out)}
              [data-pillar="ventures"] .wathba-pressable:active{transform:scale(.985)}
            }
            [data-pillar="ventures"] .wathba-hero-ctl:focus-visible,
            [data-pillar="ventures"] .wathba-hero-dot:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
            /* The BUTTON is 24x24 and never changes size; the visible pill is an
               inner span. Two reasons, both real:

               WCAG 2.2 SC 2.5.8 (AA) wants a 24x24 target unless the spacing
               exception applies. These dots were 8x8 with 8px gaps — centres
               16px apart, so the 24px exception circles overlap and it failed on
               both counts. The hit area is now 24x24 while the dot still LOOKS
               like an 8px dot.

               And the active dot used to animate the width property, which is
               layout: every
               tick reflowed the whole dot row. It is a transform now, so the row
               is static and nothing below it can move. */
            [data-pillar="ventures"] .wathba-hero-dot{width:24px;height:24px;padding:0;border:0;background:none;cursor:pointer;display:grid;place-items:center;border-radius:50%}
            [data-pillar="ventures"] .wathba-hero-dot-mark{width:8px;height:8px;border-radius:30px;background:rgba(var(--ink-rgb),.22);transition:transform .22s cubic-bezier(.22,.68,.24,1),background-color .22s ease;transform-origin:center}
            [data-pillar="ventures"] .wathba-hero-dot[data-active="1"] .wathba-hero-dot-mark{transform:scaleX(2.4);background:var(--accent)}
            /* Ten 24px targets do not fit between the arrows on a phone, and the
               tenth dot orphaned onto its own line. Below this width the arrows
               carry navigation on their own — they are 36px, the live region
               still announces each slide, and an orphaned dot is worse than no
               dot. The dots return as soon as there is room for all of them. */
            @media (max-width:520px){
              [data-pillar="ventures"] .wathba-hero-dots{display:none}
            }
            [data-pillar="ventures"] .wathba-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
            @media (max-width:880px){
              /* minmax(0,1fr), for the same reason as .wathba-home-hero above:
                 a grid item's min-width defaults to auto, so a 1fr track cannot
                 shrink below its content's min-content. Measured at 390px: the
                 duo's column resolved to 509px inside a 338px container and its
                 children sat at x = -145. Nothing ever reported it because
                 [data-pillar] sets overflow-x:clip, which makes scrollWidth
                 equal clientWidth — a page-level overflow check reads 0px while
                 the cards are being cut off. Pre-dates the stage; found while
                 screenshotting it. */
              [data-pillar="ventures"] .wathba-mag-duo{grid-template-columns:minmax(0,1fr)!important}
              [data-pillar="ventures"] .wathba-mag-row{grid-template-columns:1fr 1fr!important}
            }
            /* Stage 1 item 11 — «الرائجة» had NO responsive rule at all: a bare
               repeat(4,1fr) at every width, which measured 71px cards on a 390px
               phone. Three up on desktop (hero of discovery), two on tablet, one
               on a phone.

               The two queries are DISJOINT on purpose. Written as
               max-width:880 + min-width:761 they overlap between 761 and 880,
               and since both carry !important the later rule would win — the
               phone rule would have been silently dead across a 120px band.

               minmax(0,1fr) rather than 1fr for the same reason the duo above
               needed it: a 1fr track is sized by its content's min-content and
               will not shrink below it. */
            @media (max-width:620px){
              [data-pillar="ventures"] .wathba-trend-grid{grid-template-columns:minmax(0,1fr)!important;gap:18px!important}
            }
            @media (min-width:621px) and (max-width:1100px){
              [data-pillar="ventures"] .wathba-trend-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
            }
            @media (max-width:540px){
              [data-pillar="ventures"] .wathba-mag-row{grid-template-columns:1fr!important}
            }
            @media (max-width:980px){
              /* POLISH Unit 2 — spotlight stacks before the lead/rail split gets
                 cramped; the story trio drops to two up. */
              [data-pillar="ventures"] .wathba-spotlight-grid{grid-template-columns:1fr!important}
              [data-pillar="ventures"] .wathba-spotlight-stories{grid-template-columns:1fr 1fr!important}
            }
            @media (max-width:640px){
              [data-pillar="ventures"] .wathba-spotlight-stories{grid-template-columns:1fr!important}
            }
            @media (max-width:760px){
              [data-pillar="ventures"] .wathba-spotlight-hero{grid-template-columns:1fr!important;gap:26px!important;padding-top:44px!important}
              [data-pillar="ventures"] .wathba-hero-band{grid-template-columns:1fr!important}
              /* minmax(0,1fr), NOT 1fr. A grid item's min-width defaults to
                 auto, so a 1fr track cannot shrink below the item's min-content
                 — and the hero's four-stat row min-contents at ~377px. The
                 column blew 39px past the section's 338px content box, and it
                 re-resolved whenever text metrics settled: the stat row wrapped
                 a line, then unwrapped, ~30ms apart at ~1s. Two 0.14 shifts,
                 mobile CLS median 0.171 against 0.0001 on desktop. */
              [data-pillar="ventures"] .wathba-home-hero{grid-template-columns:minmax(0,1fr)!important;gap:26px!important;padding-top:34px!important}
              [data-pillar="ventures"] .wathba-discover-row{flex-direction:column!important;align-items:stretch!important}
              [data-pillar="ventures"] .wathba-discover-aside{width:100%!important}
            }
          `,
        }}
      />
      {/* The provider lives INSIDE this div, not around it. Its toasts and
       *  confirm dialog are emitted after {children}, so mounting it as the
       *  parent left them siblings of the themed element — `var(--card)`,
       *  `var(--text)`, `var(--grad)` and `var(--on-accent)` all resolved to
       *  nothing and the dialog's copy sat on the bare scrim at 3.74:1 in
       *  BOTH themes. Nothing here creates a containing block, so the
       *  overlays stay position:fixed against the viewport. */}
      <WathbaFeedbackProvider>
        <PageViewTracker />
        <WathbaHeader
          theme={theme}
          onToggleTheme={() => setAndPersistTheme(theme === 'dark' ? 'light' : 'dark')}
        />
        {/* NO framer-motion wrap on main — first paint must show content
         *  without waiting for hydration (SEO + no-JS users). Inner cards
         *  still use motion.div for soft entrances where the loss of
         *  visibility-on-load is acceptable. */}
        <main className="wathba-fade">{children}</main>
        <WathbaFooter />
      </WathbaFeedbackProvider>
    </div>
  );
}
