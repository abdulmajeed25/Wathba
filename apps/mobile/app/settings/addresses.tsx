import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Header, Text, Card, Icon, Badge, Button } from '../../src/ui';

const ADDRESSES = [
  { id: 'a1', label: 'المنزل', name: 'سارة العامري', line: 'حي العليا، شارع التحلية', city: 'الرياض', postal: '11564', default: true },
  { id: 'a2', label: 'العمل', name: 'سارة العامري', line: 'برج المملكة، الدور ٥٢', city: 'الرياض', postal: '11525', default: false },
];

export default function Addresses() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        <Text variant="h1" style={{ marginBottom: 8 }}>العناوين</Text>
        <Text tone="muted" variant="small" style={{ marginBottom: 22 }}>إدارة عناوين الشحن لمكافآت المشاريع.</Text>

        <View style={{ gap: 12, marginBottom: 16 }}>
          {ADDRESSES.map((a) => (
            <Card key={a.id}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Icon name="location_on" size={22} color={colors.accent} />
                <Text variant="h4" style={{ flex: 1 }}>{a.label}</Text>
                {a.default && <Badge label="افتراضي" tone="accent" />}
              </View>
              <Text variant="small" tone="textSoft" style={{ lineHeight: 22 }}>
                {a.name}{'\n'}
                {a.line}{'\n'}
                {a.city}، السعودية{' '}
                <Text num style={{ color: colors.muted }}>{a.postal}</Text>
              </Text>
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 12 }}>
                <Pressable style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 9, backgroundColor: `rgba(${colors.inkRgb},0.06)` }}>
                  <Text variant="small" tone="muted">تعديل</Text>
                </Pressable>
                {!a.default && (
                  <Pressable style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 9, backgroundColor: `rgba(${colors.inkRgb},0.06)` }}>
                    <Text variant="small" tone="muted">تعيين افتراضي</Text>
                  </Pressable>
                )}
              </View>
            </Card>
          ))}
        </View>

        <Button title="إضافة عنوان جديد" iconLeft="add_circle" variant="outline" full />
      </ScrollView>
    </SafeAreaView>
  );
}
