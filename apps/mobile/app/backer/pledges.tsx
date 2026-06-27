import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Header, Text, Card, EmptyState } from '../../src/ui';
import { projects } from '../../src/data/mock';
import { fmtSAR } from '../../src/data/format';

interface MyPledge {
  id: string;
  projectId: string;
  projectTitleAr: string;
  tierTitle: string;
  amountHalalas: number;
  status: 'HELD' | 'CAPTURED' | 'REFUNDED';
  date: string;
}

const STATUS_LABEL: Record<MyPledge['status'], string> = {
  HELD: 'محجوز (ينتظر النجاح)',
  CAPTURED: 'تمّ الخصم',
  REFUNDED: 'مسترَد',
};
const STATUS_COLOR: Record<MyPledge['status'], string> = {
  HELD: '#fbbf24',
  CAPTURED: '#05a661',
  REFUNDED: '#8a958c',
};

const MOCK_PLEDGES: MyPledge[] = [
  { id: 'pl1', projectId: 'sirb', projectTitleAr: 'سِرب — درون التصوير الذكي', tierTitle: 'الإصدار المبكر', amountHalalas: 75_000, status: 'HELD', date: '٢٠٢٦/٠٦/٢٠' },
  { id: 'pl2', projectId: 'hekaya', projectTitleAr: 'حكايا — قصص الأطفال', tierTitle: 'الداعم الذهبي', amountHalalas: 250_000, status: 'CAPTURED', date: '٢٠٢٦/٠٥/٠٤' },
  { id: 'pl3', projectId: 'tarib', projectTitleAr: 'طرَب — لعبة لوحية', tierTitle: 'النسخة الكاملة', amountHalalas: 35_000, status: 'REFUNDED', date: '٢٠٢٦/٠٤/١٢' },
];

export default function MyPledges() {
  const { colors } = useTheme();
  const router = useRouter();

  if (MOCK_PLEDGES.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header />
        <EmptyState
          icon="volunteer_activism"
          title="لم تدعم مشروعاً بعد"
          subtitle="استكشف مشاريع المبدعين العرب وكن جزءاً من تحقيق فكرة."
          cta={{ label: 'استكشف المشاريع', onPress: () => router.push('/explore') }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: 24, paddingBottom: 8 }}>
          <Text num style={{ fontSize: 12, color: colors.accent, letterSpacing: 2, marginBottom: 6 }}>
            MY PLEDGES
          </Text>
          <Text variant="h1" style={{ fontSize: 28, marginBottom: 6 }}>
            دعومي
          </Text>
          <Text tone="muted" variant="small">
            تتبّع كل المشاريع التي دعمتها وحالتها الحالية.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 14, marginTop: 12 }}>
          {MOCK_PLEDGES.map((p) => {
            const proj = projects.find((x) => x.id === p.projectId);
            const color = STATUS_COLOR[p.status]!;
            return (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/backer/pledges/${p.id}` as never)}
              >
                <Card>
                  <View style={{ flexDirection: 'row-reverse', gap: 12 }}>
                    <View
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 14,
                        backgroundColor: proj?.imageAccent ?? colors.phBg,
                      }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="h4" style={{ marginBottom: 4 }} numberOfLines={1}>
                        {p.projectTitleAr}
                      </Text>
                      <Text variant="small" tone="muted2" style={{ marginBottom: 6 }}>
                        {p.tierTitle} · {p.date}
                      </Text>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text num style={{ color: colors.accent, fontWeight: '700' }}>
                          {fmtSAR(p.amountHalalas)}
                        </Text>
                        <View
                          style={{
                            paddingVertical: 4,
                            paddingHorizontal: 10,
                            borderRadius: 20,
                            backgroundColor: color + '18',
                          }}
                        >
                          <Text style={{ color, fontSize: 11, fontWeight: '700' }}>
                            {STATUS_LABEL[p.status]}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
