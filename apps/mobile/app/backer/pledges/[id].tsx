import React, { useState } from 'react';
import { View, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Header, Text, Card, Button, Icon } from '../../../src/ui';
import { fmtSAR, toArabicDigits } from '../../../src/data/format';

interface PledgeDetail {
  id: string;
  projectId: string;
  projectTitleAr: string;
  tierTitle: string;
  tierItems: string[];
  amountHalalas: number;
  contractType: 'DONATION' | 'ISTISNA' | 'SALAM';
  status: 'HELD' | 'CAPTURED' | 'REFUNDED';
  date: string;
  shipping?: { name: string; address: string; city: string; country: string; postal: string };
}

const MOCK: Record<string, PledgeDetail> = {
  pl1: {
    id: 'pl1',
    projectId: 'sirb',
    projectTitleAr: 'سِرب — درون التصوير الذكي',
    tierTitle: 'الإصدار المبكر',
    tierItems: ['وحدة من المنتج', 'شحن مجاني داخل الخليج', 'وصول حصري لمجموعة الواتساب'],
    amountHalalas: 75_000,
    contractType: 'ISTISNA',
    status: 'HELD',
    date: '٢٠٢٦/٠٦/٢٠',
    shipping: { name: 'سارة العامري', address: 'حي العليا، شارع التحلية', city: 'الرياض', country: 'السعودية', postal: '11564' },
  },
};

const CONTRACT_LABEL: Record<PledgeDetail['contractType'], string> = {
  DONATION: 'تبرّع',
  ISTISNA: 'استصناع',
  SALAM: 'سَلَم',
};

export default function PledgeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [cancelled, setCancelled] = useState(false);
  const pledge = MOCK[id] ?? MOCK.pl1!;

  const cancel = () => {
    Alert.alert('إلغاء الدعم', 'هل تريد إلغاء دعمك؟ سيتم تحرير المبلغ المحجوز فوراً.', [
      { text: 'لا، احتفظ به', style: 'cancel' },
      {
        text: 'نعم، ألغِ',
        style: 'destructive',
        onPress: () => setCancelled(true),
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: 24, paddingBottom: 14 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 14 }}
          >
            <Icon name="arrow_forward" size={16} color={colors.muted} />
            <Text tone="muted" variant="small">عودة لدعومي</Text>
          </Pressable>
          <Text num style={{ fontSize: 12, color: colors.accent, letterSpacing: 2, marginBottom: 6 }}>
            PLEDGE #{toArabicDigits(pledge.id.toUpperCase())}
          </Text>
          <Text variant="h1" style={{ fontSize: 24, marginBottom: 4 }}>{pledge.projectTitleAr}</Text>
          <Text tone="muted" variant="small">دُعم بتاريخ {pledge.date}</Text>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 14 }}>
          {/* Status card */}
          <Card>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 56, height: 56, borderRadius: 16,
                  backgroundColor: cancelled || pledge.status === 'REFUNDED' ? 'rgba(138,149,140,0.18)'
                    : pledge.status === 'CAPTURED' ? 'rgba(5,166,97,0.18)'
                    : 'rgba(251,191,36,0.18)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon
                  name={cancelled ? 'cancel' : pledge.status === 'CAPTURED' ? 'check_circle' : 'lock_clock'}
                  size={28}
                  color={cancelled ? colors.muted : pledge.status === 'CAPTURED' ? colors.pos : colors.gold}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="h4" style={{ marginBottom: 4 }}>
                  {cancelled ? 'تمّ إلغاء الدعم'
                    : pledge.status === 'CAPTURED' ? 'تمّ خصم المبلغ'
                    : pledge.status === 'REFUNDED' ? 'تمّ ردّ المبلغ'
                    : 'محجوز — ينتظر بلوغ الهدف'}
                </Text>
                <Text variant="small" tone="muted">
                  {cancelled ? 'سيظهر المبلغ المسترَد خلال ٣-٥ أيام عمل.'
                    : pledge.status === 'HELD' ? 'لن يُخصم أي مبلغ إلا عند نجاح المشروع.'
                    : pledge.status === 'CAPTURED' ? 'المبلغ في حساب الضمان حتى تسليم المكافأة.'
                    : 'سيظهر المبلغ في حسابك خلال ٣-٥ أيام عمل.'}
                </Text>
              </View>
            </View>
          </Card>

          {/* Amount + tier */}
          <Card>
            <Text variant="h4" style={{ marginBottom: 14 }}>تفاصيل الدعم</Text>
            <Row label="المكافأة" value={pledge.tierTitle} />
            <Row label="المبلغ" value={fmtSAR(pledge.amountHalalas)} accent />
            <Row label="نوع العقد" value={CONTRACT_LABEL[pledge.contractType]} />
            <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: `rgba(${colors.inkRgb},0.08)`, gap: 8 }}>
              <Text variant="small" tone="textSoft" style={{ fontWeight: '600' }}>ما تشمله المكافأة</Text>
              {pledge.tierItems.map((i, k) => (
                <View key={k} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                  <Icon name="check_circle" size={16} color={colors.pos} />
                  <Text variant="small" tone="textSoft" style={{ flex: 1 }}>{i}</Text>
                </View>
              ))}
            </View>
          </Card>

          {/* Shipping */}
          {pledge.shipping && (
            <Card>
              <Text variant="h4" style={{ marginBottom: 14 }}>عنوان الشحن</Text>
              <Text variant="small" tone="textSoft" style={{ lineHeight: 22 }}>
                {pledge.shipping.name}{'\n'}
                {pledge.shipping.address}{'\n'}
                {pledge.shipping.city}، {pledge.shipping.country}{'\n'}
                <Text num style={{ color: colors.muted }}>{pledge.shipping.postal}</Text>
              </Text>
            </Card>
          )}

          {/* Actions */}
          {pledge.status === 'HELD' && !cancelled && (
            <Button
              title="إلغاء الدعم"
              variant="outline"
              iconLeft="cancel"
              onPress={cancel}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
      <Text tone="muted" variant="small">{label}</Text>
      <Text num={accent} style={{ color: accent ? colors.accent : colors.text, fontWeight: accent ? '700' : '500', fontSize: 14 }}>
        {value}
      </Text>
    </View>
  );
}
