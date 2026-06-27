import React, { useState } from 'react';
import { View, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { Header, Text, ProjectCard, Icon } from '../src/ui';
import { useSearch } from '../src/data/hooks';
import { toArabicDigits } from '../src/data/format';

const SUGGESTIONS = ['تقنية', 'سِرب', 'حكايا', 'تصميم', 'أطفال', 'موسيقى'];

export default function Search() {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const resultsQ = useSearch(q);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={{ padding: 24 }}>
          <Text variant="h1" style={{ fontSize: 28, marginBottom: 16 }}>
            ابحث في وثبة
          </Text>
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 10,
              padding: 14,
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: q ? colors.accent : `rgba(${colors.inkRgb},0.12)`,
              backgroundColor: `rgba(${colors.inkRgb},0.04)`,
              marginBottom: 18,
            }}
          >
            <Icon name="search" size={22} color={colors.accent} />
            <TextInput
              autoFocus
              value={q}
              onChangeText={setQ}
              placeholder="ابحث عن مشاريع، مبدعين، فئات…"
              placeholderTextColor={colors.muted2}
              style={{
                flex: 1,
                fontSize: 16,
                color: colors.text,
                fontFamily: 'IBMPlexSansArabic',
                textAlign: 'right',
              }}
            />
            {q && (
              <Pressable onPress={() => setQ('')}>
                <Icon name="close" size={20} color={colors.muted2} />
              </Pressable>
            )}
          </View>

          <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Text tone="muted2" variant="small">
              اقتراحات:
            </Text>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => setQ(s)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 30,
                  borderWidth: 1,
                  borderColor: `rgba(${colors.inkRgb},0.1)`,
                  backgroundColor: `rgba(${colors.inkRgb},0.04)`,
                }}
              >
                <Text variant="small" tone="muted">
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: 24 }}>
          <Text variant="small" tone="muted" style={{ marginBottom: 16 }}>
            <Text num style={{ color: colors.text, fontWeight: '700' }}>
              {toArabicDigits(resultsQ.data?.length ?? 0)}
            </Text>{' '}
            نتيجة
          </Text>
          <View style={{ gap: 16 }}>
            {(resultsQ.data ?? []).map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
