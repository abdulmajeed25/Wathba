import React from 'react';
import { View } from 'react-native';
import { Screen, Text, Button, Badge, Card } from '../src/ui';
import { useTheme } from '../src/theme/ThemeProvider';
import { ar } from '../src/i18n/ar';

/**
 * Phase 0 home — proves theme + RTL + design tokens + UI primitives wire
 * together. Phase 1 replaces this with the full home reproduced from
 * design/wathba.dc.html.
 */
export default function HomeStub() {
  const { name, toggle, colors } = useTheme();
  return (
    <Screen>
      <View style={{ paddingTop: 16, gap: 16 }}>
        <Badge label={ar.home.badge} withDot />
        <Text variant="display">{ar.home.h1Top}</Text>
        <Text variant="display" tone="accent">
          {ar.home.h1Highlight}
        </Text>
        <Text variant="body" tone="muted">
          {ar.home.description}
        </Text>
        <View style={{ flexDirection: 'row-reverse', gap: 12 }}>
          <Button title={ar.home.ctaLaunch} iconLeft="bolt" />
          <Button title={ar.home.ctaDiscover} variant="ghost" iconLeft="explore" />
        </View>
        <Card>
          <Text variant="h3">{ar.home.transparencyTitle}</Text>
          <Text variant="muted" style={{ marginTop: 8 }}>
            {ar.home.transparencyDesc}
          </Text>
        </Card>
        <Button title={`Theme: ${name} (tap to toggle)`} variant="outline" onPress={toggle} />
        <Text tone="muted2" variant="small">
          bg={colors.bg} accent={colors.accent}
        </Text>
      </View>
    </Screen>
  );
}
