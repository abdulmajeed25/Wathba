// ============================================================================
// Wathba — demo projects that give the rotating hero something real to rotate.
//
//   node --env-file=.env prisma/seed-hero-projects.mjs
//
// The hero draws from four buckets — قوية / متنوعة / قاربت الاكتمال / وصلت حديثاً —
// and refuses to show the same bucket or category twice in a row. The dataset
// could not feed that: after 0059 flagged the e2e leftovers, EIGHT eligible LIVE
// projects remained, one per category. Four buckets over eight projects is not a
// showcase, it is the same four cards on a loop.
//
// So this adds 18 campaigns, spread across 14 categories and all four buckets,
// with funding levels chosen to LAND in a specific bucket:
//
//   قوية              120-165%  staff-picked
//   قاربت الاكتمال     79-91%    (the ≥75% rule, comfortably inside it)
//   متنوعة            31-58%    mid-tier, deliberately ordinary
//   وصلت حديثاً        4-12%     published in the last few days
//
// Titles and creators are realistic Saudi Arabic. NONE carries a fixture token
// or a 10+ digit number, so the 0058/0059 trigger leaves them public — verified
// after the run, not assumed.
//
// Idempotent: keyed on slug, safe to re-run. Deadlines and publishedAt are
// computed relative to NOW at run time, so "وصلت حديثاً" stays recent whenever
// the demo is reseeded rather than aging into the wrong bucket.
// ============================================================================
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DAY = 864e5;
const ago = (d) => new Date(Date.now() - d * DAY);
const hence = (d) => new Date(Date.now() + d * DAY);
/** SAR → halalas. Money is BigInt halalas everywhere in this schema. */
const sar = (n) => BigInt(Math.round(n * 100));

// creatorKey → the person behind the campaign.
const CREATORS = {
  nakhil:  { name: 'مزارع القصيم',      handle: 'nakhil',  city: 'بريدة' },
  mirqab:  { name: 'مِرقاب للبصريات',    handle: 'mirqab',  city: 'تبوك' },
  summar:  { name: 'سُمّار للتراث',       handle: 'summar',  city: 'أبها' },
  wadi:    { name: 'وادي البيئة',        handle: 'wadi',    city: 'الباحة' },
  hirfah:  { name: 'دار حِرفة',          handle: 'hirfah',  city: 'مكة المكرمة' },
  mathaq:  { name: 'مذاق الشرقية',       handle: 'mathaq',  city: 'الدمام' },
  malab:   { name: 'ملعب الحي',          handle: 'malab',   city: 'الرياض' },
  shaghaf: { name: 'فرقة شغف',           handle: 'shaghaf', city: 'جازان' },
  basmah:  { name: 'مبادرة بصمة',        handle: 'basmah',  city: 'المدينة المنورة' },
  rahhala: { name: 'رحّالة',             handle: 'rahhala', city: 'تبوك' },
  khayal:  { name: 'استوديو خيال',       handle: 'khayal',  city: 'الرياض' },
  minbar:  { name: 'منبر الصحفي',        handle: 'minbar',  city: 'الخبر' },
  eeqaa:   { name: 'فرقة إيقاع',         handle: 'eeqaa',   city: 'جدة' },
  souq:    { name: 'سوق الرقمي',         handle: 'souq',    city: 'الرياض' },
  naw:     { name: 'نَوّ للتصوير',        handle: 'naw',     city: 'نجران' },
  qalam:   { name: 'دار قلم',            handle: 'qalam',   city: 'حائل' },
  tayf:    { name: 'طيف للفنون',         handle: 'tayf',    city: 'سكاكا' },
  nagham:  { name: 'نغم للإنتاج',        handle: 'nagham',  city: 'عرعر' },
};

