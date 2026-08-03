'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';

import { PageViewTracker } from '@/components/analytics/page-view-tracker';
import { WathbaFeedbackProvider } from './wathba-feedback';
import { WathbaFooter } from './wathba-footer';
import { WathbaHeader } from './wathba-header';
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
  defaultTheme = 'light',
}: {
  children: ReactNode;
  defaultTheme?: WathbaTheme;
}) {
  const [theme, setTheme] = useState<WathbaTheme>(defaultTheme);

  const styleVars: CSSProperties = {
    ...(wathbaCssVars[theme] as unknown as CSSProperties),
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
              [data-pillar="ventures"] .wathba-account-slot{min-width:0}
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
              [data-pillar="ventures"] .wathba-hero-bar{transition:transform 1.1s cubic-bezier(.2,.7,.2,1)}
            }
            /* Grows from the reading start: right in Arabic, left in English. */
            [data-pillar="ventures"] .wathba-hero-bar{transform-origin:right center}
            [dir="ltr"] [data-pillar="ventures"] .wathba-hero-bar{transform-origin:left center}
            [data-pillar="ventures"] .wathba-hero-ctl{width:36px;height:36px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:var(--card);color:var(--text);border:1px solid rgba(var(--ink-rgb),.14);transition:transform .16s ease,border-color .16s ease}
            @media (hover:hover) and (pointer:fine){
              [data-pillar="ventures"] .wathba-hero-ctl:hover{border-color:rgba(var(--accent-rgb),.55)}
            }
            [data-pillar="ventures"] .wathba-hero-ctl:active{transform:scale(.94)}
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
              [data-pillar="ventures"] .wathba-mag-duo{grid-template-columns:1fr!important}
              [data-pillar="ventures"] .wathba-mag-row{grid-template-columns:1fr 1fr!important}
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
              [data-pillar="ventures"] .wathba-home-hero{grid-template-columns:1fr!important;gap:26px!important;padding-top:34px!important}
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
        <WathbaHeader theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
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
