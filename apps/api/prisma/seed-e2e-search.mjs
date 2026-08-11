// The Arabic reference content that arabic-search.spec.ts searches for.
//
// WHY THIS FILE EXISTS. That spec was written against the demo database and
// only ever passed there, because the e2e fixture contained none of the words
// it looks for. That was invisible for a long time: `run-e2e.sh` was silently
// testing against the demo DB (issue #172), so "the e2e fixture is thin" never
// cost anything. Under real isolation the spec fails 6 tests and skips 2.
//
// EVERY TERM BELOW IS LOAD-BEARING. Each one is the reference for a named
// assertion, so changing a title here breaks a test on purpose rather than by
// accident. The mapping is spelled out so the next person editing this copy
// knows what they are editing:
//
//   «نخيل» + «تمور»   AS4  partial word matches (نخي)
//                     AS6  only the LAST token is prefixed (نخيل تمو)
//                     AS9  typo «نخييل» must suggest «نخيل»
//                     AS10 a successful search skips suggestions
//                     AS12 header dropdown finds it from three characters
//                     AS13 zero-results page offers "هل تقصد…"
//   «الأحياء»          AS1  hamza is optional — «الاحياء» must find it too
//   «تقنية»            AS2  ta-marbuta folds to «تقنيه»
//   «حتى»              AS2  alef-maksura folds to «حتي»
//   «٢٠٠»              AS3  Arabic-Indic digits fold to «200»
//   «رحّالة» (creator)  AS7  shadda is optional — «رحالة» must find them
//   «مشروع»            AS11 gives that test something to actually rank
//
// AS5 (a single letter returns results) needs no term of its own — «ن» is the
// first letter of «نخيل».
//
// The projects are LIVE and NOT flagged as fixtures, deliberately: search
// excludes `isTestFixture` rows, so a flagged project would be unfindable and
// every assertion above would go back to proving nothing. That matches how
// «الرحلة الذهبية» is already handled for the category-discovery specs.
import bcrypt from 'bcryptjs';

const DAY = 864e5;
const daysAgo = (d) => new Date(Date.now() - d * DAY);
const daysHence = (d) => new Date(Date.now() + d * DAY);
const h = (n) => BigInt(n);

// Fixed ids so re-running is an upsert rather than a second copy — a duplicate
// would break AS4/AS6, which assert on `items[0]`.
const CREATOR_ID = 'e2e5ea11-0000-4000-8000-000000000001';
const PALMS_ID = 'e2e5ea11-0000-4000-8000-000000000002';
const FIELDS_ID = 'e2e5ea11-0000-4000-8000-000000000003';
const CRAFT_ID = 'e2e5ea11-0000-4000-8000-000000000004';

