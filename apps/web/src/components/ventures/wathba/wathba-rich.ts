/**
 * Rich seed content for the Kickstarter-style campaign page.
 * Per-project: long-form story blocks, YouTube id, expanded FAQs,
 * updates, 40+ threaded comments, risks section, expanded reward tiers.
 *
 * Keyed by the same project ids used in wathba-data.ts (`p1`–`p8`).
 *
 * IMPORTANT: all text is original Wathba demo content. NOT copied from any
 * reference campaign. The structure mirrors a Kickstarter campaign page;
 * the words and images are ours.
 */

export type StoryBlock =
  | { kind: 'h2'; id: string; text: string }
  | { kind: 'h3'; id: string; text: string }
  | { kind: 'p';  text: string }
  | { kind: 'img'; alt: string; ratio?: 'wide' | 'square' | 'tall'; caption?: string }
  | { kind: 'video'; provider: 'youtube'; videoId: string; caption?: string }
  | { kind: 'embed'; provider: 'youtube'; videoId: string }
  | { kind: 'callout'; title: string; body: string; icon?: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'compare'; before: string; after: string };

export interface RichRewardTier {
  id: string;
  featured?: boolean;
  /** "إصدار محدود" pill */
  limitedBadge?: string;
  priceSar: number;
  title: string;
  description: string;
  /** "ما يتضمنه" list */
  includes: string[];
  /** optional add-ons appended after the includes list */
  addOns?: string[];
  shipsTo: string;
  estDelivery: string;
  backers: number;
  /** total quantity, or null for unlimited */
  limit: number | null;
  /** already claimed (drives "متبقٍ" + sold-out states) */
  claimed: number;
  rank?: string;
}

export interface RichComment {
  id: string;
  authorName: string;
  authorInitial: string;
  authorRank: string;
  rankColor: string;
  bodyAr: string;
  timeAr: string;
  likes: number;
  isCreatorReply?: boolean;
  replies?: RichComment[];
}

export interface RichUpdate {
  n: number;
  title: string;
  body: string;
  date: string;
  tag: string;
}

export interface RichFaq {
  q: string;
  a: string;
}

export interface RichCampaign {
  /** Pongbot-style "Project We Love" badge text or null */
  weLoveBadge: string | null;
  tagline: string;
  /** YouTube embed for the hero (placeholder id — not the reference video) */
  youtubeId: string;
  /** Hero image alt + ratio */
  heroImage: { alt: string };
  /** the long-form story — minimum 10 blocks for a real Kickstarter feel */
  story: StoryBlock[];
  rewards: RichRewardTier[];
  faqs: RichFaq[];
  updates: RichUpdate[];
  comments: RichComment[];
  /** Kickstarter "Risks and challenges" section */
  risksTitle: string;
  risksBody: string;
}

/* ───────────────────────────── per-project rich content ───────────────────── */

