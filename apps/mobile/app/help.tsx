import React from 'react';
import { View, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { Header, Text, Card, Icon } from '../src/ui';
import { projectFaqs } from '../src/data/mock';

const TOPICS = [
  { icon: 'volunteer_activism', title: 'دعم مشروع', desc: 'كيف أدعم؟ كيف أُلغي؟ متى يُخصم المبلغ؟' },
  { icon: 'rocket_launch', title: 'إطلاق مشروع', desc: 'الإعداد، التمويل، المراحل، الصرف.' },
  { icon: 'verified_user', title: 'الأمان والتحقق', desc: 'نفاذ، حماية البيانات، حذف الحساب.' },
  { icon: 'gavel', title: 'العقود والقانوني', desc: 'أنواع العقود، الشروط، السياسات.' },
];

export default function Help() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60 }}>
        <Text variant="h1" style={{ marginBottom: 8 }}>مركز المساعدة</Text>
        <Text tone="muted" variant="small" style={{ marginBottom: 22 }}>اعثر على إجاباتك أو تواصل معنا مباشرة.</Text>

        <Text num variant="small" tone="muted2" style={{ marginBottom: 10, fontWeight: '700', letterSpacing: 1 }}>
          المواضيع
        </Text>
        <View style={{ gap: 10, marginBottom: 22 }}>
          {TOPICS.map((t) => (
            <Card key={t.title} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: `rgba(${colors.accentRgb},0.1)`,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name={t.icon} size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>{t.title}</Text>
                <Text tone="muted2" variant="mutedSmall">{t.desc}</Text>
              </View>
              <Icon name="chevron_left" size={20} color={colors.muted2} />
            </Card>
          ))}
        </View>

        <Text num variant="small" tone="muted2" style={{ marginBottom: 10, fontWeight: '700', letterSpacing: 1 }}>
          أسئلة شائعة
        </Text>
        <View style={{ gap: 10, marginBottom: 22 }}>
          {projectFaqs.map((f, i) => (
            <Card key={i}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Icon name="help" size={20} color={colors.accent} />
                <Text variant="h4" style={{ flex: 1 }}>{f.q}</Text>
              </View>
              <Text variant="body" tone="muted" style={{ lineHeight: 24 }}>{f.a}</Text>
            </Card>
          ))}
        </View>

        <Card>
          <Text variant="h3" style={{ marginBottom: 12 }}>تواصل معنا</Text>
          <Pressable
            onPress={() => Linking.openURL('mailto:support@wathba.sa')}
            style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 12 }}
          >
            <Icon name="mail" size={22} color={colors.accent} />
            <Text style={{ flex: 1 }}>support@wathba.sa</Text>
            <Icon name="open_in_new" size={18} color={colors.muted2} />
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL('tel:+966112222222')}
            style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 12 }}
          >
            <Icon name="phone" size={22} color={colors.accent} />
            <Text num style={{ flex: 1 }}>+٩٦٦ ١١ ٢٢٢ ٢٢٢٢</Text>
            <Icon name="open_in_new" size={18} color={colors.muted2} />
          </Pressable>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
