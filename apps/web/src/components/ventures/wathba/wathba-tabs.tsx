'use client';

import type { CSSProperties, ReactNode } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { Icon } from './wathba-icons';

/**
 * Wathba-styled tabs built on @radix-ui/react-tabs. Provides keyboard
 * navigation (Arrow keys + Home/End), correct ARIA roles, focus
 * management — all the things hand-rolled tab buttons miss.
 *
 * Visual styling matches the existing 4 tab surfaces (admin / payments /
 * settings / supplier): bottom-border active indicator with the
 * design's accent color, gap 26, scrollable on overflow.
 */

export interface WathbaTabDef {
  id: string;
  label: string;
  icon: string;
}

export function WathbaTabs({
  tabs,
  value,
  onValueChange,
  maxWidth,
  containerStyle,
  children,
}: {
  tabs: readonly WathbaTabDef[];
  value: string;
  onValueChange: (v: string) => void;
  maxWidth?: number;
  containerStyle?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      <div
        style={{
          maxWidth, margin: '28px auto 0', padding: '0 26px',
          borderBottom: '1px solid rgba(var(--ink-rgb),.08)',
          ...containerStyle,
        }}
      >
        <TabsPrimitive.List
          style={{ display: 'flex', gap: 26, overflowX: 'auto' }}
          loop
        >
          {tabs.map((t) => {
            const active = t.id === value;
            return (
              <TabsPrimitive.Trigger
                key={t.id}
                value={t.id}
                style={{
                  cursor: 'pointer',
                  padding: '14px 2px',
                  background: 'transparent',
                  borderTop: 'none',
                  borderInline: 'none',
                  borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  color: active ? 'var(--accent)' : 'var(--muted)',
                  fontSize: 14.5, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 8,
                  whiteSpace: 'nowrap', fontFamily: 'inherit',
                }}
              >
                <Icon name={t.icon} size={18} />
                {t.label}
              </TabsPrimitive.Trigger>
            );
          })}
        </TabsPrimitive.List>
      </div>

      {/* Body — the parent renders its own Content panels with TabsContent. */}
      {children}
    </TabsPrimitive.Root>
  );
}

/** Re-export Radix Content so callers don't need to know the import path. */
export const WathbaTabsContent = TabsPrimitive.Content;
