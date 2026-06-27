/**
 * Mock data mirroring API shapes. Same fields as @wathba/types so screens
 * built today work unchanged once real fetches replace these.
 */

import type { Halalas, ProjectCategory, ReputationTier } from '@wathba/types';

export interface ProjectCard {
  id: string;
  titleAr: string;
  shortDescAr: string;
  category: ProjectCategory;
  categoryAr: string;
  cityAr: string;
  creator: string;
  raisedHalalas: Halalas;
  goalHalalas: Halalas;
  releaseThresholdPct: number;
  backersCount: number;
  daysLeft: number;
  popular?: boolean;
  platformPartner?: { stakeType: string; disclosureAr: string } | null;
  status: 'LIVE' | 'SUCCESSFUL' | 'FUNDED';
}

const sar = (s: number) => s * 100;

export const categories: Array<{
  id: ProjectCategory; ar: string; en: string; icon: string; count: string;
}> = [
  { id: 'TECH',       ar: 'تقنية',     en: 'TECH',       icon: 'cpu',         count: '٢١٤' },
  { id: 'DESIGN',     ar: 'تصميم',     en: 'DESIGN',     icon: 'palette',     count: '١٤٨' },
  { id: 'FILM',       ar: 'سينما',     en: 'FILM',       icon: 'film',        count: '٧٢'  },
  { id: 'MUSIC',      ar: 'موسيقى',    en: 'MUSIC',      icon: 'music',       count: '٩١'  },
  { id: 'FOOD',       ar: 'طعام',      en: 'FOOD',       icon: 'utensils',    count: '٦٥'  },
  { id: 'GAMES',      ar: 'ألعاب',     en: 'GAMES',      icon: 'gamepad2',    count: '٣٨'  },
  { id: 'PUBLISHING', ar: 'نشر',       en: 'PUBLISHING', icon: 'book-open',   count: '٥٤'  },
  { id: 'FASHION',    ar: 'أزياء',     en: 'FASHION',    icon: 'shirt',       count: '٤٢'  },
];

export const featuredProject: ProjectCard = {
  id: 'sirb',
  titleAr: 'سِرب — درون التصوير الذكي',
  shortDescAr: 'كاميرا طائرة تتبعك تلقائياً وتصوّر بدقة 8K. صُممت بالكامل في المنطقة.',
  category: 'TECH',
  categoryAr: 'تقنية',
  cityAr: 'الرياض، السعودية',
  creator: 'فريق سِرب',
  raisedHalalas: sar(2_566_750),
  goalHalalas: sar(1_500_000),
  releaseThresholdPct: 80,
  backersCount: 3247,
  daysLeft: 12,
  status: 'LIVE',
};

export const trendingProjects: ProjectCard[] = [
  featuredProject,
  {
    id: 'hekaya',
    titleAr: 'حكايا — منصة قصص الأطفال العربية',
    shortDescAr: 'محتوى تعليمي عربي أصيل لأطفالنا.',
    category: 'PUBLISHING', categoryAr: 'نشر', cityAr: 'جدة، السعودية',
    creator: 'استوديو حكايا',
    raisedHalalas: sar(875_500), goalHalalas: sar(800_000),
    releaseThresholdPct: 80, backersCount: 1843, daysLeft: 5,
    popular: true, status: 'LIVE',
  },
  {
    id: 'sada',
    titleAr: 'صدى — سمّاعة لاسلكية بصوت عربي',
    shortDescAr: 'سمّاعات صُمّمت بحس عربي وبجودة استوديو.',
    category: 'TECH', categoryAr: 'تقنية', cityAr: 'دبي، الإمارات',
    creator: 'فريق صدى',
    raisedHalalas: sar(430_000), goalHalalas: sar(600_000),
    releaseThresholdPct: 80, backersCount: 1124, daysLeft: 21,
    status: 'LIVE',
  },
  {
    id: 'bustan',
    titleAr: 'بستان — حدائق مدنية صغيرة',
    shortDescAr: 'حدائق على الأسطح للأحياء العربية.',
    category: 'SOCIAL', categoryAr: 'اجتماعي', cityAr: 'القاهرة، مصر',
    creator: 'بستان الحي',
    raisedHalalas: sar(120_000), goalHalalas: sar(400_000),
    releaseThresholdPct: 80, backersCount: 412, daysLeft: 28,
    status: 'LIVE',
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
    category: 'DESIGN', categoryAr: 'تصميم', cityAr: 'مراكش، المغرب',
    creator: 'نور كرافت',
    raisedHalalas: sar(225_000), goalHalalas: sar(250_000),
    releaseThresholdPct: 80, backersCount: 763, daysLeft: 9,
    status: 'LIVE',
  },
  {
    id: 'tarib',
    titleAr: 'طرَب — لعبة لوحية موسيقية',
    shortDescAr: 'تعلّم المقامات وأنت تلعب مع الأصدقاء.',
    category: 'GAMES', categoryAr: 'ألعاب', cityAr: 'بيروت، لبنان',
    creator: 'استوديو طرَب',
    raisedHalalas: sar(95_000), goalHalalas: sar(220_000),
    releaseThresholdPct: 80, backersCount: 318, daysLeft: 16,
    status: 'LIVE',
  },
  {
    id: 'kaynun',
    titleAr: 'كَيْنون — مدوّنة الذكاء الاصطناعي العربية',
    shortDescAr: 'مدوّنة أسبوعية مصورة عن الذكاء الاصطناعي.',
    category: 'PUBLISHING', categoryAr: 'نشر', cityAr: 'الرياض، السعودية',
    creator: 'كَيْنون',
    raisedHalalas: sar(58_000), goalHalalas: sar(120_000),
    releaseThresholdPct: 80, backersCount: 241, daysLeft: 23,
    status: 'LIVE',
  },
  {
    id: 'safiyya',
    titleAr: 'صفية — فستان مستدام',
    shortDescAr: 'أزياء مستوحاة من البيئة بصياغة معاصرة.',
    category: 'FASHION', categoryAr: 'أزياء', cityAr: 'تونس',
    creator: 'صفية ديزاين',
    raisedHalalas: sar(140_000), goalHalalas: sar(180_000),
    releaseThresholdPct: 80, backersCount: 521, daysLeft: 4,
    status: 'LIVE',
  },
];

