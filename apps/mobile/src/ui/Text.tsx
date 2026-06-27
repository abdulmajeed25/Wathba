import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'muted'
  | 'mutedSmall'
  | 'eyebrow'
  | 'num';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  /** Tint by token name. */
  tone?: 'text' | 'textSoft' | 'muted' | 'muted2' | 'accent' | 'pos' | 'gold' | 'onAccent';
  /** Force number font (Space Grotesk + tabular nums). */
  num?: boolean;
  weight?: '400' | '500' | '600' | '700';
}

const variantStyle = (v: TextVariant, fontUi: string, fontNum: string): TextStyle => {
  switch (v) {
    case 'display':
      return { fontSize: 62, lineHeight: 65, fontWeight: '700', fontFamily: fontUi, letterSpacing: -1.5 };
    case 'h1':
      return { fontSize: 32, lineHeight: 38, fontWeight: '700', fontFamily: fontUi, letterSpacing: -0.7 };
    case 'h2':
      return { fontSize: 24, lineHeight: 29, fontWeight: '700', fontFamily: fontUi, letterSpacing: -0.4 };
    case 'h3':
      return { fontSize: 18, lineHeight: 24, fontWeight: '700', fontFamily: fontUi };
    case 'h4':
      return { fontSize: 16, lineHeight: 22, fontWeight: '700', fontFamily: fontUi };
    case 'body':
      return { fontSize: 14, lineHeight: 22, fontWeight: '400', fontFamily: fontUi };
    case 'bodyStrong':
      return { fontSize: 14, lineHeight: 22, fontWeight: '600', fontFamily: fontUi };
    case 'small':
      return { fontSize: 12.5, lineHeight: 18, fontWeight: '500', fontFamily: fontUi };
    case 'muted':
      return { fontSize: 14, lineHeight: 22, fontWeight: '400', fontFamily: fontUi };
    case 'mutedSmall':
      return { fontSize: 11.5, lineHeight: 16, fontWeight: '500', fontFamily: fontUi };
    case 'eyebrow':
      return { fontSize: 12, lineHeight: 16, fontWeight: '700', fontFamily: fontNum, letterSpacing: 2 };
    case 'num':
      return { fontSize: 14, lineHeight: 20, fontWeight: '600', fontFamily: fontNum };
  }
};

export function Text({ variant = 'body', tone, num, weight, style, ...rest }: TextProps) {
  const { colors, fonts } = useTheme();
  const base = variantStyle(variant, fonts.ui, fonts.num);
  const color =
    tone === 'accent' ? colors.accent
    : tone === 'pos' ? colors.pos
    : tone === 'gold' ? colors.gold
    : tone === 'textSoft' ? colors.textSoft
    : tone === 'muted' ? colors.muted
    : tone === 'muted2' ? colors.muted2
    : tone === 'onAccent' ? colors.onAccent
    : colors.text;
  return (
    <RNText
      {...rest}
      style={[
        base,
        num && { fontFamily: fonts.num },
        weight && { fontWeight: weight },
        { color, writingDirection: 'rtl' },
        style,
      ]}
    />
  );
}
