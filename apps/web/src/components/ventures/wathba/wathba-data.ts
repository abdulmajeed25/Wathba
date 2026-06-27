/**
 * Wathba demo content — literal copy from the design's DC script
 * (state + tables). Powers the no-login /preview-ventures review.
 *
 * Once the real Ventures API endpoints land per the spec, the home/discover
 * surfaces swap to those endpoints; this file remains the fallback fixture.
 */

export interface WathbaProject {
  id: string;
  titleAr: string;
  titleEn: string;
  creator: string;
  cat: string;
  catId: string;
  raised: number;
  goal: number;
  backers: number;
  daysLeft: number;
  loc: string;
  badge: string;
  desc: string;
}

export const wathbaProjects: WathbaProject[] = [
  {
    id: 'p1',
    titleAr: 'سِرب — درون التصوير الذكي',
    titleEn: 'Sirb',
    creator: 'استوديو أُفق',
    cat: 'تقنية',
    catId: 'tech',
    raised: 684200,
    goal: 400000,
    backers: 2847,
    daysLeft: 12,
    loc: 'أبوظبي، الإمارات',
    badge: 'مشروع نحبه',
    desc: 'كاميرا طائرة تتبعك تلقائياً وتصوّر بدقة 8K، مصممة بالكامل في المنطقة.',
  },
  {
    id: 'p2',
    titleAr: 'حكايا — لعبة الطاولة العربية',
    titleEn: 'Hekaya',
    creator: 'ورشة لُعَب',
    cat: 'ألعاب',
    catId: 'games',
    raised: 128400,
    goal: 120000,
    backers: 1640,
    daysLeft: 8,
    loc: 'عمّان، الأردن',
    badge: 'رائج',
    desc: 'لعبة طاولة استراتيجية مستوحاة من التراث العربي بتصميم فاخر.',
  },
  {
    id: 'p3',
    titleAr: 'صدى — فيلم وثائقي عن الصحراء',
    titleEn: 'Sada',
    creator: 'ليلى منصور',
    cat: 'أفلام',
    catId: 'film',
    raised: 96800,
    goal: 150000,
    backers: 980,
    daysLeft: 21,
    loc: 'الرياض، السعودية',
    badge: '',
    desc: 'رحلة بصرية عبر صحاري الجزيرة العربية ومن يسكنها.',
  },
  {
    id: 'p4',
    titleAr: 'بستان — حقيبة من مواد معاد تدويرها',
    titleEn: 'Bustan',
    creator: 'مرسم خضر',
    cat: 'تصميم',
    catId: 'design',
    raised: 54300,
    goal: 60000,
    backers: 1210,
    daysLeft: 5,
    loc: 'تونس',
    badge: '',
    desc: 'حقائب يومية أنيقة مصنوعة بالكامل من بلاستيك المحيطات.',
  },
  {
    id: 'p5',
    titleAr: 'وتر — ألبوم موسيقى عربية حديثة',
    titleEn: 'Watar',
    creator: 'فرقة المدى',
    cat: 'موسيقى',
    catId: 'music',
    raised: 38900,
    goal: 45000,
    backers: 720,
    daysLeft: 14,
    loc: 'بيروت، لبنان',
    badge: '',
    desc: 'ألبوم يمزج الآلات العربية الكلاسيكية بإنتاج إلكتروني معاصر.',
  },
  {
    id: 'p6',
    titleAr: 'مِداد — رواية مصوّرة',
    titleEn: 'Midad',
    creator: 'كريم الحاج',
    cat: 'نشر',
    catId: 'publishing',
    raised: 73500,
    goal: 50000,
    backers: 1580,
    daysLeft: 9,
    loc: 'القاهرة، مصر',
    badge: 'مشروع نحبه',
    desc: 'رواية مصوّرة ملحمية تدور في مدينة عربية مستقبلية.',
  },
  {
    id: 'p7',
    titleAr: 'نواة — حديقة منزلية ذكية',
    titleEn: 'Nawah',
    creator: 'مختبر أخضر',
    cat: 'تقنية',
    catId: 'tech',
    raised: 212000,
    goal: 100000,
    backers: 3120,
    daysLeft: 18,
    loc: 'دبي، الإمارات',
    badge: 'رائج',
    desc: 'وحدة زراعة ذكية تنمّي الخضروات في مطبخك دون تربة.',
  },
  {
    id: 'p8',
    titleAr: 'لون — معرض فني تفاعلي',
    titleEn: 'Lawn',
    creator: 'جماعة طيف',
    cat: 'فنون',
    catId: 'art',
    raised: 29400,
    goal: 80000,
    backers: 540,
    daysLeft: 26,
    loc: 'الدوحة، قطر',
    badge: '',
    desc: 'معرض غامر يحوّل اللوحات إلى تجارب ضوئية حركية.',
  },
];

