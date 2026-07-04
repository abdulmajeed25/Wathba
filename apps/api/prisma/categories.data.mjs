// Batch CAT — the canonical Wathba category tree (Arabic-first).
//
// 21 top-level categories = 14 Kickstarter clones (the original 15 minus Music,
// removed per the CAT amendment) + 7 Saudi / Vision-2030 extensions. Top-level
// slugs are explicit (spec-authoritative); subcategory slugs are kebab(en),
// unique within their parent. Music and its subcategories are intentionally
// absent everywhere. "Music Videos" (under Film & Video), "Radio & Podcasts"
// (Publishing) and "Sound" (Technology) are separate nodes of other parents and
// are kept.
//
// Shared by prisma/seed-categories.mjs (full seed + backfill) and
// prisma/seed-e2e.mjs (so Playwright's mega-menu is populated).

/** kebab-case an English label → a URL slug (unique within a parent). */
export function kebab(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Legacy ProjectCategory enum → new top-level slug (backfill of Project.categoryId). */
export const LEGACY_TOPLEVEL_MAP = {
  TECH: 'technology',
  DESIGN: 'design',
  FILM: 'film-video',
  FOOD: 'food',
  GAMES: 'games',
  PUBLISHING: 'publishing',
  FASHION: 'fashion',
  ART: 'art',
  SOCIAL: 'social-impact',
  // MUSIC is handled specially (category removed) → film-video / music-videos.
};

const c = (en, ar) => ({ en, ar });

/** The full tree. Order === nav sortOrder (1-based, no gaps). */
export const TREE = [
  // ─── Kickstarter clones (14, Music removed) ───────────────────────────────
  {
    slug: 'art', nameEn: 'Art', nameAr: 'الفنون',
    children: [
      c('Ceramics', 'الخزف'), c('Conceptual Art', 'الفن المفاهيمي'),
      c('Digital Art', 'الفن الرقمي'), c('Illustration', 'الرسم التوضيحي'),
      c('Installations', 'الأعمال التركيبية'), c('Mixed Media', 'الوسائط المختلطة'),
      c('Painting', 'الرسم'), c('Performance Art', 'فن الأداء'),
      c('Public Art', 'الفن العام'), c('Sculpture', 'النحت'),
      c('Social Practice', 'الفن المجتمعي'), c('Textiles', 'المنسوجات'),
      c('Video Art', 'فن الفيديو'),
    ],
  },
  {
    slug: 'comics', nameEn: 'Comics', nameAr: 'القصص المصورة',
    children: [
      c('Anthologies', 'المختارات'), c('Comic Books', 'كتب الكوميكس'),
      c('Events', 'الفعاليات'), c('Graphic Novels', 'الروايات المصورة'),
      c('Webcomics', 'الكوميكس الرقمية'),
    ],
  },
  {
    slug: 'crafts', nameEn: 'Crafts', nameAr: 'الحِرف',
    children: [
      c('Candles', 'الشموع'), c('Crochet', 'الكروشيه'), c('DIY', 'اصنعها بنفسك'),
      c('Embroidery', 'التطريز'), c('Glass', 'الزجاج'), c('Knitting', 'الحياكة'),
      c('Letterpress', 'الطباعة اليدوية'), c('Pottery', 'الفخار'),
      c('Printing', 'الطباعة'), c('Quilts', 'اللُحف'), c('Stationery', 'القرطاسية'),
      c('Taxidermy', 'التحنيط'), c('Weaving', 'النسيج'), c('Woodworking', 'الأعمال الخشبية'),
    ],
  },
  {
    slug: 'dance', nameEn: 'Dance', nameAr: 'الفنون الحركية',
    children: [
      c('Performances', 'العروض'), c('Spaces', 'المساحات'), c('Workshops', 'ورش العمل'),
    ],
  },
  {
    slug: 'design', nameEn: 'Design', nameAr: 'التصميم',
    children: [
      c('Architecture', 'العمارة'), c('Civic Design', 'التصميم المدني'),
      c('Graphic Design', 'التصميم الجرافيكي'), c('Interactive Design', 'التصميم التفاعلي'),
      c('Product Design', 'تصميم المنتجات'), c('Toys', 'الألعاب/الدمى'),
      c('Typography', 'فن الخطوط'),
    ],
  },
  {
    slug: 'fashion', nameEn: 'Fashion', nameAr: 'الأزياء',
    children: [
      c('Accessories', 'الإكسسوارات'), c('Apparel', 'الملابس'),
      c('Childrenswear', 'ملابس الأطفال'), c('Couture', 'الأزياء الراقية'),
      c('Footwear', 'الأحذية'), c('Jewelry', 'المجوهرات'),
      c('Pet Fashion', 'أزياء الحيوانات الأليفة'), c('Ready-to-wear', 'الملابس الجاهزة'),
    ],
  },
  {
    slug: 'film-video', nameEn: 'Film & Video', nameAr: 'الأفلام والفيديو',
    children: [
      c('Action', 'أكشن'), c('Animation', 'الرسوم المتحركة'), c('Comedy', 'كوميديا'),
      c('Documentary', 'وثائقي'), c('Drama', 'دراما'), c('Experimental', 'تجريبي'),
      c('Family', 'عائلي'), c('Fantasy', 'فانتازيا'), c('Festivals', 'المهرجانات'),
      c('Horror', 'رعب'), c('Movie Theaters', 'دور السينما'),
      c('Music Videos', 'الفيديوهات الموسيقية'), c('Narrative Film', 'الأفلام الروائية'),
      c('Romance', 'رومانسي'), c('Science Fiction', 'الخيال العلمي'),
      c('Shorts', 'الأفلام القصيرة'), c('Television', 'التلفزيون'),
      c('Thrillers', 'الإثارة'), c('Webseries', 'المسلسلات الرقمية'),
    ],
  },
  {
    slug: 'food', nameEn: 'Food', nameAr: 'الغذاء',
    children: [
      c('Community Gardens', 'الحدائق المجتمعية'), c('Cookbooks', 'كتب الطبخ'),
      c('Drinks', 'المشروبات'), c('Events', 'الفعاليات'),
      c("Farmer's Markets", 'أسواق المزارعين'), c('Farms', 'المزارع'),
      c('Food Trucks', 'عربات الطعام'), c('Restaurants', 'المطاعم'),
      c('Small Batch', 'الإنتاج المحدود'), c('Spaces', 'المساحات'), c('Vegan', 'نباتي'),
    ],
  },
  {
    slug: 'games', nameEn: 'Games', nameAr: 'الألعاب',
    children: [
      c('Gaming Hardware', 'أجهزة الألعاب'), c('Live Games', 'الألعاب الحية'),
      c('Mobile Games', 'ألعاب الجوال'), c('Playing Cards', 'أوراق اللعب'),
      c('Puzzles', 'الألغاز'), c('STL', 'نماذج STL'), c('Tabletop Games', 'ألعاب الطاولة'),
      c('TTRPG', 'ألعاب تقمص الأدوار الطاولية'), c('Video Games', 'ألعاب الفيديو'),
    ],
  },
  {
    slug: 'journalism', nameEn: 'Journalism', nameAr: 'الصحافة',
    children: [
      c('Audio', 'صوتي'), c('Photo', 'مصور'), c('Print', 'مطبوع'),
      c('Video', 'مرئي'), c('Web', 'رقمي'),
    ],
  },
  {
    slug: 'photography', nameEn: 'Photography', nameAr: 'التصوير',
    children: [
      c('Animals', 'الحيوانات'), c('Fine Art', 'الفن التشكيلي'), c('Nature', 'الطبيعة'),
      c('People', 'الأشخاص'), c('Photobooks', 'كتب التصوير'), c('Places', 'الأماكن'),
    ],
  },
  {
    slug: 'publishing', nameEn: 'Publishing', nameAr: 'النشر',
    children: [
      c('Academic', 'أكاديمي'), c('Anthologies', 'المختارات'), c('Art Books', 'كتب الفنون'),
      c('Audiobooks', 'الكتب الصوتية'), c('Calendars', 'التقاويم'),
      c("Children's Books", 'كتب الأطفال'), c('Comedy', 'كوميدي'), c('Fiction', 'الروايات'),
      c('Letterpress', 'الطباعة اليدوية'), c('Literary Journals', 'المجلات الأدبية'),
      c('Literary Spaces', 'المساحات الأدبية'), c('Nonfiction', 'غير الروائي'),
      c('Periodicals', 'الدوريات'), c('Poetry', 'الشعر'),
      c('Radio & Podcasts', 'الإذاعة والبودكاست'), c('Translations', 'الترجمات'),
      c('Young Adult', 'اليافعين'), c('Zines', 'المجلات المستقلة'),
    ],
  },
  {
    slug: 'technology', nameEn: 'Technology', nameAr: 'التقنية',
    children: [
      c('3D Printing', 'الطباعة ثلاثية الأبعاد'), c('Apps', 'التطبيقات'),
      c('Camera Equipment', 'معدات التصوير'), c('DIY Electronics', 'الإلكترونيات الذاتية'),
      c('Fabrication Tools', 'أدوات التصنيع'), c('Flight', 'الطيران'),
      c('Gadgets', 'الأجهزة الذكية'), c('Hardware', 'العتاد'),
      c('Makerspaces', 'مساحات الصنّاع'), c('Robots', 'الروبوتات'),
      c('Software', 'البرمجيات'), c('Sound', 'الصوتيات'),
      c('Space Exploration', 'استكشاف الفضاء'), c('Wearables', 'الأجهزة القابلة للارتداء'),
      c('Web', 'الويب'),
    ],
  },
  {
    slug: 'theater', nameEn: 'Theater', nameAr: 'المسرح',
    children: [
      c('Comedy', 'كوميدي'), c('Experimental', 'تجريبي'), c('Festivals', 'المهرجانات'),
      c('Immersive', 'الغامر'), c('Musical', 'الاستعراضي'), c('Plays', 'المسرحيات'),
    ],
  },
  // ─── Saudi / Vision-2030 extensions (7) ───────────────────────────────────
  {
    slug: 'heritage-culture', nameEn: 'Heritage & Culture', nameAr: 'التراث والثقافة',
    children: [
      c('Traditional Crafts', 'الحِرف التراثية — السدو والخوص والفخار'),
      c('Arabic Calligraphy & Islamic Arts', 'الخط العربي والفنون الإسلامية'),
      c('Museums & Heritage Sites', 'المتاحف والمواقع التراثية'),
      c('Folklore & Oral History', 'الموروث الشعبي والتاريخ الشفهي'),
      c('Traditional Fashion', 'الأزياء التراثية'),
      c('Heritage Festivals', 'المهرجانات التراثية'),
      c('Arabic Poetry & Nabati', 'الشعر العربي والنبطي'),
    ],
  },
  {
    slug: 'tourism-entertainment', nameEn: 'Tourism & Entertainment', nameAr: 'السياحة والترفيه',
    children: [
      c('Local Tourism Experiences', 'التجارب السياحية المحلية'),
      c('Adventure & Desert Tourism', 'سياحة المغامرات والبر'),
      c('Entertainment Venues & Events', 'الوجهات والفعاليات الترفيهية'),
      c('Seasonal Festivals', 'المواسم والمهرجانات'),
      c('Hospitality Concepts', 'مفاهيم الضيافة'),
      c('Red Sea & Coastal Experiences', 'تجارب البحر الأحمر والسواحل'),
    ],
  },
  {
    slug: 'sports', nameEn: 'Sports', nameAr: 'الرياضة',
    children: [
      c('Football', 'كرة القدم'), c('Motorsports', 'رياضة المحركات'),
      c('Equestrian & Camel Racing', 'الفروسية وسباقات الهجن'), c('Falconry', 'الصقارة'),
      c('Fitness & Wellness', 'اللياقة والصحة'), c('E-sports', 'الرياضات الإلكترونية'),
      c('Traditional Sports', 'الرياضات التراثية'),
      c('Extreme Sports', 'الرياضات القتالية والمغامرة'),
    ],
  },
  {
    slug: 'environment-sustainability', nameEn: 'Environment & Sustainability', nameAr: 'البيئة والاستدامة',
    children: [
      c('Greening & Afforestation', 'التشجير والتخضير — السعودية الخضراء'),
      c('Renewable Energy', 'الطاقة المتجددة'),
      c('Recycling & Circular Economy', 'إعادة التدوير والاقتصاد الدائري'),
      c('Water Conservation', 'ترشيد المياه'),
      c('Wildlife & Marine Conservation', 'حماية الفطريات والبيئة البحرية'),
      c('Sustainable Agriculture Tech', 'تقنيات الزراعة المستدامة'),
    ],
  },
  {
    slug: 'social-impact', nameEn: 'Social Impact & Community', nameAr: 'الأثر الاجتماعي والمجتمع',
    children: [
      c('Volunteering Initiatives', 'المبادرات التطوعية'),
      c('Non-profit Projects', 'المشاريع غير الربحية'),
      c('Education & Literacy', 'التعليم ومحو الأمية'),
      c('Women Empowerment', 'تمكين المرأة'), c('Youth Development', 'تنمية الشباب'),
      c('People with Disabilities', 'أصحاب الهمم'),
      c('Community Development', 'تنمية المجتمعات المحلية'),
    ],
  },
  {
    slug: 'agriculture-food-security', nameEn: 'Agriculture & Food Security', nameAr: 'الزراعة والأمن الغذائي',
    children: [
      c('Local Farming', 'الزراعة المحلية'), c('Dates & Palm Products', 'التمور ومنتجات النخيل'),
      c('Saudi Coffee', 'القهوة السعودية'), c('Honey & Beekeeping', 'العسل وتربية النحل'),
      c('Aquaculture', 'الاستزراع المائي'), c('AgriTech', 'التقنية الزراعية'),
      c('Livestock', 'الثروة الحيوانية'),
    ],
  },
  {
    slug: 'digital-economy', nameEn: 'Emerging & Digital Economy', nameAr: 'الاقتصاد الرقمي والناشئ',
    children: [
      c('Fintech', 'التقنية المالية'), c('E-commerce Concepts', 'مفاهيم التجارة الإلكترونية'),
      c('Smart Cities & Mobility', 'المدن الذكية والتنقل'), c('AI & Data', 'الذكاء الاصطناعي والبيانات'),
      c('Logistics & Delivery', 'اللوجستيات والتوصيل'), c('Creator Economy', 'اقتصاد صنّاع المحتوى'),
    ],
  },
];
