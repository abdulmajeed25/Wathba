import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Header, Text, Badge } from '../../src/ui';

export default function Privacy() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        <Badge label="نظام حماية البيانات الشخصية · سدايا" tone="accent" icon="shield" style={{ marginBottom: 16 }} />
        <Text variant="h1" style={{ marginBottom: 12 }}>سياسة الخصوصية</Text>
        <Text tone="muted" variant="small" style={{ marginBottom: 20 }}>متوافقة مع نظام حماية البيانات الشخصية (PDPL)</Text>

        <Section title="١. ما البيانات التي نجمعها؟">
          الاسم، البريد، رقم الجوال، بيانات الهوية الوطنية عند التحقق من نفاذ، عناوين الشحن
          للمكافآت المادية، ومعلومات تقنية كنوع الجهاز وعنوان IP.
        </Section>
        <Section title="٢. لماذا نجمعها؟">
          • لتقديم خدمات المنصة (دعم، تمويل، شحن، شفافية).{'\n'}
          • للالتزام بمتطلبات الجهات التنظيمية (KYC, AML, ZATCA).{'\n'}
          • لتحسين تجربة الاستخدام والأمان.
        </Section>
        <Section title="٣. أين تُخزَّن البيانات؟">
          داخل المملكة العربية السعودية، على بنية تحتية موثوقة ومُؤمَّنة.
        </Section>
        <Section title="٤. حقوقك">
          • الاطلاع على بياناتك.{'\n'}
          • تصحيحها أو تحديثها.{'\n'}
          • طلب حذفها — مع مراعاة المتطلبات النظامية.{'\n'}
          • نقلها لمزوّد آخر.{'\n'}
          • تقديم شكوى للسلطة المختصة (هيئة البيانات والذكاء الاصطناعي — سدايا).
        </Section>
        <Section title="٥. التواصل">
          لأي استفسار بخصوص بياناتك تواصل معنا على privacy@wathba.sa.
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text variant="h3" style={{ marginBottom: 8 }}>{title}</Text>
      <Text variant="body" tone="textSoft" style={{ lineHeight: 26 }}>{children}</Text>
    </View>
  );
}