export interface WathbaCategory {
  id: string;
  ar: string;
  en: string;
  icon: string;
  count: string;
  subs: string[];
}

export const wathbaCategories: WathbaCategory[] = [
  { id: 'tech', ar: 'تقنية', en: 'Technology', icon: 'memory', count: '٨٤٢ مشروع', subs: ['أجهزة', 'تطبيقات', 'روبوتات', 'طاقة', 'إنترنت الأشياء', 'ارتداءات ذكية', 'واقع افتراضي', 'فضاء'] },
  { id: 'art', ar: 'فنون', en: 'Art', icon: 'palette', count: '٦١٠ مشروع', subs: ['رسم', 'نحت', 'تصوير فوتوغرافي', 'فن رقمي', 'خزف', 'فن الشارع', 'تجهيز فني', 'نسيج'] },
  { id: 'games', ar: 'ألعاب', en: 'Games', icon: 'sports_esports', count: '٤٩٣ مشروع', subs: ['ألعاب طاولة', 'ألعاب فيديو', 'بطاقات', 'أحجية', 'ألعاب أدوار', 'ألعاب جوال', 'أجهزة لعب'] },
  { id: 'film', ar: 'أفلام', en: 'Film', icon: 'movie', count: '٣٨٧ مشروع', subs: ['وثائقي', 'روائي', 'أفلام قصيرة', 'رسوم متحركة', 'خيال علمي', 'كوميديا', 'دراما', 'تجريبي'] },
  { id: 'music', ar: 'موسيقى', en: 'Music', icon: 'music_note', count: '٤٢١ مشروع', subs: ['عربي', 'إلكتروني', 'روك', 'هيب هوب', 'كلاسيكي', 'جاز', 'بوب', 'عالمي'] },
  { id: 'design', ar: 'تصميم', en: 'Design', icon: 'design_services', count: '٥٥٨ مشروع', subs: ['منتجات', 'جرافيك', 'أثاث', 'أزياء', 'طباعة', 'عمارة', 'تصميم تفاعلي', 'ألعاب أطفال'] },
  { id: 'publishing', ar: 'نشر', en: 'Publishing', icon: 'menu_book', count: '٣٠٢ مشروع', subs: ['روايات', 'قصص مصوّرة', 'كتب أطفال', 'شعر', 'مجلات', 'كتب فنية', 'صحافة', 'مختارات'] },
  { id: 'food', ar: 'طعام', en: 'Food', icon: 'restaurant', count: '٢١٧ مشروع', subs: ['مأكولات', 'مشروبات', 'حلويات', 'مطاعم', 'مزارع', 'كتب طبخ', 'دفعات صغيرة', 'نباتي'] },
];

export interface WathbaRank {
  id: string;
  ar: string;
  en: string;
  req: string;
  icon: string;
  bg: string;
  icoColor: string;
  titleColor: string;
  border: string;
  glow: string;
  perks: string[];
}

