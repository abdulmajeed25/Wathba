/**
 * OPS Phase B (Unit 2) — theme + density state for the operator surface.
 *
 * The ops shell is styled with the hardcoded GitHub-dark palette baked into
 * Tailwind arbitrary values (`bg-[#0d1117]`, `text-[#8b949e]`, …) across every
 * screen. Rewriting each screen to CSS variables is out of scope (and out of
 * this unit's file ownership), so theming is done PRAGMATICALLY: a scoped set
 * of overrides in globals.css keyed off `data-theme`/`data-density` on the ops
 * root remaps that fixed palette per theme, and — for density — overrides the
 * Tailwind v4 `--spacing` token (every p-/gap-/space- utility resolves through
 * it) so «compact» tightens the whole surface without touching a single screen.
 *
 * Dark stays the default look; light is a real, WCAG-1.4.3-compliant theme.
 * Initial default respects `prefers-color-scheme`; the operator's explicit
 * choice (localStorage) always wins. This module is import-safe on both server
 * and client (pure constants + string builder + guarded client helpers).
 */

export type OpsTheme = 'dark' | 'light';
export type OpsDensity = 'comfortable' | 'compact';

export const THEME_KEY = 'ops:theme';
export const DENSITY_KEY = 'ops:density';

export const THEMES: OpsTheme[] = ['dark', 'light'];
export const DENSITIES: OpsDensity[] = ['comfortable', 'compact'];

export const THEME_LABEL: Record<OpsTheme, string> = {
  dark: 'داكن',
  light: 'فاتح',
};
export const DENSITY_LABEL: Record<OpsDensity, string> = {
  comfortable: 'مريح',
  compact: 'مضغوط',
};

/**
 * Synchronous pre-paint initialiser. Emitted as an inline classic <script> as
 * the FIRST child of the ops root so it runs the instant that element is
 * parsed — no flash of the wrong theme. It resolves the stored choice, falling
 * back to the OS appearance preference (dark otherwise), and stamps the
 * attributes on its own parent element (the ops root). Kept tiny + dependency
 * free; any exception silently leaves the SSR defaults (dark/comfortable).
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var r=document.currentScript&&document.currentScript.parentElement;if(!r)return;
var t=null;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)});}catch(e){}
if(t!=='dark'&&t!=='light'){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark';}
var d=null;try{d=localStorage.getItem(${JSON.stringify(DENSITY_KEY)});}catch(e){}
if(d!=='comfortable'&&d!=='compact'){d='comfortable';}
r.setAttribute('data-theme',t);r.setAttribute('data-density',d);
}catch(e){}})();`;

/** The ops root element (identified for the client toggle). */
export function opsRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById('ops-root');
}

export function readTheme(): OpsTheme {
  if (typeof document === 'undefined') return 'dark';
  const attr = opsRoot()?.getAttribute('data-theme');
  return attr === 'light' ? 'light' : 'dark';
}

export function readDensity(): OpsDensity {
  if (typeof document === 'undefined') return 'comfortable';
  const attr = opsRoot()?.getAttribute('data-density');
  return attr === 'compact' ? 'compact' : 'comfortable';
}

export function applyTheme(theme: OpsTheme): void {
  const r = opsRoot();
  if (!r) return;
  r.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode — the attribute still applies for this session */
  }
}

export function applyDensity(density: OpsDensity): void {
  const r = opsRoot();
  if (!r) return;
  r.setAttribute('data-density', density);
  try {
    localStorage.setItem(DENSITY_KEY, density);
  } catch {
    /* private mode — the attribute still applies for this session */
  }
}
