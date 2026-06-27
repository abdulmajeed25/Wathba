import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme/ThemeProvider';
import { Header, Text, Card, Button, Tabs, Icon } from '../src/ui';
import { toArabicDigits, fmtSAR } from '../src/data/format';
import { projectUpdates } from '../src/data/mock';

const tabs = [
  { id: 'overview', label: 'نظرة عامة', icon: 'dashboard' },
  { id: 'backers', label: 'الداعمون', icon: 'group' },
  { id: 'updates', label: 'التحديثات', icon: 'campaign' },
  { id: 'settings', label: 'الإعدادات', icon: 'settings' },
];

const stats = [
  { label: 'إجمالي التمويل', value: '٢.٥٦M ر.س', delta: '+١٢٪ هذا الأسبوع', icon: 'paid', color: '#05a661' },
  { label: 'الداعمون', value: '٣,٢٤٧', delta: '+٤٠ اليوم', icon: 'group', color: '#2563eb' },
  { label: 'نسبة الإنجاز', value: '١٧١٪', delta: 'تجاوز الهدف', icon: 'trending_up', color: '#6d4df0' },
  { label: 'أيام متبقية', value: '١٢', delta: 'حملة نشطة', icon: 'schedule', color: '#fbbf24' },
];

const recentBackers = [
  { initial: 'أ', name: 'أحمد القاسم', time: 'قبل دقيقة', amount: fmtSAR(75_000), tier: 'الإصدار المبكر', rank: 'سفير', rc: '#b9820a' },
  { initial: 'س', name: 'سارة العامري', time: 'قبل ١٠ دقائق', amount: fmtSAR(24_000), tier: 'حزمة الاستوديو', rank: 'مناصِر', rc: '#05a661' },
  { initial: 'ف', name: 'فهد المرّي', time: 'قبل ساعة', amount: fmtSAR(7_500), tier: 'الإصدار المبكر', rank: 'داعم', rc: '#2563eb' },
  { initial: 'ن', name: 'نورة الزهراني', time: 'قبل ٣ ساعات', amount: fmtSAR(75_000), tier: 'حزمة الاستوديو', rank: 'مناصِر', rc: '#05a661' },
  { initial: 'ع', name: 'علي الحربي', time: 'قبل ٥ ساعات', amount: fmtSAR(2_400), tier: 'الراعي الذهبي', rank: 'سفير', rc: '#b9820a' },
];

const chartBars = [
  { d: 'سبت', h: '40%', v: '٤٢K' },
  { d: 'أحد', h: '55%', v: '٥٨K' },
  { d: 'إثنين', h: '72%', v: '٧٦K' },
  { d: 'ثلاثاء', h: '90%', v: '٩٢K' },
  { d: 'أربعاء', h: '65%', v: '٧٠K' },
  { d: 'خميس', h: '80%', v: '٨٤K' },
  { d: 'جمعة', h: '95%', v: '٩٨K' },
];