export const wathbaRanks: WathbaRank[] = [
  { id: 'r1', ar: 'مستكشف', en: 'EXPLORER', req: 'أول دعم', icon: 'explore', bg: 'rgba(148,163,184,.15)', icoColor: 'var(--rank-silver)', titleColor: 'var(--rank-silver)', border: 'rgba(var(--ink-rgb),.08)', glow: 'none', perks: ['شارة رقمية على ملفك', 'تحديثات حصرية من المشاريع', 'الوصول لمجتمع الداعمين'] },
  { id: 'r2', ar: 'داعم', en: 'BACKER', req: '٣ مشاريع', icon: 'favorite', bg: 'rgba(var(--accent2-rgb),.18)', icoColor: 'var(--blue)', titleColor: 'var(--blue)', border: 'rgba(var(--accent2-rgb),.25)', glow: 'none', perks: ['كل مزايا المستكشف', 'أولوية في الردود', 'إشعارات مبكرة بالمشاريع الجديدة'] },
  { id: 'r3', ar: 'محسن', en: 'PATRON', req: '$١٬٠٠٠+', icon: 'volunteer_activism', bg: 'rgba(var(--accent-rgb),.18)', icoColor: 'var(--accent)', titleColor: 'var(--accent)', border: 'rgba(var(--accent-rgb),.3)', glow: '0 0 24px -6px rgba(var(--accent-rgb),.5)', perks: ['كل مزايا الداعم', 'وصول مبكر لمكافآت محدودة', 'شارة «محسن» مميزة'] },
  { id: 'r4', ar: 'سفير', en: 'AMBASSADOR', req: '١٠ مشاريع', icon: 'workspace_premium', bg: 'rgba(251,191,36,.18)', icoColor: 'var(--gold)', titleColor: 'var(--gold)', border: 'rgba(251,191,36,.35)', glow: '0 0 28px -6px rgba(251,191,36,.55)', perks: ['كل مزايا المحسن', 'لقاءات افتراضية مع المبدعين', 'دعوات لفعاليات وثبة الحصرية'] },
  { id: 'r5', ar: 'شريك مؤسس', en: 'FOUNDER', req: '$١٠٬٠٠٠+', icon: 'diamond', bg: 'linear-gradient(135deg,var(--purple),var(--accent))', icoColor: 'var(--on-accent)', titleColor: 'var(--purple)', border: 'rgba(167,139,250,.4)', glow: '0 0 32px -4px rgba(167,139,250,.6)', perks: ['كل المزايا السابقة', 'اسمك في «جدار المؤسسين»', 'استشارات مع فريق وثبة', 'منتجات حصرية للمؤسسين'] },
];

export const wathbaBudgetRows = [
  { label: 'التصنيع والإنتاج', pct: 48, w: '48%', color: 'var(--grad-bar)' },
  { label: 'البحث والتطوير', pct: 24, w: '24%', color: 'var(--grad-bar-over)' },
  { label: 'الشحن والتغليف', pct: 16, w: '16%', color: 'linear-gradient(90deg,var(--purple),#3b82f6)' },
  { label: 'التشغيل والتسويق', pct: 12, w: '12%', color: 'linear-gradient(90deg,var(--gold),#f59e0b)' },
];

export const wathbaHowSteps = [
  { n: '01', icon: 'lightbulb', titleAr: 'اعرض فكرتك', descAr: 'أنشئ صفحة مشروعك بالفيديو والقصة والأهداف، وحدّد مستويات الدعم والمكافآت.' },
  { n: '02', icon: 'campaign', titleAr: 'اجمع الدعم', descAr: 'شارك مشروعك مع مجتمعك، وتابع التمويل لحظياً مع لوحة شفافية كاملة.' },
  { n: '03', icon: 'rocket_launch', titleAr: 'حقّق وثبتك', descAr: 'عند بلوغ الهدف نحوّل التمويل، وتبدأ رحلة تنفيذ مشروعك ومكافأة داعميك.' },
];

export const wathbaTickerMessages = [
  '🟢 أحمد دعم «سِرب» بـ $240',
  '🚀 «حكايا» وصل 100% من هدفه',
  '🟢 سارة أصبحت سفيرة الآن',
  '✨ مشروع جديد: «بستان» في التصميم',
  '🟢 خالد دعم «صدى» بـ $85',
];

export const wathbaFooterCols = [
  { title: 'المنصة', items: ['استكشف المشاريع', 'ابدأ مشروعاً', 'كيف تعمل', 'رتب الداعمين', 'الأسعار والرسوم'] },
  { title: 'الموارد', items: ['دليل المبدعين', 'مركز المساعدة', 'قصص نجاح', 'المدونة', 'الأسئلة الشائعة'] },
  { title: 'الشركة', items: ['من نحن', 'الوظائف', 'الشروط', 'الخصوصية', 'تواصل معنا'] },
];

export const wathbaSocials = ['public', 'alternate_email', 'photo_camera', 'smart_display'];

// ───────── derivations (mirror the design's derive()) ─────────
export interface DerivedProject extends WathbaProject {
  pct: number;
  pctW: string;
  pctColor: string;
  barGrad: string;
  raisedFmt: string;
  goalFmt: string;
  backersFmt: string;
  trustScore: number;
  trustBand: 'low' | 'moderate' | 'high' | 'exceptional';
}

const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtMoney = (n: number) => '$' + fmtNum(n);

function trustBandFor(score: number): 'low' | 'moderate' | 'high' | 'exceptional' {
  if (score >= 90) return 'exceptional';
  if (score >= 75) return 'high';
  if (score >= 55) return 'moderate';
  return 'low';
}

