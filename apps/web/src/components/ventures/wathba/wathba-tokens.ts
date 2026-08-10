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
    // Was #6f7a73 → 3.80:1 on --ph-bg (#eaeee7), the placeholder's own ground.
    // A hint is quiet, never unreadable — same rule the dark theme follows.
    '--ph-label': '#5c665f',
    '--ink-rgb': '18,33,26',
    '--accent': '#05a661',
    '--accent-rgb': '5,166,97',
    '--accent2-rgb': '6,140,110',
    // Deeper emerald for accent-coloured TEXT on light grounds. --accent stays
    // the brand green for fills/buttons.
    //
    // CORRECTION: the note that used to sit here said "#05a661 on #fff is only
    // 4.5". It is 3.17 — the original measurement was taken with a sampler that
    // could not composite, and the wrong number made --accent look borderline
    // rather than failing. Anything painting TEXT with var(--accent) on a light
    // ground fails 1.4.3; that is what --accent-ink is for.
    '--accent-ink': '#04773a',
    // The ink that goes ON the brand green — buttons, badges, the logo mark.
    // Was #ffffff: white on --grad's lightest stop is 2.39:1, which made every
    // primary CTA on the public site fail. The dark theme already puts dark ink
    // on its green; light now does the same, so the GREEN ITSELF is unchanged
    // and only what sits on top of it moves. 5.98:1 against the worst of the
    // six accent grounds (#05a661, and the five gradient stops).
    '--on-accent': '#08130d',
    // The LOGO MARK — the rocket glyph inside the green square, in the header
    // and footer lockups. Same story as --chip-fill below: it borrowed
    // --on-accent, and when that token became dark ink for contrast reasons the
    // brand mark went black with it, in both themes. A logo is not copy. The
    // 3:1 of WCAG 1.4.11 covers "graphics required to understand the content" —
    // the rocket is not, because the wordmark «وثبة» sits beside it as real
    // text and carries the name. So this one is chosen to LOOK right: white on
    // the green square, 2.39:1 in light and 1.97:1 in dark. Both are below 3:1
    // and that is deliberate, not an oversight.
    '--logo-mark': '#ffffff',
    // ── ON A DARK SCRIM ────────────────────────────────────────────────────
    // A handful of overlays (the category pill and bookmark button on a card
    // image, the «مميّز» badge) paint a fixed near-black scrim in BOTH themes.
    // Their ink therefore cannot be a theme token: --text-soft on that scrim is
    // 1.16:1 in light and fine in dark, which is exactly how it shipped. These
    // three are identical in both themes and are measured against the WORST
    // case — the scrim over pure white, rgb(56,65,76): 9.60, 6.00, 6.26.
    // The INVERSE chip that sits on the accent band («ابدأ مشروعك الآن»). It
    // used to borrow --on-accent as its fill, which broke the moment that token
    // became dark ink: fill and text were then both dark (1.13:1). A fill needs
    // its own name.
    '--chip-fill': '#ffffff',
    '--chip-ink': '#16201b',
    '--on-scrim': '#f4f7f5',
    '--on-scrim-accent': '#4ade96',
    '--on-scrim-gold': '#f5c24c',
    /**
     * HOME-REVIEW — the STAGE. Identical in both themes, on purpose, exactly
     * like the --on-scrim set directly above: «مشروع مميز» keeps a dark ground
     * in light mode too, because changing the ground is the cheapest and
     * strongest "new chapter" signal a page has, and the review found the
     * homepage had none — 13 of 15 sections shared one container and one card.
     *
     * The values are the DARK theme's own canvas, surface, text and muted. That
     * is not a coincidence and not a copy-paste: reusing a pair the dark theme
     * already ships means the contrast is already proven (the dark sweep
     * measures 0 failures across 1,259 samples), instead of inventing a new
     * foreground/background pair that nothing has ever measured.
     */
    '--stage': '#131210',

    // ── creator-dashboard vocabulary → the layers above ───────────────────
    // Batch PAGE-PARITY. The 22 dashboard components were written against a
    // PARALLEL set of names that never existed in this file: 224 usages of
    // --bg-base, --bg-elevated, --border-subtle, --border-strong,
    // --text-tertiary, --brand-primary, --brand-ink and --on-brand. Every one
    // carried an inline hex fallback, so nothing looked broken — the surface
    // simply painted its fallbacks and never followed the theme. Switching to
    // dark left all 18 sub-pages white, with an indigo accent instead of the
    // green identity.
    //
    // Aliased rather than renamed at 224 call sites: this file already works
    // that way for the legacy names below, one mapping is auditable where 224
    // edits are not, and any other surface reaching for these names is fixed
    // by the same change.
    '--bg-base': '#f4f6f1',
    '--bg-elevated': '#ffffff',
    '--border-subtle': 'rgba(18,33,26,.12)',
    '--border-strong': 'rgba(18,33,26,.16)',
    '--text-tertiary': '#646f68',
    '--brand-primary': '#05a661',
    '--brand-ink': '#04773a',
    '--on-brand': '#08130d',
    '--stage-1': '#1c1a17',
    '--stage-text': '#f6f4ef',
    '--stage-muted': '#c0bab0',
    '--header-bg': 'rgba(255,255,255,.82)',
    '--grad': 'linear-gradient(135deg,#05c074,#03a98e)',
    '--grad-bar': 'linear-gradient(90deg,#05c074,#03a98e)',
    '--grad-bar-over': 'linear-gradient(90deg,#05c074,#10b04f)',
    '--grad-barv': 'linear-gradient(180deg,#05c074,#03a98e)',
    '--cta-grad': 'linear-gradient(120deg,#05c074,#02b39a,#12c86d)',
    '--gold': '#b9820a',
    '--gold-rgb': '185,130,10',
    // --gold is a FILL (rank badges, medals). As text on a light ground it is
    // 3.35:1, so accent-coloured gold copy («سفير») gets its own darker ink,
    // exactly as --accent/--accent-ink are split. 5.83:1 at worst.
    '--gold-ink': '#7a5305',
    '--pos': '#05a661',
    // Same fill/ink split as the accent: --pos is a bar/dot fill, --pos-ink is
    // the readable value for POSITIVE copy on a light ground (--pos as text is
    // 2.70:1 at worst).
    '--pos-ink': '#046b40',
    '--pos-rgb': '5,166,97',
    '--purple': '#6d4df0',
    // Same split again. --purple is 4.49:1 on the profile band #ebede9, which
    // is a fill ratio; «داعم مؤسس» is copy, so it reads from --purple-ink.
    // 4.64:1 at worst, and close enough to the fill that the rank still looks
    // like the same purple.
    '--purple-ink': '#6a4be9',
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
    // The square behind the mark is GREEN in this theme too — it is not the
    // dark header ground — so the mark stays white here for exactly the reason
    // it is white in light. See the light theme's note.
    '--logo-mark': '#ffffff',
    // ── ON A DARK SCRIM ────────────────────────────────────────────────────
    // A handful of overlays (the category pill and bookmark button on a card
    // image, the «مميّز» badge) paint a fixed near-black scrim in BOTH themes.
    // Their ink therefore cannot be a theme token: --text-soft on that scrim is
    // 1.16:1 in light and fine in dark, which is exactly how it shipped. These
    // three are identical in both themes and are measured against the WORST
    // case — the scrim over pure white, rgb(56,65,76): 9.60, 6.00, 6.26.
    '--chip-fill': '#08130d',
    '--chip-ink': '#f6f4ef',
    '--on-scrim': '#f4f7f5',
    '--on-scrim-accent': '#4ade96',
    '--on-scrim-gold': '#f5c24c',
    /**
     * HOME-REVIEW — the STAGE. Identical in both themes, on purpose, exactly
     * like the --on-scrim set directly above: «مشروع مميز» keeps a dark ground
     * in light mode too, because changing the ground is the cheapest and
     * strongest "new chapter" signal a page has, and the review found the
     * homepage had none — 13 of 15 sections shared one container and one card.
     *
     * The values are the DARK theme's own canvas, surface, text and muted. That
     * is not a coincidence and not a copy-paste: reusing a pair the dark theme
     * already ships means the contrast is already proven (the dark sweep
     * measures 0 failures across 1,259 samples), instead of inventing a new
     * foreground/background pair that nothing has ever measured.
     */
    '--stage': '#131210',

    // ── creator-dashboard vocabulary → the layers above ───────────────────
    // Batch PAGE-PARITY. The 22 dashboard components were written against a
    // PARALLEL set of names that never existed in this file: 224 usages of
    // --bg-base, --bg-elevated, --border-subtle, --border-strong,
    // --text-tertiary, --brand-primary, --brand-ink and --on-brand. Every one
    // carried an inline hex fallback, so nothing looked broken — the surface
    // simply painted its fallbacks and never followed the theme. Switching to
    // dark left all 18 sub-pages white, with an indigo accent instead of the
    // green identity.
    //
    // Aliased rather than renamed at 224 call sites: this file already works
    // that way for the legacy names below, one mapping is auditable where 224
    // edits are not, and any other surface reaching for these names is fixed
    // by the same change.
    '--bg-base': '#131210',
    '--bg-elevated': '#1c1a17',
    '--border-subtle': 'rgba(255,252,245,.11)',
    '--border-strong': 'rgba(255,252,245,.16)',
    '--text-tertiary': '#aba49a',
    '--brand-primary': '#1fd37e',
    '--brand-ink': '#4ade96',
    '--on-brand': '#08130d',
    '--stage-1': '#1c1a17',
    '--stage-text': '#f6f4ef',
    '--stage-muted': '#c0bab0',
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
    // On dark surfaces the fill is already the readable value; the split exists
    // so components can say "gold TEXT" without knowing which theme they're in.
    '--gold-ink': '#f5c24c',
    '--pos': '#3dd68c',
    '--pos-ink': '#3dd68c',
    '--pos-rgb': '61,214,140',
    '--purple': '#c0a8ff',
    '--purple-ink': '#c0a8ff',
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
