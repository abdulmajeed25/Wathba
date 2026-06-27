import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Header, Text, Card, Tabs, Icon, Badge, Button } from '../../src/ui';
import { projects } from '../../src/data/mock';
import { fmtSAR, toArabicDigits } from '../../src/data/format';

const tabs = [
  { id: 'review', label: 'مراجعة المشاريع', icon: 'fact_check' },
  { id: 'kyc', label: 'تحقق الهويات', icon: 'badge' },
  { id: 'partner', label: 'بشراكة وثبة', icon: 'verified' },
];

export default function AdminConsole() {
  const { colors } = useTheme();
  const [tab, setTab] = useState('review');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: 24, paddingBottom: 8 }}>
          <Text num style={{ fontSize: 12, color: colors.accent, letterSpacing: 2, marginBottom: 6 }}>
            ADMIN CONSOLE
          </Text>
          <Text variant="h1" style={{ fontSize: 28, marginBottom: 6 }}>لوحة الإدارة</Text>
          <Text tone="muted" variant="small">
            مراجعة المشاريع، تحقق الهويات، وإدارة شراكات وثبة.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24 }}>
          <Tabs items={tabs} active={tab} onChange={setTab} variant="pill" />

          <View style={{ marginTop: 20, gap: 12 }}>
            {tab === 'review' &&
              projects.slice(0, 3).map((p) => (
                <Card key={p.id}>
                  <View style={{ flexDirection: 'row-reverse', gap: 12, marginBottom: 12 }}>
                    <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: p.imageAccent ?? colors.phBg }} />
                    <View style={{ flex: 1 }}>
                      <Text variant="h4">{p.titleAr}</Text>
                      <Text tone="muted2" variant="mutedSmall">بواسطة {p.creator}</Text>
                      <Text num tone="muted" variant="small" style={{ marginTop: 4 }}>
                        هدف {fmtSAR(p.goalHalalas)} · {toArabicDigits(p.daysLeft + 30)} يوم
                      </Text>
                    </View>
                    <Badge label="بانتظار المراجعة" tone="gold" />
                  </View>
                  <Text variant="small" tone="textSoft" numberOfLines={3} style={{ lineHeight: 22, marginBottom: 14 }}>
                    {p.shortDescAr}
                  </Text>
                  <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
                    <Button title="اعتماد + نشر" iconLeft="check" size="sm" style={{ flex: 1 }} />
                    <Button title="رفض + إرجاع" variant="outline" iconLeft="cancel" size="sm" style={{ flex: 1 }} />
                  </View>
                </Card>
              ))}

            {tab === 'kyc' &&
              ['أحمد القاسم', 'سارة العامري', 'فهد المرّي'].map((name) => (
                <Card key={name} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 44, height: 44, borderRadius: 12,
                      backgroundColor: `rgba(${colors.inkRgb},0.08)`,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontWeight: '700' }}>{name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700' }}>{name}</Text>
                    <Text num tone="muted2" variant="mutedSmall">+٩٦٦ ٥X XXX XXXX</Text>
                  </View>
                  <Button title="تأكيد يدوي" variant="outline" size="sm" />
                </Card>
              ))}

            {tab === 'partner' && (
              <>
                <View
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: 'rgba(109,77,240,0.08)',
                    borderColor: 'rgba(109,77,240,0.25)',
                    borderWidth: 1,
                    flexDirection: 'row-reverse',
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <Icon name="verified" size={22} color="#6d4df0" />
                  <Text variant="small" tone="textSoft" style={{ flex: 1, lineHeight: 22 }}>
                    وسم «بشراكة وثبة» يجب أن يكون مرئياً للداعمين على البطاقة وصفحة التفاصيل. هذا
                    التزام قانوني/أخلاقي بالشفافية.
                  </Text>
                </View>
                {projects.map((p) => {
                  const partnered = !!p.platformPartner;
                  return (
                    <Card key={p.id} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: p.imageAccent ?? colors.phBg }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700' }}>{p.titleAr}</Text>
                        <Text tone="muted2" variant="mutedSmall">{p.creator}</Text>
                      </View>
                      <Pressable
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          borderRadius: 9,
                          backgroundColor: partnered ? '#6d4df022' : `rgba(${colors.inkRgb},0.06)`,
                          borderColor: partnered ? '#6d4df077' : 'transparent',
                          borderWidth: 1,
                        }}
                      >
                        <Text style={{ color: partnered ? '#6d4df0' : colors.muted, fontWeight: '600', fontSize: 12 }}>
                          {partnered ? 'بشراكة وثبة ✓' : 'تعيين كشريك'}
                        </Text>
                      </Pressable>
                    </Card>
                  );
                })}
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