export default function Dashboard() {
  const { colors } = useTheme();
  const [tab, setTab] = useState('overview');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: 24, paddingBottom: 0 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <LinearGradient
              colors={colors.grad as unknown as [string, string]}
              style={{ width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 22 }}>س</Text>
            </LinearGradient>
            <View>
              <Text num style={{ fontSize: 11, color: colors.accent, letterSpacing: 2 }}>
                CREATOR DASHBOARD
              </Text>
              <Text variant="h2">لوحة تحكم سِرب</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 22 }}>
            <Button title="عرض الصفحة" variant="ghost" iconLeft="visibility" size="sm" />
            <Button title="نشر تحديث" iconLeft="campaign" size="sm" />
          </View>
          <Tabs items={tabs} active={tab} onChange={setTab} />
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          {tab === 'overview' && (
            <View>
              {/* Stats grid */}
              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                {stats.map((s) => (
                  <Card key={s.label} style={{ flexBasis: '47%', flexGrow: 1 }}>
                    <View
                      style={{
                        flexDirection: 'row-reverse',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                      }}
                    >
                      <Text tone="muted" variant="small">
                        {s.label}
                      </Text>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          backgroundColor: `rgba(${colors.inkRgb},0.05)`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon name={s.icon} size={18} color={s.color} />
                      </View>
                    </View>
                    <Text num style={{ fontSize: 22, fontWeight: '700', marginBottom: 4 }}>
                      {s.value}
                    </Text>
                    <Text style={{ fontSize: 11, color: s.color, fontWeight: '600' }}>
                      {s.delta}
                    </Text>
                  </Card>
                ))}
              </View>
              {/* Daily funding chart */}
              <Card style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 18 }}>
                  <Text variant="h4">التمويل اليومي</Text>
                  <Text num tone="muted2" variant="small">
                    آخر ٧ أيام
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    height: 180,
                    gap: 10,
                  }}
                >
                  {chartBars.map((b) => (
                    <View key={b.d} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                      <Text num variant="mutedSmall" tone="muted">
                        {b.v}
                      </Text>
                      <LinearGradient
                        colors={colors.gradBarV as unknown as [string, string]}
                        style={{
                          width: '100%',
                          height: b.h as unknown as number,
                          borderTopLeftRadius: 8,
                          borderTopRightRadius: 8,
                        }}
                      />
                      <Text variant="mutedSmall" tone="muted2">
                        {b.d}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>
              {/* Recent backers */}
              <Card>
                <Text variant="h4" style={{ marginBottom: 16 }}>
                  داعمون جدد
                </Text>
                {recentBackers.slice(0, 5).map((b, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 11,
                      paddingVertical: 10,
                      borderBottomWidth: i < 4 ? 1 : 0,
                      borderBottomColor: `rgba(${colors.inkRgb},0.04)`,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 11,
                        backgroundColor: `rgba(${colors.inkRgb},0.08)`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontWeight: '700' }}>{b.initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{b.name}</Text>
                      <Text tone="muted2" variant="mutedSmall">
                        {b.time}
                      </Text>
                    </View>
                    <Text num style={{ color: colors.accent, fontWeight: '700' }}>
                      {b.amount}
                    </Text>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {tab === 'backers' && (
            <Card padding={0}>
              <View
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  borderBottomWidth: 1,
                  borderBottomColor: `rgba(${colors.inkRgb},0.08)`,
                  flexDirection: 'row-reverse',
                  gap: 12,
                }}
              >
                <Text style={{ flex: 2, fontSize: 12, color: colors.muted2, fontWeight: '600' }}>الداعم</Text>
                <Text style={{ flex: 1, fontSize: 12, color: colors.muted2, fontWeight: '600' }}>المبلغ</Text>
                <Text style={{ flex: 1, fontSize: 12, color: colors.muted2, fontWeight: '600' }}>الرتبة</Text>
              </View>
              {recentBackers.map((b, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row-reverse',
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 18,
                    alignItems: 'center',
                    borderBottomWidth: i < recentBackers.length - 1 ? 1 : 0,
                    borderBottomColor: `rgba(${colors.inkRgb},0.04)`,
                  }}
                >
                  <View style={{ flex: 2, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        backgroundColor: `rgba(${colors.inkRgb},0.08)`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontWeight: '700' }}>{b.initial}</Text>
                    </View>
                    <Text variant="bodyStrong">{b.name}</Text>
                  </View>
                  <Text num style={{ flex: 1, color: colors.accent, fontWeight: '700' }}>
                    {b.amount}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        paddingVertical: 3,
                        paddingHorizontal: 9,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: b.rc,
                      }}
                    >
                      <Text style={{ color: b.rc, fontSize: 11, fontWeight: '700' }}>{b.rank}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </Card>
          )}

          {tab === 'updates' && (
            <View style={{ gap: 12 }}>
              {projectUpdates.map((u) => (
                <Card
                  key={u.n}
                  style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14 }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 11,
                      backgroundColor: `rgba(${colors.accentRgb},0.12)`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text num style={{ color: colors.accent, fontWeight: '700' }}>
                      #{toArabicDigits(u.n)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700' }}>{u.title}</Text>
                    <Text num tone="muted2" variant="mutedSmall">
                      {u.date}
                    </Text>
                  </View>
                  <Icon name="edit" size={20} color={colors.muted2} />
                </Card>
              ))}
            </View>
          )}

          {tab === 'settings' && (
            <Card>
              <Text variant="h4" style={{ marginBottom: 18 }}>
                إعدادات المشروع
              </Text>
              <Text variant="small" tone="textSoft" style={{ marginBottom: 12, fontWeight: '600' }}>
                نمط الألوان
              </Text>
              <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 22 }}>
                <ThemeCard label="فاتح" desc="مريح وكلاسيكي" colorA="#fff" colorB="#05a661" />
                <ThemeCard label="داكن" desc="عصري وجريء" colorA="#0c1c2f" colorB="#22d3ee" />
              </View>
              <SettingsRow title="إشعارات الداعمين" desc="أرسل بريداً لكل داعم عند نشر تحديث" enabled />
              <SettingsRow title="عرض لوحة الشفافية" desc="اجعل توزيع الميزانية مرئياً للجميع" enabled />
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ThemeCard({ label, desc, colorA, colorB }: { label: string; desc: string; colorA: string; colorB: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: `rgba(${colors.inkRgb},0.1)`,
      }}
    >
      <View style={{ flexDirection: 'row-reverse', gap: 4 }}>
        <View style={{ width: 18, height: 30, borderRadius: 5, backgroundColor: colorA, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }} />
        <View style={{ width: 18, height: 30, borderRadius: 5, backgroundColor: colorB }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700' }}>{label}</Text>
        <Text variant="mutedSmall" tone="muted2">
          {desc}
        </Text>
      </View>
    </View>
  );
}

function SettingsRow({ title, desc, enabled }: { title: string; desc: string; enabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        backgroundColor: `rgba(${colors.inkRgb},0.03)`,
        borderRadius: 12,
        marginBottom: 10,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '600' }}>{title}</Text>
        <Text variant="mutedSmall" tone="muted2">
          {desc}
        </Text>
      </View>
      <View
        style={{
          width: 46,
          height: 26,
          borderRadius: 13,
          backgroundColor: enabled ? colors.accent : `rgba(${colors.inkRgb},0.12)`,
          padding: 3,
          alignItems: enabled ? 'flex-end' : 'flex-start',
        }}
      >
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.onAccent }} />
      </View>
    </View>
  );
}
