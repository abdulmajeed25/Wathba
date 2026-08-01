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
               Below 880px the desktop login link is hidden and the header is
               tight, so the reservation is dropped there. */
            [data-pillar="ventures"] .wathba-account-slot{min-width:206px;height:42px;display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-shrink:0;white-space:nowrap}
            @media (max-width:880px){
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
            @media (max-width:880px){
              [data-pillar="ventures"] .wathba-desk-only{display:none!important}
              [data-pillar="ventures"] .wathba-mob-only{display:inline-flex!important}
              [data-pillar="ventures"] .wathba-mob-sheet{display:flex}
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
