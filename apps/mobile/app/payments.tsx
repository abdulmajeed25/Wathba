import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { Header, Text, Card, Icon, Badge } from '../src/ui';
import { fmtSAR } from '../src/data/format';

interface Tx {
  id: string;
  kind: 'pledge_held' | 'pledge_captured' | 'pledge_refunded' | 'payout_received';
  title: string;
  date: string;
  amountHalalas: number;
}

const ICON_FOR: Record<Tx['kind'], string> = {
  pledge_held: 'lock_clock',
  pledge_captured: 'shopping_cart_checkout',
  pledge_refunded: 'undo',
  payout_received: 'paid',
};
const LABEL_FOR: Record<Tx['kind'], string> = {
  pledge_held: 'حجز',
  pledge_captured: 'خصم',
  pledge_refunded: 'استرداد',
  payout_received: 'دفعة واردة',
};

const MOCK: Tx[] = [
  { id: 't1', kind: 'pledge_held', title: 'دعم «سِرب»', date: '٢٠٢٦/٠٦/٢٠', amountHalalas: -75_000 },
  { id: 't2', kind: 'pledge_captured', title: 'خصم دعم «حكايا»', date: '٢٠٢٦/٠٥/٠٤', amountHalalas: -250_000 },
  { id: 't3', kind: 'pledge_refunded', title: 'استرداد دعم «طرَب»', date: '٢٠٢٦/٠٤/١٢', amountHalalas: 35_000 },
  { id: 't4', kind: 'payout_received', title: 'مكافأة الإحالة', date: '٢٠٢٦/٠٣/٠١', amountHalalas: 5_000 },
];

const METHODS = [
  { id: 'card1', label: '•••• ٤٢٤٢', kind: 'بطاقة Visa', icon: 'credit_card', default: true },
  { id: 'card2', label: '•••• ٧٧٢١', kind: 'بطاقة Mada', icon: 'credit_card', default: false },
];

export default function Payments() {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: 24, paddingBottom: 14 }}>
          <Text num style={{ fontSize: 12, color: colors.accent, letterSpacing: 2, marginBottom: 6 }}>
            PAYMENTS
          </Text>
          <Text variant="h1" style={{ fontSize: 28, marginBottom: 6 }}>
            الدفع والمعاملات
          </Text>
          <Text tone="muted" variant="small">طرق الدفع المحفوظة + سجل كامل بالمعاملات.</Text>
        </View>

        <View style={{ paddingHorizontal: 24, marginBottom: 18 }}>
          <Text num variant="small" tone="muted2" style={{ marginBottom: 10, fontWeight: '700', letterSpacing: 1 }}>طرق الدفع</Text>
          <View style={{ gap: 10 }}>
            {METHODS.map((m) => (
              <Card key={m.id} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: `rgba(${colors.inkRgb},0.05)`,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon name={m.icon} size={22} color={colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text num style={{ fontWeight: '700' }}>{m.label}</Text>
                  <Text variant="small" tone="muted2">{m.kind}</Text>
                </View>
                {m.default && <Badge label="افتراضية" tone="accent" />}
              </Card>
            ))}
            <Pressable
              style={{
                padding: 14,
                borderRadius: 14,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: `rgba(${colors.accentRgb},0.3)`,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Icon name="add_circle" size={20} color={colors.accent} />
              <Text style={{ color: colors.accent, fontWeight: '600' }}>إضافة بطاقة جديدة</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24 }}>
          <Text num variant="small" tone="muted2" style={{ marginBottom: 10, fontWeight: '700', letterSpacing: 1 }}>سجل المعاملات</Text>
          <Card padding={0}>
            {MOCK.map((t, i) => {
              const positive = t.amountHalalas > 0;
              return (
                <View
                  key={t.id}
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderBottomWidth: i < MOCK.length - 1 ? 1 : 0,
                    borderBottomColor: `rgba(${colors.inkRgb},0.04)`,
                  }}
                >
                  <View
                    style={{
                      width: 38, height: 38, borderRadius: 11,
                      backgroundColor: positive ? 'rgba(5,166,97,0.12)' : 'rgba(138,149,140,0.12)',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon name={ICON_FOR[t.kind]} size={20} color={positive ? colors.pos : colors.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '600', fontSize: 14 }}>{t.title}</Text>
                    <Text num tone="muted2" variant="mutedSmall">
                      {LABEL_FOR[t.kind]} · {t.date}
                    </Text>
                  </View>
                  <Text
                    num
                    style={{
                      color: positive ? colors.pos : colors.text,
                      fontWeight: '700',
                      fontSize: 15,
                    }}
                  >
                    {positive ? '+' : '−'}{fmtSAR(Math.abs(t.amountHalalas))}
                  </Text>
                </View>
              );
            })}
          </Card>
        </View>

        <Pressable
          onPress={() => router.push('/wallet' as never)}
          style={{ paddingHorizontal: 24, marginTop: 16 }}
        >
          <Card style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
            <Icon name="account_balance_wallet" size={22} color={colors.accent} />
            <Text style={{ flex: 1, fontWeight: '600' }}>محفظتي (للمبدعين)</Text>
            <Icon name="chevron_left" size={20} color={colors.muted2} />
          </Card>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