const sirbStory: StoryBlock[] = [
  { kind: 'h2', id: 'intro',     text: 'مَن نحن وماذا نصنع' },
  { kind: 'p', text: 'سِرب فريق صغير من 7 مهندسين عرب يعملون منذ سنتين على بناء أول درون عربي متخصص في التصوير الذكي. نحلم بأن يستطيع أي مبدع — مصوّر، صانع محتوى، أو هاوٍ — أن يحصل على لقطات احترافية بدون فريق تصوير كامل.' },
  { kind: 'video', provider: 'youtube', videoId: 'jNQXAC9IVRw', caption: 'فيديو تعريفي بدورة حياة المنتج من أول رسمة إلى الإنتاج (2 دقيقة).' },
  { kind: 'h2', id: 'problem',   text: 'المشكلة' },
  { kind: 'p', text: 'الدرونات الموجودة اليوم إما باهظة الثمن وموجّهة للمحترفين، أو رخيصة بجودة هاوي. لا يوجد خيار في المنتصف يمنحك جودة سينمائية بسعر مقبول، خاصة لمن يصوّرون بانفراد بدون فريق دعم.' },
  { kind: 'compare', before: 'درون احترافي: 15000+ ر.س، يحتاج طيار محترف، لا يتبع تلقائياً', after: 'درون هاوي: 800 ر.س، جودة 4K بصعوبة، لا يثبت الكاميرا' },
  { kind: 'h2', id: 'solution',  text: 'الحل: سِرب' },
  { kind: 'p', text: 'بنينا درون يجمع بين الذكاء الاصطناعي للتتبع التلقائي، تصوير 8K بمستشعر سوني IMX989، وتصميم خفيف يطوى في حقيبة الظهر. مصنوع بالكامل في المنطقة، يدعم اللغة العربية في تطبيقه، ومتوافق مع أنظمة الطيران الخليجية.' },
  { kind: 'img', alt: 'صورة سِرب وهو يحلّق فوق صحراء الربع الخالي', ratio: 'wide', caption: 'اختبارات الطيران في الربع الخالي — رياح 40 كم/س، حرارة 42°C.' },
  { kind: 'h2', id: 'features',  text: 'المواصفات الرئيسية' },
  { kind: 'list', items: [
    'كاميرا سوني IMX989 — تصوير 8K بمعدل 30 إطاراً/ث، 4K بمعدل 60',
    'بطارية تكفي لـ42 دقيقة طيران مستمر (الأفضل في الفئة)',
    'تتبّع ذكي للأشخاص + للأشياء + للسيارات',
    'مقاوم للماء IP54 + درجة حرارة تشغيل تصل لـ50°C',
    'يطوى في 5 ثوانٍ، وزن 490 غم فقط',
    'تطبيق عربي/إنجليزي مع وضع قبلية للمستخدم الجديد',
  ] },
  { kind: 'img', alt: 'منظر شامل لمكوّنات الدرون قبل التجميع', ratio: 'wide' },
  { kind: 'h2', id: 'how',       text: 'كيف يعمل' },
  { kind: 'h3', id: 'how-1',     text: '1. التقاط ذكي' },
  { kind: 'p', text: 'تشغّل التطبيق، توجّه الكاميرا إليك، تضغط «اتبعني». الدرون يتعلّم ملامحك خلال 3 ثوانٍ ويتبعك من 10 زوايا مختلفة قبل أن يختار اللقطة الأفضل تلقائياً.' },
  { kind: 'h3', id: 'how-2',     text: '2. عودة آمنة' },
  { kind: 'p', text: 'لو ضعفت البطارية أو انقطع الاتصال، يعود الدرون لنقطة الإقلاع بمسار آمن. مستشعرات في 6 اتجاهات لتجنّب العقبات.' },
  { kind: 'h3', id: 'how-3',     text: '3. تحرير فوري' },
  { kind: 'p', text: 'بعد كل رحلة تصوير، يقترح التطبيق 3 مقاطع جاهزة للنشر (ريلز/تيك توك) بقصاصات ذكية ومؤثرات صوت.' },
  { kind: 'h2', id: 'box',       text: 'ما يصلك في الصندوق' },
  { kind: 'list', items: [
    '1× درون سِرب',
    '3× بطارية ذكية + شاحن سريع 65W',
    '4× مراوح احتياطية',
    'حقيبة كتف مقاومة للماء',
    'كرت SD سعة 128 غيغا (سرعة V60)',
    'سنة ضمان كاملة + استبدال في حال السقوط (مرة واحدة)',
  ] },
  { kind: 'img', alt: 'لقطة من أعلى لمحتويات الصندوق مرتّبة', ratio: 'square' },
  { kind: 'h2', id: 'timeline',  text: 'الجدول الزمني للإنتاج' },
  { kind: 'p', text: 'الحملة تنتهي بعد 12 يوماً. الإنتاج يبدأ فور بلوغ 80٪ من الهدف. التسليم المتوقع: مارس 2026 للداعمين الأوائل، أبريل 2026 للباقي.' },
  { kind: 'callout', title: 'نموذج الكل أو لا شيء — مع عتبة 80٪',
    body: 'يُموَّل المشروع فقط إذا بلغ 80٪ من هدفه قبل الموعد النهائي. هذا يضمن وجود ميزانية كافية لإكمال الإنتاج. لو لم نبلغ العتبة، يُعاد كامل مبلغك تلقائياً.', icon: 'lightbulb' },
  { kind: 'h2', id: 'about',     text: 'عن الفريق' },
  { kind: 'p', text: 'الفريق يقوده المهندس عبدالعزيز الراشد (خبرة 12 سنة في تصميم الطائرات بدون طيار، عمل سابقاً في شركة DJI الصينية)، إلى جانب رئيسة قسم الذكاء الاصطناعي د. سارة العامري، وفريق هندسي مكوّن من 5 مطوّرين. مقرّنا في الرياض، ومصنعنا الشريك في شنزن.' },
  { kind: 'img', alt: 'صورة جماعية لفريق سِرب', ratio: 'wide', caption: '12 شخصاً، 4 جنسيات، نقطة التقاء واحدة في الرياض.' },
];