// bucket is documentation here — the API derives buckets from the DATA (funding
// %, staff-pick, publishedAt), never from a stored label. If a project's numbers
// drift, it moves bucket on its own, which is the correct behaviour.
const PROJECTS = [
  // ── قوية — funded past goal, staff-picked ────────────────────────────────
  { slug: 'nakhil-dates', creator: 'nakhil', cat: 'agriculture-food-security', region: 'QASSIM',
    titleAr: 'نخيل — تمور عضوية من المزرعة مباشرة',
    shortDescAr: 'تمور سكري وخلاص من مزارع القصيم، تصل إليك خلال ٤٨ ساعة من القطف دون وسيط.',
    goal: 180000, pct: 165, backers: 1420, staff: true, published: 52, deadline: 11 },
  { slug: 'mirqab-telescope', creator: 'mirqab', cat: 'technology', region: 'TABUK',
    titleAr: 'مِرقاب — تلسكوب صحراوي للهواة',
    shortDescAr: 'تلسكوب خفيف يُنصب في دقيقتين، مصمم لسماء نيوم الصافية ومزوّد بدليل نجوم عربي.',
    goal: 320000, pct: 138, backers: 964, staff: true, published: 41, deadline: 18 },
  { slug: 'summar-folktales', creator: 'summar', cat: 'heritage-culture', region: 'ASIR',
    titleAr: 'سُمّار — أرشيف الحكاية الشعبية المسموعة',
    shortDescAr: 'تسجيل ٢٠٠ حكاية من كبار السن في عسير بأصواتهم، وأرشفتها مجاناً للأجيال القادمة.',
    goal: 90000, pct: 121, backers: 1877, staff: true, published: 63, deadline: 6 },
  { slug: 'wadi-restoration', creator: 'wadi', cat: 'environment-sustainability', region: 'BAHAH',
    titleAr: 'وادي — إعادة الحياة لمدرجات الباحة',
    shortDescAr: 'ترميم المدرجات الزراعية الحجرية وإعادة زراعتها بالبن البلدي مع أهالي القرى.',
    goal: 240000, pct: 112, backers: 803, staff: true, published: 35, deadline: 21 },

  // ── قاربت الاكتمال — 75%+ and still open ─────────────────────────────────
  { slug: 'hirfah-sadu', creator: 'hirfah', cat: 'crafts', region: 'MAKKAH',
    titleAr: 'حِرفة — سجاد السدو بأيدٍ سعودية',
    shortDescAr: 'ورشة تشغّل ١٢ حرفية لنسج السدو على أنوال تقليدية بتصاميم معاصرة.',
    goal: 140000, pct: 88, backers: 612, staff: false, published: 29, deadline: 9 },
  { slug: 'mathaq-kitchen', creator: 'mathaq', cat: 'food', region: 'EASTERN',
    titleAr: 'مذاق — مطبخ الشرقية السحابي',
    shortDescAr: 'مطبخ مشترك يتيح لعشر أسر منتجة طهي وبيع أطباقها بترخيص وتغليف نظامي.',
    goal: 200000, pct: 82, backers: 741, staff: false, published: 24, deadline: 14 },
  { slug: 'malab-court', creator: 'malab', cat: 'sports', region: 'RIYADH',
    titleAr: 'ملعب — ملاعب الأحياء المفتوحة',
    shortDescAr: 'تحويل ثلاث ساحات مهملة في شمال الرياض إلى ملاعب مضاءة مجانية للأطفال.',
    goal: 160000, pct: 79, backers: 1094, staff: false, published: 31, deadline: 12 },
  { slug: 'shaghaf-stage', creator: 'shaghaf', cat: 'theater', region: 'JAZAN',
    titleAr: 'شغف — مسرح جازان المتنقل',
    shortDescAr: 'مسرح قابل للطي يجول ثماني قرى بعروض تُكتب مع أهلها وتُقدَّم بلهجتهم.',
    goal: 110000, pct: 91, backers: 528, staff: false, published: 27, deadline: 5 },

  // ── متنوعة — mid-tier, the ordinary middle of the platform ───────────────
  { slug: 'basmah-braille', creator: 'basmah', cat: 'social-impact', region: 'MADINAH',
    titleAr: 'بصمة — مكتبة برايل للأطفال',
    shortDescAr: 'طباعة ٤٠ قصة عربية مصوّرة ببرايل وتوزيعها على مدارس الدمج مجاناً.',
    goal: 130000, pct: 47, backers: 396, staff: false, published: 19, deadline: 26 },
  { slug: 'rahhala-trails', creator: 'rahhala', cat: 'tourism-entertainment', region: 'TABUK',
    titleAr: 'رحّالة — دليل مسارات المشي في الشمال',
    shortDescAr: 'مسح وتوثيق ٣٠ مساراً جبلياً بخرائط دقيقة ونقاط مياه ومستويات صعوبة.',
    goal: 75000, pct: 38, backers: 284, staff: false, published: 16, deadline: 33 },
  { slug: 'khayal-comics', creator: 'khayal', cat: 'comics', region: 'RIYADH',
    titleAr: 'خيال — سلسلة قصص مصوّرة سعودية',
    shortDescAr: 'ستة أعداد بأبطال من نجد والحجاز، برسم يدوي وحبر تقليدي لا بالذكاء الاصطناعي.',
    goal: 95000, pct: 54, backers: 617, staff: false, published: 22, deadline: 29 },
  { slug: 'minbar-local', creator: 'minbar', cat: 'journalism', region: 'EASTERN',
    titleAr: 'منبر — صحافة محلية للأحياء',
    shortDescAr: 'غرفة أخبار صغيرة تغطي مجالس الأحياء والخدمات البلدية في الخبر والدمام.',
    goal: 120000, pct: 31, backers: 209, staff: false, published: 14, deadline: 37 },
  { slug: 'eeqaa-dance', creator: 'eeqaa', cat: 'dance', region: 'MAKKAH',
    titleAr: 'إيقاع — توثيق الرقصات الشعبية',
    shortDescAr: 'تصوير وتوثيق العرضة والمزمار بحركة بطيئة مع شرح الإيقاع لطلاب الفنون.',
    goal: 85000, pct: 43, backers: 351, staff: false, published: 20, deadline: 24 },
  { slug: 'souq-artisans', creator: 'souq', cat: 'digital-economy', region: 'RIYADH',
    titleAr: 'سوق — متجر رقمي للحرفيين',
    shortDescAr: 'منصة تتيح للحرفي بيع منتجه وشحنه دون عمولة في السنة الأولى.',
    goal: 210000, pct: 58, backers: 884, staff: false, published: 26, deadline: 20 },

  // ── وصلت حديثاً — days old, still finding their first backers ────────────
  { slug: 'naw-desert-light', creator: 'naw', cat: 'photography', region: 'NAJRAN',
    titleAr: 'نَوّ — كتاب ضوء الصحراء',
    shortDescAr: 'كتاب تصوير يرصد ضوء الفجر في الربع الخالي على مدى عام كامل.',
    goal: 70000, pct: 9, backers: 47, staff: false, published: 3, deadline: 44 },
  { slug: 'qalam-poetry', creator: 'qalam', cat: 'publishing', region: 'HAIL',
    titleAr: 'قلم — ديوان شعراء حائل الجدد',
    shortDescAr: 'ديوان يجمع اثني عشر صوتاً شعرياً شاباً من حائل بطباعة فاخرة.',
    goal: 45000, pct: 6, backers: 28, staff: false, published: 2, deadline: 47 },
  { slug: 'tayf-murals', creator: 'tayf', cat: 'art', region: 'JAWF',
    titleAr: 'طيف — جداريات الجوف',
    shortDescAr: 'ست جداريات على أسوار مدارس الجوف يرسمها فنانون محليون مع الطلاب.',
    goal: 65000, pct: 12, backers: 61, staff: false, published: 5, deadline: 41 },
  { slug: 'nagham-shortfilm', creator: 'nagham', cat: 'film-video', region: 'NORTHERN_BORDERS',
    titleAr: 'نغم — فيلم قصير عن طريق الحرير',
    shortDescAr: 'فيلم قصير يتتبع قافلة تجارية قديمة عبر الحدود الشمالية بممثلين من المنطقة.',
    goal: 150000, pct: 4, backers: 19, staff: false, published: 1, deadline: 52 },
];

