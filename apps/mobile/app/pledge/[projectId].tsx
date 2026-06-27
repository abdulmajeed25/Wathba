import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Header, Text, Card, Button, Icon } from '../../src/ui';
import { useProject, useRewardTiers } from '../../src/data/hooks';
import { fmtSAR, toArabicDigits } from '../../src/data/format';

type StepKey = 'tier' | 'info' | 'payment' | 'done';

const STEPS: Array<{ key: StepKey; label: string; n: string }> = [
  { key: 'tier', label: 'المكافأة', n: '١' },
  { key: 'info', label: 'البيانات', n: '٢' },
  { key: 'payment', label: 'الدفع', n: '٣' },
  { key: 'done', label: 'انتهى', n: '٤' },
];

export default function PledgeFlow() {
  const { projectId, tier } = useLocalSearchParams<{ projectId: string; tier?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const projectQ = useProject(projectId);
  const tiersQ = useRewardTiers(projectId);
  const [step, setStep] = useState<StepKey>(tier ? 'info' : 'tier');
  const [selectedTier, setSelectedTier] = useState<string | undefined>(tier);

  useEffect(() => {
    if (tier) setSelectedTier(tier);
  }, [tier]);

  const tierData = useMemo(
    () => (tiersQ.data ?? []).find((t) => t.id === selectedTier),
    [tiersQ.data, selectedTier],
  );

  const currIndex = STEPS.findIndex((s) => s.key === step);
  const canBack = currIndex > 0 && step !== 'done';

  const next = () => {
    if (step === 'tier' && selectedTier) setStep('info');
    else if (step === 'info') setStep('payment');
    else if (step === 'payment') setStep('done');
  };
  const back = () => {
    if (currIndex > 0) setStep(STEPS[currIndex - 1]!.key);
  };

  if (!projectQ.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <Header />
        <View style={{ padding: 24 }}>
          <Text tone="muted">جاري التحميل…</Text>
        </View>
      </SafeAreaView>
    );
  }
  const p = projectQ.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ padding: 24, paddingBottom: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 14 }}
          >
            <Icon name="arrow_forward" size={16} color={colors.muted} />
            <Text tone="muted" variant="small">
              عودة للمشروع
            </Text>
          </Pressable>
          <Text variant="h1" style={{ fontSize: 26, marginBottom: 4 }}>
            ادعم: {p.titleAr}
          </Text>
          <Text tone="muted" variant="small">
            دعمك مؤمَّن — لن يُخصم أي مبلغ إلا عند نجاح المشروع.
          </Text>
        </View>

        {/* Stepper */}
        <View style={{ flexDirection: 'row-reverse', paddingHorizontal: 24, marginBottom: 24 }}>
          {STEPS.map((s, i) => {
            const isActive = s.key === step;
            const isDone = i < currIndex || step === 'done';
            return (
              <View key={s.key} style={{ flexDirection: 'row-reverse', alignItems: 'center', flex: 1 }}>
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor:
                        isActive || isDone ? colors.accent : `rgba(${colors.inkRgb},0.08)`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isDone && !isActive ? (
                      <Icon name="check" size={18} color={colors.onAccent} />
                    ) : (
                      <Text
                        num
                        style={{
                          color: isActive || isDone ? colors.onAccent : colors.muted,
                          fontWeight: '700',
                          fontSize: 13,
                        }}
                      >
                        {s.n}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 11,
                      color: isActive ? colors.text : colors.muted,
                      fontWeight: '600',
                    }}
                  >
                    {s.label}
                  </Text>
                </View>
                {i < STEPS.length - 1 && (
                  <View
                    style={{
                      flex: 1,
                      height: 2,
                      backgroundColor: `rgba(${colors.inkRgb},0.1)`,
                      marginHorizontal: 8,
                      marginBottom: 18,
                    }}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* STEP BODIES */}
        <View style={{ paddingHorizontal: 24 }}>
          {step === 'tier' && (
            <View>
              <Text variant="h3" style={{ marginBottom: 14 }}>
                اختر مستوى الدعم
              </Text>
              <View style={{ gap: 12 }}>
                {(tiersQ.data ?? []).map((t) => {
                  const isSel = t.id === selectedTier;
                  return (
                    <Pressable key={t.id} onPress={() => setSelectedTier(t.id)}>
                      <Card
                        style={{
                          borderWidth: 1.5,
                          borderColor: isSel ? colors.accent : `rgba(${colors.inkRgb},0.09)`,
                          backgroundColor: isSel ? `rgba(${colors.accentRgb},0.07)` : colors.card,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row-reverse',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 6,
                          }}
                        >
                          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                            <Text num style={{ color: colors.accent, fontWeight: '700', fontSize: 18 }}>
                              {fmtSAR(t.amountHalalas)}
                            </Text>
                            <Text variant="h4">{t.titleAr}</Text>
                          </View>
                          <Text num tone="muted2" variant="mutedSmall">
                            {toArabicDigits(t.backers)} داعم
                          </Text>
                        </View>
                        <Text variant="small" tone="muted">
                          {t.descAr}
                        </Text>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {step === 'info' && (
            <View>
              <Text variant="h3" style={{ marginBottom: 18 }}>
                معلومات الشحن والتواصل
              </Text>
              <Field label="الاسم الكامل" placeholder="مثال: سارة العامري" />
              <Field label="البريد الإلكتروني" placeholder="you@email.com" keyboardType="email-address" />
              <Field label="العنوان" placeholder="الشارع، المبنى، الشقة" />
              <View style={{ flexDirection: 'row-reverse', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="المدينة" placeholder="الرياض" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="الدولة" placeholder="السعودية" defaultValue="السعودية" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="الرمز" placeholder="11564" keyboardType="number-pad" />
                </View>
              </View>
            </View>
          )}

          {step === 'payment' && (
            <View>
              <Text variant="h3" style={{ marginBottom: 18 }}>
                طريقة الدفع
              </Text>
              <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 18 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: `rgba(${colors.accentRgb},0.06)`,
                    borderWidth: 1.5,
                    borderColor: colors.accent,
                    borderRadius: 13,
                    padding: 14,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Icon name="credit_card" size={22} color={colors.accent} />
                  <Text style={{ fontWeight: '600' }}>بطاقة ائتمان</Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: `rgba(${colors.inkRgb},0.03)`,
                    borderWidth: 1,
                    borderColor: `rgba(${colors.inkRgb},0.1)`,
                    borderRadius: 13,
                    padding: 14,
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Icon name="account_balance_wallet" size={22} color={colors.muted} />
                  <Text style={{ fontWeight: '600', color: colors.muted }}>محفظة رقمية</Text>
                </View>
              </View>
              <Field label="رقم البطاقة" placeholder="4242 4242 4242 4242" num />
              <View style={{ flexDirection: 'row-reverse', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="تاريخ الانتهاء" placeholder="08 / 28" num />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="CVC" placeholder="•••" secure />
                </View>
              </View>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 9,
                  marginTop: 18,
                  padding: 12,
                  borderRadius: 11,
                  backgroundColor: 'rgba(52,211,153,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(52,211,153,0.18)',
                }}
              >
                <Icon name="shield" size={18} color={colors.pos} />
                <Text variant="small" style={{ color: colors.pos, flex: 1 }}>
                  الدفع مشفّر بالكامل. لن يُخصم المبلغ إلا عند نجاح المشروع.
                </Text>
              </View>
            </View>
          )}

          {step === 'done' && (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <LinearGradient
                colors={colors.grad as unknown as [string, string]}
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 42,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 22,
                }}
              >
                <Icon name="check" size={42} color={colors.onAccent} />
              </LinearGradient>
              <Text variant="h1" style={{ marginBottom: 10, textAlign: 'center' }}>
                شكراً لدعمك! 🎉
              </Text>
              <Text variant="body" tone="textSoft" style={{ textAlign: 'center', marginBottom: 20 }}>
                أصبحت الآن داعماً لـ«{p.titleAr}». سنوافيك بكل التحديثات على بريدك.
              </Text>
              <View
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: 14,
                  backgroundColor: 'rgba(251,191,36,0.10)',
                  borderWidth: 1,
                  borderColor: 'rgba(251,191,36,0.30)',
                  marginBottom: 24,
                }}
              >
                <Icon name="workspace_premium" size={24} color={colors.gold} />
                <View>
                  <Text tone="muted" variant="small">
                    ارتقت رتبتك إلى
                  </Text>
                  <Text style={{ color: colors.gold, fontWeight: '700', fontSize: 16 }}>
                    داعم
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                <Button title="ملفي الشخصي" onPress={() => router.replace('/profile')} />
                <Button title="استكشف المزيد" variant="ghost" onPress={() => router.replace('/explore')} />
              </View>
            </View>
          )}
        </View>

        {/* Order summary (steps 1-3) */}
        {step !== 'done' && tierData && (
          <View style={{ paddingHorizontal: 24, paddingTop: 22 }}>
            <Card>
              <Text style={{ fontWeight: '700', marginBottom: 16 }}>ملخص الدعم</Text>
              <View
                style={{
                  height: 100,
                  borderRadius: 12,
                  backgroundColor: p.imageAccent ?? colors.phBg,
                  marginBottom: 14,
                }}
              />
              <Text variant="h4" style={{ marginBottom: 4 }}>
                {p.titleAr}
              </Text>
              <Text tone="muted2" variant="mutedSmall" style={{ marginBottom: 14 }}>
                بواسطة {p.creator}
              </Text>
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: `rgba(${colors.inkRgb},0.08)`,
                  paddingTop: 12,
                  gap: 10,
                }}
              >
                <Row label={tierData.titleAr} value={fmtSAR(tierData.amountHalalas)} />
                {tierData.includesPhysicalProduct && (
                  <Row label="الشحن" value={fmtSAR(2_500)} />
                )}
                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: `rgba(${colors.inkRgb},0.08)`,
                    paddingTop: 12,
                  }}
                >
                  <Row
                    label="الإجمالي"
                    value={fmtSAR(tierData.amountHalalas + (tierData.includesPhysicalProduct ? 2_500 : 0))}
                    accent
                  />
                </View>
              </View>
            </Card>
          </View>
        )}

        {/* Nav buttons */}
        {step !== 'done' && (
          <View style={{ flexDirection: 'row-reverse', gap: 10, padding: 24, paddingTop: 22 }}>
            {canBack && <Button title="رجوع" variant="ghost" onPress={back} />}
            <Button
              title={step === 'payment' ? 'تأكيد الدعم' : 'التالي'}
              onPress={next}
              style={{ flex: 1 }}
              size="lg"
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  num?: boolean;
  secure?: boolean;
  defaultValue?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text variant="small" tone="muted" style={{ marginBottom: 7 }}>
        {props.label}
      </Text>
      <TextInput
        placeholder={props.placeholder}
        placeholderTextColor={colors.muted2}
        keyboardType={props.keyboardType ?? 'default'}
        secureTextEntry={props.secure}
        defaultValue={props.defaultValue}
        style={{
          backgroundColor: `rgba(${colors.inkRgb},0.04)`,
          borderWidth: 1,
          borderColor: `rgba(${colors.inkRgb},0.12)`,
          borderRadius: 11,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 14,
          color: colors.text,
          fontFamily: props.num ? 'SpaceGrotesk' : 'IBMPlexSansArabic',
          textAlign: 'right',
        }}
      />
    </View>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
      <Text
        style={{
          color: accent ? colors.text : colors.muted,
          fontWeight: accent ? '700' : '500',
          fontSize: accent ? 17 : 14,
        }}
      >
        {label}
      </Text>
      <Text
        num
        style={{
          color: accent ? colors.accent : colors.text,
          fontWeight: accent ? '700' : '600',
          fontSize: accent ? 17 : 14,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
