import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme/ThemeProvider';
import { Header, Text, ProjectCard, Icon, Tabs } from '../src/ui';
import { projects } from '../src/data/mock';

const tabs = [
  { id: 'backed', label: 'مشاريع دعمتها', icon: 'volunteer-activism' },
  { id: 'created', label: 'مشاريعي', icon: 'rocket-launch' },
  { id: 'saved', label: 'محفوظة', icon: 'bookmark' },
];

export default function Profile() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState('backed');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Hero */}
        <View
          style={{
            padding: 24,
            paddingBottom: 28,
            borderBottomWidth: 1,
            borderBottomColor: `rgba(${colors.inkRgb},0.07)`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <LinearGradient
            colors={[`rgba(251,191,36,0.10)`, 'transparent']}
            style={{ position: 'absolute', inset: 0 }}
          />
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 18, marginBottom: 22 }}>
            <View style={{ position: 'relative' }}>
              <LinearGradient
                colors={colors.grad as unknown as [string, string]}
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.onAccent, fontSize: 40, fontWeight: '700' }}>س</Text>
              </LinearGradient>
              <View
                style={{
                  position: 'absolute',
                  bottom: -6,
                  right: -6,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.gold,
                  borderWidth: 3,
                  borderColor: colors.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="workspace_premium" size={16} color={colors.onAccent} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h1" style={{ fontSize: 26, marginBottom: 4 }}>
                سارة العامري
              </Text>
              <View
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: 4,
                  paddingHorizontal: 11,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: 'rgba(251,191,36,0.4)',
                  backgroundColor: 'rgba(251,191,36,0.1)',
                  marginBottom: 8,
                }}
              >
                <Icon name="workspace_premium" size={14} color={colors.gold} />
                <Text style={{ color: colors.gold, fontSize: 12, fontWeight: '700' }}>سفير</Text>
              </View>
              <Text variant="small" tone="muted">
                داعمة للإبداع العربي · انضمّت يناير ٢٠٢٥ · الرياض، السعودية
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row-reverse', gap: 24, marginBottom: 22 }}>
            <Stat label="مشروعاً دعمته" value="١٢" />
            <Stat label="إجمالي الدعم" value="١٤,٤٠٠ ر.س" />
            <Stat label="أطلقت" value="١" />
          </View>

          {/* Rank progress */}
          <View
            style={{
              backgroundColor: `rgba(${colors.inkRgb},0.04)`,
              borderWidth: 1,
              borderColor: `rgba(${colors.inkRgb},0.1)`,
              borderRadius: 14,
              padding: 14,
            }}
          >
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: colors.gold, fontWeight: '600', fontSize: 13 }}>سفير</Text>
              <Text style={{ color: colors.purple, fontWeight: '600', fontSize: 13 }}>شريك مؤسس</Text>
            </View>
            <View
              style={{
                height: 8,
                borderRadius: 30,
                backgroundColor: `rgba(${colors.inkRgb},0.08)`,
                overflow: 'hidden',
                marginBottom: 10,
              }}
            >
              <LinearGradient
                colors={[colors.gold, colors.purple] as unknown as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: '100%', width: '64%', borderRadius: 30 }}
              />
            </View>
            <Text num variant="mutedSmall" tone="muted">
              ٢٣,١٠٠ ر.س تفصلك عن رتبة «شريك مؤسس»
            </Text>
          </View>
        </View>

        <View style={{ padding: 24 }}>
          <Tabs items={tabs} active={tab} onChange={setTab} variant="pill" />
          <View style={{ marginTop: 22, gap: 16 }}>
            {tab === 'backed' &&
              projects.slice(0, 4).map((p) => <ProjectCard key={p.id} project={p} />)}
            {tab === 'created' && (
              <View style={{ gap: 14 }}>
                <ProjectCard project={projects[0]!} />
                <Pressable
                  onPress={() => router.push('/launch')}
                  style={{
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: `rgba(${colors.accentRgb},0.3)`,
                    borderRadius: 16,
                    padding: 24,
                    alignItems: 'center',
                    flexDirection: 'row-reverse',
                    justifyContent: 'center',
                    gap: 9,
                  }}
                >
                  <Icon name="add_circle" size={22} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 15 }}>
                    أطلق مشروعاً جديداً
                  </Text>
                </Pressable>
              </View>
            )}
            {tab === 'saved' && projects.slice(1, 3).map((p) => <ProjectCard key={p.id} project={p} />)}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text num style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>
        {value}
      </Text>
      <Text variant="mutedSmall" tone="muted2">
        {label}
      </Text>
    </View>
  );
}
