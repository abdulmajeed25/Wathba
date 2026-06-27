import React, { useState } from 'react';
import { View, TextInput, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Text, Button, Icon } from '../../src/ui';
import { api, ApiError } from '../../src/api/client';
import { useAuthStore, type AuthUser } from '../../src/auth/store';

export default function SignUp() {
  const { colors } = useTheme();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await api<{ accessToken: string; user: AuthUser }>('/auth/signup', {
        method: 'POST',
        json: { name, email, password, phone: phone || undefined },
        auth: false,
      });
      await setSession(r.accessToken, r.user);
      router.replace('/(auth)/nafath' as never);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('هذا البريد مسجَّل مسبقاً.');
      } else if (err instanceof ApiError) {
        setError('تعذّر إنشاء الحساب — تحقق من البيانات.');
      } else {
        setError('تعذّر الاتصال بالخادم.');
      }
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = name.length >= 2 && email.includes('@') && password.length >= 8;

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
        <Text variant="h1" style={{ marginBottom: 8 }}>إنشاء حساب</Text>
        <Text tone="muted" variant="small" style={{ marginBottom: 26 }}>
          خطوة سريعة، ثم نتحقق من هويتك عبر نفاذ.
        </Text>

        <Field label="الاسم الكامل" value={name} onChangeText={setName} placeholder="مثال: سارة العامري" />
        <Field label="البريد الإلكتروني" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" />
        <Field label="رقم الجوال (اختياري)" value={phone} onChangeText={setPhone} placeholder="+9665XXXXXXXX" keyboardType="phone-pad" />
        <Field label="كلمة السر (٨ أحرف فأكثر)" value={password} onChangeText={setPassword} placeholder="••••••••" secure />

        {error && (
          <View style={{ padding: 12, borderRadius: 11, backgroundColor: 'rgba(239,68,68,0.08)', marginBottom: 14, flexDirection: 'row-reverse', gap: 8 }}>
            <Icon name="error" size={18} color="#ef4444" />
            <Text style={{ color: '#ef4444', flex: 1 }} variant="small">{error}</Text>
          </View>
        )}

        <Button
          title={loading ? 'جاري إنشاء الحساب…' : 'أنشئ حسابي'}
          size="lg"
          full
          onPress={submit}
          disabled={loading || !canSubmit}
        />

        <View style={{ marginTop: 22, padding: 14, borderRadius: 12, backgroundColor: `rgba(${colors.accentRgb},0.05)`, borderColor: `rgba(${colors.accentRgb},0.18)`, borderWidth: 1, flexDirection: 'row-reverse', gap: 10 }}>
          <Icon name="shield" size={20} color={colors.accent} />
          <Text variant="small" tone="textSoft" style={{ flex: 1, lineHeight: 22 }}>
            بإنشاء الحساب فأنت توافق على شروط الاستخدام وسياسة الخصوصية (نظام حماية البيانات الشخصية PDPL/سدايا).
          </Text>
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
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad';
  secure?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
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
