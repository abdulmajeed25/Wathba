'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

import { wathbaCssVars, type WathbaTheme } from './wathba-tokens';
import { resolveTheme, SSR_THEME, THEME_INIT_SCRIPT } from './wathba-theme';

/**
 * The palette, without the site chrome.
 *
 * Batch PAGE-PARITY. `WathbaShell` is two things welded together: the themed
 * root (this) and the public chrome (header, footer, page-view tracking). Every
 * surface needs the first; the creator dashboard deliberately does not want the
 * second — it has its own sidebar and no site footer.
 *
 * Before this existed the dashboard had no way to take one without the other,
 * so it took neither: 18 sub-pages rendered outside the design system entirely,
 * stayed light when the reader had chosen dark, and painted an indigo accent
 * instead of the green identity. Wrapping them in the full shell would have
 * ADDED a site header to a surface that has its own — a redesign, not the
 * propagation this batch is for.
 *
 * So the theme layer becomes a primitive that both shells compose. `WathbaShell`
 * is unchanged in behaviour; it now renders its chrome inside this.
 *
 * Why the palette is inline styles rather than `[data-theme]` CSS rules is
 * answered at length in wathba-theme.ts — the short version is that this
 * shell's <style> block lives in the body, where a custom property is briefly
 * undefined, and moving the palette there was measured at 0.07 CLS.
 *
 * DELIBERATE DUPLICATION, for now. `WathbaShell` still carries its own copy of
 * this wrapper. Collapsing it onto this primitive means handing the header a
 * setter, and the homepage carries measured LCP ≤704ms / CLS ≤0.0012 gates that
 * a restructure of its root would put at risk for no user-visible gain. The
 * dashboard is what has no theme today, so that is what this fixes. Unifying
 * the two is a follow-up with the homepage gates re-measured, not a drive-by.
 */
export function WathbaThemeRoot({
  children,
  defaultTheme = SSR_THEME,
  style,
}: {
  children: ReactNode;
  defaultTheme?: WathbaTheme;
  /** Extra styles merged onto the themed element (layout, not colour). */
  style?: CSSProperties;
}) {
  const [theme, setTheme] = useState<WathbaTheme>(defaultTheme);

  // AFTER first paint, deliberately: on a hard load THEME_INIT_SCRIPT has
  // already put the right palette on this element, so this only brings React's
  // state into line with what is on screen. On a client-side navigation the
  // script does not re-run — React never executes an inserted inline script —
  // and then this IS the mechanism. Both paths resolve by the same rule.
  useEffect(() => {
    setTheme(resolveTheme());
  }, []);

  const styleVars: CSSProperties = {
    ...(wathbaCssVars[theme] as unknown as CSSProperties),
    fontFamily: "'IBM Plex Sans Arabic', sans-serif",
    WebkitFontSmoothing: 'antialiased',
    direction: 'rtl',
    minHeight: '100vh',
    transition: 'background .4s, color .4s',
    // INHERITED TEXT COLOUR, and it has to be here.
    //
    // globals.css sets `body { color: var(--text-primary) }`, and at BODY scope
    // that resolves from :root — which declares the light palette. Any element
    // inside this wrapper that does not set its own colour therefore inherited
    // #16201b straight through the dark theme. The milestones <h1> is a plain
    // `<h1 style={{fontSize:26,fontWeight:700}}>` with no colour of its own, and
    // it measured 1.04:1 against the dark ground — a heading you cannot see.
    //
    // Re-declaring it HERE re-resolves the same variable inside the themed
    // scope, so everything below inherits the right ink without touching a
    // single component. Anything that sets its own colour still wins.
    color: 'var(--text-primary)',
    ...style,
  };

  return (
    <div data-theme={theme} data-pillar="ventures" style={styleVars}>
      {/* FIRST child, deliberately. It reads
       *  `document.currentScript.parentElement`, so it must sit inside the
       *  element it themes, and it must run before anything below it paints. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      {children}
    </div>
  );
}
