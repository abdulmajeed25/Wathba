'use client';

import type { CSSProperties, ComponentType, ReactNode, SVGProps } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpen,
  Bookmark,
  CheckCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  Compass,
  CreditCard,
  Crown,
  Cpu,
  Eye,
  Film,
  Flag,
  Gamepad2,
  Gift,
  Heart,
  HelpCircle,
  Inbox,
  Info,
  LayoutGrid,
  Lightbulb,
  Lock,
  MapPin,
  Megaphone,
  Moon,
  Music,
  Palette,
  Pencil,
  PieChart,
  Play,
  PlayCircle,
  PlusCircle,
  Rocket,
  Search,
  Send,
  Share2,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  ThumbsUp,
  TrendingUp,
  UploadCloud,
  User,
  Utensils,
  Zap,
} from 'lucide-react';

/**
 * Wathba icon — maps Material-Symbols ligature names (the design's source of
 * truth) to lucide-react components (the chosen stack icon library).
 *
 * This wrapper keeps the historical Icon prop API (`name` ligature + `size` +
 * `fill` + `color`) so the 90+ call sites in the wathba-* components need no
 * edits. Material Symbols' "FILL=1" axis maps to lucide's `fill="currentColor"`
 * on outline-by-default glyphs (heart, bookmark, etc.).
 *
 * Unknown ligatures fall back to AlertCircle so a missing mapping is loud, not
 * silent (the previous bug rendered the literal name as text).
 */

type LucideIconCmp = ComponentType<SVGProps<SVGSVGElement>>;

const ICON_MAP: Record<string, LucideIconCmp> = {
  /* hero / cta / buttons */
  rocket_launch: Rocket,
  bolt: Zap,
  explore: Compass,
  favorite: Heart,
  favorite_border: Heart,
  visibility: Eye,
  shield: Shield,
  verified: BadgeCheck,
  verified_user: ShieldCheck,
  workspace_premium: Award,

  /* nav / header / search */
  expand_more: ChevronDown,
  chevron_left: ChevronLeft,
  arrow_back: ArrowLeft,
  arrow_forward: ArrowRight,
  search: Search,
  light_mode: Sun,
  dark_mode: Moon,
  notifications: Bell,
  share: Share2,
  bookmark: Bookmark,
  person: User,
  category: LayoutGrid,

  /* tabs / states */
  auto_stories: BookOpen,
  query_stats: BarChart3,
  campaign: Megaphone,
  forum: Inbox,
  help: HelpCircle,
  info: Info,
  flag: Flag,
  trending_up: TrendingUp,
  pie_chart: PieChart,
  location_on: MapPin,
  check_circle: CheckCircle,
  check: Check,
  add_circle: PlusCircle,
  edit: Pencil,
  send: Send,
  gavel: Award,
  inbox: Inbox,
  lock: Lock,
  credit_card: CreditCard,
  cloud_upload: UploadCloud,
  play_circle: PlayCircle,
  play: Play,
  tips_and_updates: Lightbulb,
  lightbulb: Lightbulb,
  redeem: Gift,
  diamond: Sparkles,
  thumbs_up: ThumbsUp,
  thumb_up: ThumbsUp,
  package_2: ShoppingBag,
  inventory_2: ShoppingBag,
  volunteer_activism: Heart,

  /* category strip — material → lucide */
  memory: Cpu,
  palette: Palette,
  sports_esports: Gamepad2,
  movie: Film,
  music_note: Music,
  restaurant: Utensils,
  menu_book: BookOpen,
  design_services: Palette,
  schedule: Clock,
  crown: Crown,
};

interface IconProps {
  name: string;
  size?: number;
  /** Material Symbols' FILL=1 axis — for outline-by-default glyphs (heart,
   *  bookmark, etc.) this fills them; pass-through for already-filled glyphs. */
  fill?: boolean;
  color?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 20, fill = false, color, style }: IconProps) {
  const Cmp = ICON_MAP[name] ?? AlertCircle;
  return (
    <Cmp
      width={size}
      height={size}
      style={{ color, flexShrink: 0, ...style }}
      strokeWidth={2}
      fill={fill ? 'currentColor' : 'none'}
      aria-hidden
    />
  );
}

/** Numeric wrapper — Space Grotesk + tabular-nums (the `.num` class). */
export function Num({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        fontFamily: '"Space Grotesk", sans-serif',
        fontFeatureSettings: '"tnum"',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