const hekayaStory: StoryBlock[] = [
  { kind: 'h2', id: 'intro',     text: 'لماذا لعبة طاولة عربية؟' },
  { kind: 'p', text: 'بعد 3 سنوات من تصميم ألعاب الفيديو، لاحظنا أن أطفالنا يقضون 7 ساعات يومياً أمام الشاشات. حكايا محاولتنا لإعادة الأسرة حول الطاولة بلعبة استراتيجية بنكهة عربية أصيلة.' },
  { kind: 'video', provider: 'youtube', videoId: 'jNQXAC9IVRw' },
  { kind: 'h2', id: 'gameplay',  text: 'طريقة اللعب' },
  { kind: 'p', text: 'لعبة استراتيجية لـ2-6 لاعبين، عمر 10+، تستغرق الجلسة 45-60 دقيقة. كل لاعب يبني قبيلته الخاصة عبر العصور — من الجاهلية إلى العباسي إلى الأموي. تكسب نقاطاً من خلال التجارة، الشعر، الحروب التقليدية، والاكتشافات العلمية.' },
  { kind: 'img', alt: 'لقطة من أعلى للوحة اللعبة كاملة', ratio: 'wide' },
  { kind: 'h2', id: 'components', text: 'مكوّنات اللعبة' },
  { kind: 'list', items: [
    'لوحة لعب فاخرة 70×70 سم بطبقة لمسات ذهبية',
    '240 بطاقة لعب مرسومة يدوياً بأسلوب المنمنمات العربية',
    '6 مجسّمات قبائل (ريزن صلب، مرسومة يدوياً)',
    '4 نرود فضّية مصكوكة',
    'دليل لعب عربي/إنجليزي 120 صفحة',
    'صندوق مغناطيسي فاخر مع رسومات بارزة',
  ] },
  { kind: 'h2', id: 'design',    text: 'الفن والتصميم' },
  { kind: 'p', text: 'تعاوّنا مع الفنّان السعودي محمد العتيبي لرسم البطاقات يدوياً بأسلوب المخطوطات الإسلامية. كل بطاقة استغرقت 4-6 ساعات رسم. الخط الذي صُمّمت به البطاقات هو خط الثلث المعاصر من الخطّاط نسيم بن مصطفى.' },
  { kind: 'img', alt: 'صور لعدد من البطاقات المرسومة يدوياً', ratio: 'wide' },
  { kind: 'h2', id: 'why-now',   text: 'لماذا الآن؟' },
  { kind: 'p', text: 'نشهد نهضة في ألعاب الطاولة بالخليج — ولا توجد لعبة استراتيجية من إنتاج عربي بمعايير عالمية. حكايا أكملت 18 شهراً من البحث والتطوير + 4 نسخ تجريبية مع 320 لاعباً اختباري.' },
  { kind: 'callout', title: 'إصدار محدود — للداعمين فقط',
    body: '200 نسخة فقط من «إصدار المؤسسين» تحمل أرقاماً متسلسلة وتوقيع الفنّان. لن تُعاد طباعتها أبداً.', icon: 'tips_and_updates' },
];

