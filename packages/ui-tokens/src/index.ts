/**
 * Wathba design tokens — typed module mirror of tokens.css.
 * Lets non-CSS consumers (charts, generated docs) pull the same values.
 * Keep in sync with tokens.css.
 */

export type ThemeName = 'light' | 'dark';

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  footer: string;
  phBg: string;
  card: string;
  band: string;
  text: string;
  textSoft: string;
  muted: string;
  muted2: string;
  phLabel: string;
  inkRgb: string;
  accent: string;
  accentRgb: string;
  accent2Rgb: string;
  onAccent: string;
  headerBg: string;
  grad: readonly [string, string];
  gradBar: readonly [string, string];
  gradBarOver: readonly [string, string];
  gradBarV: readonly [string, string];
  ctaGrad: readonly [string, string, string];
  gold: string;
  pos: string;
  purple: string;
  blue: string;
  rankSilver: string;
  cardShadow: string;
  cardShadowH: string;
}

export const light: Palette = {
  bg: '#f4f6f1',
  surface: '#ffffff',
  surface2: '#ffffff',
  footer: '#eef1ea',
  phBg: '#eaeee7',
  card: '#ffffff',
  band: '#eef2ea',
  text: '#16201b',
  textSoft: '#3b4942',
  muted: '#5d6b62',
  muted2: '#8a958c',
  phLabel: '#9aa7a0',
  inkRgb: '18,33,26',
  accent: '#05a661',
  accentRgb: '5,166,97',
  accent2Rgb: '6,140,110',
  onAccent: '#ffffff',
  headerBg: 'rgba(255,255,255,0.82)',
  grad: ['#05c074', '#03a98e'] as const,
  gradBar: ['#05c074', '#03a98e'] as const,
  gradBarOver: ['#05c074', '#10b04f'] as const,
  gradBarV: ['#05c074', '#03a98e'] as const,
  ctaGrad: ['#05c074', '#02b39a', '#12c86d'] as const,
  gold: '#b9820a',
  pos: '#05a661',
  purple: '#6d4df0',
  blue: '#2563eb',
  rankSilver: '#67736a',
  cardShadow: '0 2px 14px rgba(18,33,26,0.06)',
  cardShadowH: '0 16px 34px -14px rgba(18,33,26,0.18)',
};

export const dark: Palette = {
  bg: '#0a1422',
  surface: '#102339',
  surface2: '#0c1c2f',
  footer: '#08111d',
  phBg: '#0e2138',
  card: '#102339',
  band: '#0d2236',
  text: '#eaf1fb',
  textSoft: '#c3d3e8',
  muted: '#9fb3cf',
  muted2: '#7f95b3',
  phLabel: '#3d5876',
  inkRgb: '255,255,255',
  accent: '#22d3ee',
  accentRgb: '34,211,238',
  accent2Rgb: '59,130,246',
  onAccent: '#06121f',
  headerBg: 'rgba(10,20,34,0.72)',
  grad: ['#3b82f6', '#22d3ee'] as const,
  gradBar: ['#3b82f6', '#22d3ee'] as const,
  gradBarOver: ['#22d3ee', '#34d399'] as const,
  gradBarV: ['#22d3ee', '#3b82f6'] as const,
  ctaGrad: ['#1d4ed8', '#0891b2', '#3b82f6'] as const,
  gold: '#fbbf24',
  pos: '#34d399',
  purple: '#a78bfa',
  blue: '#60a5fa',
  rankSilver: '#cbd5e1',
  cardShadow: 'none',
  cardShadowH: '0 22px 48px -24px rgba(0,0,0,0.8)',
};

export const palettes: Record<ThemeName, Palette> = { light, dark };

export const fonts = {
  arabic: 'var(--font-arabic), "IBM Plex Sans Arabic", system-ui, sans-serif',
  grotesk: 'var(--font-grotesk), "Space Grotesk", system-ui, sans-serif',
} as const;

/** Spacing scale (superset of prototype's actual values). */
export const spacing = {
  0: 0, 1: 4, 2: 8, 3: 12, '3.5': 14, 4: 16, '4.5': 18, 5: 20, '5.5': 22,
  6: 24, '6.5': 26, 7: 28, 8: 32, 9: 36, 10: 40, 11: 44, 14: 56, 18: 72,
} as const;

/** Border-radii — every distinct value used in the prototype. */
export const radii = {
  none: 0,
  xs: 8,
  sm: 9,
  md: 10,
  lg: 11,
  pad: 12,
  brand: 13,
  btn: 14,
  card: 16,
  cardLg: 18,
  cardXl: 20,
  cardHero: 22,
  cardFeatured: 24,
  cardBand: 26,
  cardCta: 28,
  pill: 30,
  circle: 9999,
} as const;

export const fontSizes = {
  '9.5': 9.5, '11': 11, '11.5': 11.5, '12': 12, '12.5': 12.5,
  '13': 13, '13.5': 13.5, '14': 14, '14.5': 14.5,
  '15': 15, '15.5': 15.5, '16': 16, '16.5': 16.5, '17': 17, '18': 18, '18.5': 18.5,
  '19': 19, '20': 20, '21': 21, '22': 22, '23': 23, '24': 24, '26': 26, '28': 28,
  '30': 30, '32': 32, '34': 34, '36': 36, '38': 38, '40': 40, '42': 42, '44': 44,
  '46': 46, '48': 48, '62': 62,
} as const;

export const lineHeights = {
  hero: 1.05, tight: 1.2, snug: 1.35, base: 1.6, relaxed: 1.7, loose: 1.85,
} as const;

export const letterSpacings = {
  hero: '-1.5px', h1: '-1px', h1Large: '-1.2px', h1Big: '-1.3px',
  h2: '-0.6px', h2Tight: '-0.5px', h3: '-0.4px', cardTitle: '-0.3px',
  brand: '-0.3px', none: '0', num: '2px', numTight: '1px', numLoose: '3px',
} as const;

export const shadows = {
  none: 'none',
  card: '0 2px 14px rgba(18,33,26,0.06)',
  cardHover: '0 16px 34px -14px rgba(18,33,26,0.18)',
  logoGlow: '0 8px 22px -8px rgba(5,166,97,0.7)',
  buttonGlow: '0 14px 30px -10px rgba(5,166,97,0.55)',
  featured: '0 30px 70px -30px rgba(0,0,0,0.8)',
  megaMenu: '0 40px 80px -30px rgba(0,0,0,0.55)',
} as const;
