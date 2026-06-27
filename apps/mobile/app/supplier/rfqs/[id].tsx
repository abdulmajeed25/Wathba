import React, { useState } from 'react';
import { View, ScrollView, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { Header, Text, Card, Badge, Icon, Button } from '../../../src/ui';
import { rfqs } from '../../../src/data/procurement-mock';
import { toArabicDigits } from '../../../src/data/format';

export default function RFQDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [amount, setAmount] = useState('');
  const [lead, setLead] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const rfq = rfqs.find((r) => r.id === id);
  if (!rfq) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <Header />
        <View style={{ padding: 24 }}>
          <Text tone="muted">RFQ غير موجود.</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text tone="muted" variant="small">عودة للفرص</Text>
          </Pressable>
          <Badge label={rfq.category} icon="category" tone="accent" style={{ marginBottom: 14 }} />
          <Text variant="h1" style={{ fontSize: 26, marginBottom: 6 }}>
            {rfq.projectTitleAr}
          </Text>
          <Text num tone="muted2" variant="small">
            ينتهي خلال {toArabicDigits(rfq.daysLeft)} يوم · {rfq.dueDate}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, marginBottom: 18 }}>
          <Card>
            <Text variant="h4" style={{ marginBottom: 8 }}>المواصفات</Text>
            <Text variant="body" tone="textSoft" style={{ lineHeight: 26 }}>
              {rfq.specsAr}
            </Text>
          </Card>
        </View>

        <View style={{ paddingHorizontal: 24 }}>
          <Card>
            <Text variant="h4" style={{ marginBottom: 4 }}>قدّم عرضك</Text>
            <Text variant="small" tone="muted2" style={{ marginBottom: 18 }}>
              المنصة عرض عكسي — أفضل عرض من حيث السعر والمدة يفوز.
            </Text>
            {!submitted ? (
              <>
                <Field
                  label="السعر الإجمالي (ر.س)"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="١٩٢,٥٠٠"
                  num
                />
                <Field
                  label="مدة التسليم (يوم)"
                  value={lead}
                  onChangeText={setLead}
                  placeholder="٤٥"
                  num
                />
                <View style={{ marginBottom: 14 }}>
                  <Text variant="small" tone="textSoft" style={{ marginBottom: 8, fontWeight: '600' }}>
                    ملاحظات الالتزام بالمواصفات
                  </Text>
                  <TextInput
                    multiline
                    placeholder="اشرح كيف تلبّي المواصفات + ضمانات الجودة + شروط الدفع."
                    placeholderTextColor={colors.muted2}
                    style={{
                      minHeight: 100,
                      backgroundColor: `rgba(${colors.inkRgb},0.04)`,
                      borderWidth: 1,
                      borderColor: `rgba(${colors.inkRgb},0.12)`,
                      borderRadius: 12,
                      padding: 14,
                      color: colors.text,
                      fontFamily: 'IBMPlexSansArabic',
                      textAlign: 'right',
                      textAlignVertical: 'top',
                      lineHeight: 22,
                    }}
                  />
                </View>
                <Button
                  title="إرسال العرض"
                  iconLeft="send"
                  size="lg"
                  full
                  onPress={() => setSubmitted(true)}
                />
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Icon name="check_circle" size={50} color={colors.pos} />
                <Text variant="h3" style={{ marginTop: 12 }}>تم استلام عرضك</Text>
                <Text variant="small" tone="muted" style={{ marginTop: 6, textAlign: 'center' }}>
                  سيقوم صاحب المشروع بمراجعة كل العروض وإبلاغك بالقرار في «عروضي».
                </Text>
              </View>
            )}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  num?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text variant="small" tone="textSoft" style={{ marginBottom: 8, fontWeight: '600' }}>
        {props.label}
      </Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.muted2}
        keyboardType={props.num ? 'numeric' : 'default'}
        style={{
          backgroundColor: `rgba(${colors.inkRgb},0.04)`,
          borderWidth: 1,
          borderColor: `rgba(${colors.inkRgb},0.12)`,
          borderRadius: 12,
          padding: 14,
          fontSize: 15,
          color: colors.text,
          fontFamily: props.num ? 'SpaceGrotesk' : 'IBMPlexSansArabic',
          textAlign: 'right',
        }}
      />
    </View>
  );
}