const bustanStory: StoryBlock[] = [
  { kind: 'h2', id: 'intro',     text: 'حقيبة من البحر' },
  { kind: 'p', text: 'بستان مشروع تصميم تونسي يحوّل بلاستيك المحيطات إلى حقائب يومية أنيقة. كل حقيبة تساوي 16 زجاجة بلاستيك أُنقذت من الوصول للبحر.' },
  { kind: 'video', provider: 'youtube', videoId: 'jNQXAC9IVRw', caption: 'مشاهدة عملية التصنيع من تجميع البلاستيك إلى الحقيبة النهائية.' },
  { kind: 'h2', id: 'process',   text: 'كيف نصنعها' },
  { kind: 'list', items: [
    'نجمع البلاستيك مع شريكنا «بحر نظيف» في صفاقس',
    'نغسل ونفرز البلاستيك حسب اللون والكثافة',
    'نطحن البلاستيك ونصهره عند 240°م',
    'نشكّل ألياف نسيج بكثافة قطنية',
    'نخيط الحقيبة يدوياً في ورشتنا (6 حرفيات)',
  ] },
  { kind: 'img', alt: 'مراحل التصنيع من المواد الخام للحقيبة الجاهزة', ratio: 'wide' },
  { kind: 'h2', id: 'designs',   text: 'التصاميم المتاحة' },
  { kind: 'p', text: 'ثلاثة أحجام (يومي/متوسط/سفر) × أربعة ألوان (أزرق بحر/رملي/زيتي/فحمي) = 12 خيار. كل حقيبة تحمل رقم تسلسل ومنطقة جمع البلاستيك المطبوع داخلها.' },
  { kind: 'img', alt: 'تشكيلة الألوان والأحجام كلها معاً', ratio: 'wide' },
  { kind: 'h2', id: 'impact',    text: 'الأثر' },
  { kind: 'list', items: [
    '2000 متر من النسيج = 250,000 زجاجة محذوفة من النفايات',
    'كل حقيبة تساوي 16 زجاجة',
    'نوظّف 6 حرفيات تونسيات بدوام كامل',
    '10٪ من المبيعات تذهب لحملات تنظيف الشواطئ',
  ] },
  { kind: 'callout', title: 'شراكة وثبة',
    body: 'وثبة تستثمر في بستان كشريك مؤسس. حصّتنا في نجاح الشركة، أرباحك من الحقيبة. منفصلتان تماماً.', icon: 'verified' },
];

/* fallback for the smaller projects — short content that still exercises the
 * campaign page structure (TOC + 8 tabs + reward grid). */
function shortStory(titleAr: string): StoryBlock[] {
  return [
    { kind: 'h2', id: 'intro', text: 'فكرة المشروع' },
    { kind: 'p', text: `${titleAr} مشروع نتعاوّن فيه مع مبدعين من المنطقة لتقديم تجربة فريدة. نشاركك هنا التفاصيل الكاملة للرحلة من الفكرة إلى التنفيذ.` },
    { kind: 'video', provider: 'youtube', videoId: 'jNQXAC9IVRw' },
    { kind: 'h2', id: 'features', text: 'المميّزات' },
    { kind: 'list', items: ['جودة عالية في كل تفصيلة', 'تصميم يجمع التقليد بالمعاصرة', 'شفافية كاملة في الإنفاق'] },
    { kind: 'img', alt: 'صورة معبّرة عن المشروع', ratio: 'wide' },
    { kind: 'h2', id: 'timeline', text: 'الجدول الزمني' },
    { kind: 'p', text: 'الحملة تنتهي قريباً. نموذج الكل أو لا شيء مع عتبة 80٪ يطمئنك أن مبلغك مؤمَّن.' },
    { kind: 'h2', id: 'about', text: 'عن الفريق' },
    { kind: 'p', text: 'فريق صغير شغوف يعمل على تحقيق هذه الفكرة. تجد كل التفاصيل عن المؤسسين في صفحة المبدع.' },
  ];
}

/* ─────────────── shared reward-tier builder (gives each project 4 tiers) ── */

