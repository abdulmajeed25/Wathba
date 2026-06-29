'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';

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
            [data-pillar="ventures"] .wathba-ph{background-color:var(--ph-bg);background-image:repeating-linear-gradient(135deg,rgba(var(--accent-rgb),.07) 0,rgba(var(--accent-rgb),.07) 2px,transparent 2px,transparent 11px)}
            [data-pillar="ventures"] .wathba-fade{animation:wathba-fadeUp .45s ease both}
          `,
        }}
      />
      <WathbaHeader theme={theme} onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} />
      {/* NO framer-motion wrap on main — first paint must show content
       *  without waiting for hydration (SEO + no-JS users). Inner cards
       *  still use motion.div for soft entrances where the loss of
       *  visibility-on-load is acceptable. */}
      <main className="wathba-fade">{children}</main>
      <WathbaFooter />
    </div>
  );
}
