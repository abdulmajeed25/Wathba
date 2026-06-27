import React, { useState } from 'react';
import { View, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { Header, Text, Card, Button, Icon } from '../src/ui';
import { useCategories } from '../src/data/hooks';
import { toArabicDigits } from '../src/data/format';

type Step = 1 | 2 | 3 | 4 | 5;
const LABELS: Record<Step, string> = {
  1: 'الأساسيات',
  2: 'الهدف',
  3: 'القصة',
  4: 'المكافآت',
  5: 'مراجعة',
};
const ICONS: Record<Step, string> = {
  1: 'edit_note',
  2: 'flag',
  3: 'auto_stories',
  4: 'redeem',
  5: 'check_circle',
};

export default function LaunchWizard() {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>(1);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const catsQ = useCategories();

  const next = () => setStep((s) => (s < 5 ? ((s + 1) as Step) : 5));
  const back = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : 1));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: 24, paddingBottom: 12 }}>
          <Text num style={{ fontSize: 12, color: colors.accent, letterSpacing: 2, marginBottom: 6 }}>
            START A PROJECT
          </Text>
          <Text variant="h1" style={{ marginBottom: 6 }}>
            أطلق مشروعك على وثبة
          </Text>
          <Text tone="muted" variant="small" style={{ marginBottom: 22 }}>
            خمس خطوات تفصلك عن تحويل فكرتك إلى حملة تمويل ناجحة.
          </Text>

          {/* Stepper */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n, i) => {
              const isActive = n === step;
              const isDone = n < step;
              return (
                <View key={n} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor:
                        isActive || isDone ? colors.accent : `rgba(${colors.inkRgb},0.08)`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon
                      name={ICONS[n as Step]}
                      size={20}
                      color={isActive || isDone ? colors.onAccent : colors.muted}
                    />
                  </View>
                  <Text
                    variant="mutedSmall"
                    style={{ color: isActive ? colors.text : colors.muted2, textAlign: 'center' }}
                  >
                    {LABELS[n as Step]}
                  </Text>
                  {i < 4 && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 18,
                        right: -6,
                        height: 2,
                        width: 12,
                        backgroundColor: `rgba(${colors.inkRgb},0.1)`,
                      }}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={{ paddingHorizontal: 24 }}>
          <Card padding={22}>
            {step === 1 && (
              <View>
                <Text variant="h3" style={{ marginBottom: 4 }}>
                  أساسيات المشروع
                </Text>
                <Text tone="muted2" variant="small" style={{ marginBottom: 22 }}>
                  ابدأ بالاسم والفئة — هذه أول ما يراه الداعمون.
                </Text>
                <Field label="عنوان المشروع" placeholder="مثال: سِرب — درون التصوير الذكي" />
                <Field label="الوصف المختصر" placeholder="جملة واحدة تلخّص مشروعك" />
                <Text variant="small" tone="textSoft" style={{ marginBottom: 10, fontWeight: '600' }}>
                  الفئة
                </Text>
                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
                  {(catsQ.data ?? []).map((c) => {
                    const isSel = selectedCat === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setSelectedCat(c.id)}
                        style={{
                          flexDirection: 'row-reverse',
                          alignItems: 'center',
                          gap: 7,
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 30,
                          borderWidth: 1,
                          borderColor: isSel ? colors.accent : `rgba(${colors.inkRgb},0.1)`,
                          backgroundColor: isSel
                            ? `rgba(${colors.accentRgb},0.10)`
                            : `rgba(${colors.inkRgb},0.04)`,
                        }}
                      >
                        <Icon name={c.icon} size={16} color={isSel ? colors.accent : colors.muted} />
                        <Text style={{ color: isSel ? colors.accent : colors.muted, fontSize: 13, fontWeight: '600' }}>
                          {c.ar}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {step === 2 && (
              <View>
                <Text variant="h3" style={{ marginBottom: 4 }}>
                  هدف التمويل
                </Text>
                <Text tone="muted2" variant="small" style={{ marginBottom: 22 }}>
                  حدّد مبلغاً واقعياً يغطّي تكاليف تنفيذ مشروعك.
                </Text>
                <View style={{ flexDirection: 'row-reverse', gap: 14, marginBottom: 22 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="هدف التمويل (ر.س)" placeholder="١٥٠,٠٠٠" num />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="مدة الحملة (يوم)" placeholder="٣٠" num />
                  </View>
                </View>
                <View
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    backgroundColor: `rgba(${colors.accentRgb},0.05)`,
                    borderWidth: 1,
                    borderColor: `rgba(${colors.accentRgb},0.18)`,
                    flexDirection: 'row-reverse',
                    gap: 12,
                  }}
                >
                  <Icon name="tips_and_updates" size={22} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', marginBottom: 4 }}>
                      نموذج «الكل أو لا شيء»
                    </Text>
                    <Text variant="small" tone="muted" style={{ lineHeight: 20 }}>
                      لن تتلقى أي تمويل إلا إذا بلغت ٨٠٪ من هدفك على الأقل خلال المدة المحددة. هذا يبني
                      الثقة مع الداعمين ويحميهم.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {step === 3 && (
              <View>
                <Text variant="h3" style={{ marginBottom: 4 }}>
                  القصة والوسائط
                </Text>
                <Text tone="muted2" variant="small" style={{ marginBottom: 22 }}>
                  المشاريع ذات الفيديو تجمع تمويلاً أكثر بنسبة ٨٥٪.
                </Text>
                <View
                  style={{
                    padding: 32,
                    borderRadius: 16,
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: `rgba(${colors.inkRgb},0.15)`,
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Icon name="cloud_upload" size={36} color={colors.accent} />
                  <Text style={{ fontWeight: '600', marginTop: 12 }}>اسحب فيديو أو صور المشروع هنا</Text>
                  <Text tone="muted2" variant="mutedSmall" style={{ marginTop: 5 }}>
                    MP4، PNG، JPG — حتى ٢٠٠MB
                  </Text>
                </View>
                <Text variant="small" tone="textSoft" style={{ marginBottom: 8, fontWeight: '600' }}>
                  قصة المشروع
                </Text>
                <TextInput
                  multiline
                  placeholder="احكِ قصتك: ما المشكلة التي تحلّها؟ من أنت؟ لماذا الآن؟"
                  placeholderTextColor={colors.muted2}
                  style={{
                    minHeight: 140,
                    backgroundColor: `rgba(${colors.inkRgb},0.04)`,
                    borderWidth: 1,
                    borderColor: `rgba(${colors.inkRgb},0.12)`,
                    borderRadius: 12,
                    padding: 14,
                    color: colors.text,
                    fontFamily: 'IBMPlexSansArabic',
                    textAlign: 'right',
                    lineHeight: 22,
                    textAlignVertical: 'top',
                  }}
                />
              </View>
            )}

            {step === 4 && (
              <View>
                <Text variant="h3" style={{ marginBottom: 4 }}>
                  مستويات المكافآت
                </Text>
                <Text tone="muted2" variant="small" style={{ marginBottom: 22 }}>
                  امنح داعميك أسباباً للمشاركة على مستويات مختلفة.
                </Text>
                {[1, 2, 3].map((n) => (
                  <View
                    key={n}
                    style={{
                      backgroundColor: `rgba(${colors.inkRgb},0.03)`,
                      borderWidth: 1,
                      borderColor: `rgba(${colors.inkRgb},0.1)`,
                      borderRadius: 14,
                      padding: 14,
                      marginBottom: 12,
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        backgroundColor: `rgba(${colors.accentRgb},0.1)`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text num style={{ color: colors.accent, fontWeight: '700', fontSize: 14 }}>
                        {toArabicDigits(n * 250)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', fontSize: 14 }}>مكافأة #{toArabicDigits(n)}</Text>
                      <Text variant="small" tone="muted">
                        وصف قصير للمكافأة وما تشمله من مزايا.
                      </Text>
                    </View>
                    <Icon name="edit" size={20} color={colors.muted2} />
                  </View>
                ))}
                <Pressable
                  style={{
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: `rgba(${colors.accentRgb},0.3)`,
                    borderRadius: 14,
                    padding: 16,
                    flexDirection: 'row-reverse',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Icon name="add_circle" size={20} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontWeight: '600' }}>
                    أضف مستوى مكافأة جديد
                  </Text>
                </Pressable>
              </View>
            )}

            {step === 5 && (
              <View>
                <Text variant="h3" style={{ marginBottom: 4 }}>
                  مراجعة وإطلاق
                </Text>
                <Text tone="muted2" variant="small" style={{ marginBottom: 22 }}>
                  راجع التفاصيل النهائية قبل الإطلاق.
                </Text>
                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
                  <SummaryCard label="العنوان" value="سِرب — درون التصوير الذكي" />
                  <SummaryCard label="الفئة" value="تقنية" />
                  <SummaryCard label="الهدف" value="١٥٠,٠٠٠ ر.س" accent />
                  <SummaryCard label="المدة" value="٣٠ يوم" />
                </View>
                <View
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    backgroundColor: `rgba(${colors.accentRgb},0.10)`,
                    borderWidth: 1,
                    borderColor: `rgba(${colors.accentRgb},0.25)`,
                    flexDirection: 'row-reverse',
                    gap: 12,
                  }}
                >
                  <Icon name="check_circle" size={26} color={colors.pos} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700' }}>مشروعك جاهز للإطلاق!</Text>
                    <Text variant="small" tone="muted" style={{ marginTop: 2 }}>
                      سيخضع لمراجعة سريعة خلال ٢٤ ساعة قبل النشر.
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </Card>

          <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 20 }}>
            {step > 1 && <Button title="رجوع" variant="ghost" onPress={back} />}
            <Button
              title={step === 5 ? 'إرسال للمراجعة' : 'التالي'}
              onPress={next}
              style={{ flex: 1 }}
              size="lg"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: { label: string; placeholder?: string; num?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text variant="small" tone="textSoft" style={{ marginBottom: 8, fontWeight: '600' }}>
        {props.label}
      </Text>
      <TextInput
        placeholder={props.placeholder}
        placeholderTextColor={colors.muted2}
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

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        backgroundColor: `rgba(${colors.inkRgb},0.03)`,
        borderWidth: 1,
        borderColor: `rgba(${colors.inkRgb},0.08)`,
        borderRadius: 13,
        padding: 14,
      }}
    >
      <Text tone="muted2" variant="mutedSmall" style={{ marginBottom: 5 }}>
        {label}
      </Text>
      <Text
        num={accent}
        style={{
          fontWeight: '700',
          fontSize: 15,
          color: accent ? colors.accent : colors.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
