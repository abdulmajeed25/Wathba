import React, { useState } from 'react';
import { View, TextInput, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Text, Button, Icon } from '../../src/ui';
import { api, ApiError } from '../../src/api/client';
import { useAuthStore, type AuthUser } from '../../src/auth/store';

export default function SignIn() {
  const { colors } = useTheme();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await api<{ accessToken: string; user: AuthUser }>('/auth/signin', {
        method: 'POST',
        json: { email, password },
        auth: false,
      });
      await setSession(r.accessToken, r.user);
      router.replace('/');
    } catch (err) {
      if (err instanceof ApiError) setError('بيانات الدخول غير صحيحة. جرّب مرة أخرى.');
      else setError('تعذّر الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 32 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 22 }}
        >
          <Icon name="arrow_forward" size={18} color={colors.muted} />
          <Text tone="muted" variant="small">رجوع</Text>
        </Pressable>
        <Text variant="h1" style={{ marginBottom: 8 }}>تسجيل الدخول</Text>
        <Text tone="muted" variant="small" style={{ marginBottom: 26 }}>
          ادخل بريدك وكلمة السر للوصول لحسابك.
        </Text>

        <Field label="البريد الإلكتروني" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" />
        <Field label="كلمة السر" value={password} onChangeText={setPassword} placeholder="••••••••" secure />

        {error && (
          <View style={{ padding: 12, borderRadius: 11, backgroundColor: 'rgba(239,68,68,0.08)', marginBottom: 14, flexDirection: 'row-reverse', gap: 8 }}>
            <Icon name="error" size={18} color="#ef4444" />
            <Text style={{ color: '#ef4444', flex: 1 }} variant="small">{error}</Text>
          </View>
        )}

        <Button
          title={loading ? 'جاري الدخول…' : 'دخول'}
          size="lg"
          full
          onPress={submit}
          disabled={loading || !email || !password}
        />
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', marginTop: 22, gap: 5 }}>
          <Text tone="muted" variant="small">ليس لديك حساب؟</Text>
          <Pressable onPress={() => router.replace('/(auth)/sign-up' as never)}>
            <Text variant="small" style={{ color: colors.accent, fontWeight: '700' }}>أنشئ حساباً</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  secure?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text variant="small" tone="textSoft" style={{ marginBottom: 8, fontWeight: '600' }}>
        {props.label}
      </Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.muted2}
        keyboardType={props.keyboardType ?? 'default'}
        autoCapitalize="none"
        secureTextEntry={props.secure}
        style={{
          backgroundColor: `rgba(${colors.inkRgb},0.04)`,
          borderWidth: 1,
          borderColor: `rgba(${colors.inkRgb},0.12)`,
          borderRadius: 12,
          padding: 14,
          fontSize: 15,
          color: colors.text,
          fontFamily: 'IBMPlexSansArabic',
          textAlign: 'right',
        }}
      />
    </View>
  );
}
