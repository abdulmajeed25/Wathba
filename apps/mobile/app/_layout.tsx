import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { ensureRtl } from '../src/i18n/rtl';
import { queryClient } from '../src/api/queryClient';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

ensureRtl();

function ShellInner() {
  const { colors, name } = useTheme();
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => undefined);
  }, [colors.bg]);
  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} backgroundColor={colors.bg} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // We register the Material Symbols family lazily via @expo/vector-icons;
    // the Arabic UI font + Space Grotesk are loaded from Google Fonts at build
    // time. For now we rely on system Arabic + IBM Plex packaged later (Phase 1).
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <ShellInner />
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