export const liveTicker = [
  '🟢 أحمد دعم «سِرب» بـ ٢٤٠ ر.س',
  '🚀 «حكايا» وصل ١٠٠٪ من هدفه',
  '🟢 سارة أصبحت سفيرة الآن',
  '✨ مشروع جديد: «بستان» في التصميم',
  '🟢 خالد دعم «صدى» بـ ٨٥ ر.س',
];

export const budgetSplit = [
  { label: 'تطوير المنتج',          pct: 42, color: '#05c074' },
  { label: 'التصنيع',               pct: 28, color: '#03a98e' },
  { label: 'التسويق والشحن',         pct: 18, color: '#fbbf24' },
  { label: 'الإدارة والقانوني',      pct: 12, color: '#6d4df0' },
];

export const ranks: Array<{
  id: ReputationTier; ar: string; en: string; icon: string; color: string; bg: string; req: string;
  perks: string[];
}> = [
  { id: 'NEWCOMER',  ar: 'وافد جديد',   en: 'NEWCOMER',   icon: 'user',                color: '#67736a', bg: '#67736a22', req: 'انضممت اليوم',                perks: ['وصول كامل للمشاريع','إشعارات للتحديثات','إمكانية الدعم'] },
  { id: 'SUPPORTER', ar: 'داعم',        en: 'SUPPORTER',  icon: 'thumbs-up',           color: '#2563eb', bg: '#2563eb22', req: 'دعمت مشروعاً واحداً',         perks: ['شارة داعم','تخفيضات حصرية','دعوات حصرية'] },
  { id: 'ADVOCATE',  ar: 'مناصِر',      en: 'ADVOCATE',   icon: 'badge-check',         color: '#05a661', bg: '#05a66122', req: 'دعمت ٥ مشاريع',              perks: ['وصول مبكر للمشاريع','لقاءات حصرية','تأثير على الترتيب'] },
  { id: 'AMBASSADOR',ar: 'سفير',        en: 'AMBASSADOR', icon: 'award',               color: '#b9820a', bg: '#b9820a22', req: 'دعمت ١٠ مشاريع + ٣٠٠٠ ر.س',  perks: ['شارة ذهبية مميزة','حضور مجاني للفعاليات','منتجات حصرية موقّعة'] },
  { id: 'FOUNDER',   ar: 'شريك مؤسس',   en: 'FOUNDER',    icon: 'crown',               color: '#6d4df0', bg: '#6d4df022', req: 'دعمت ٢٥ مشروعاً + ١٠,٠٠٠ ر.س', perks: ['ملحقة بكل أحداث وثبة','لوحة شرف مدى الحياة','حصة في القرارات الكبرى'] },
];

export const howSteps = [
  { n: '01', icon: 'lightbulb',     titleAr: 'اعرض فكرتك',  descAr: 'حدّد هدفك، صمّم رتب المكافآت، وأضف وسائل تروّج فكرتك.' },
  { n: '02', icon: 'users',         titleAr: 'اجمع المجتمع', descAr: 'ادعم المشاريع التي تؤمن بها، وشارك مشروعك مع داعميك المحتملين.' },
  { n: '03', icon: 'rocket',        titleAr: 'حقّق المشروع', descAr: 'استلم تمويلك على دفعات حسب الإنجاز، وحافظ على شفافية كاملة.' },
];
