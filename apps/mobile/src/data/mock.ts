/**
 * Mock data — Arabic-first, SAR-priced. Mirrors what the API will return so
 * screens can be developed end-to-end before a DB is provisioned.
 *
 * Once the API is up, swap the mock hooks (src/data/hooks.ts) to real fetch
 * calls; the screens don't care.
 */
import type { ProjectCategory, ProjectStatus, ReputationTier } from '@wathba/types';

export interface ProjectCard {
  id: string;
  titleAr: string;
  shortDescAr: string;
  category: ProjectCategory;
  categoryAr: string;
  cityAr: string;
  creator: string;
  /** halalas */
  raisedHalalas: number;
  /** halalas */
  goalHalalas: number;
  releaseThresholdPct: number;
  backersCount: number;
  daysLeft: number;
  popular?: boolean;
  platformPartner?: { stakeType: string; disclosureAr: string } | null;
  status: ProjectStatus;
  imageAccent?: string;
}

export interface RewardTierItem {
  id: string;
  titleAr: string;
  amountHalalas: number;
  descAr: string;
  estDelivery: string;
  popular?: boolean;
  backers: number;
  limitQty?: number | null;
  claimedQty: number;
  items: string[];
  includesPhysicalProduct: boolean;
}

export const categories: Array<{
  id: ProjectCategory;
  ar: string;
  en: string;
  icon: string;
  count: string;
}> = [
  { id: 'tech', ar: 'تقنية', en: 'Tech', icon: 'memory', count: '٢١٤' },
  { id: 'design', ar: 'تصميم', en: 'Design', icon: 'palette', count: '١٤٨' },
  { id: 'film', ar: 'سينما', en: 'Film', icon: 'movie', count: '٧٢' },
  { id: 'music', ar: 'موسيقى', en: 'Music', icon: 'music-note', count: '٩١' },
  { id: 'food', ar: 'طعام', en: 'Food', icon: 'restaurant', count: '٦٥' },
  { id: 'games', ar: 'ألعاب', en: 'Games', icon: 'sports-esports', count: '٣٨' },
  { id: 'publishing', ar: 'نشر', en: 'Publishing', icon: 'book', count: '٥٤' },
  { id: 'fashion', ar: 'أزياء', en: 'Fashion', icon: 'checkroom', count: '٤٢' },
];

const sar = (s: number) => s * 100; // SAR → halalas

export const featuredProject: ProjectCard = {
  id: 'sirb',
  titleAr: 'سِرب — درون التصوير الذكي',
  shortDescAr: 'كاميرا طائرة تتبعك تلقائياً وتصوّر بدقة 8K. صُممت بالكامل في المنطقة.',
  category: 'tech',
  categoryAr: 'تقنية',
  cityAr: 'الرياض، السعودية',
  creator: 'فريق سِرب',
  raisedHalalas: sar(2_566_750),
  goalHalalas: sar(1_500_000),
  releaseThresholdPct: 80,
  backersCount: 3247,
  daysLeft: 12,
  status: 'LIVE',
  imageAccent: '#05c074',
};