function buildRewards(opts: { earlyTitle: string; standardTitle: string; deluxeTitle: string; founderTitle: string; includes: string[]; earlyPrice: number; standardPrice: number; deluxePrice: number; founderPrice: number; shipsFrom: string }): RichRewardTier[] {
  return [
    {
      id: 'tcustom', priceSar: 25, title: 'دعم مبكر بدون مكافأة',
      description: 'تستلم شكراً شخصياً من الفريق + تحديثات حصرية على البريد. لا تنتظر مكافأة مادية.',
      includes: ['شارة داعم رقمية في ملفك', 'تحديثات داخلية حصرية'],
      shipsTo: 'لا يلزم شحن', estDelivery: 'فوري', backers: 412, limit: null, claimed: 0,
      rank: 'مستكشف',
    },
    {
      id: 'tearly', priceSar: opts.earlyPrice, title: opts.earlyTitle,
      description: 'سعر الإطلاق الحصري — 25٪ خصم من سعر التجزئة المتوقع، شحن مجاني داخل الخليج.',
      includes: opts.includes,
      shipsTo: opts.shipsFrom, estDelivery: 'مارس 2026', backers: 1240, limit: 500, claimed: 372,
      rank: 'داعم', featured: true, limitedBadge: 'إصدار محدود — 128 متبقٍ',
    },
    {
      id: 'tstd', priceSar: opts.standardPrice, title: opts.standardTitle,
      description: 'الباقة الموسّعة بإكسسوارات إضافية وضمان مديد لسنتين.',
      includes: [...opts.includes, 'حقيبة حمل مخصّصة', 'ضمان سنتين بدل سنة'],
      addOns: ['شحن دولي مجّاني', 'تسجيل أولوية للتحديثات البرمجية'],
      shipsTo: 'العالم كله', estDelivery: 'مارس 2026', backers: 680, limit: null, claimed: 680,
      rank: 'محسن',
    },
    {
      id: 'tdeluxe', priceSar: opts.deluxePrice, title: opts.deluxeTitle,
      description: 'الباقة الاحترافية — خمس وحدات مع دعم مخصّص للفريق.',
      includes: [`5× ${opts.includes[0] ?? 'المنتج'}`, 'دعم فني مخصص لمدة عام', 'اسمك ضمن «الشركاء» في الصفحة'],
      shipsTo: 'العالم كله', estDelivery: 'أبريل 2026', backers: 94, limit: 100, claimed: 70,
      rank: 'محسن',
    },
    {
      id: 'tfounder', priceSar: opts.founderPrice, title: opts.founderTitle,
      description: 'تجربة كاملة — زيارة للاستوديو + نسخة موقّعة برقم #001 + عشاء مع الفريق المؤسس.',
      includes: ['كل ما سبق', 'جولة في الاستوديو ليوم كامل', 'نسخة موقّعة برقم تسلسلي مميز', 'عشاء خاص مع المؤسسين'],
      shipsTo: 'الرياض / دبي', estDelivery: 'مايو 2026', backers: 6, limit: 10, claimed: 6,
      rank: 'داعم مؤسس', limitedBadge: 'إصدار «داعم مؤسس» — 4 متبقٍ',
    },
  ];
}

/* ──────────────────────── seed comments (40+ per project) ─────────────────── */

const RANK_COLORS = {
  newcomer: 'var(--rank-silver)',
  supporter: 'var(--blue)',
  patron: 'var(--accent-ink)',
  ambassador: 'var(--gold-ink)',
  founder: 'var(--purple-ink)',
};

