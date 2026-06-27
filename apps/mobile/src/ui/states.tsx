import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';
import { Icon } from './Icon';
import { Button } from './Button';

/** Centered spinner with optional caption. */
export function LoadingState({ caption = 'جاري التحميل…' }: { caption?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <ActivityIndicator color={colors.accent} />
      <Text tone="muted" variant="small" style={{ marginTop: 12 }}>
        {caption}
      </Text>
    </View>
  );
}

export interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  cta?: { label: string; onPress: () => void };
}

export function EmptyState({ icon = 'inbox', title, subtitle, cta }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          backgroundColor: `rgba(${colors.inkRgb},0.04)`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={34} color={colors.muted2} />
      </View>
      <Text variant="h3" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {subtitle && (
        <Text variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 280 }}>
          {subtitle}
        </Text>
      )}
      {cta && <Button title={cta.label} onPress={cta.onPress} style={{ marginTop: 8 }} />}
    </View>
  );
}

export interface ErrorStateProps {
  title?: string;
  detail?: string;
  retry?: () => void;
}

export function ErrorState({ title = 'حدث خطأ', detail, retry }: ErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          backgroundColor: 'rgba(239,68,68,0.08)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="error" size={34} color="#ef4444" />
      </View>
      <Text variant="h3" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {detail && (
        <Text variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 280 }}>
          {detail}
        </Text>
      )}
      {retry && <Button title="حاول مجدداً" onPress={retry} variant="outline" />}
      {!retry && (
        <Text tone="muted2" variant="mutedSmall">
          إذا استمرت المشكلة، تواصل معنا من «المساعدة».
        </Text>
      )}
      {/* placeholder so unused */}
      {colors ? null : null}
    </View>
  );
}

/** Skeleton row for list placeholders. */
export function SkeletonCard({ height = 160 }: { height?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height,
        borderRadius: 18,
        backgroundColor: `rgba(${colors.inkRgb},0.04)`,
        borderWidth: 1,
        borderColor: `rgba(${colors.inkRgb},0.06)`,
      }}
    />
  );
}