export const projects: ProjectCard[] = [
  featuredProject,
  {
    id: 'hekaya',
    titleAr: 'حكايا — منصة قصص الأطفال العربية',
    shortDescAr: 'محتوى تعليمي عربي أصيل لأطفالنا.',
    category: 'publishing',
    categoryAr: 'نشر',
    cityAr: 'جدة، السعودية',
    creator: 'استوديو حكايا',
    raisedHalalas: sar(875_500),
    goalHalalas: sar(800_000),
    releaseThresholdPct: 80,
    backersCount: 1843,
    daysLeft: 5,
    popular: true,
    status: 'LIVE',
    imageAccent: '#22d3ee',
  },
  {
    id: 'sada',
    titleAr: 'صدى — سمّاعة لاسلكية بصوت عربي',
    shortDescAr: 'سمّاعات صُمّمت بحس عربي وبجودة استوديو.',
    category: 'tech',
    categoryAr: 'تقنية',
    cityAr: 'دبي، الإمارات',
    creator: 'فريق صدى',
    raisedHalalas: sar(430_000),
    goalHalalas: sar(600_000),
    releaseThresholdPct: 80,
    backersCount: 1124,
    daysLeft: 21,
    status: 'LIVE',
    imageAccent: '#fbbf24',
  },
  {
    id: 'bustan',
    titleAr: 'بستان — حدائق مدنية صغيرة',
    shortDescAr: 'حدائق على الأسطح للأحياء العربية.',
    category: 'social',
    categoryAr: 'اجتماعي',
    cityAr: 'القاهرة، مصر',
    creator: 'بستان الحي',
    raisedHalalas: sar(120_000),
    goalHalalas: sar(400_000),
    releaseThresholdPct: 80,
    backersCount: 412,
    daysLeft: 28,
    status: 'LIVE',
    imageAccent: '#34d399',
    platformPartner: {
      stakeType: 'co-founder',
      disclosureAr:
        'تستثمر وثبة في هذا المشروع بصفتها شريكاً مؤسساً، وتشارك أرباحه لاحقاً بشكلٍ منفصل عن دعم المجتمع.',
    },
  },
  {
    id: 'noor',
    titleAr: 'نور — مصابيح يدوية من الفخار',
    shortDescAr: 'إضاءة دافئة بصناعة حرفية يدوية.',
    category: 'design',
    categoryAr: 'تصميم',
    cityAr: 'مراكش، المغرب',
    creator: 'نور كرافت',
    raisedHalalas: sar(225_000),
    goalHalalas: sar(250_000),
    releaseThresholdPct: 80,
    backersCount: 763,
    daysLeft: 9,
    status: 'LIVE',
    imageAccent: '#a78bfa',
  },
  {
    id: 'tarib',
    titleAr: 'طرَب — لعبة لوحية موسيقية',
    shortDescAr: 'تعلّم المقامات وأنت تلعب مع الأصدقاء.',
    category: 'games',
    categoryAr: 'ألعاب',
    cityAr: 'بيروت، لبنان',
    creator: 'استوديو طرَب',
    raisedHalalas: sar(95_000),
    goalHalalas: sar(220_000),
    releaseThresholdPct: 80,
    backersCount: 318,
    daysLeft: 16,
    status: 'LIVE',
    imageAccent: '#60a5fa',
  },
  {
    id: 'kaynun',
    titleAr: 'كَيْنون — مدوّنة الذكاء الاصطناعي العربية',
    shortDescAr: 'مدوّنة أسبوعية مصورة عن الذكاء الاصطناعي.',
    category: 'publishing',
    categoryAr: 'نشر',
    cityAr: 'الرياض، السعودية',
    creator: 'كَيْنون',
    raisedHalalas: sar(58_000),
    goalHalalas: sar(120_000),
    releaseThresholdPct: 80,
    backersCount: 241,
    daysLeft: 23,
    status: 'LIVE',
    imageAccent: '#f59e0b',
  },
  {
    id: 'safiyya',
    titleAr: 'صفية — فستان مستدام',
    shortDescAr: 'أزياء مستوحاة من البيئة بصياغة معاصرة.',
    category: 'fashion',
    categoryAr: 'أزياء',
    cityAr: 'تونس',
    creator: 'صفية ديزاين',
    raisedHalalas: sar(140_000),
    goalHalalas: sar(180_000),
    releaseThresholdPct: 80,
    backersCount: 521,
    daysLeft: 4,
    status: 'LIVE',
    imageAccent: '#10b981',
  },
];

export const rewardTiersFor = (projectId: string): RewardTierItem[] => {
  // Same tiers shape for all mock projects.
  return [
    {
      id: `${projectId}-tier-1`,
      titleAr: 'الداعم الأول',
      amountHalalas: sar(75),
      descAr: 'شكر شخصي من المبدع + تحديثات داخلية حصرية طوال فترة التطوير.',
      estDelivery: 'أبريل ٢٠٢٦',
      backers: 412,
      claimedQty: 412,
      items: ['شارة "داعم مبكر" على ملفك', 'وصول حصري للتحديثات', 'دعوة لمجموعة الواتساب الخاصة'],
      includesPhysicalProduct: false,
    },
    {
      id: `${projectId}-tier-2`,
      titleAr: 'الإصدار المبكر',
      amountHalalas: sar(750),
      descAr: 'احصل على المنتج بسعر مخفّض ٢٥٪، وكُن من أوائل من يجرّبه.',
      estDelivery: 'يونيو ٢٠٢٦',
      backers: 1840,
      claimedQty: 1840,
      limitQty: 2500,
      popular: true,
      items: ['وحدة من المنتج النهائي', 'شحن مجاني داخل الخليج', 'كل مزايا الرتب السابقة'],
      includesPhysicalProduct: true,
    },
    {
      id: `${projectId}-tier-3`,
      titleAr: 'حزمة الاستوديو',
      amountHalalas: sar(2_400),
      descAr: 'حزمة احترافية كاملة + ملحقات حصرية للمحترفين والمصورين.',
      estDelivery: 'يوليو ٢٠٢٦',
      backers: 312,
      claimedQty: 312,
      limitQty: 500,
      items: ['وحدتان من المنتج + الملحقات', 'تجربة استوديو حصرية', 'دعم فني مباشر لمدة عام'],
      includesPhysicalProduct: true,
    },
    {
      id: `${projectId}-tier-4`,
      titleAr: 'الراعي الذهبي',
      amountHalalas: sar(7_500),
      descAr: 'كن جزءاً من رحلة المشروع — اسمك على المنتج وعشاء حصري مع الفريق.',
      estDelivery: 'أغسطس ٢٠٢٦',
      backers: 38,
      claimedQty: 38,
      limitQty: 50,
      items: ['كل ما سبق', 'اسمك مطبوع على الوحدة', 'عشاء حصري مع الفريق المؤسس'],
      includesPhysicalProduct: true,
    },
  ];
};

