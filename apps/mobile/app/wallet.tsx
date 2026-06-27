import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme/ThemeProvider';
import { Header, Text, Card, Button, Icon, Badge } from '../src/ui';
import { fmtSAR } from '../src/data/format';

const PAYOUTS = [
  { id: 'po1', project: 'سِرب', milestone: '#١ النموذج الأوّلي', amountHalalas: 64_168_750_0, status: 'SENT', date: '٢٠٢٦/٠٥/١٢' },
  { id: 'po2', project: 'سِرب', milestone: '#٢ التصنيع التجريبي', amountHalalas: 77_002_500_0, status: 'PENDING', date: 'قيد الإصدار' },
  { id: 'po3', project: 'حكايا', milestone: '#١ المسوّدة', amountHalalas: 17_510_000_0, status: 'SENT', date: '٢٠٢٦/٠٤/٢٢' },
];

export default function Wallet() {
  const { colors } = useTheme();
  const totalSent = PAYOUTS.filter((p) => p.status === 'SENT').reduce((acc, p) => acc + p.amountHalalas, 0);
  const totalPending = PAYOUTS.filter((p) => p.status === 'PENDING').reduce((acc, p) => acc + p.amountHalalas, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: 24, paddingBottom: 14 }}>
          <Text num style={{ fontSize: 12, color: colors.accent, letterSpacing: 2, marginBottom: 6 }}>
            CREATOR WALLET
          </Text>
          <Text variant="h1" style={{ fontSize: 28, marginBottom: 6 }}>محفظتي</Text>
          <Text tone="muted" variant="small">
            كل المبالغ التي صُرفت لك من إنجازات مشاريعك.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, marginBottom: 18 }}>
          <View style={{ borderRadius: 22, overflow: 'hidden' }}>
            <LinearGradient
              colors={colors.grad as unknown as [string, string]}
              style={{ padding: 28 }}
            >
              <Text style={{ color: colors.onAccent, opacity: 0.9, fontWeight: '600', fontSize: 13 }}>
                إجمالي المبالغ المصروفة
              </Text>
              <Text num style={{ color: colors.onAccent, fontSize: 38, fontWeight: '700', marginTop: 6 }}>
                {fmtSAR(totalSent)}
              </Text>
              <View style={{ marginTop: 18, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ color: colors.onAccent, opacity: 0.85, fontSize: 11 }}>قيد الصرف</Text>
                  <Text num style={{ color: colors.onAccent, fontSize: 16, fontWeight: '600' }}>
                    {fmtSAR(totalPending)}
                  </Text>
                </View>
                <Button title="سحب" variant="ghost" size="sm" />
              </View>
            </LinearGradient>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24 }}>
          <Text num variant="small" tone="muted2" style={{ marginBottom: 10, fontWeight: '700', letterSpacing: 1 }}>
            الدفعات
          </Text>
          <View style={{ gap: 10 }}>
            {PAYOUTS.map((p) => (
              <Card key={p.id}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <View
                    style={{
                      width: 40, height: 40, borderRadius: 12,
                      backgroundColor: p.status === 'SENT' ? 'rgba(5,166,97,0.12)' : 'rgba(251,191,36,0.18)',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon name={p.status === 'SENT' ? 'check_circle' : 'hourglass_top'} size={20} color={p.status === 'SENT' ? colors.pos : colors.gold} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700' }}>{p.project}</Text>
                    <Text tone="muted2" variant="mutedSmall">{p.milestone}</Text>
                  </View>
                  <Badge
                    label={p.status === 'SENT' ? 'مصروفة' : 'قيد المعالجة'}
                    tone={p.status === 'SENT' ? 'pos' : 'gold'}
                  />
                </View>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: `rgba(${colors.inkRgb},0.07)` }}>
                  <Text num tone="muted" variant="small">{p.date}</Text>
                  <Text num style={{ color: colors.accent, fontWeight: '700', fontSize: 17 }}>
                    {fmtSAR(p.amountHalalas)}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
