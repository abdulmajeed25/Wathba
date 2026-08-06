import { wathbaCssVars, type WathbaTheme } from './wathba-tokens';

/**
 * HOME-REVIEW D7 — the pillar's theme survives a reload, and a first-time
 * visitor gets the appearance their OS already asked for.
 *
 * Before this, the theme was `useState('light')` and nothing else: the toggle
 * worked, and then a refresh — or any navigation that remounted the shell —
 * put the reader back in light. A dark-mode reader had to re-toggle on every
 * visit, and a reader whose OS is set to dark was shown light regardless.
 *
 * WHY THIS IS NOT A COPY OF app/ops/_lib/theme.ts. The ops surface paints from
 * CSS rules keyed on `[data-theme]` in globals.css, so its pre-paint script
 * only has to stamp an attribute and the whole palette follows. Wathba does
 * the opposite: `wathbaCssVars[theme]` is spread as INLINE styles on the shell
 * wrapper (see wathba-tokens.ts — "React inline-style passes them verbatim"),
 * so an attribute alone changes nothing. This script therefore sets the custom
 * properties directly, by the same mechanism React uses, which is why there is
 * a palette embedded in it.
 *
 * That was the deliberate choice over the alternative — moving the palette out
 * to `[data-theme="dark"]` CSS rules. This shell's <style> block is IN THE
 * BODY, and a custom property declared there is briefly undefined: the
 * vertical-rhythm tokens were moved back inline for exactly that reason, at a
 * measured cost of 0.07 CLS. Declaring the palette there would have risked
 * `background: var(--bg)` resolving to nothing — a flash of unstyled colour,
 * which is the very thing this is meant to remove.
 */

export const THEME_KEY = 'wathba:theme';

/**
 * What the SERVER renders. The markup is identical for every visitor (this is
 * a static, cacheable shell — there is no per-request theme), so the script
 * below only ever has to upgrade light → dark, never the other way.
 */
export const SSR_THEME: WathbaTheme = 'light';

/** The stored choice wins; the OS preference is only the opening default. */
export function resolveTheme(): WathbaTheme {
  if (typeof window === 'undefined') return SSR_THEME;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_KEY);
  } catch {
    /* private mode / storage disabled — fall through to the OS preference */
  }
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : SSR_THEME;
}

export function persistTheme(theme: WathbaTheme): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* the toggle still applies for this session; it just will not outlive it */
  }
}

/**
 * Synchronous pre-paint initialiser, emitted as the first child of the shell
 * wrapper so it runs the instant that element is parsed — before first paint,
 * and well before hydration. Resolving this in a `useEffect` instead would
 * paint light first and correct it afterwards, which IS the flash.
 *
 * Any exception leaves the server's light rendering in place. Client-side
 * navigations do not re-run it (React does not execute inserted inline
 * scripts) — the shell's effect covers that case with the same rule.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var r=document.currentScript&&document.currentScript.parentElement;if(!r)return;
var t=null;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)});}catch(e){}
if(t!=='dark'&&t!=='light'){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':${JSON.stringify(SSR_THEME)};}
r.setAttribute('data-theme',t);
if(t!==${JSON.stringify(SSR_THEME)}){var v=${JSON.stringify(wathbaCssVars.dark)};for(var k in v){r.style.setProperty(k,v[k]);}}
}catch(e){}})();`;
