import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Header, Text, Card, Icon } from '../../src/ui';

/**
 * Per-contract Arabic terms shown at pledge — mirrors the templates in
 * apps/api/src/contracts/contracts.service.ts so the user-facing copy
 * always matches what the backend records.
 */

const TYPES: Array<{
  id: 'DONATION' | 'ISTISNA' | 'SALAM';
  label: string;
  icon: string;
  body: string;
}> = [
  {
    id: 'DONATION',
    label: 'تبرّع (Donation)',
    icon: 'volunteer_activism',
    body:
      'بدعمك لهذا المشروع، أنت تساهم طوعياً في تمويله. مكافأتك (إن وُجدت) هي شكر رمزي من المبدع، وليست منتجاً مضموناً تجارياً. تُستخدم في المشاريع غير الربحية والرمزية والإبداعية.',
  },
  {
    id: 'ISTISNA',
    label: 'استصناع (Istisna)',
    icon: 'inventory_2',
    body:
      'بدعمك، تطلب من المبدع صناعة المنتج وفق المواصفات المنشورة وتسليمه بحلول التاريخ المحدد. تُحتسب أموالك في حساب ضمان ولا تُحوَّل إلا عند تحقّق المشروع لشروط النجاح. هذا العقد متوافق مع الشريعة ومناسب للمنتجات الجديدة.',
  },
  {
    id: 'SALAM',
    label: 'سَلَم (Salam)',
    icon: 'inventory',
    body:
      'تدفع المبلغ مقدّماً لقاء سلعة موصوفة في الذمة تُسلَّم في موعد لاحق. تُحفظ أموالك في حساب ضمان ولا تُحوَّل قبل بلوغ هدف التمويل. مناسب للمحاصيل والإنتاج المتسلسل.',
  },
];

export default function ContractTerms() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        <Text variant="h1" style={{ marginBottom: 8 }}>شروط عقود الدعم</Text>
        <Text tone="muted" variant="small" style={{ marginBottom: 20 }}>
          كل مشروع يُحدّد نوع العقد المناسب لطبيعته. هذه نظرة كاملة على الأنواع المتاحة.
        </Text>
        <View style={{ gap: 14 }}>
          {TYPES.map((t) => (
            <Card key={t.id}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Icon name={t.icon} size={26} color={colors.accent} />
                <Text variant="h3">{t.label}</Text>
              </View>
              <Text variant="body" tone="textSoft" style={{ lineHeight: 26 }}>{t.body}</Text>
            </Card>
          ))}
        </View>
        <View
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 14,
            backgroundColor: `rgba(${colors.accentRgb},0.05)`,
            borderColor: `rgba(${colors.accentRgb},0.18)`,
            borderWidth: 1,
            flexDirection: 'row-reverse',
            gap: 10,
          }}
        >
          <Icon name="tips_and_updates" size={20} color={colors.accent} />
          <Text variant="small" tone="textSoft" style={{ flex: 1, lineHeight: 22 }}>
            هذه نسخة عامة. النسخة الملزمة هي ما يظهر في صفحة الدعم لكل مشروع بحسب نوع العقد المحدد.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