/** Deterministic heuristic that mirrors apps/api TrustScoreService for the
 *  fixture-rendered cards. Once the seed wave lands and the API returns
 *  per-venture scores live, this fallback drops out. */
function trustHeuristic(p: WathbaProject): number {
  let s = 55;
  const pct = (p.raised / p.goal) * 100;
  if (pct >= 100) s += 16;
  else if (pct >= 70) s += 10;
  else if (pct >= 50) s += 6;
  else if (pct < 20) s -= 4;
  if (p.backers >= 2000) s += 8;
  else if (p.backers >= 1000) s += 4;
  if (p.badge === 'مشروع نحبه') s += 6;
  else if (p.badge === 'رائج') s += 3;
  if (p.daysLeft <= 7) s += 2;
  return Math.max(30, Math.min(96, s));
}

export function deriveProject(p: WathbaProject): DerivedProject {
  const pct = Math.round((p.raised / p.goal) * 100);
  const over = pct >= 100;
  const trustScore = trustHeuristic(p);
  return {
    ...p,
    pct,
    pctW: Math.min(pct, 100) + '%',
    pctColor: over ? 'var(--accent)' : 'var(--blue)',
    barGrad: over ? 'var(--grad-bar-over)' : 'var(--grad-bar)',
    raisedFmt: fmtMoney(p.raised),
    goalFmt: fmtMoney(p.goal),
    backersFmt: fmtNum(p.backers),
    trustScore,
    trustBand: trustBandFor(trustScore),
  };
}

export function compactNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return Math.round(n / 1e3) + 'K';
  return String(n);
}

// ───────── live API adapter ─────────

/**
 * Live row from GET /v1/ventures. Kept narrow on purpose — we only thread
 * fields the UI actually consumes. The full DTO lives in lib/api/wathba.ts.
 */
export interface ApiVentureLike {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  state: string;
  fundingGoal: string;
  fundingRaised: string;
  fundingDeadline: string | null;
  trustScore: number | null;
}

const SEED_PREFIX = /^\[SEED\]\s*/;

function daysUntil(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * Stitch a live API venture into the existing WathbaProject shape. Fields the
 * API knows about (raised/goal/deadline/trustScore) come from the live row;
 * presentational fields the API doesn't store yet (creator/loc/badge/cat) fall
 * back to the matching fixture row keyed by slug — the seed slugs are the
 * lowercase fixture titleEn so this matches 1:1 for the 8 demo ventures.
 *
 * Returns null when no fixture is found, so the caller can decide whether to
 * skip the row or render a minimal card.
 */
export function adaptApiVenture(v: ApiVentureLike): (WathbaProject & { apiId: string }) | null {
  const slug = v.slug.toLowerCase();
  const fixture = wathbaProjects.find((p) => p.titleEn.toLowerCase() === slug);
  if (!fixture) return null;
  const cleanTitle = v.title.replace(SEED_PREFIX, '').trim();
  return {
    ...fixture,
    id: slug,
    apiId: v.id,
    titleAr: cleanTitle || fixture.titleAr,
    raised: Number(v.fundingRaised),
    goal: Number(v.fundingGoal),
    daysLeft: daysUntil(v.fundingDeadline),
    desc: v.tagline?.trim() ? v.tagline.trim() : fixture.desc,
  };
}

export interface ApiForumThreadLike {
  id: string;
  title: string;
  body: string;
  author: { handle: string; displayName: string };
  createdAt: string;
  replyCount: number;
  likeCount: number;
}

const RANK_BY_HANDLE: Record<string, { rank: string; rankColor: string }> = {
  'mona-otaibi': { rank: 'سفير', rankColor: 'var(--gold)' },
  'yousef-haddad': { rank: 'محسن', rankColor: 'var(--accent)' },
  'rahaf-a': { rank: 'داعم', rankColor: 'var(--blue)' },
};

function relativeAr(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diffMs / 3_600_000);
  if (h < 1) return 'الآن';
  if (h < 24) return `قبل ${h} ${h === 1 ? 'ساعة' : 'ساعات'}`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'قبل يوم';
  return `قبل ${d} ${d < 11 ? 'أيام' : 'يوماً'}`;
}

const SEED_PREFIX_THREAD = /^\[SEED\]\s*/;

