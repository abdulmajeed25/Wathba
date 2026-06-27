/**
 * Wathba design tokens — extracted from design/wathba.dc.html.
 *
 * Single source of truth for colors, fonts, gradients, radii, shadows.
 * Mobile reads these via ThemeProvider; web reads the same values.
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
  // gradients exposed as stop arrays for expo-linear-gradient
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
  ui: 'IBMPlexSansArabic',
  uiBold: 'IBMPlexSansArabic-Bold',
  uiSemibold: 'IBMPlexSansArabic-SemiBold',
  uiMedium: 'IBMPlexSansArabic-Medium',
  num: 'SpaceGrotesk',
  numBold: 'SpaceGrotesk-Bold',
  ico: 'MaterialSymbolsRounded',
} as const;

export type FontKey = keyof typeof fonts;

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
  '6xl': 72,
} as const;

export const radii = {
  none: 0,
  xs: 6,
  sm: 9,
  md: 11,
  lg: 13,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  pill: 30,
  circle: 9999,
} as const;

export const fontSizes = {
  xs: 11,
  sm: 12.5,
  base: 14,
  md: 15,
  lg: 16.5,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
  '5xl': 32,
  '6xl': 38,
  '7xl': 46,
  '8xl': 62,
} as const;

export const lineHeights = {
  tight: 1.05,
  snug: 1.2,
  normal: 1.55,
  relaxed: 1.7,
  loose: 1.85,
} as const;

export const shadows = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 4px 14px rgba(18,33,26,0.06)',
  lg: '0 16px 34px -14px rgba(18,33,26,0.18)',
  glow: '0 14px 30px -10px rgba(5,166,97,0.55)',
} as const;