export async function seedSearchFixtures(prisma) {
  const passwordHash = await bcrypt.hash('Str0ngPass!x', 12);
  const verified = {
    nafathVerified: true,
    nafathVerifiedAt: new Date(),
    emailVerified: true,
    consentVersion: '2026-06-28',
    consentAt: new Date(),
  };

  // AS7's reference creator. The shadda in «رحّالة» is the whole point: the
  // creator arm of suggest was a raw ILIKE with no normalisation, so a reader
  // had to type the diacritic to find them.
  const creator = await prisma.user.upsert({
    where: { id: CREATOR_ID },
    update: { name: 'رحّالة الجزيرة', roles: ['BACKER', 'CREATOR'], ...verified },
    create: {
      id: CREATOR_ID,
      name: 'رحّالة الجزيرة',
      email: 'e2e-rahhala@test.wathba.sa',
      handle: 'rahhala-e2e',
      city: 'الرياض',
      bioAr: 'نوثّق الحرف السعودية ونحكي قصصها.',
      roles: ['BACKER', 'CREATOR'],
      passwordHash,
      ...verified,
    },
  });

  const topBySlug = async (slug) => prisma.category.findFirst({ where: { slug, parentId: null } });
  const catId = async (slug) => (await topBySlug(slug))?.id ?? null;
  const foodCat = await catId('food');
  const techCat = await catId('technology');
  const socialCat = await catId('social');

  const base = {
    status: 'LIVE',
    isTestFixture: false,
    hiddenAt: null,
    createdById: creator.id,
    fundingGoalHalalas: h(50_000_00),
    raisedHalalas: h(12_500_00),
    realizedHalalas: h(12_500_00),
    backersCount: 42,
    durationDays: 45,
    deadline: daysHence(20),
    publishedAt: daysAgo(10),
  };

  const projects = [
    {
      id: PALMS_ID,
      slug: 'e2e-nakheel-tumoor',
      titleAr: 'نخيل وتمور القصيم',
      shortDescAr: 'مشروع لتعبئة تمور النخيل بمعايير تصدير حديثة.',
      // «٢٠٠» is AS3's reference and «حتى» is AS2's alef-maksura reference.
      // Both read naturally here; neither is decoration.
      storyAr:
        'مشروع زراعي في القصيم يجمع أكثر من ٢٠٠ مزارع حول خط تعبئة واحد للتمور. ' +
        'نعمل مع مزارع النخيل حتى نهاية الموسم، ثم ننتقل إلى التصدير.',
      category: 'FOOD',
      categoryId: foodCat,
      region: 'QASSIM',
    },
    {
      id: FIELDS_ID,
      slug: 'e2e-malaeb-alahyaa',
      // AS1's reference: «الأحياء» with hamza, which «الاحياء» must also find.
      titleAr: 'ملاعب الأحياء المفتوحة',
      shortDescAr: 'مشروع لتحويل الأراضي الفاضية في الأحياء إلى ملاعب مفتوحة.',
      storyAr:
        'نحوّل الأراضي غير المستغلة داخل الأحياء السكنية إلى ملاعب مفتوحة للأطفال، ' +
        'بالشراكة مع الأمانة والسكان.',
      category: 'SOCIAL',
      categoryId: socialCat,
      region: 'RIYADH',
    },
    {
      id: CRAFT_ID,
      slug: 'e2e-mansa-taqniya',
      // AS2's ta-marbuta reference: «تقنية», which «تقنيه» must also find.
      titleAr: 'منصة تقنية للحرفيين',
      shortDescAr: 'مشروع منصة تقنية تربط الحرفيين بالمشترين مباشرة.',
      storyAr:
        'منصة تقنية سعودية تتيح للحرفيين عرض أعمالهم والبيع مباشرة، ' +
        'مع دعم لوجستي حتى باب المشتري.',
      category: 'TECH',
      categoryId: techCat,
      region: 'RIYADH',
    },
  ];

  for (const p of projects) {
    const { id, ...rest } = p;
    await prisma.project.upsert({
      where: { id },
      // UPDATE the text too, not just create. These strings ARE the assertions;
      // if someone edits a title here the seed has to carry it to an existing
      // database, or the spec fails against stale rows and the diff looks fine.
      update: { ...rest, ...base },
      create: { id, ...rest, ...base },
    });
  }

  // AS8 asks the suggest dropdown for «تراث» and requires a tag group back.
  // The vocabulary is seeded separately (seedTags); this attaches «تراث سعودي»
  // so it has a non-zero usageCount and is reachable from a real project.
  const heritage = await prisma.tag.findUnique({ where: { slug: 'saudi-heritage' } });
  if (heritage) {
    await prisma.projectTag.upsert({
      // Composite @@id([tagId, projectId]) — the compound key is named in that
      // order, not the other way round.
      where: { tagId_projectId: { tagId: heritage.id, projectId: CRAFT_ID } },
      update: {},
      create: { projectId: CRAFT_ID, tagId: heritage.id },
    });
    await prisma.tag.update({
      where: { id: heritage.id },
      data: { usageCount: await prisma.projectTag.count({ where: { tagId: heritage.id } }) },
    });
  }

  console.log(
    `[seed-e2e-search] ${projects.length} searchable project(s) + creator «رحّالة الجزيرة»` +
      `${heritage ? ' + tag «تراث سعودي»' : ' (tag vocabulary missing — run seed-tags)'}`,
  );
}
