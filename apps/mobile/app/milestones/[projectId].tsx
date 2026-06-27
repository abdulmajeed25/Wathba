import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Header, Text, Card, Button, Icon, ProgressBar } from '../../src/ui';
import { toArabicDigits, fmtSAR } from '../../src/data/format';
import { useProject } from '../../src/data/hooks';

/**
 * Creator-facing milestone management screen.
 * Pulls the plan from /v1/projects/:projectId/milestones (mocked here
 * with a deterministic sample matching the design).
 */

interface MilestoneRow {
  id: string;
  order: number;
  titleAr: string;
  releasePct: number;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'RELEASED';
  amountHalalas: number;
}

const MOCK_MILESTONES: MilestoneRow[] = [
  { id: 'm1', order: 1, titleAr: 'إنهاء النموذج الأوّلي', releasePct: 25, status: 'RELEASED', amountHalalas: 641_687_500 },
  { id: 'm2', order: 2, titleAr: 'بدء التصنيع التجريبي', releasePct: 30, status: 'APPROVED', amountHalalas: 770_025_000 },
  { id: 'm3', order: 3, titleAr: 'الدفعة الأولى من الشحن', releasePct: 25, status: 'SUBMITTED', amountHalalas: 641_687_500 },
  { id: 'm4', order: 4, titleAr: 'إكمال التسليم لكل الداعمين', releasePct: 20, status: 'PENDING', amountHalalas: 513_350_000 },
];

const STATUS_LABEL: Record<MilestoneRow['status'], string> = {
  PENDING: 'لم تبدأ',
  SUBMITTED: 'قُدِّمت الأدلة',
  APPROVED: 'مُعتمدة',
  RELEASED: 'تمّ الصرف',
};

const STATUS_COLOR = (status: MilestoneRow['status']) =>
  status === 'RELEASED' ? '#05a661'
  : status === 'APPROVED' ? '#3b82f6'
  : status === 'SUBMITTED' ? '#fbbf24'
  : '#8a958c';

export default function MilestonesScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const projectQ = useProject(projectId);
  const router = useRouter();
  const { colors } = useTheme();

  const totalReleased = MOCK_MILESTONES
    .filter((m) => m.status === 'RELEASED')
    .reduce((acc, m) => acc + m.amountHalalas, 0);
  const totalPlanned = MOCK_MILESTONES.reduce((acc, m) => acc + m.amountHalalas, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: 24 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 14 }}
          >
            <Icon name="arrow_forward" size={16} color={colors.muted} />
            <Text tone="muted" variant="small">عودة</Text>
          </Pressable>
          <Text num style={{ fontSize: 12, color: colors.accent, letterSpacing: 2, marginBottom: 6 }}>
            CREATOR / MILESTONES
          </Text>
          <Text variant="h1" style={{ fontSize: 28, marginBottom: 6 }}>
            مراحل المشروع
          </Text>
          <Text tone="muted" variant="small">
            {projectQ.data?.titleAr ?? '—'}
          </Text>
        </View>

        {/* Summary card */}
        <View style={{ paddingHorizontal: 24, marginBottom: 18 }}>
          <Card padding={20}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <Text variant="h4">مبلغ مفرَج عنه</Text>
              <Text num style={{ color: colors.accent, fontSize: 22, fontWeight: '700' }}>
                {fmtSAR(totalReleased)}
              </Text>
            </View>
            <ProgressBar pct={totalReleased / totalPlanned} height={9} />
            <Text num tone="muted2" variant="mutedSmall" style={{ marginTop: 8 }}>
              من إجمالي {fmtSAR(totalPlanned)} على {toArabicDigits(MOCK_MILESTONES.length)} مراحل
            </Text>
          </Card>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 14 }}>
          {MOCK_MILESTONES.map((m) => (
            <Card key={m.id}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 14 }}>
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: STATUS_COLOR(m.status) + '20',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text num style={{ color: STATUS_COLOR(m.status), fontWeight: '700' }}>
                    {toArabicDigits(m.order)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text variant="h4" style={{ flex: 1 }}>{m.titleAr}</Text>
                    <View
                      style={{
                        paddingVertical: 3,
                        paddingHorizontal: 10,
                        borderRadius: 20,
                        backgroundColor: STATUS_COLOR(m.status) + '18',
                      }}
                    >
                      <Text style={{ color: STATUS_COLOR(m.status), fontSize: 11, fontWeight: '700' }}>
                        {STATUS_LABEL[m.status]}
                      </Text>
                    </View>
                  </View>
                  <Text num tone="muted2" variant="mutedSmall">
                    {toArabicDigits(m.releasePct)}٪ من التمويل · {fmtSAR(m.amountHalalas)}
                  </Text>
                  {m.status === 'PENDING' && (
                    <Button title="رفع الأدلة" iconLeft="cloud_upload" size="sm" style={{ marginTop: 12, alignSelf: 'flex-start' }} />
                  )}
                  {m.status === 'APPROVED' && (
                    <Text variant="small" tone="pos" style={{ marginTop: 8 }}>
                      جاهزة للصرف — سيتم التحويل تلقائياً خلال ٤٨ ساعة
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
