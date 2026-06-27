import React from 'react';
import { Pressable, View, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Text, Icon } from './index';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string | number;
}

export interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pill';
}

export function Tabs({ items, active, onChange, variant = 'underline' }: TabsProps) {
  const { colors } = useTheme();

  if (variant === 'pill') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 9,
          backgroundColor: `rgba(${colors.inkRgb},0.04)`,
          borderRadius: 13,
          padding: 5,
          alignSelf: 'flex-start',
          flexDirection: 'row-reverse',
        }}
      >
        {items.map((t) => {
          const isActive = t.id === active;
          return (
            <Pressable
              key={t.id}
              onPress={() => onChange(t.id)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 15,
                borderRadius: 9,
                backgroundColor: isActive ? colors.surface : 'transparent',
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 7,
              }}
            >
              {t.icon && <Icon name={t.icon} size={16} color={isActive ? colors.text : colors.muted} />}
              <Text
                style={{
                  color: isActive ? colors.text : colors.muted,
                  fontSize: 13.5,
                  fontWeight: '600',
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ borderBottomWidth: 1, borderBottomColor: `rgba(${colors.inkRgb},0.08)` }}
      contentContainerStyle={{ flexDirection: 'row-reverse', gap: 24, paddingHorizontal: 4 }}
    >
      {items.map((t) => {
        const isActive = t.id === active;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            style={{
              paddingVertical: 14,
              paddingHorizontal: 2,
              borderBottomWidth: 2,
              borderBottomColor: isActive ? colors.accent : 'transparent',
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {t.icon && <Icon name={t.icon} size={18} color={isActive ? colors.accent : colors.muted} />}
            <Text
              style={{
                color: isActive ? colors.accent : colors.muted,
                fontSize: 15,
                fontWeight: '600',
              }}
            >
              {t.label}
            </Text>
            {t.badge !== undefined && (
              <View
                style={{
                  backgroundColor: `rgba(${colors.inkRgb},0.08)`,
                  paddingVertical: 2,
                  paddingHorizontal: 7,
                  borderRadius: 20,
                }}
              >
                <Text num variant="small">
                  {t.badge}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
