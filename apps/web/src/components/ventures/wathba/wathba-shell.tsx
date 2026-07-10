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
    <WathbaFeedbackProvider>
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
            @media (max-width:760px){
              [data-pillar="ventures"] .wathba-hero-band{grid-template-columns:1fr!important}
              [data-pillar="ventures"] .wathba-home-hero{grid-template-columns:1fr!important;gap:26px!important;padding-top:34px!important}
              [data-pillar="ventures"] .wathba-discover-row{flex-direction:column!important;align-items:stretch!important}
              [data-pillar="ventures"] .wathba-discover-aside{width:100%!important}
            }
          `,
        }}
      />
      <PageViewTracker />
      <WathbaHeader theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
      {/* NO framer-motion wrap on main — first paint must show content
       *  without waiting for hydration (SEO + no-JS users). Inner cards
       *  still use motion.div for soft entrances where the loss of
       *  visibility-on-load is acceptable. */}
      <main className="wathba-fade">{children}</main>
      <WathbaFooter />
    </div>
    </WathbaFeedbackProvider>
  );
}
