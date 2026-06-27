import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import type { ComponentProps } from 'react';

/**
 * Wathba icon — proxies to Material Symbols / MaterialIcons. We use
 * MaterialIcons from @expo/vector-icons because Material Symbols Rounded
 * is not bundled as a font in Expo; the closest cross-platform option is
 * the MaterialIcons set, which matches visually for ~95% of glyphs.
 *
 * Pass the same icon names as the design (e.g. `bolt`, `explore`,
 * `rocket_launch`); we transliterate snake_case → kebab via a map below.
 */
const NAME_MAP: Record<string, ComponentProps<typeof MaterialIcons>['name']> = {
  rocket_launch: 'rocket-launch',
  expand_more: 'expand-more',
  chevron_left: 'chevron-left',
  arrow_back: 'arrow-back',
  arrow_forward: 'arrow-forward',
  trending_up: 'trending-up',
  workspace_premium: 'workspace-premium',
  bolt: 'bolt',
  explore: 'explore',
  search: 'search',
  visibility: 'visibility',
  favorite: 'favorite',
  favorite_border: 'favorite-border',
  bookmark: 'bookmark',
  share: 'share',
  notifications: 'notifications',
  verified_user: 'verified-user',
  verified: 'verified',
  redeem: 'redeem',
  check: 'check',
  check_circle: 'check-circle',
  credit_card: 'credit-card',
  account_balance_wallet: 'account-balance-wallet',
  lock: 'lock',
  shield: 'shield',
  query_stats: 'query-stats',
  cloud_upload: 'cloud-upload',
  tips_and_updates: 'tips-and-updates',
  edit: 'edit',
  add_circle: 'add-circle',
  person: 'person',
  campaign: 'campaign',
  help: 'help',
  play_circle: 'play-circle',
};

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color }: IconProps) {
  const { colors } = useTheme();
  const mapped = NAME_MAP[name] ?? (name as ComponentProps<typeof MaterialIcons>['name']);
  return <MaterialIcons name={mapped} size={size} color={color ?? colors.muted} />;
}
