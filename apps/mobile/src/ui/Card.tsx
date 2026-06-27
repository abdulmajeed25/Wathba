import React from 'react';
import { View, type ViewProps, type ViewStyle, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface CardProps extends ViewProps {
  padding?: number;
  /** Lift on hover/press — currently a static elevated look; press handled by Pressable wrapper. */
  elevated?: boolean;
  radius?: number;
  bordered?: boolean;
}

export function Card({
  children,
  padding = 18,
  elevated = false,
  radius = 18,
  bordered = true,
  style,
  ...rest
}: CardProps) {
  const { colors } = useTheme();
  const wrapper: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding,
    borderWidth: bordered ? 1 : 0,
    borderColor: `rgba(${colors.inkRgb},0.09)`,
    ...(elevated
      ? Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 18,
          },
          android: { elevation: 4 },
          web: { boxShadow: colors.cardShadow } as unknown as ViewStyle,
          default: {},
        })
      : {}),
  };
  return (
    <View style={[wrapper, style]} {...rest}>
      {children}
    </View>
  );
}
