import React from 'react';
import { Pressable, View, type PressableProps, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'ghost' | 'outline';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  iconLeft?: string;
  iconRight?: string;
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  haptic?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  variant = 'primary',
  iconLeft,
  iconRight,
  size = 'md',
  full,
  haptic = true,
  style,
  onPress,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();

  const padV = size === 'sm' ? 10 : size === 'lg' ? 16 : 13;
  const padH = size === 'sm' ? 16 : size === 'lg' ? 28 : 22;
  const fontSize = size === 'sm' ? 13 : size === 'lg' ? 16 : 14.5;
  const radius = 14;

  const handlePress: PressableProps['onPress'] = (e) => {
    if (haptic) {
      Haptics.selectionAsync().catch(() => undefined);
    }
    onPress?.(e);
  };

  const innerRow: ViewStyle = {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: padV,
    paddingHorizontal: padH,
  };

  if (variant === 'primary') {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={handlePress}
        {...rest}
        style={({ pressed }) => [
          {
            borderRadius: radius,
            overflow: 'hidden',
            transform: [{ translateY: pressed ? 1 : 0 }],
            width: full ? '100%' : undefined,
          },
          style,
        ]}
      >
        <LinearGradient
          colors={colors.grad as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={innerRow}
        >
          {iconLeft && <Icon name={iconLeft} size={fontSize + 6} color={colors.onAccent} />}
          <Text style={{ color: colors.onAccent, fontSize, fontWeight: '700' }}>{title}</Text>
          {iconRight && <Icon name={iconRight} size={fontSize + 6} color={colors.onAccent} />}
        </LinearGradient>
      </Pressable>
    );
  }

  // ghost / outline
  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      {...rest}
      style={({ pressed }) => [
        {
          borderRadius: radius,
          borderWidth: variant === 'outline' ? 1 : 1,
          borderColor: `rgba(${colors.inkRgb},0.16)`,
          backgroundColor: pressed ? `rgba(${colors.inkRgb},0.06)` : 'transparent',
          width: full ? '100%' : undefined,
        },
        style,
      ]}
    >
      <View style={innerRow}>
        {iconLeft && <Icon name={iconLeft} size={fontSize + 6} color={colors.text} />}
        <Text style={{ color: colors.text, fontSize, fontWeight: '600' }}>{title}</Text>
        {iconRight && <Icon name={iconRight} size={fontSize + 6} color={colors.text} />}
      </View>
    </Pressable>
  );
}
