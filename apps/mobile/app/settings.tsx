import React from 'react';
import { View, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { Header, Text, Card, Icon, Badge } from '../src/ui';
import { useAuthStore } from '../src/auth/store';

export default function Settings() {
  const { colors, name, setTheme } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: 24, paddingBottom: 8 }}>
          <Text variant="h1" style={{ fontSize: 28 }}>الإعدادات</Text>
        </View>

        {/* Profile snapshot */}
        <View style={{ paddingHorizontal: 24, marginBottom: 18 }}>
          <Pressable onPress={() => router.push('/profile')}>
            <Card style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  width: 54, height: 54, borderRadius: 14,
                  backgroundColor: `rgba(${colors.accentRgb},0.15)`,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 22 }}>
                  {(user?.name ?? 'ز').charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="h4">{user?.name ?? 'زائر'}</Text>
                <Text tone="muted2" variant="small">{user?.email ?? 'لم تسجل دخول بعد'}</Text>
                {user?.nafathVerified ? (
                  <Badge label="موثّق بنفاذ" tone="pos" icon="verified" style={{ marginTop: 6 }} />
                ) : (
                  <Badge label="غير موثّق" tone="muted" icon="error" style={{ marginTop: 6 }} />
                )}
              </View>
              <Icon name="chevron_left" size={22} color={colors.muted2} />
            </Card>
          </Pressable>
        </View>

        {/* Theme */}
        <SettingsSection title="المظهر">
          <SettingsRow
            icon="palette"
            title="نمط الألوان"
            valueRight={
              <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                <Pressable
                  onPress={() => setTheme('light')}
                  style={{
                    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 9,
                    backgroundColor: name === 'light' ? colors.accent : `rgba(${colors.inkRgb},0.08)`,
                  }}
                >
                  <Text style={{ color: name === 'light' ? colors.onAccent : colors.muted, fontSize: 12, fontWeight: '600' }}>فاتح</Text>
                </Pressable>
                <Pressable
                  onPress={() => setTheme('dark')}
                  style={{
                    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 9,
                    backgroundColor: name === 'dark' ? colors.accent : `rgba(${colors.inkRgb},0.08)`,
                  }}
                >
                  <Text style={{ color: name === 'dark' ? colors.onAccent : colors.muted, fontSize: 12, fontWeight: '600' }}>داكن</Text>
                </Pressable>
              </View>
            }
          />
        </SettingsSection>

        <SettingsSection title="الحساب">
          <SettingsLink icon="person" title="الملف الشخصي" onPress={() => router.push('/profile')} />
          <SettingsLink icon="location_on" title="العناوين" onPress={() => router.push('/settings/addresses' as never)} />
          <SettingsLink icon="lock" title="الأمان وكلمة السر" onPress={() => router.push('/settings/security' as never)} />
          <SettingsLink icon="language" title="اللغة" hint="العربية" onPress={() => undefined} />
        </SettingsSection>

        <SettingsSection title="الإشعارات">
          <SettingsToggle icon="notifications" title="إشعارات داخل التطبيق" defaultOn />
          <SettingsToggle icon="mail" title="إشعارات بريدية" defaultOn />
          <SettingsToggle icon="sms" title="رسائل نصية للأمور المهمة" defaultOn={false} />
        </SettingsSection>

        <SettingsSection title="الدفع والمحفظة">
          <SettingsLink icon="credit_card" title="طرق الدفع" onPress={() => router.push('/payments' as never)} />
          <SettingsLink icon="account_balance_wallet" title="محفظتي (للمبدعين)" onPress={() => router.push('/wallet' as never)} />
          <SettingsLink icon="receipt_long" title="سجل المعاملات" onPress={() => router.push('/payments' as never)} />
        </SettingsSection>

        <SettingsSection title="المساعدة والقانوني">
          <SettingsLink icon="help_outline" title="مركز المساعدة" onPress={() => router.push('/help' as never)} />
          <SettingsLink icon="gavel" title="الشروط والأحكام" onPress={() => router.push('/legal/terms' as never)} />
          <SettingsLink icon="privacy_tip" title="سياسة الخصوصية (PDPL)" onPress={() => router.push('/legal/privacy' as never)} />
          <SettingsLink icon="description" title="شروط العقود" onPress={() => router.push('/legal/contracts' as never)} />
        </SettingsSection>

        {user && (
          <View style={{ paddingHorizontal: 24, marginTop: 10 }}>
            <Pressable onPress={() => clear().then(() => router.replace('/(auth)/welcome' as never))}>
              <Card style={{ alignItems: 'center' }}>
                <Text style={{ color: '#ef4444', fontWeight: '700' }}>تسجيل الخروج</Text>
              </Card>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 24, marginBottom: 18 }}>
      <Text num variant="small" tone="muted2" style={{ marginBottom: 8, fontWeight: '700', letterSpacing: 1 }}>
        {title}
      </Text>
      <Card padding={0}>
        {children}
      </Card>
    </View>
  );
}

function SettingsLink({ icon, title, hint, onPress }: { icon: string; title: string; hint?: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: `rgba(${colors.inkRgb},0.04)`,
      }}
    >
      <Icon name={icon} size={22} color={colors.accent} />
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '500' }}>{title}</Text>
      {hint && <Text tone="muted2" variant="small">{hint}</Text>}
      <Icon name="chevron_left" size={20} color={colors.muted2} />
    </Pressable>
  );
}

function SettingsRow({ icon, title, valueRight }: { icon: string; title: string; valueRight: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
      }}
    >
      <Icon name={icon} size={22} color={colors.accent} />
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '500' }}>{title}</Text>
      {valueRight}
    </View>
  );
}

function SettingsToggle({ icon, title, defaultOn }: { icon: string; title: string; defaultOn: boolean }) {
  const { colors } = useTheme();
  const [on, setOn] = React.useState(defaultOn);
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: `rgba(${colors.inkRgb},0.04)`,
      }}
    >
      <Icon name={icon} size={22} color={colors.muted} />
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '500' }}>{title}</Text>
      <Switch
        value={on}
        onValueChange={setOn}
        thumbColor={colors.onAccent}
        trackColor={{ true: colors.accent, false: `rgba(${colors.inkRgb},0.18)` }}
      />
    </View>
  );
}