export function adaptApiThread(t: ApiForumThreadLike): {
  name: string;
  rank: string;
  rankColor: string;
  time: string;
  body: string;
  likes: number;
  reply: string | null;
} {
  const rk = RANK_BY_HANDLE[t.author.handle] ?? { rank: 'داعم', rankColor: 'var(--blue)' };
  const body = (t.body || t.title).replace(SEED_PREFIX_THREAD, '').trim();
  return {
    name: t.author.displayName,
    rank: rk.rank,
    rankColor: rk.rankColor,
    time: relativeAr(t.createdAt),
    body,
    likes: t.likeCount,
    reply: t.replyCount > 0 ? 'ردّ مؤسس المشروع — افتح المناقشة لقراءة الرد كاملاً.' : null,
  };
}

/**
 * Live-aware derive: prefers the cached score on the venture row, falls back
 * to the deterministic heuristic so cards always render a value.
 */
export function deriveLiveProject(p: WathbaProject, trustScoreOverride?: number | null): DerivedProject {
  const base = deriveProject(p);
  if (typeof trustScoreOverride === 'number' && trustScoreOverride > 0) {
    return { ...base, trustScore: trustScoreOverride, trustBand: trustBandFor(trustScoreOverride) };
  }
  return base;
}

// ───────── project detail content ─────────

export interface WathbaTier {
  id: string;
  price: number;
  title: string;
  desc: string;
  items: string[];
  backers: number;
  left: number | null;
  est: string;
  rank: string;
  popular?: boolean;
}

export const wathbaTiers: WathbaTier[] = [
  {
    id: 't0',
    price: 25,
    title: 'داعم مبكر',
    desc: 'شكرٌ خاص باسمك في صفحة المشروع، وتحديثات حصرية طوال الرحلة.',
    items: ['شارة داعم رقمية', 'تحديثات حصرية'],
    backers: 842,
    left: null,
    est: 'فوري',
    rank: 'مستكشف',
  },
  {
    id: 't1',
    price: 79,
    title: 'الباقة الأساسية',
    desc: 'وحدة واحدة بسعر الإطلاق الحصري قبل طرحها في الأسواق.',
    items: ['١× المنتج', 'خصم الإطلاق ٣٠٪', 'شحن مجاني محلياً'],
    backers: 1240,
    left: null,
    est: 'مارس ٢٠٢٦',
    rank: 'داعم',
    popular: true,
  },
  {
    id: 't2',
    price: 149,
    title: 'الباقة المزدوجة',
    desc: 'وحدتان بسعرٍ مخفّض — مثالية لك ولمن تحب، مع إكسسوارات إضافية.',
    items: ['٢× المنتج', 'حقيبة حمل حصرية', 'وصول مبكر للتحديثات'],
    backers: 680,
    left: 120,
    est: 'مارس ٢٠٢٦',
    rank: 'داعم',
  },
  {
    id: 't3',
    price: 399,
    title: 'باقة المحترفين',
    desc: 'خمس وحدات للفرق والاستوديوهات، مع دعم فني مخصص لمدة عام.',
    items: ['٥× المنتج', 'دعم فني سنوي', 'اسمك كـ«شريك» في الصفحة'],
    backers: 94,
    left: 30,
    est: 'أبريل ٢٠٢٦',
    rank: 'محسن',
  },
  {
    id: 't4',
    price: 2500,
    title: 'الشريك المؤسس',
    desc: 'تجربة كاملة: زيارة الاستوديو، نسخة موقّعة بالرقم #001، وعشاء مع الفريق.',
    items: ['كل ما سبق', 'جولة في الاستوديو', 'نسخة موقّعة رقم #001', 'عشاء مع المؤسسين'],
    backers: 6,
    left: 4,
    est: 'مايو ٢٠٢٦',
    rank: 'شريك مؤسس',
  },
];

export const wathbaProjectUpdates = [
  { n: 4, title: 'وصلنا 150% — شكراً لكم!', date: 'قبل يومين', body: 'تجاوزنا الهدف الإضافي الأول، ما يعني أن كل وحدة ستحصل على بطارية أكبر دون أي تكلفة إضافية عليكم.', tag: 'إنجاز' },
  { n: 3, title: 'العيّنة الهندسية الأولى جاهزة', date: 'قبل ٦ أيام', body: 'استلمنا أول نموذج من المصنع وأجرينا اختبارات الطيران الأولية بنجاح. شاهدوا الفيديو في الصفحة.', tag: 'تطوير' },
  { n: 2, title: 'شراكة مع شركة شحن إقليمية', date: 'قبل ١١ يوماً', body: 'وقّعنا اتفاقية تضمن وصول الطلبات خلال ٥ أيام عمل داخل دول الخليج.', tag: 'لوجستيات' },
  { n: 1, title: 'انطلقنا رسمياً على وثبة', date: 'قبل ١٤ يوماً', body: 'أهلاً بكم في رحلة سِرب! نشارككم اليوم كل التفاصيل والمخططات. تابعونا.', tag: 'إطلاق' },
];

