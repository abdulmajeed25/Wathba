import React, { useState } from 'react';
import { View, TextInput, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Text, Button, Icon, Card } from '../../src/ui';
import { api, ApiError } from '../../src/api/client';
import { useAuthStore } from '../../src/auth/store';

export default function NafathVerify() {
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [nationalId, setNationalId] = useState('');
  const [txId, setTxId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiate = async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await api<{ transactionId: string; expiresInSec: number }>('/nafath/initiate', {
        method: 'POST',
        json: { nationalId },
      });
      setTxId(r.transactionId);
    } catch (err) {
      setError(err instanceof ApiError ? 'تعذّر بدء التحقق. تأكد من الرقم.' : 'تعذّر الاتصال.');
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!txId) return;
    setError(null);
    setLoading(true);
    try {
      await api<{ verified: true }>('/nafath/confirm', {
        method: 'POST',
        json: { transactionId: txId },
      });
      if (user) await setUser({ ...user, nafathVerified: true });
      router.replace('/');
    } catch {
      setError('تعذّر تأكيد التحقق.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 32 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <LinearGradient
            colors={['#0c1c2f', '#102339'] as unknown as [string, string]}
            style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
            }}
          >
            <Icon name="verified_user" size={36} color="#22d3ee" />
          </LinearGradient>
          <Text variant="h1" style={{ marginBottom: 8, textAlign: 'center' }}>تحقق نفاذ</Text>
          <Text variant="body" tone="textSoft" style={{ textAlign: 'center', maxWidth: 340, lineHeight: 24 }}>
            للتأكد من هويتك وفتح كل ميزات وثبة، نتحقق منك عبر نفاذ الوطني.
          </Text>
        </View>

        <Card>
          {!txId ? (
            <View>
              <Text variant="small" tone="textSoft" style={{ marginBottom: 8, fontWeight: '600' }}>
                رقم الهوية الوطنية
              </Text>
              <TextInput
                value={nationalId}
                onChangeText={setNationalId}
                placeholder="١٠ أرقام"
                placeholderTextColor={colors.muted2}
                keyboardType="number-pad"
                maxLength={10}
                style={{
                  backgroundColor: `rgba(${colors.inkRgb},0.04)`,
                  borderWidth: 1,
                  borderColor: `rgba(${colors.inkRgb},0.12)`,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 17,
                  color: colors.text,
                  fontFamily: 'SpaceGrotesk',
                  textAlign: 'right',
                  marginBottom: 16,
                  letterSpacing: 3,
                }}
              />
              <Button
                title={loading ? 'جاري الإرسال…' : 'إرسال طلب التحقق'}
                size="lg"
                full
                onPress={initiate}
                disabled={loading || !/^\d{10}$/.test(nationalId)}
              />
            </View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Icon name="hourglass_top" size={48} color={colors.accent} />
              <Text variant="h3" style={{ marginTop: 14, marginBottom: 8 }}>
                افتح تطبيق نفاذ
              </Text>
              <Text variant="body" tone="muted" style={{ textAlign: 'center', marginBottom: 18 }}>
                وأكد رقم التحقق المعروض في إشعار نفاذ.
              </Text>
              <Text num style={{ fontSize: 32, fontWeight: '700', color: colors.accent, letterSpacing: 8, marginBottom: 18 }}>
                {(txId.slice(-4)).split('').join(' ')}
              </Text>
              <Button
                title={loading ? 'جاري التأكيد…' : 'لقد أكّدت في تطبيق نفاذ'}
                size="lg"
                full
                onPress={confirm}
                disabled={loading}
              />
            </View>
          )}
        </Card>

        {error && (
          <View style={{ padding: 12, borderRadius: 11, backgroundColor: 'rgba(239,68,68,0.08)', marginTop: 16, flexDirection: 'row-reverse', gap: 8 }}>
            <Icon name="error" size={18} color="#ef4444" />
            <Text style={{ color: '#ef4444', flex: 1 }} variant="small">{error}</Text>
          </View>
        )}

        <Pressable
          onPress={() => router.replace('/')}
          style={{ alignItems: 'center', marginTop: 22 }}
        >
          <Text tone="muted" variant="small">تخطّى الآن — لاحقاً من «الإعدادات»</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
