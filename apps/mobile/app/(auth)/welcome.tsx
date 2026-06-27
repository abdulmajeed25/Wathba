import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Text, Button, Icon } from '../../src/ui';

export default function Welcome() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center', paddingTop: 48 }}>
          <LinearGradient
            colors={colors.grad as unknown as [string, string]}
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 22,
            }}
          >
            <Icon name="rocket_launch" size={42} color={colors.onAccent} />
          </LinearGradient>
          <Text variant="display" style={{ fontSize: 42, lineHeight: 48, textAlign: 'center', marginBottom: 12 }}>
            وثبة
          </Text>
          <Text num style={{ fontSize: 11, color: colors.muted2, letterSpacing: 4, marginBottom: 30 }}>
            LEAP FORWARD
          </Text>
          <Text variant="body" tone="textSoft" style={{ fontSize: 17, lineHeight: 28, textAlign: 'center' }}>
            منصة الدعم الجماعي الأولى عربياً.
            {'\n'}
            مشاريع، شفافية، ومجتمع يؤمن بأفكارك.
          </Text>
        </View>
        <View style={{ gap: 12 }}>
          <Button
            title="ابدأ الآن"
            iconLeft="rocket_launch"
            size="lg"
            full
            onPress={() => router.push('/(auth)/sign-up' as never)}
          />
          <Button
            title="لديّ حساب"
            variant="outline"
            size="lg"
            full
            onPress={() => router.push('/(auth)/sign-in' as never)}
          />
          <Button
            title="تصفّح كزائر"
            variant="ghost"
            full
            onPress={() => router.replace('/')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