function buildComments(slug: string): RichComment[] {
  const names = [
    ['أحمد القاسم', 'أ', 'سفير', RANK_COLORS.ambassador],
    ['سارة العامري', 'س', 'محسن', RANK_COLORS.patron],
    ['فهد المرّي', 'ف', 'داعم', RANK_COLORS.supporter],
    ['نورة الزهراني', 'ن', 'محسن', RANK_COLORS.patron],
    ['علي الحربي', 'ع', 'سفير', RANK_COLORS.ambassador],
    ['ليلى منصور', 'ل', 'داعم', RANK_COLORS.supporter],
    ['كريم الحاج', 'ك', 'محسن', RANK_COLORS.patron],
    ['منى العتيبي', 'م', 'داعم مؤسس', RANK_COLORS.founder],
    ['يوسف حدّاد', 'ي', 'مستكشف', RANK_COLORS.newcomer],
    ['رهف ا.', 'ر', 'داعم', RANK_COLORS.supporter],
  ] as const;

  const bodies = [
    'دعمت المشروع من اليوم الأول. لوحة الشفافية أقنعتني تماماً — هذا ما ينقص بقية المنصات.',
    'فكرة رائعة وتنفيذ احترافي. متحمس جداً لاستلام وحدتي! هل ستتوفر ألوان إضافية لاحقاً؟',
    'سؤال عن الشحن لخارج الخليج، هل متاح؟',
    'الفريق رد عليّ خلال ساعة على بريدي. تواصل ممتاز.',
    'متى تتوقعون أن يصل المنتج للسعودية؟ شكراً.',
    'دعمت الباقة المزدوجة. الإكسسوارات الإضافية تستاهل.',
    'إجابة على سؤالكم: حصلت على الوحدة في موعدها بالضبط، تجربة ممتازة.',
    'هل يمكن إضافة عنوان شحن إضافي بعد الدعم؟',
    'صفحة الشفافية لوحدها سبب كافٍ للدعم. أتمنى التوسع.',
    'شراكة وثبة معكم أعطتني ثقة إضافية. شكراً للفريق.',
    'سؤال تقني: ما توافق التطبيق مع iOS 18؟',
    'نموذج العتبة 80٪ أذكى من الكل أو لا شيء التقليدي. تقدير للفكرة.',
    'وصلتني الباقة الذهبية بحال ممتاز. سعيدة بالنتيجة.',
    'هل تخططون لفتح اشتراك سنوي للتحديثات البرمجية؟',
    'الكاميرا جودتها فاقت توقعاتي بكثير. شكراً للفريق.',
    'حابب أعرف إذا في فرصة تجربة المنتج قبل الدعم.',
    'دعمت الإصدار المحدود (المؤسسين). متى ستبدأ الأرقام التسلسلية؟',
    'الفيديو الأخير في التحديث #3 كان جداً مقنع. واصلوا.',
    'تجربة الدعم سلسة جداً، استغرقت أقل من دقيقتين.',
    'سؤال للمسؤول: متى تفتح حملة الإصدار التالي؟',
  ];

  // Deterministic per-(slug,i) pseudo-random in [0,1). Same input → same output
  // on both server and client renders, which kills the hydration mismatch
  // formerly caused by Math.random() here.
  const seed = (s: string): number => {
    let h = 2166136261;
    for (let k = 0; k < s.length; k++) {
      h ^= s.charCodeAt(k);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  };

  const out: RichComment[] = [];
  for (let i = 0; i < 42; i++) {
    const [name, init, rank, rc] = names[i % names.length]!;
    const body = bodies[i % bodies.length]!;
    const days = Math.floor(i / 4) + 1;
    const hours = (i % 4) * 3 + 1;
    const timeAr = i === 0
      ? 'قبل ساعة'
      : days === 1 ? `قبل ${hours} ساعات` : `قبل ${days} أيام`;
    const c: RichComment = {
      id: `${slug}-c${i + 1}`,
      authorName: name,
      authorInitial: init,
      authorRank: rank,
      rankColor: rc,
      bodyAr: body,
      timeAr,
      likes: Math.max(0, 32 - i - Math.floor(seed(`${slug}|like|${i}`) * 8)),
    };
    // ~25% of comments get a creator reply
    if (i % 4 === 0) {
      c.replies = [
        {
          id: `${slug}-c${i + 1}-r1`,
          authorName: 'فريق المشروع',
          authorInitial: 'م',
          authorRank: 'المبدع',
          rankColor: 'var(--accent)',
          bodyAr: 'شكراً جزيلاً لدعمك! سنوافيك بالرد التفصيلي على بريدك خلال 24 ساعة.',
          timeAr: 'قبل 3 ساعات',
          likes: Math.floor(seed(`${slug}|reply|${i}`) * 8) + 2,
          isCreatorReply: true,
        },
      ];
    }
    out.push(c);
  }
  return out;
}

/* ──────────────────────── faqs / updates / risks ─────────────────────────── */

const sharedFaqs: RichFaq[] = [
  { q: 'متى سأستلم مكافأتي؟', a: 'حسب الباقة — البكرات الأولى في مارس 2026، البقية أبريل 2026. كل تفاصيل التسليم في صفحة الدعم.' },
  { q: 'ماذا لو لم يصل المشروع لهدفه؟', a: 'نستخدم نموذج الكل أو لا شيء بعتبة 80٪. إن لم نبلغها، يُعاد كامل المبلغ المحجوز إلى بطاقتك تلقائياً ولن يُخصم منك شيء.' },
  { q: 'هل الشحن الدولي متاح؟', a: 'نعم — نشحن إلى 38 دولة. تُحتسب رسوم الشحن الدولي عند إتمام الدعم.' },
  { q: 'كيف أتأكد من جودة المنتج؟', a: 'أكملنا مرحلة العيّنات الهندسية بنجاح، وكل المراحل موثّقة في لوحة الشفافية وقسم التحديثات.' },
  { q: 'هل يمكن إلغاء الدعم؟', a: 'نعم — مجاناً من صفحة «تعهّداتي» في حسابك، وحتى 48 ساعة قبل موعد إغلاق الحملة. في الساعات الـ48 الأخيرة تُقفل التعهدات فلا إلغاء ولا تخفيض (الزيادة أو تعهد جديد يبقيان متاحين)، وبعد نجاح الحملة لا يمكن الإلغاء.' },
  { q: 'كيف أتواصل مع المبدع؟', a: 'مباشرة عبر زر «تواصل مع المبدع» في تبويب «المبدع»، أو في قسم التعليقات على الصفحة.' },
];

const sharedUpdates: RichUpdate[] = [
  { n: 4, tag: 'إنجاز',       date: 'قبل يومين',   title: 'وصلنا 120٪ من الهدف — شكراً!',
    body: 'تجاوزنا الهدف الإضافي الأول، ما يعني أن كل وحدة ستحصل على بطارية أكبر دون أي تكلفة إضافية عليكم.' },
  { n: 3, tag: 'تطوير',       date: 'قبل 6 أيام',  title: 'العيّنة الهندسية الأولى جاهزة',
    body: 'استلمنا أول نموذج من المصنع وأجرينا اختبارات الجودة الأولية بنجاح. شاهدوا الفيديو الكامل في الصفحة.' },
  { n: 2, tag: 'لوجستيات',    date: 'قبل 11 يوماً', title: 'شراكة مع شركة شحن إقليمية',
    body: 'وقّعنا اتفاقية تضمن وصول الطلبات خلال 5 أيام عمل داخل دول الخليج، و10-14 يوماً دولياً.' },
  { n: 1, tag: 'إطلاق',        date: 'قبل 14 يوماً', title: 'انطلقنا رسمياً على وثبة',
    body: 'أهلاً بكم في رحلة المشروع! نشارككم اليوم كل التفاصيل والمخططات. ابقوا معنا.' },
];

const sharedRisks = {
  title: 'المخاطر والتحديات',
  body: 'كأي مشروع جديد، نواجه تحدّيات. أكبرها (1) تقلّبات أسعار المكوّنات الإلكترونية، (2) سلاسل الإمداد عبر الحدود، (3) جودة الدفعة الأولى من الإنتاج بالحجم. نخفّف هذه المخاطر بـ: تأمين أسعار المكوّنات مسبقاً لـ6 أشهر، استخدام شريك شحن إقليمي مرخّص، وإجراء 3 جولات ضبط جودة قبل الشحن للداعمين. كل التحديثات على هذه النقاط تُنشر في تبويب «التحديثات».',
};

/* ─────────────────────────── final per-project map ────────────────────────── */

export const wathbaRichCampaigns: Record<string, RichCampaign> = {
  p1: {
    weLoveBadge: 'مشروع نحبه',
    tagline: 'كاميرا طائرة تتبعك تلقائياً وتصوّر بدقة 8K — مصمَّمة بالكامل في المنطقة.',
    youtubeId: 'jNQXAC9IVRw',
    heroImage: { alt: 'سِرب يحلّق فوق صحراء الربع الخالي عند الغروب' },
    story: sirbStory,
    rewards: buildRewards({
      earlyTitle: 'الإصدار المبكر — وحدة كاملة',
      standardTitle: 'الباقة الموسّعة',
      deluxeTitle: 'باقة المحترفين',
      founderTitle: 'الداعم المؤسس',
      includes: ['1× درون سِرب', '3× بطارية', '4× مراوح احتياطية', 'حقيبة كتف', 'كرت SD 128 غيغا'],
      earlyPrice: 1850, standardPrice: 2400, deluxePrice: 9500, founderPrice: 24000,
      shipsFrom: 'دول الخليج',
    }),
    faqs: sharedFaqs,
    updates: sharedUpdates,
    comments: buildComments('p1'),
    risksTitle: sharedRisks.title,
    risksBody: sharedRisks.body,
  },
  p2: {
    weLoveBadge: 'مشروع نحبه',
    tagline: 'لعبة طاولة استراتيجية بنكهة عربية أصيلة — تجمع الأسرة لتسع ساعات من المرح.',
    youtubeId: 'jNQXAC9IVRw',
    heroImage: { alt: 'حكايا — اللوحة كاملة محضرة للعب الجلسة الأولى' },
    story: hekayaStory,
    rewards: buildRewards({
      earlyTitle: 'لعبة الإطلاق',
      standardTitle: 'باقة الموسّعة + شخصيات إضافية',
      deluxeTitle: 'إصدار العائلة (2 نسخة)',
      founderTitle: 'إصدار المؤسسين',
      includes: ['1× لعبة حكايا كاملة', 'دليل لعب 120 صفحة', 'صندوق مغناطيسي فاخر'],
      earlyPrice: 340, standardPrice: 480, deluxePrice: 720, founderPrice: 1800,
      shipsFrom: 'العالم',
    }),
    faqs: sharedFaqs,
    updates: sharedUpdates,
    comments: buildComments('p2'),
    risksTitle: sharedRisks.title,
    risksBody: 'تحدياتنا الرئيسية: (1) جودة طباعة البطاقات بالأسلوب الفني المطلوب، (2) دقة المجسّمات الراتنجية، (3) جدول التسليم في موسم الذروة. تأمين الجودة عبر شريك طباعة في ميونخ + اختبار عيّنات يدوية لكل دفعة قبل التغليف.',
  },
  p3: {
    weLoveBadge: null,
    tagline: 'رحلة بصرية مدّتها 90 دقيقة عبر صحاري الجزيرة العربية ومَن يسكنها.',
    youtubeId: 'jNQXAC9IVRw',
    heroImage: { alt: 'لقطة من الفيلم — قافلة في الربع الخالي' },
    story: shortStory('صدى'),
    rewards: buildRewards({
      earlyTitle: 'تذكرة العرض الافتتاحي',
      standardTitle: 'تذكرة + ملصق موقّع',
      deluxeTitle: 'باقة المحبين',
      founderTitle: 'منتج مشارك',
      includes: ['تذكرة العرض الافتتاحي', 'دعوة جلسة Q&A بعد العرض'],
      earlyPrice: 120, standardPrice: 280, deluxePrice: 850, founderPrice: 5000,
      shipsFrom: 'الرياض',
    }),
    faqs: sharedFaqs,
    updates: sharedUpdates,
    comments: buildComments('p3'),
    risksTitle: sharedRisks.title,
    risksBody: sharedRisks.body,
  },
  p4: {
    weLoveBadge: 'بشراكة وثبة',
    tagline: 'حقائب يومية أنيقة من بلاستيك المحيطات — كل حقيبة تساوي 16 زجاجة محذوفة.',
    youtubeId: 'jNQXAC9IVRw',
    heroImage: { alt: 'بستان — تشكيلة الألوان الأربعة معاً' },
    story: bustanStory,
    rewards: buildRewards({
      earlyTitle: 'حقيبة يومية',
      standardTitle: 'حقيبة سفر',
      deluxeTitle: 'الطقم الثلاثي (3 حجوم)',
      founderTitle: 'إصدار محدود — 50 نسخة فقط',
      includes: ['1× حقيبة يومية بلونك المختار', 'حقيبة قماشية صغيرة للعملات', 'بطاقة شكر يدوية'],
      earlyPrice: 220, standardPrice: 380, deluxePrice: 880, founderPrice: 2400,
      shipsFrom: 'تونس → كل العالم',
    }),
    faqs: sharedFaqs,
    updates: sharedUpdates,
    comments: buildComments('p4'),
    risksTitle: sharedRisks.title,
    risksBody: sharedRisks.body,
  },
};

/* Default fallback for projects not in the map yet — keeps the page from
 * crashing for any of the 8 fixture projects. */
export function getRichCampaign(projectId: string, titleAr: string): RichCampaign {
  const found = wathbaRichCampaigns[projectId];
  if (found) return found;
  return {
    weLoveBadge: null,
    tagline: 'تفاصيل المشروع كاملة على الصفحة.',
    youtubeId: 'jNQXAC9IVRw',
    heroImage: { alt: `صورة المشروع — ${titleAr}` },
    story: shortStory(titleAr),
    rewards: buildRewards({
      earlyTitle: 'الإصدار المبكر',
      standardTitle: 'الباقة الموسّعة',
      deluxeTitle: 'باقة المحترفين',
      founderTitle: 'الداعم المؤسس',
      includes: ['1× المنتج الأساسي', 'تحديثات حصرية'],
      earlyPrice: 200, standardPrice: 380, deluxePrice: 980, founderPrice: 3500,
      shipsFrom: 'دول الخليج',
    }),
    faqs: sharedFaqs,
    updates: sharedUpdates,
    comments: buildComments(projectId),
    risksTitle: sharedRisks.title,
    risksBody: sharedRisks.body,
  };
}
