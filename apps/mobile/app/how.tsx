import React from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme/ThemeProvider';
import { Header, Text, Card, Button, Icon } from '../src/ui';
import { useHowSteps } from '../src/data/hooks';
import { projectFaqs } from '../src/data/mock';

export default function How() {
  const { colors } = useTheme();
  const router = useRouter();
  const steps = useHowSteps();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text num style={{ fontSize: 12, color: colors.accent, letterSpacing: 2, marginBottom: 10 }}>
            HOW IT WORKS
          </Text>
          <Text variant="display" style={{ fontSize: 36, lineHeight: 40, textAlign: 'center', marginBottom: 14 }}>
            كيف تعمل <Text style={{ fontSize: 36, color: colors.accent }}>وثبة</Text>
          </Text>
          <Text variant="body" tone="textSoft" style={{ textAlign: 'center', fontSize: 15, lineHeight: 24 }}>
            منصة بسيطة وشفافة تربط المبدعين بالداعمين. سواء كنت تطلق فكرة أو تدعم واحدة — العملية
            واضحة من البداية للنهاية.
          </Text>
        </View>

        {/* Creators section */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <LinearGradient
              colors={colors.grad as unknown as [string, string]}
              style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="rocket_launch" size={22} color={colors.onAccent} />
            </LinearGradient>
            <Text variant="h2">للمبدعين</Text>
          </View>
          <View style={{ gap: 14 }}>
            {(steps.data ?? []).map((s) => (
              <Card key={s.n}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14 }}>
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 14,
                      backgroundColor: `rgba(${colors.accentRgb},0.1)`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={s.icon} size={26} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="h4" style={{ marginBottom: 6 }}>
                      {s.titleAr}
                    </Text>
                    <Text variant="small" tone="muted" style={{ lineHeight: 22 }}>
                      {s.descAr}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </View>

        {/* Backers section */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: 'rgba(251,191,36,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="favorite" size={22} color={colors.gold} />
            </View>
            <Text variant="h2">للداعمين</Text>
          </View>
          <View style={{ gap: 14 }}>
            <BackerStep icon="search" title="اكتشف" desc="تصفّح آلاف المشاريع عبر الفئات، واعثر على ما يلامس شغفك." />
            <BackerStep icon="redeem" title="ادعم" desc="اختر مستوى الدعم المناسب، واحصل على مكافآت حصرية ورتبة ترتقي بدعمك." />
            <BackerStep icon="visibility" title="تابع بشفافية" desc="راقب تقدّم المشروع ولوحة الميزانية الحيّة حتى وصول مكافأتك إليك." />
          </View>
        </View>

        {/* Fees */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <Card padding={24} radius={22}>
            <View style={{ flexDirection: 'row-reverse', gap: 18 }}>
              <FeeBlock value="٥٪" label="رسوم المنصة" desc="عند نجاح الحملة فقط — لا رسوم على الفشل." color={colors.accent} />
              <FeeBlock value="٠" label="رسوم الإطلاق" desc="إنشاء وإطلاق مشروعك مجاني." color={colors.blue} />
            </View>
            <View style={{ marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: `rgba(${colors.inkRgb},0.08)` }}>
              <FeeBlock value="١٠٠٪" label="استرداد مضمون" desc="يُعاد دعمك كاملاً إن لم يصل المشروع لهدفه." color={colors.pos} />
            </View>
          </Card>
        </View>

        {/* FAQ */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <Text variant="h2" style={{ textAlign: 'center', marginBottom: 18 }}>
            أسئلة شائعة
          </Text>
          <View style={{ gap: 12 }}>
            {projectFaqs.map((f, i) => (
              <Card key={i}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Icon name="help" size={20} color={colors.accent} />
                  <Text variant="h4" style={{ flex: 1 }}>
                    {f.q}
                  </Text>
                </View>
                <Text variant="body" tone="muted" style={{ lineHeight: 24 }}>
                  {f.a}
                </Text>
              </Card>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 24 }}>
          <View style={{ borderRadius: 24, overflow: 'hidden' }}>
            <LinearGradient
              colors={colors.ctaGrad as unknown as [string, string, string]}
              style={{ padding: 28, alignItems: 'center' }}
            >
              <Text style={{ color: colors.onAccent, fontSize: 24, fontWeight: '700', marginBottom: 18, textAlign: 'center' }}>
                جاهز للوثبة التالية؟
              </Text>
              <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                <Button title="أطلق مشروعك" onPress={() => router.push('/launch')} />
                <Button title="استكشف" variant="ghost" onPress={() => router.push('/explore')} />
              </View>
            </LinearGradient>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BackerStep({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 14,
            backgroundColor: 'rgba(251,191,36,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={26} color={colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h4" style={{ marginBottom: 6 }}>
            {title}
          </Text>
          <Text variant="small" tone="muted" style={{ lineHeight: 22 }}>
            {desc}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function FeeBlock({ value, label, desc, color }: { value: string; label: string; desc: string; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text num style={{ fontSize: 38, fontWeight: '700', color }}>
        {value}
      </Text>
      <Text style={{ fontWeight: '600', marginTop: 4 }}>{label}</Text>
      <Text variant="mutedSmall" tone="muted2" style={{ textAlign: 'center', marginTop: 6 }}>
        {desc}
      </Text>
    </View>
  );
}
