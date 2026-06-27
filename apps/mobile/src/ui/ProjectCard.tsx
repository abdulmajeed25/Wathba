import React from 'react';
import { View, Pressable, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';
import { Text, ProgressBar, Icon } from './index';
import { fmtSAR, fmtCount, fmtPct, toArabicDigits } from '../data/format';
import type { ProjectCard as ProjectCardData } from '../data/mock';

export interface ProjectCardProps {
  project: ProjectCardData;
  variant?: 'compact' | 'wide';
  style?: ViewStyle;
}

export function ProjectCard({ project: p, variant = 'compact', style }: ProjectCardProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const pct = fmtPct(p.raisedHalalas, p.goalHalalas);
  const over = pct >= 100;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/projects/${p.id}` as never)}
      style={({ pressed }) => [
        {
          backgroundColor: colors.card,
          borderRadius: 18,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: `rgba(${colors.inkRgb},0.08)`,
          transform: [{ translateY: pressed ? -2 : 0 }],
        },
        style,
      ]}
    >
      {/* Image placeholder */}
      <View
        style={{
          height: variant === 'wide' ? 200 : 158,
          backgroundColor: p.imageAccent ?? colors.phBg,
          position: 'relative',
        }}
      >
        <LinearGradient
          colors={['transparent', 'rgba(6,18,31,0.5)']}
          style={{ position: 'absolute', inset: 0 }}
        />
        {/* Category chip */}
        <View
          style={{
            position: 'absolute',
            top: 11,
            right: 11,
            backgroundColor: 'rgba(6,18,31,0.7)',
            borderColor: `rgba(${colors.inkRgb},0.12)`,
            borderWidth: 1,
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderRadius: 20,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{p.categoryAr}</Text>
        </View>
        {/* Bookmark */}
        <View
          style={{
            position: 'absolute',
            top: 11,
            left: 11,
            width: 30,
            height: 30,
            borderRadius: 9,
            backgroundColor: 'rgba(6,18,31,0.7)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="bookmark" size={16} color="#fff" />
        </View>
        {/* Platform-partner badge — §6 mandatory disclosure */}
        {p.platformPartner && (
          <View
            style={{
              position: 'absolute',
              bottom: 11,
              right: 11,
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 6,
              backgroundColor: 'rgba(109,77,240,0.95)',
              paddingVertical: 5,
              paddingHorizontal: 10,
              borderRadius: 20,
            }}
          >
            <Icon name="verified" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>بشراكة وثبة</Text>
          </View>
        )}
      </View>

      <View style={{ padding: 15 }}>
        <Text variant="h4" style={{ marginBottom: 4, letterSpacing: -0.3 }}>
          {p.titleAr}
        </Text>
        <Text tone="muted2" variant="small" style={{ marginBottom: 12 }}>
          بواسطة {p.creator}
        </Text>
        <ProgressBar pct={pct / 100} height={6} over={over} style={{ marginBottom: 10 }} />
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
          <Text
            num
            style={{ color: over ? colors.pos : colors.accent, fontSize: 15, fontWeight: '700' }}
          >
            {toArabicDigits(pct)}٪
          </Text>
          <Text num tone="muted" variant="small">
            {fmtSAR(p.raisedHalalas)}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row-reverse',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          <Text num tone="muted2" variant="mutedSmall">
            {toArabicDigits(fmtCount(p.backersCount))} داعم
          </Text>
          <Text num tone="muted2" variant="mutedSmall">
            {toArabicDigits(p.daysLeft)} يوم متبقٍ
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