async function main() {
  const demoHash = await bcrypt.hash('Wathba!2026', 10);

  const cats = await prisma.category.findMany({ where: { parentId: null }, select: { id: true, slug: true } });
  const catId = new Map(cats.map((c) => [c.slug, c.id]));
  const missing = [...new Set(PROJECTS.map((p) => p.cat))].filter((s) => !catId.has(s));
  if (missing.length) throw new Error(`categories absent from this database: ${missing.join(', ')}`);

  const creatorId = new Map();
  for (const [key, c] of Object.entries(CREATORS)) {
    const u = await prisma.user.upsert({
      where: { email: `${c.handle}@wathba.demo` },
      update: { name: c.name, city: c.city },
      create: {
        name: c.name,
        email: `${c.handle}@wathba.demo`,
        handle: c.handle,
        city: c.city,
        roles: ['BACKER', 'CREATOR'],
        passwordHash: demoHash,
        emailVerified: true,
        consentVersion: '2026-06-28',
      },
    });
    creatorId.set(key, u.id);
  }

  let made = 0;
  let updated = 0;
  for (const p of PROJECTS) {
    const goal = sar(p.goal);
    // raised is DERIVED from the target percentage, so the bucket a project
    // lands in is readable straight off this table.
    const raised = (goal * BigInt(p.pct)) / 100n;
    const data = {
      titleAr: p.titleAr,
      shortDescAr: p.shortDescAr,
      // storyAr and durationDays are required with no default. The story is the
      // campaign body — a one-liner would render as an empty project page, so it
      // is built from the pitch the card already shows plus the funding plan.
      storyAr:
        `${p.shortDescAr}\n\n` +
        `تبدأ الحملة بتغطية تكاليف الإنتاج الأولى، ثم التوسّع بحسب ما يتحقق من الهدف. ` +
        `كل داعم يحصل على تحديث شهري بالصور والأرقام، ولا يُخصم أي مبلغ إلا عند نجاح الحملة.`,
      durationDays: p.published + p.deadline,
      categoryId: catId.get(p.cat),
      region: p.region,
      status: 'LIVE',
      isStaffPick: p.staff,
      fundingGoalHalalas: goal,
      raisedHalalas: raised,
      backersCount: p.backers,
      deadline: hence(p.deadline),
      publishedAt: ago(p.published),
      createdById: creatorId.get(p.creator),
      hiddenAt: null,
    };
    const existing = await prisma.project.findUnique({ where: { slug: p.slug }, select: { id: true } });
    if (existing) {
      await prisma.project.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.project.create({ data: { ...data, slug: p.slug } });
      made += 1;
    }
  }

  // The trigger from 0058/0059 decides this, not us — so read it back rather
  // than trust the titles. A project that silently landed as a fixture would be
  // invisible on the very surface this seed exists to fill.
  const flagged = await prisma.project.findMany({
    where: { slug: { in: PROJECTS.map((p) => p.slug) }, isTestFixture: true },
    select: { slug: true, titleAr: true },
  });
  if (flagged.length) {
    throw new Error(
      `the fixture trigger flagged seeded projects — they would never appear publicly:\n` +
        flagged.map((f) => `  ${f.slug}  ${f.titleAr}`).join('\n'),
    );
  }

  console.log(`hero seed: ${made} created, ${updated} updated, 0 flagged as fixtures`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
