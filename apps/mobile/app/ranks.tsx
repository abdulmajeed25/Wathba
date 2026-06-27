import React from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { Header, Text, Card, Button, Icon, Badge } from '../src/ui';
import { useRanks } from '../src/data/hooks';

export default function Ranks() {
  const { colors } = useTheme();
  const router = useRouter();
  const ranksQ = useRanks();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Badge label="نظام رتب الداعمين" icon="workspace_premium" tone="gold" style={{ marginBottom: 18 }} />
          <Text variant="display" style={{ fontSize: 36, lineHeight: 40, textAlign: 'center', marginBottom: 12 }}>
            كلما دعمت أكثر،
          </Text>
          <Text
            variant="display"
            style={{ fontSize: 36, lineHeight: 40, textAlign: 'center', color: colors.accent, marginBottom: 18 }}
          >
            ارتقت مكانتك
          </Text>
          <Text variant="body" tone="textSoft" style={{ textAlign: 'center', fontSize: 15, lineHeight: 24 }}>
            على وثبة، دعمك ليس مجرد تبرّع — إنه رحلة. كل مشروع تدعمه يقرّبك من رتبة أعلى ومزايا
            حصرية تليق بشغفك.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 14 }}>
          {(ranksQ.data ?? []).map((r) => (
            <Card key={r.id} style={{ borderColor: `${r.color}33`, borderWidth: 1 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    backgroundColor: r.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={r.icon} size={28} color={r.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: r.color, fontSize: 18, fontWeight: '700' }}>{r.ar}</Text>
                  <Text num variant="mutedSmall" tone="muted2" style={{ letterSpacing: 2 }}>
                    {r.en}
                  </Text>
                </View>
                <View
                  style={{
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                    borderRadius: 9,
                    backgroundColor: `rgba(${colors.inkRgb},0.04)`,
                  }}
                >
                  <Text variant="small" tone="textSoft">
                    {r.req}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: `rgba(${colors.inkRgb},0.07)`,
                  paddingTop: 12,
                  gap: 10,
                }}
              >
                {r.perks.map((p, i) => (
                  <View key={i} style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8 }}>
                    <Icon name="check_circle" size={16} color={r.color} />
                    <Text variant="small" tone="muted" style={{ flex: 1, lineHeight: 22 }}>
                      {p}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ))}
          <Button
            title="ابدأ رحلتك — ادعم مشروعاً"
            size="lg"
            full
            style={{ marginTop: 20 }}
            onPress={() => router.push('/explore')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
