import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';

export interface ProgressBarProps {
  /** 0..1 (clamped). */
  pct: number;
  height?: number;
  /** Use the "over 100%" gradient when funded. */
  over?: boolean;
  style?: ViewStyle;
}

export function ProgressBar({ pct, height = 9, over, style }: ProgressBarProps) {
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, pct));
  const gradient = over ? colors.gradBarOver : colors.gradBar;
  return (
    <View
      style={[
        {
          height,
          borderRadius: 30,
          backgroundColor: `rgba(${colors.inkRgb},0.08)`,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <LinearGradient
        colors={gradient as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: '100%', width: `${clamped * 100}%`, borderRadius: 30 }}
      />
    </View>
  );
}