export const wathbaProjectComments = [
  { name: 'منى العتيبي', rank: 'سفير', rankColor: 'var(--gold)', time: 'قبل ٣ ساعات', body: 'فكرة رائعة وتنفيذ احترافي. متحمسة جداً لاستلام وحدتي! هل ستتوفر ألوان إضافية لاحقاً؟', likes: 24, reply: 'نعم منى، خططنا لطرح لونين جديدين بعد الحملة مباشرةً 🎉' },
  { name: 'يوسف حدّاد', rank: 'محسن', rankColor: 'var(--accent)', time: 'قبل ٨ ساعات', body: 'دعمت المشروع من اليوم الأول. لوحة الشفافية أقنعتني تماماً — هذا ما ينقص بقية المنصات.', likes: 41, reply: null as string | null },
  { name: 'رهف ا.', rank: 'داعم', rankColor: 'var(--blue)', time: 'قبل يوم', body: 'سؤال عن الشحن لخارج الخليج، هل متاح؟', likes: 7, reply: 'متاح يا رهف، ستُضاف رسوم الشحن الدولي عند الدفع.' },
];

export const wathbaProjectFaqs = [
  { q: 'متى سأستلم مكافأتي؟', a: 'تبدأ عمليات الشحن في مارس ٢٠٢٦ بعد انتهاء الحملة بنجاح، وسنوافيكم بتحديثات دورية عن حالة طلبكم.' },
  { q: 'ماذا لو لم يصل المشروع لهدفه؟', a: 'نعتمد مبدأ «الكل أو لا شيء». إن لم نبلغ الهدف، تُعاد كامل مبالغكم تلقائياً دون أي خصم.' },
  { q: 'هل الشحن الدولي متاح؟', a: 'نعم، نشحن إلى أكثر من ٣٨ دولة. تُحتسب رسوم الشحن الدولي عند إتمام الدعم.' },
  { q: 'كيف أضمن جودة المنتج؟', a: 'أكملنا مرحلة العيّنات الهندسية بنجاح، وكل المراحل موثّقة في لوحة الشفافية وقسم التحديثات.' },
];

export const wathbaTxTimeline = [
  { label: 'إطلاق الحملة', amount: '$0', date: '١ يناير', done: true },
  { label: 'تأمين المصنع', amount: '$120K', date: 'مكتمل', done: true },
  { label: 'بدء الإنتاج', amount: '$330K', date: 'فبراير', done: true },
  { label: 'الشحن للداعمين', amount: '$110K', date: 'مارس', done: false },
  { label: 'الدعم والصيانة', amount: '$80K', date: 'مستمر', done: false },
];

export const wathbaSortOptions = [
  { id: 'trending', label: 'الأكثر رواجاً' },
  { id: 'newest', label: 'الأحدث' },
  { id: 'mostfunded', label: 'الأكثر تمويلاً' },
  { id: 'ending', label: 'تنتهي قريباً' },
  { id: 'backers', label: 'الأكثر داعمين' },
];

export const wathbaStatusOptions = [
  { id: 'all', label: 'الكل' },
  { id: 'live', label: 'نشطة' },
  { id: 'funded', label: 'مُموَّلة' },
  { id: 'near', label: 'قاربت الاكتمال' },
];

export const wathbaProjectTabs = [
  { id: 'story', label: 'القصة', icon: 'auto_stories', badge: null as string | null },
  { id: 'transparency', label: 'الشفافية', icon: 'query_stats', badge: null },
  { id: 'updates', label: 'التحديثات', icon: 'campaign', badge: '4' },
  { id: 'community', label: 'المجتمع', icon: 'forum', badge: '128' },
  { id: 'faq', label: 'الأسئلة', icon: 'help', badge: null },
];

export const wathbaPledgeSteps = [
  { n: 1, label: 'المكافأة' },
  { n: 2, label: 'المعلومات' },
  { n: 3, label: 'الدفع' },
  { n: 4, label: 'تأكيد' },
];

