import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme/ThemeProvider';
import { Header, Text, Icon, ProjectCard } from '../../src/ui';
import { useCategories, useDiscover } from '../../src/data/hooks';
import { toArabicDigits } from '../../src/data/format';

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const catsQ = useCategories();
  const cat = (catsQ.data ?? []).find((c) => c.id === id);
  const listQ = useDiscover({ category: id });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero band */}
        <View style={{ position: 'relative', overflow: 'hidden' }}>
          <LinearGradient
            colors={[`rgba(${colors.accent2Rgb},0.2)`, 'transparent']}
            style={{ position: 'absolute', inset: 0 }}
          />
          <View style={{ padding: 24 }}>
            <Pressable
              onPress={() => router.push('/explore')}
              style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 16 }}
            >
              <Icon name="arrow_forward" size={16} color={colors.muted} />
              <Text tone="muted" variant="small">
                كل الفئات
              </Text>
            </Pressable>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  backgroundColor: `rgba(${colors.accentRgb},0.18)`,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={cat?.icon ?? 'explore'} size={32} color={colors.accent} />
              </View>
              <View>
                <Text variant="h1">{cat?.ar ?? '—'}</Text>
                <Text num tone="muted" variant="small" style={{ marginTop: 4 }}>
                  {toArabicDigits(cat?.count ?? '0')} مشروع · <Text style={{ color: colors.accent }}>{cat?.en}</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24, gap: 16 }}>
          <Text variant="h3">مشاريع في {cat?.ar ?? ''}</Text>
          {(listQ.data ?? []).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
          {listQ.data?.length === 0 && (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text tone="muted2">لا توجد مشاريع حالياً في هذه الفئة.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