export const budgetSplit = [
  { label: 'تطوير المنتج', pct: 42, color: '#05c074' },
  { label: 'التصنيع', pct: 28, color: '#03a98e' },
  { label: 'التسويق والشحن', pct: 18, color: '#fbbf24' },
  { label: 'الإدارة والقانوني', pct: 12, color: '#6d4df0' },
];

export const transparencyTimeline = [
  { label: 'دفعة المصنّع — الجولة الأولى', date: '٢٠٢٦/٠٥/٠٤', amount: '٤٦٠,٠٠٠ ر.س' },
  { label: 'مكوّنات إلكترونية مستوردة', date: '٢٠٢٦/٠٥/١٢', amount: '١٨٠,٠٠٠ ر.س' },
  { label: 'حملة تسويقية رقمية', date: '٢٠٢٦/٠٥/٢٠', amount: '٧٠,٠٠٠ ر.س' },
  { label: 'استشارة قانونية', date: '٢٠٢٦/٠٥/٢٥', amount: '٢٢,٠٠٠ ر.س' },
  { label: 'تطوير برمجي للتطبيق المرافق', date: '٢٠٢٦/٠٦/٠١', amount: '١١٠,٠٠٠ ر.س' },
];

export const projectUpdates = [
  {
    n: 4,
    tag: 'تصنيع',
    date: '٢٠٢٦/٠٦/١٢',
    title: 'الدفعة الأولى وصلت من المصنع',
    body: 'تمّ تسليم الدفعة الأولى من ٥٠٠ وحدة من سِرب. سنبدأ بإرسالها للداعمين في رتبة الإصدار المبكر خلال أسبوعين.',
  },
  {
    n: 3,
    tag: 'تحديث الفريق',
    date: '٢٠٢٦/٠٦/٠٤',
    title: 'انضمام مهندس بصريات جديد',
    body: 'سعدنا بانضمام المهندس سعيد إلى فريق سِرب لتطوير وحدة الكاميرا بدقة 8K. خبرته ستنقلنا للأمام.',
  },
  {
    n: 2,
    tag: 'الميزانية',
    date: '٢٠٢٦/٠٥/٢٢',
    title: 'تفاصيل الإنفاق هذا الشهر',
    body: 'صرفنا ٧١٠ آلاف ريال هذا الشهر بين تصنيع، مكونات، وتسويق. كل التفاصيل في لوحة الشفافية.',
  },
  {
    n: 1,
    tag: 'الإطلاق',
    date: '٢٠٢٦/٠٤/٠١',
    title: 'انطلقنا!',
    body: 'حصلنا على ٥٠٠,٠٠٠ ر.س في ٢٤ ساعة الأولى. شكراً لكل من آمن بنا.',
  },
];

export const projectComments = [
  {
    initial: 'أ',
    name: 'أحمد القاسم',
    rank: 'سفير',
    rankColor: '#b9820a',
    time: 'قبل ساعة',
    body: 'أحببت فكرة المنتج، خصوصاً أنه صُنع في المنطقة. هل ستتوفر نسخة بكاميرا حرارية لاحقاً؟',
    likes: 12,
    reply:
      'شكراً أحمد! النسخة الحرارية ستكون ضمن خطّتنا للعام القادم — احرص على متابعة التحديثات.',
  },
  {
    initial: 'س',
    name: 'سارة العامري',
    rank: 'مناصِر',
    rankColor: '#05a661',
    time: 'قبل ٣ ساعات',
    body: 'لوحة الشفافية شيء جداً مميز — أتمنى لو كل المنصات تتبنّى هذه الفكرة.',
    likes: 24,
  },
  {
    initial: 'ف',
    name: 'فهد المرّي',
    rank: 'داعم',
    rankColor: '#2563eb',
    time: 'أمس',
    body: 'متى تتوقعون أن يصل المنتج للسعودية؟ شكراً لكم.',
    likes: 5,
    reply: 'فهد، الشحن يبدأ من يوليو ٢٠٢٦ بإذن الله.',
  },
];

