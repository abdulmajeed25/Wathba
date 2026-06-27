import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Header, Text } from '../../src/ui';

export default function Terms() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        <Text variant="h1" style={{ marginBottom: 12 }}>الشروط والأحكام</Text>
        <Text tone="muted" variant="small" style={{ marginBottom: 20 }}>
          آخر تحديث: ٢٠٢٦/٠٦/٢٠
        </Text>

        <Section title="١. تعريف الخدمة">
          وثبة منصة سعودية للتمويل الجماعي بنموذج «الكل أو لا شيء»، تربط المبدعين بمجتمع من
          الداعمين الذين يحصلون على مكافآت عند نجاح المشروع.
        </Section>
        <Section title="٢. نموذج التمويل">
          عند طرح مشروع تُحدَّد نسبة عتبة الإطلاق (الافتراضية ٨٠٪ من الهدف). إذا بلغ التمويل هذه
          العتبة عند الموعد النهائي فإن المنصة تخصم المبالغ المحجوزة وتُحوّلها للمبدع على دفعات وفق
          المراحل. إذا لم تُبلغ، يُعاد كامل الدعم تلقائياً إلى البطاقات.
        </Section>
        <Section title="٣. حسابات الضمان">
          كل المبالغ تُحفظ في حساب ضمان مع مزوّد الدفع المرخّص (مَيسر). لا يستلم المبدع المال
          مباشرة بل عند تحقّق المرحلة المرتبطة وإجازتها.
        </Section>
        <Section title="٤. حقوق الداعم">
          • إلغاء الدعم في أي وقت قبل الموعد النهائي.{'\n'}
          • الاسترداد الكامل عند فشل المشروع.{'\n'}
          • الوصول للوحة الشفافية الحيّة لكل مشروع.{'\n'}
          • التواصل المباشر مع المبدع عبر التحديثات والتعليقات.
        </Section>
        <Section title="٥. مسؤوليات المبدع">
          يلتزم المبدع بالتنفيذ وفق المواصفات المنشورة وفي المواعيد المحددة، وبتحديث الداعمين دورياً
          وفق التقدّم. عدم الالتزام يُتيح للمنصة استرداد المبالغ من حساب الضمان.
        </Section>
        <Section title="٦. حدود المسؤولية">
          المنصة وسيط مالي وتقني، ولا تضمن نتائج المشاريع التجارية. كل قرار دعم هو قرار شخصي يتم
          بمعرفة الداعم بالمخاطر المرتبطة.
        </Section>
        <Section title="٧. الاختصاص القضائي">
          تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتُحال النزاعات لمحاكمها المختصة.
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
