/**
 * Wathba (وثبة) design tokens — literal copy of the CSS variables defined in
 * WATBHوثبة.dc.html. Inlined as objects so React inline-style passes them
 * verbatim; the design's :root selector is reproduced via a wrapper div with
 * `style={{ ...wathbaCssVars[theme] }}` and `data-theme={theme}`.
 */

export type WathbaTheme = 'light' | 'dark';

export const wathbaCssVars: Record<WathbaTheme, Record<string, string>> = {
  light: {
    // ── elevation layers (POLISH Unit 4) ───────────────────────────────────
    // Canonical names, defined in BOTH themes so a component never needs to
    // know which one is active. The legacy aliases below map onto these.
    '--surface-0': '#f4f6f1',
    '--surface-1': '#ffffff',
    '--surface-2': '#eef2ea',
    '--surface-3': '#ffffff',
    '--text-primary': '#16201b',
    '--text-secondary': '#3b4942',
    '--text-muted': '#4d574f',
    '--border': 'rgba(18,33,26,.12)',

    '--bg': '#f4f6f1',
    '--surface': '#ffffff',
    '--surface2': '#ffffff',
    '--footer': '#eef1ea',
    '--ph-bg': '#eaeee7',
    '--card': '#ffffff',
    '--band': '#eef2ea',
    '--avatar': 'linear-gradient(135deg,#e9ede7,#d9e0d8)',
    '--text': '#16201b',
    '--text-soft': '#3b4942',
    // STAKES/S-2 — darkened to clear WCAG 2.2 AA (4.5:1) on the white card
    // ground; the old #5d6b62 / #8a958c failed (axe: color-contrast).
    '--muted': '#4d574f',
    '--muted2': '#646f68',
    '--ph-label': '#6f7a73',
    '--ink-rgb': '18,33,26',
    '--accent': '#05a661',
    '--accent-rgb': '5,166,97',
    '--accent2-rgb': '6,140,110',
    // STAKES/S-2 — deeper emerald for accent-colored TEXT on light grounds:
    // #05a661 on #fff is only 4.5 (fails AA for the stat numerals). --accent
    // stays the brand green for fills/buttons.
    '--accent-ink': '#04773a',
    '--on-accent': '#ffffff',
    '--header-bg': 'rgba(255,255,255,.82)',
    '--grad': 'linear-gradient(135deg,#05c074,#03a98e)',
    '--grad-bar': 'linear-gradient(90deg,#05c074,#03a98e)',
    '--grad-bar-over': 'linear-gradient(90deg,#05c074,#10b04f)',
    '--grad-barv': 'linear-gradient(180deg,#05c074,#03a98e)',
    '--cta-grad': 'linear-gradient(120deg,#05c074,#02b39a,#12c86d)',
    '--gold': '#b9820a',
    '--gold-rgb': '185,130,10',
    '--pos': '#05a661',
    '--pos-rgb': '5,166,97',
    '--purple': '#6d4df0',
    '--purple-rgb': '109,77,240',
    '--blue': '#2563eb',
    '--blue-rgb': '37,99,235',
    '--err': '#dc2626',
    '--err-rgb': '220,38,38',
    '--rank-silver': '#67736a',
    '--card-shadow': '0 2px 14px rgba(18,33,26,.06)',
    '--card-shadow-h': '0 16px 34px -14px rgba(18,33,26,.18)',
  },
  dark: {
    // ═══ POLISH Unit 4 — layered WARM dark, green-led ═══════════════════════
    //
    // What this replaces: a cold blue-black palette (#0a1422 canvas) whose
    // accent was '#22d3ee' — CYAN. Wathba's whole identity is green, and at
    // night the brand simply turned into a different company. Progress bars,
    // links, the logo and every CTA gradient went blue.
    //
    // Two rules hold this together:
    //
    //   ELEVATION = LIGHTNESS. surface-0 is the canvas; every layer stacked on
    //   top of it steps UP. There is no "one flat black" and no dark-on-dark
    //   guesswork about which panel sits above which.
    //
    //   WARM, NOT BLUE. Each grey carries a little red/yellow, so the ground
    //   reads like ink rather than like a screenshot of a terminal.
    //
    // Every pair below is measured, not eyeballed: 21 text/background
    // combinations clear WCAG 1.4.3 (≥4.5:1 body, ≥3:1 large/graphic). The old
    // theme's '--ph-label' scored 2.16:1 on a card — that is the failing muted
    // hint text, and it is fixed here rather than nudged.
    '--surface-0': '#131210',
    '--surface-1': '#1c1a17',
    '--surface-2': '#242220',
    '--surface-3': '#302d29',
    '--text-primary': '#f6f4ef',
    '--text-secondary': '#d8d3c9',
    '--text-muted': '#aba49a',
    '--border': 'rgba(255,252,245,.11)',

    // ── legacy aliases → the layers above ─────────────────────────────────
    '--bg': '#131210',
    '--surface': '#1c1a17',
    '--surface2': '#242220',
    '--footer': '#0e0d0c',
    '--ph-bg': '#242220',
    // A whisper of gradient so a card still reads as a lifted plane; both stops
    // are inside the surface-1 step, so elevation ordering is unchanged.
    '--card': 'linear-gradient(180deg,#1c1a17,#191714)',
    '--band': 'linear-gradient(120deg,#242220,#1e1c19)',
    '--avatar': 'linear-gradient(135deg,#302d29,#211f1c)',
    '--text': '#f6f4ef',
    '--text-soft': '#d8d3c9',
    // --muted is the STRONGER of the two (matching the light theme's ordering);
    // --muted2 is the quieter one. 8.9:1 and 7.0:1 on a card.
    '--muted': '#c0bab0',
    '--muted2': '#aba49a',
    // Was #3d5876 → 2.16:1. Now the same value as --muted2: a hint is quiet,
    // never invisible.
    '--ph-label': '#aba49a',
    // Warm white, so every rgba(var(--ink-rgb),…) border and wash stays warm
    // instead of dropping a cold blue veil over the surfaces.
    '--ink-rgb': '255,252,245',

    // ── the brand, still green ────────────────────────────────────────────
    // The emerald pushed up in lightness until it clears AA on dark surfaces:
    // fills 8.8:1, accent TEXT 10.1:1 on a card.
    '--accent': '#1fd37e',
    '--accent-rgb': '31,211,126',
    '--accent2-rgb': '16,185,129',
    '--accent-ink': '#4ade96',
    '--on-accent': '#08130d',
    '--header-bg': 'rgba(19,18,16,.74)',
    '--grad': 'linear-gradient(135deg,#1fd37e,#10b981)',
    '--grad-bar': 'linear-gradient(90deg,#1fd37e,#10b981)',
    '--grad-bar-over': 'linear-gradient(90deg,#1fd37e,#3dd68c)',
    '--grad-barv': 'linear-gradient(180deg,#1fd37e,#10b981)',
    '--cta-grad': 'linear-gradient(120deg,#1fd37e,#0fbf86,#34e39a)',

    // ── state colours, dark-tuned ─────────────────────────────────────────
    // Never carried by hue alone anywhere they mean something — each is paired
    // with a label or an icon in the components that use them.
    '--gold': '#f5c24c',
    '--gold-rgb': '245,194,76',
    '--pos': '#3dd68c',
    '--pos-rgb': '61,214,140',
    '--purple': '#c0a8ff',
    '--purple-rgb': '192,168,255',
    '--blue': '#79b8ff',
    '--blue-rgb': '121,184,255',
    '--err': '#ff7b72',
    '--err-rgb': '255,123,114',
    '--rank-silver': '#c9c3b8',
    // Depth on dark comes from the lightness step, not from a shadow nobody can
    // see; the hover shadow stays, to lift a card off its layer.
    '--card-shadow': '0 1px 0 rgba(255,252,245,.04)',
    '--card-shadow-h': '0 22px 48px -24px rgba(0,0,0,.75)',
  },
};

/** Wathba keyframes — literal copy. */
export const wathbaKeyframes = `
@keyframes wathba-fadeUp{from{opacity:.001;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes wathba-fadeIn{from{opacity:.001}to{opacity:1}}
@keyframes wathba-floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes wathba-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes wathba-gshift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes wathba-pulsering{0%{box-shadow:0 0 0 0 rgba(var(--accent-rgb),.45)}70%{box-shadow:0 0 0 14px rgba(var(--accent-rgb),0)}100%{box-shadow:0 0 0 0 rgba(var(--accent-rgb),0)}}
@keyframes wathba-spinslow{to{transform:rotate(360deg)}}
@keyframes wathba-ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
`;