export const projectFaqs = [
  {
    q: 'متى سأستلم مكافأتي؟',
    a: 'بعد إغلاق الحملة بـ٢-٤ أشهر — كل رتبة مكافأة تحمل موعد التسليم المتوقع.',
  },
  {
    q: 'ماذا يحدث إن لم يصل المشروع لهدفه؟',
    a: 'يُعاد كامل المبلغ المحجوز إلى بطاقتك تلقائياً، ولن يتمّ خصم أي جزء منه.',
  },
  {
    q: 'كيف أعرف كيف صُرفت أموالي؟',
    a: 'لوحة الشفافية الحيّة في صفحة المشروع تُحدَّث مع كل مرحلة، وتعرض توزيع الميزانية والإنفاق التفصيلي.',
  },
  {
    q: 'هل يمكنني إلغاء دعمي؟',
    a: 'نعم، يمكنك إلغاء دعمك أي وقت قبل إغلاق الحملة من «دعومي» في ملفك الشخصي.',
  },
];

export const liveTicker = [
  '🟢 أحمد دعم «سِرب» بـ ٢٤٠ ر.س',
  '🚀 «حكايا» وصل ١٠٠٪ من هدفه',
  '🟢 سارة أصبحت سفيرة الآن',
  '✨ مشروع جديد: «بستان» في التصميم',
  '🟢 خالد دعم «صدى» بـ ٨٥ ر.س',
];

export const ranks: Array<{
  id: ReputationTier;
  ar: string;
  en: string;
  icon: string;
  color: string;
  bg: string;
  req: string;
  perks: string[];
}> = [
  {
    id: 'newcomer',
    ar: 'وافد جديد',
    en: 'NEWCOMER',
    icon: 'person',
    color: '#67736a',
    bg: '#67736a22',
    req: 'انضممت اليوم',
    perks: ['وصول كامل للمشاريع', 'إشعارات للتحديثات', 'إمكانية الدعم'],
  },
  {
    id: 'supporter',
    ar: 'داعم',
    en: 'SUPPORTER',
    icon: 'thumb-up',
    color: '#2563eb',
    bg: '#2563eb22',
    req: 'دعمت مشروعاً واحداً',
    perks: ['شارة داعم', 'تخفيضات حصرية على المنتجات', 'دعوات حصرية'],
  },
  {
    id: 'advocate',
    ar: 'مناصِر',
    en: 'ADVOCATE',
    icon: 'verified',
    color: '#05a661',
    bg: '#05a66122',
    req: 'دعمت ٥ مشاريع',
    perks: ['وصول مبكر للمشاريع الجديدة', 'لقاءات حصرية عبر زووم', 'تأثير على ترتيب المشاريع'],
  },
  {
    id: 'ambassador',
    ar: 'سفير',
    en: 'AMBASSADOR',
    icon: 'workspace-premium',
    color: '#b9820a',
    bg: '#b9820a22',
    req: 'دعمت ١٠ مشاريع + ٣٠٠٠ ر.س',
    perks: ['شارة ذهبية مميزة', 'حضور مجاني لفعاليات وثبة', 'منتجات حصرية موقّعة'],
  },
  {
    id: 'founder',
    ar: 'شريك مؤسس',
    en: 'FOUNDER',
    icon: 'star',
    color: '#6d4df0',
    bg: '#6d4df022',
    req: 'دعمت ٢٥ مشروعاً + ١٠,٠٠٠ ر.س',
    perks: ['ملحقة بكل أحداث وثبة', 'لوحة شرف مدى الحياة', 'حصة في القرارات الكبرى'],
  },
];

export const howSteps = [
  {
    n: '01',
    icon: 'lightbulb',
    titleAr: 'اعرض فكرتك',
    descAr: 'حدّد هدفك، صمّم رتب المكافآت، وأضف وسائل تروّج فكرتك.',
  },
  {
    n: '02',
    icon: 'group',
    titleAr: 'اجمع المجتمع',
    descAr: 'ادعم المشاريع التي تؤمن بها، وشارك مشروعك مع داعميك المحتملين.',
  },
  {
    n: '03',
    icon: 'rocket-launch',
    titleAr: 'حقّق المشروع',
    descAr: 'استلم تمويلك على دفعات حسب الإنجاز، وحافظ على شفافية كاملة مع داعميك.',
  },
];
