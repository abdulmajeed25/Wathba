import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Header, Text, Card, Badge, Tabs, Icon } from '../../src/ui';
import { rfqs, myBids } from '../../src/data/procurement-mock';
import { fmtSAR, toArabicDigits } from '../../src/data/format';

const tabs = [
  { id: 'open', label: 'فرص مفتوحة', icon: 'work' },
  { id: 'bids', label: 'عروضي', icon: 'gavel' },
];

const BID_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'قيد المراجعة',
  SHORTLISTED: 'مرشّح',
  AWARDED: 'فائز',
  REJECTED: 'مرفوض',
};
const BID_STATUS_COLOR: Record<string, string> = {
  SUBMITTED: '#8a958c',
  SHORTLISTED: '#fbbf24',
  AWARDED: '#05a661',
  REJECTED: '#ef4444',
};

export default function SupplierPortal() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState('open');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: 24, paddingBottom: 18 }}>
          <Text num style={{ fontSize: 12, color: colors.accent, letterSpacing: 2, marginBottom: 6 }}>
            SUPPLIER PORTAL
          </Text>
          <Text variant="h1" style={{ fontSize: 28, marginBottom: 8 }}>
            بوّابة المورّدين
          </Text>
          <Text tone="muted" variant="small">
            تقدّم بعروضك على مشاريع وثبة. أفضل عرض من حيث السعر والمدة يفوز.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24 }}>
          <Tabs items={tabs} active={tab} onChange={setTab} variant="pill" />

          <View style={{ marginTop: 22, gap: 14 }}>
            {tab === 'open' &&
              rfqs.map((r) => (
                <Pressable key={r.id} onPress={() => router.push(`/supplier/rfqs/${r.id}` as never)}>
                  <Card>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Badge label={r.category} tone="accent" icon="category" />
                      <Text num tone="muted2" variant="mutedSmall">
                        ينتهي خلال {toArabicDigits(r.daysLeft)} يوم
                      </Text>
                    </View>
                    <Text variant="h4" style={{ marginBottom: 6 }}>
                      {r.projectTitleAr}
                    </Text>
                    <Text variant="small" tone="muted" style={{ lineHeight: 22, marginBottom: 14 }}>
                      {r.specsAr}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row-reverse',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: `rgba(${colors.inkRgb},0.07)`,
                      }}
                    >
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                        <Icon name="gavel" size={16} color={colors.muted2} />
                        <Text num tone="muted" variant="small">
                          {toArabicDigits(r.bidsCount)} عرض حتى الآن
                        </Text>
                      </View>
                      <Text num tone="muted2" variant="mutedSmall">
                        ينتهي: {r.dueDate}
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              ))}

            {tab === 'bids' &&
              myBids.map((b) => {
                const color = BID_STATUS_COLOR[b.status]!;
                return (
                  <Card key={b.id}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 11,
                          backgroundColor: color + '22',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name="gavel" size={20} color={color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="h4">{b.rfqTitle}</Text>
                        <Text num tone="muted2" variant="mutedSmall">
                          قُدِّم {b.submittedAt}
                        </Text>
                      </View>
                      <View
                        style={{
                          paddingVertical: 4,
                          paddingHorizontal: 11,
                          borderRadius: 20,
                          backgroundColor: color + '18',
                        }}
                      >
                        <Text style={{ color, fontSize: 11, fontWeight: '700' }}>
                          {BID_STATUS_LABEL[b.status]}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={{
                        flexDirection: 'row-reverse',
                        gap: 14,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: `rgba(${colors.inkRgb},0.07)`,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text tone="muted2" variant="mutedSmall">
                          المبلغ
                        </Text>
                        <Text num style={{ color: colors.accent, fontWeight: '700', fontSize: 15 }}>
                          {fmtSAR(b.amountHalalas)}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text tone="muted2" variant="mutedSmall">
                          مدة التسليم
                        </Text>
                        <Text num style={{ fontWeight: '700', fontSize: 15 }}>
                          {toArabicDigits(b.leadTimeDays)} يوم
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
