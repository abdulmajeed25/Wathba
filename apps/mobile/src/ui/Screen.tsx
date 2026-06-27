import React from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export interface ScreenProps extends ScrollViewProps {
  /** Whether to wrap content in a ScrollView. Defaults to true. */
  scroll?: boolean;
  /** Use full-bleed (no horizontal padding). */
  bleed?: boolean;
}

export function Screen({
  children,
  scroll = true,
  bleed = false,
  contentContainerStyle,
  ...rest
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const padH = bleed ? 0 : 20;
  const contentStyle = [
    { paddingHorizontal: padH, paddingBottom: insets.bottom + 24 },
    contentContainerStyle,
  ];

  if (!scroll) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={contentStyle}
        {...rest}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
