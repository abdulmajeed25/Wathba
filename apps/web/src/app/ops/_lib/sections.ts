/**
 * OPS Phase B (Unit 2) — the canonical operator sections, now grouped into an
 * operator-mental-model taxonomy instead of a flat 16-item rail. One source of
 * truth shared by the grouped side-nav and the command palette (pure data —
 * safe to import into both server and client components).
 *
 * Taxonomy (7 clusters, ordered by triage frequency):
 *   المراقبة   — where the day starts (board, analytics, audit)
 *   الأموال    — the money spine (isolated: highest-stakes)
 *   المشاريع   — project lifecycle + content review
 *   الثقة والأمان — reports / moderation
 *   الأشخاص    — user accounts + the ops team itself
 *   المحتوى    — the curated public surface (categories/editorial/collections)
 *   العمليات   — supply, support, agents, platform settings
 *
 * `badgeKey` ties a section to a live workQueue count on the dashboard so the
 * grouped nav can show "N need me" without navigating (see ops-nav.tsx).
 */

/** Live-count fields the nav reads off /v1/ops/dashboard.workQueue. */
export type BadgeKey =
  | 'projectsUnderReview'
  | 'money'
  | 'reportsOpen'
  | 'ticketsOpen'
  | 'appealsOpen';

export interface OpsSection {
  href: string;
  labelAr: string;
  /** Short Arabic hint shown in the command palette. */
  hintAr: string;
  /** Dashboard workQueue field to badge this item with, if any. */
  badgeKey?: BadgeKey;
}

export interface OpsGroup {
  labelAr: string;
  items: OpsSection[];
}

export const OPS_GROUPS: OpsGroup[] = [
  {
    labelAr: 'المراقبة',
    items: [
      { href: '/ops', labelAr: 'المركز', hintAr: 'لوحة القيادة والجلسة' },
      { href: '/ops/alerts', labelAr: 'التنبيهات', hintAr: 'الشذوذات والمخاطر الحيّة' },
      { href: '/ops/analytics', labelAr: 'التحليلات', hintAr: 'المؤشرات والتقارير' },
      { href: '/ops/notifications', labelAr: 'الإشعارات', hintAr: 'ما أرسلته المنصّة للمستخدمين' },
      { href: '/ops/audit', labelAr: 'سجل التدقيق', hintAr: 'سلسلة الهاش غير القابلة للتعديل' },
    ],
  },
  {
    labelAr: 'الأموال',
    items: [{ href: '/ops/money', labelAr: 'المال', hintAr: 'الصرف والتسويات والاستردادات', badgeKey: 'money' }],
  },
  {
    labelAr: 'المشاريع',
    items: [
      { href: '/ops/projects', labelAr: 'المشاريع', hintAr: 'الاعتماد والرفض ودورة الحياة', badgeKey: 'projectsUnderReview' },
      { href: '/ops/review', labelAr: 'المراجعة', hintAr: 'طابور مراجعة المحتوى' },
      { href: '/ops/fulfillment', labelAr: 'تسليم المكافآت', hintAr: 'حالة تسليم مكافآت الداعمين' },
      { href: '/ops/contests', labelAr: 'المسابقات', hintAr: 'مراقبة مسابقات علّق واربح' },
    ],
  },
  {
    labelAr: 'الثقة والأمان',
    items: [
      { href: '/ops/trust', labelAr: 'الثقة والأمان', hintAr: 'البلاغات والإشراف', badgeKey: 'reportsOpen' },
      { href: '/ops/appeals', labelAr: 'التظلّمات', hintAr: 'مراجعة تظلّمات الحظر والرفض', badgeKey: 'appealsOpen' },
    ],
  },
  {
    labelAr: 'الأشخاص',
    items: [
      { href: '/ops/users', labelAr: 'المستخدمون', hintAr: 'الحسابات وكشف البيانات' },
      { href: '/ops/team', labelAr: 'الفريق', hintAr: 'الأدوار والصلاحيات' },
    ],
  },
  {
    labelAr: 'المحتوى',
    items: [
      { href: '/ops/categories', labelAr: 'الفئات', hintAr: 'شجرة الفئات والتفعيل' },
      { href: '/ops/editorial', labelAr: 'التحرير', hintAr: 'البطاقات والمحتوى المحرَّر' },
      { href: '/ops/collections', labelAr: 'المجموعات', hintAr: 'التشكيلات والواجهات' },
    ],
  },
  {
    labelAr: 'العمليات',
    items: [
      { href: '/ops/suppliers', labelAr: 'المورّدون', hintAr: 'التوريد والعروض' },
      { href: '/ops/support', labelAr: 'الدعم', hintAr: 'تذاكر ومحادثات الدعم', badgeKey: 'ticketsOpen' },
      { href: '/ops/agents', labelAr: 'الوكلاء', hintAr: 'هويات الوكلاء ومفتاح الإيقاف' },
      { href: '/ops/settings', labelAr: 'الإعدادات', hintAr: 'إعدادات المنصة' },
    ],
  },
];

/**
 * Flat view (nav order preserved) — kept for the command palette and any other
 * consumer that wants every section without the grouping. Derived from the
 * groups so there is still exactly one source of truth.
 */
export const OPS_SECTIONS: OpsSection[] = OPS_GROUPS.flatMap((g) => g.items);
