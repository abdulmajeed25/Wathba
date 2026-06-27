import React from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';
import { Text, Icon } from './index';

/**
 * Compact top header used across the app — logo + theme toggle + sign-in
 * shortcut. The full mega-menu nav from the web design is condensed into a
 * search trigger on mobile.
 */
export function Header() {
  const { colors, name, toggle } = useTheme();
  const router = useRouter();
  return (
    <View
      style={{
        paddingTop: 14,
        paddingBottom: 12,
        paddingHorizontal: 16,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: `rgba(${colors.inkRgb},0.07)`,
        backgroundColor: colors.headerBg,
      }}
    >
      <Pressable
        onPress={() => router.push('/')}
        style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}
      >
        <LinearGradient
          colors={colors.grad as unknown as [string, string]}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="rocket_launch" size={22} color={colors.onAccent} />
        </LinearGradient>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '700', letterSpacing: -0.3 }}>وثبة</Text>
          <Text num style={{ fontSize: 9, letterSpacing: 3, color: colors.muted2 }}>
            LEAP FORWARD
          </Text>
        </View>
      </Pressable>

      <View style={{ flex: 1 }} />

      <Pressable
        onPress={() => router.push('/search')}
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 11,
          backgroundColor: `rgba(${colors.inkRgb},0.05)`,
          borderWidth: 1,
          borderColor: `rgba(${colors.inkRgb},0.09)`,
        }}
      >
        <Icon name="search" size={18} color={colors.muted2} />
      </Pressable>

      <Pressable
        onPress={toggle}
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: `rgba(${colors.inkRgb},0.12)`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          name={name === 'dark' ? 'light-mode' : 'dark-mode'}
          size={18}
          color={colors.muted}
        />
      </Pressable>
    </View>
  );
}
