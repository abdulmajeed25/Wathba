/**
 * Wathba (وثبة) design tokens — literal copy of the CSS variables defined in
 * WATBHوثبة.dc.html. Inlined as objects so React inline-style passes them
 * verbatim; the design's :root selector is reproduced via a wrapper div with
 * `style={{ ...wathbaCssVars[theme] }}` and `data-theme={theme}`.
 */

export type WathbaTheme = 'light' | 'dark';

export const wathbaCssVars: Record<WathbaTheme, Record<string, string>> = {
  light: {
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
    '--muted': '#5d6b62',
    '--muted2': '#8a958c',
    '--ph-label': '#9aa7a0',
    '--ink-rgb': '18,33,26',
    '--accent': '#05a661',
    '--accent-rgb': '5,166,97',
    '--accent2-rgb': '6,140,110',
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
    '--bg': '#0a1422',
    '--surface': '#102339',
    '--surface2': '#0c1c2f',
    '--footer': '#08111d',
    '--ph-bg': '#0e2138',
    '--card': 'linear-gradient(180deg,#102339,#0c1c2f)',
    '--band': 'linear-gradient(120deg,#0d2236,#0b1a2c)',
    '--avatar': 'linear-gradient(135deg,#1d3251,#0c1c2f)',
    '--text': '#eaf1fb',
    '--text-soft': '#c3d3e8',
    '--muted': '#9fb3cf',
    '--muted2': '#7f95b3',
    '--ph-label': '#3d5876',
    '--ink-rgb': '255,255,255',
    '--accent': '#22d3ee',
    '--accent-rgb': '34,211,238',
    '--accent2-rgb': '59,130,246',
    '--on-accent': '#06121f',
    '--header-bg': 'rgba(10,20,34,.72)',
    '--grad': 'linear-gradient(135deg,#3b82f6,#22d3ee)',
    '--grad-bar': 'linear-gradient(90deg,#3b82f6,#22d3ee)',
    '--grad-bar-over': 'linear-gradient(90deg,#22d3ee,#34d399)',
    '--grad-barv': 'linear-gradient(180deg,#22d3ee,#3b82f6)',
    '--cta-grad': 'linear-gradient(120deg,#1d4ed8,#0891b2,#3b82f6)',
    '--gold': '#fbbf24',
    '--gold-rgb': '251,191,36',
    '--pos': '#34d399',
    '--pos-rgb': '52,211,153',
    '--purple': '#a78bfa',
    '--purple-rgb': '167,139,250',
    '--blue': '#60a5fa',
    '--blue-rgb': '96,165,250',
    '--err': '#f87171',
    '--err-rgb': '248,113,113',
    '--rank-silver': '#cbd5e1',
    '--card-shadow': 'none',
    '--card-shadow-h': '0 22px 48px -24px rgba(0,0,0,.8)',
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
