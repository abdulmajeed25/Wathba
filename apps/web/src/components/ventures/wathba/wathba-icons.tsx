'use client';

import type { CSSProperties, ComponentType, ReactNode, SVGProps } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowLeftRight,
  AtSign,
  Camera,
  Globe,
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
  ChevronUp,
  Clock,
  Compass,
  CreditCard,
  Crown,
  Cpu,
  ExternalLink,
  Eye,
  Film,
  Flag,
  Frown,
  Gamepad2,
  Gift,
  Heart,
  HelpCircle,
  Inbox,
  Info,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  LogOut,
  Lock,
  Medal,
  SlidersHorizontal,
  MapPin,
  Megaphone,
  Moon,
  Music,
  Palette,
  PartyPopper,
  Pencil,
  PieChart,
  Play,
  PlayCircle,
  PlusCircle,
  Rocket,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  SquarePen,
  Sun,
  Trash2,
  ThumbsUp,
  TrendingUp,
  Trophy,
  UploadCloud,
  User,
  Users,
  Wallet,
  History,
  Utensils,
  XCircle,
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
  expand_less: ChevronUp,
  delete: Trash2,
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
  group: Users,
  history: History,
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
  logout: LogOut,
  tune: SlidersHorizontal,
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

  /* footer socials (STAKES/H5) — these ligatures previously fell back to
     AlertCircle (no mapping); lucide dropped brand glyphs so we use the
     closest neutral ones. */
  public: Globe,
  alternate_email: AtSign,
  photo_camera: Camera,
  smart_display: PlayCircle,

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

  /* ── names that had no entry and were therefore rendering AlertCircle ──
     The fallback below is deliberately loud, and it worked: three creator-
     dashboard tabs and the «الداعمون» stat card shipped showing a warning
     circle. Loud is only useful if somebody looks, and nobody did.

     The notification block is the one that mattered most. Those ligatures are
     reached by NOTIFICATION KIND, so nothing rendered them until a real payout,
     refund, rank-up or contest event existed — the seeded account has none, so
     every screen looked fine while seven kinds were one webhook away from
     showing a warning triangle to a user being told they had been paid. */
  /* Missed by the first sweep, and by the guard that sweep shipped: this call
     site spans several lines, and the scan matched `<Icon` and `name=` only
     when they shared one. It was the checkout payment-method chooser — a
     warning circle on «محفظة رقمية», beside a correct card glyph, while the
     user typed their card number. The guard now scans across line breaks. */
  account_balance_wallet: Wallet,

  dashboard: LayoutDashboard,
  groups: Users,
  settings: Settings,
  celebration: PartyPopper,
  account_balance: Landmark,
  edit_note: SquarePen,
  open_in_new: ExternalLink,
  cancel: XCircle,
  payments: Wallet,
  currency_exchange: ArrowLeftRight,
  military_tech: Medal,
  emoji_events: Trophy,
  help_outline: HelpCircle,
  sentiment_dissatisfied: Frown,
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

/** Numeric wrapper — Space Grotesk + tabular-nums (the `.num` class).
 *  `decorative` marks purely-ornamental numerals (e.g. giant ghosted step
 *  watermarks) aria-hidden so they leave the a11y tree + the contrast audit. */
export function Num({
  children,
  style,
  className,
  decorative,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <span
      className={className}
      aria-hidden={decorative || undefined}
      style={{
        fontFamily: 'var(--font-space-grotesk), "Space Grotesk", sans-serif',
        fontFeatureSettings: '"tnum"',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
