import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme/ThemeProvider';
import { Header, Text, ProjectCard, Tabs, Icon } from '../src/ui';
import { useDiscover, useCategories } from '../src/data/hooks';
import { toArabicDigits } from '../src/data/format';

const sorts: Array<{ id: 'trending' | 'new' | 'ending_soon' | 'most_funded'; label: string }> = [
  { id: 'trending', label: 'الأكثر رواجاً' },
  { id: 'new', label: 'الأحدث' },
  { id: 'ending_soon', label: 'تنتهي قريباً' },
  { id: 'most_funded', label: 'الأعلى تمويلاً' },
];

const statuses = [
  { id: 'all', label: 'الكل' },
  { id: 'live', label: 'مباشر' },
  { id: 'successful', label: 'ناجحة' },
  { id: 'funded', label: 'مموَّلة' },
];

export default function ExploreScreen() {
  const { colors } = useTheme();
  const [sort, setSort] = useState<'trending' | 'new' | 'ending_soon' | 'most_funded'>('trending');
  const [category, setCategory] = useState<string>('all');
  const [includePartnered, setIncludePartnered] = useState<boolean>(true);
  const catsQ = useCategories();
  const discoverQ = useDiscover({
    category: category === 'all' ? undefined : category,
    sort,
    includePartnered,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ padding: 24, paddingBottom: 0 }}>
          <Text num style={{ fontSize: 12, color: colors.accent, letterSpacing: 2, marginBottom: 6 }}>
            DISCOVER
          </Text>
          <Text variant="h1" style={{ marginBottom: 8 }}>
            استكشف المشاريع
          </Text>
          <Text tone="muted" variant="small" style={{ marginBottom: 20 }}>
            <Text num>{toArabicDigits(discoverQ.data?.length ?? 0)}</Text> مشروعاً ينتظر دعمك الآن
          </Text>

          <Tabs
            items={sorts.map((s) => ({ id: s.id, label: s.label }))}
            active={sort}
            onChange={(id) => setSort(id as typeof sort)}
            variant="pill"
          />
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 18, gap: 9, flexDirection: 'row-reverse' }}
        >
          {(['all', ...((catsQ.data ?? []).map((c) => c.id))] as string[]).map((id) => {
            const cat = (catsQ.data ?? []).find((c) => c.id === id);
            const isActive = id === category;
            return (
              <Pressable
                key={id}
                onPress={() => setCategory(id)}
                style={{
                  paddingVertical: 9,
                  paddingHorizontal: 14,
                  borderRadius: 30,
                  borderWidth: 1,
                  borderColor: isActive ? colors.accent : `rgba(${colors.inkRgb},0.1)`,
                  backgroundColor: isActive ? `rgba(${colors.accentRgb},0.12)` : 'transparent',
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {cat && <Icon name={cat.icon} size={16} color={isActive ? colors.accent : colors.muted} />}
                <Text style={{ color: isActive ? colors.accent : colors.muted, fontSize: 13, fontWeight: '600' }}>
                  {id === 'all' ? 'كل الفئات' : cat?.ar}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Status row + platform-partner toggle */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, gap: 8, flexDirection: 'row-reverse' }}
        >
          <Text tone="muted2" variant="small" style={{ alignSelf: 'center' }}>
            الحالة:
          </Text>
          {statuses.map((s) => (
            <Pressable
              key={s.id}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 30,
                borderWidth: 1,
                borderColor: `rgba(${colors.inkRgb},0.1)`,
              }}
            >
              <Text variant="small" tone="muted">
                {s.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setIncludePartnered((v) => !v)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 30,
              borderWidth: 1,
              borderColor: includePartnered ? `rgba(109,77,240,0.4)` : `rgba(${colors.inkRgb},0.1)`,
              backgroundColor: includePartnered ? 'rgba(109,77,240,0.10)' : 'transparent',
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Icon name="verified" size={14} color="#6d4df0" />
            <Text variant="small" style={{ color: includePartnered ? '#6d4df0' : colors.muted }}>
              مشاريع بشراكة وثبة
            </Text>
          </Pressable>
        </ScrollView>

        {/* Grid */}
        <View style={{ paddingHorizontal: 24, gap: 16 }}>
          {(discoverQ.data ?? []).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
