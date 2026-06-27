import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { Icon } from './Icon';

export interface BadgeProps {
  label: string;
  icon?: string;
  /** Color theme. */
  tone?: 'accent' | 'gold' | 'pos' | 'muted';
  style?: ViewStyle;
  /** Render with a dot for "live" status. */
  withDot?: boolean;
}

export function Badge({ label, icon, tone = 'accent', style, withDot }: BadgeProps) {
  const { colors } = useTheme();
  const color =
    tone === 'gold' ? colors.gold
    : tone === 'pos' ? colors.pos
    : tone === 'muted' ? colors.muted
    : colors.accent;

  const toneRgb =
    tone === 'gold' ? '251,191,36'
    : tone === 'pos' ? '52,211,153'
    : tone === 'muted' ? colors.inkRgb
    : colors.accentRgb;

  return (
    <View
      style={[
        {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
          alignSelf: 'flex-start',
          paddingVertical: 6,
          paddingHorizontal: 13,
          borderRadius: 30,
          backgroundColor: `rgba(${toneRgb},0.10)`,
          borderWidth: 1,
          borderColor: `rgba(${toneRgb},0.30)`,
        },
        style,
      ]}
    >
      {withDot && (
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      )}
      {icon && <Icon name={icon} size={16} color={color} />}
      <Text style={{ color, fontSize: 12.5, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}
