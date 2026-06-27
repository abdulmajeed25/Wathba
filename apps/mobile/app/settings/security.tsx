import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Header, Text, Card, Icon, Button } from '../../src/ui';

export default function Security() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        <Text variant="h1" style={{ marginBottom: 8 }}>الأمان</Text>
        <Text tone="muted" variant="small" style={{ marginBottom: 22 }}>
          حماية حسابك وبياناتك أولوية. راجع إعدادات الأمان بانتظام.
        </Text>

        <View style={{ gap: 12 }}>
          <Row icon="lock" title="تغيير كلمة السر" desc="آخر تحديث: قبل ٤٢ يوماً" cta="تغيير" />
          <Row icon="phone_android" title="التحقق بخطوتين" desc="غير مفعّل" cta="فعّل" />
          <Row icon="devices" title="الأجهزة النشطة" desc="٣ أجهزة" cta="إدارة" />
          <Row icon="badge" title="هوية نفاذ" desc="موثّق ✓" cta="تفاصيل" />
        </View>

        <Card style={{ marginTop: 16, backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)' }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Icon name="warning" size={20} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontWeight: '700' }}>المنطقة الحرجة</Text>
          </View>
          <Text variant="small" tone="muted" style={{ marginBottom: 14 }}>
            حذف الحساب نهائي ولا يمكن التراجع عنه. سيتم الإبقاء على المعاملات المالية وفق الأنظمة.
          </Text>
          <Button title="طلب حذف الحساب" variant="outline" />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, title, desc, cta }: { icon: string; title: string; desc: string; cta: string }) {
  const { colors } = useTheme();
  return (
    <Card style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 44, height: 44, borderRadius: 12,
          backgroundColor: `rgba(${colors.accentRgb},0.1)`,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={22} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700' }}>{title}</Text>
        <Text tone="muted2" variant="mutedSmall">{desc}</Text>
      </View>
      <Pressable
        style={{
          paddingVertical: 7, paddingHorizontal: 13, borderRadius: 9,
          backgroundColor: `rgba(${colors.inkRgb},0.06)`,
        }}
      >
        <Text variant="small" tone="muted">{cta}</Text>
      </Pressable>
    </Card>
  );
}
