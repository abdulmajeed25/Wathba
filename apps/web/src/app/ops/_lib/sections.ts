/**
 * OPS Part 5 — the canonical list of the 16 operator sections. One source of
 * truth shared by the side-nav and the command palette (pure data — safe to
 * import into both server and client components). Order is the nav order.
 */
export interface OpsSection {
  href: string;
  labelAr: string;
  /** Short Arabic hint shown in the command palette. */
  hintAr: string;
}

export const OPS_SECTIONS: OpsSection[] = [
  { href: '/ops', labelAr: 'المركز', hintAr: 'لوحة القيادة والجلسة' },
  { href: '/ops/projects', labelAr: 'المشاريع', hintAr: 'الاعتماد والرفض ودورة الحياة' },
  { href: '/ops/review', labelAr: 'المراجعة', hintAr: 'طابور مراجعة المحتوى' },
  { href: '/ops/money', labelAr: 'المال', hintAr: 'الصرف والتسويات والاستردادات' },
  { href: '/ops/users', labelAr: 'المستخدمون', hintAr: 'الحسابات وكشف البيانات' },
  { href: '/ops/trust', labelAr: 'الثقة والأمان', hintAr: 'البلاغات والإشراف' },
  { href: '/ops/categories', labelAr: 'الفئات', hintAr: 'شجرة الفئات والتفعيل' },
  { href: '/ops/editorial', labelAr: 'التحرير', hintAr: 'البطاقات والمحتوى المحرَّر' },
  { href: '/ops/collections', labelAr: 'المجموعات', hintAr: 'التشكيلات والواجهات' },
  { href: '/ops/suppliers', labelAr: 'المورّدون', hintAr: 'التوريد والعروض' },
  { href: '/ops/analytics', labelAr: 'التحليلات', hintAr: 'المؤشرات والتقارير' },
  { href: '/ops/settings', labelAr: 'الإعدادات', hintAr: 'إعدادات المنصة' },
  { href: '/ops/audit', labelAr: 'سجل التدقيق', hintAr: 'سلسلة الهاش غير القابلة للتعديل' },
  { href: '/ops/support', labelAr: 'الدعم', hintAr: 'تذاكر ومحادثات الدعم' },
  { href: '/ops/agents', labelAr: 'الوكلاء', hintAr: 'هويات الوكلاء ومفتاح الإيقاف' },
  { href: '/ops/team', labelAr: 'الفريق', hintAr: 'الأدوار والصلاحيات' },
];
