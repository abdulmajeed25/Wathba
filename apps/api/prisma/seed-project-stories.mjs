/**
 * Give every presentable LIVE project a STRUCTURED campaign story.
 *
 *   node --env-file=.env prisma/seed-project-stories.mjs
 *
 * Until the public renderer landed, `storyAr` was never displayed: the campaign
 * page drew a hardcoded fixture, so the seed only had to satisfy the column's
 * NOT NULL — it writes one prose paragraph, ~229 chars at the median. Rendering
 * the real story therefore turned 25 rich-looking pages into a single bare
 * paragraph each. Wiring the renderer without this script is a downgrade, not a
 * feature.
 *
 * So the story is generated the same way covers are (see seed-project-covers):
 * deterministic per project, derived from data the project already carries —
 * title, pitch, top-level category, region, goal — and shaped into the markdown
 * the renderer understands (# headings, - and 1. lists, ![alt](url) media).
 *
 * Deterministic means re-running produces byte-identical stories, so this is
 * safe to re-run and shows up as "0 changed" when nothing moved.
 *
 * Headings use `#`, not `##`. The editor labels them «عنوان رئيسي» (`#`) and
 * «عنوان فرعي» (`##`), and the parser maps them to h2 and h3 — so a story whose
 * top-level sections are `##` renders h3 directly under the page h1 and skips a
 * heading level. These are section headings, so they are `#`.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MEDIA = `${process.env.MINIO_PUBLIC_ENDPOINT}/${process.env.MEDIA_BUCKET ?? 'venture-evidence'}`;

/**
 * Per-category flavour: what "we already did this" and "here is the plan" mean
 * for a drone company vs a bakery. Keyed by TOP-LEVEL slug, the same key space
 * the covers generator uses, and unmapped slugs take a neutral entry rather than
 * inventing domain claims the project cannot support.
 */
const FLAVOUR = {
  technology: {
    done: ['أنجزنا النموذج الأولي واختبرناه داخلياً', 'أكملنا تصميم اللوحة الإلكترونية', 'وصلنا إلى أداء مستقر في الاختبارات المعملية'],
    plan: ['إغلاق التصميم النهائي للتصنيع', 'تشغيل الدفعة التجريبية الأولى', 'اختبار ميداني مع مجموعة مستخدمين', 'بدء التسليم للداعمين'],
  },
  design: {
    done: ['أنهينا مرحلة الرسومات والنماذج الورقية', 'اخترنا الخامات بعد مقارنة عدة موردين', 'راجعنا التصميم مع مستخدمين حقيقيين'],
    plan: ['إنتاج العينة النهائية', 'ضبط القياسات بعد ملاحظات التجربة', 'التصنيع بالكميات', 'الشحن والتسليم'],
  },
  art: {
    done: ['أنجزنا الأعمال التحضيرية والدراسات الأولى', 'حجزنا مساحة العمل', 'حدّدنا قائمة الأعمال النهائية'],
    plan: ['إنتاج الأعمال المتبقية', 'التجهيز والتأطير', 'إقامة العرض', 'توثيق الأعمال ونشر الكتيّب'],
  },
  games: {
    done: ['أنهينا النموذج القابل للعب', 'اختبرناه مع مجموعات لعب متعددة', 'استقرّ التوازن بعد عدة جولات مراجعة'],
    plan: ['إنهاء الرسوم والمكوّنات', 'طباعة النسخة التجريبية', 'الإنتاج بالكميات', 'الشحن للداعمين'],
  },
  'film-video': {
    done: ['أنهينا السيناريو والمعالجة البصرية', 'اخترنا مواقع التصوير', 'تعاقدنا مع فريق التصوير الأساسي'],
    plan: ['التصوير الرئيسي', 'المونتاج والمعالجة اللونية', 'الموسيقى والمكساج', 'العرض والتوزيع'],
  },
  food: {
    done: ['طوّرنا الوصفات واختبرناها مع عملاء أوائل', 'حصلنا على التراخيص الصحية اللازمة', 'اتفقنا مع موردين محليين'],
    plan: ['تجهيز المطبخ والمعدات', 'تشغيل الدفعة الأولى', 'التغليف والعلامة', 'البدء بالتوصيل والطلبات'],
  },
  publishing: {
    done: ['أنهينا المسودة الكاملة', 'أتممنا التحرير اللغوي', 'اخترنا تصميم الغلاف'],
    plan: ['الإخراج الفني الداخلي', 'الطباعة والتجليد', 'التوزيع على المكتبات', 'التسليم للداعمين'],
  },
  photography: {
    done: ['أنجزنا الجولة التصويرية الأولى', 'اخترنا الصور المرشّحة للعرض', 'جهّزنا خطة الطباعة'],
    plan: ['استكمال التصوير المتبقي', 'الطباعة بجودة أرشيفية', 'التأطير والتجهيز', 'العرض والتسليم'],
  },
  fashion: {
    done: ['أنجزنا العينات الأولى', 'اخترنا الأقمشة بعد اختبارات الجودة', 'ضبطنا جدول المقاسات'],
    plan: ['إنهاء العينة المعتمدة', 'التصنيع بالكميات', 'مراقبة الجودة', 'الشحن والتسليم'],
  },
  crafts: {
    done: ['أنجزنا القطع النموذجية يدوياً', 'وفّرنا الخامات من مصادر محلية', 'اختبرنا المتانة والاستخدام'],
    plan: ['إنتاج الكمية المطلوبة', 'التشطيب والتغليف', 'ضبط الجودة قطعة قطعة', 'التسليم للداعمين'],
  },
  'social-impact': {
    done: ['أجرينا مسحاً ميدانياً للاحتياج', 'بنينا شراكة مع جهة محلية', 'شغّلنا برنامجاً تجريبياً بمجموعة أولى'],
    plan: ['توسيع البرنامج لمجموعات إضافية', 'تدريب الفريق الميداني', 'قياس الأثر ونشر النتائج', 'ضمان الاستدامة بعد الحملة'],
  },
  'agriculture-food-security': {
    done: ['جهّزنا الأرض وأجرينا تحليل التربة', 'اخترنا الأصناف الملائمة للمناخ', 'أنهينا الموسم التجريبي الأول'],
    plan: ['التوسّع في المساحة المزروعة', 'تركيب أنظمة الري الموفّرة', 'الحصاد والفرز', 'التوزيع والتسليم'],
  },
  'heritage-culture': {
    done: ['وثّقنا الحرفة مع ممارسيها', 'جمعنا المراجع والصور الأرشيفية', 'أقمنا ورشة تعريفية أولى'],
    plan: ['إنتاج القطع والمواد التوثيقية', 'تنظيم ورش نقل المهارة', 'العرض العام', 'أرشفة العمل ونشره'],
  },
  'environment-sustainability': {
    done: ['أجرينا القياسات الأساسية للموقع', 'حصلنا على الموافقات اللازمة', 'نفّذنا مرحلة تجريبية محدودة'],
    plan: ['التنفيذ على النطاق الكامل', 'المتابعة والقياس الدوري', 'إشراك المجتمع المحلي', 'نشر تقرير الأثر'],
  },
  'tourism-entertainment': {
    done: ['صمّمنا التجربة واختبرناها مع مجموعة أولى', 'أمّنا الموقع والتصاريح', 'دربنا فريق التشغيل'],
    plan: ['تجهيز الموقع بالكامل', 'التشغيل التجريبي', 'الافتتاح للجمهور', 'استضافة الداعمين'],
  },
  sports: {
    done: ['جهّزنا البرنامج التدريبي', 'أمّنا المكان والمعدات الأساسية', 'شغّلنا مجموعة تجريبية'],
    plan: ['استكمال تجهيز المعدات', 'إطلاق البرنامج الكامل', 'تنظيم أول منافسة', 'توسيع العضوية'],
  },
  'digital-economy': {
    done: ['أطلقنا نسخة تجريبية محدودة', 'تحققنا من الطلب مع مستخدمين أوائل', 'أنهينا البنية التقنية الأساسية'],
    plan: ['إكمال الميزات الأساسية', 'الإطلاق التجريبي الموسّع', 'التكامل مع الشركاء', 'الإطلاق العام'],
  },

  /* Added after the first run: the script's own unmapped-slug warning named
     these four, which had been taking the neutral copy — the same way ten
     categories silently took the fallback cover. Act on that warning. */
  comics: {
    done: ['أنهينا سيناريو الفصول الأولى', 'استقرّ التصميم البصري للشخصيات', 'أنجزنا الصفحات النموذجية بالحبر واللون'],
    plan: ['رسم الصفحات المتبقية', 'التلوين والحروف', 'الطباعة والتجليد', 'الشحن للداعمين'],
  },
  theater: {
    done: ['أنهينا النص وقراءته مع الفريق', 'اخترنا الممثلين بعد جلسات اختبار', 'حجزنا مساحة البروفات'],
    plan: ['البروفات الكاملة', 'تنفيذ الديكور والإضاءة', 'العرض أمام الجمهور', 'دعوة الداعمين للعرض الخاص'],
  },
  journalism: {
    done: ['أنجزنا البحث الأولي وجمع المصادر', 'أجرينا المقابلات الأولى', 'وضعنا خطة تحقّق مستقلة'],
    plan: ['استكمال العمل الميداني', 'التحقق من المعلومات ومراجعتها', 'التحرير والإخراج', 'النشر وإتاحته للجميع'],
  },
  dance: {
    done: ['أنهينا تصميم الحركة للمقاطع الأساسية', 'كوّنّا فريق الراقصين', 'أمّنا مساحة التدريب'],
    plan: ['استكمال البروفات', 'تجهيز الأزياء والإضاءة', 'العرض الأول', 'توثيق العمل بالفيديو'],
  },
};

const NEUTRAL = {
  done: ['أنهينا مرحلة التخطيط والدراسة', 'جهّزنا الفريق الأساسي', 'أنجزنا تجربة أولى محدودة النطاق'],
  plan: ['استكمال التجهيزات', 'التنفيذ على المرحلة الأولى', 'المراجعة بعد التشغيل', 'التسليم للداعمين'],
};

// `fundingGoalHalalas` is BigInt — arithmetic against a Number throws outright.
const riyals = (halalas) => new Intl.NumberFormat('ar-SA-u-nu-latn').format(Math.round(Number(halalas) / 100));

/**
 * Which projects carry a story VIDEO.
 *
 * Not all of them: one shared demo clip pasted into 26 campaigns reads as
 * filler, and the point is to exercise the media path, not to fake footage.
 * Chosen by a stable hash of the id so the set does not move between runs.
 */
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const hasVideo = (id) => hash(id) % 7 === 0;

function buildStory(p) {
  const top = p.categoryRef?.parent ?? p.categoryRef ?? null;
  const f = FLAVOUR[top?.slug] ?? NEUTRAL;
  const catName = top?.nameAr ?? 'المشاريع';

  const out = [];
  out.push(`# عن المشروع`);
  out.push(p.shortDescAr);
  out.push(
    `نطرح «${p.titleAr}» على وثبة لأن هذه المرحلة تحديداً تحتاج إلى دفعة مجتمعية: ` +
      `الفكرة تجاوزت مرحلة التجريب، وما تبقّى هو التنفيذ بالكميات. ` +
      `كل تعهّد هنا يذهب إلى خطوة محدّدة في الخطة أدناه، ولا يُخصم أي مبلغ إلا عند بلوغ الهدف.`,
  );

  out.push(`# ما الذي أنجزناه حتى الآن`);
  out.push(f.done.map((d) => `- ${d}`).join('\n'));

  if (hasVideo(p.id)) {
    out.push(`# الفيديو التعريفي`);
    out.push(`![لمحة سريعة عن المشروع](${MEDIA}/story/2026/08/demo-clip.webm)`);
  }

  out.push(`# خطة التنفيذ`);
  out.push(f.plan.map((s, i) => `${i + 1}. ${s}`).join('\n'));

  out.push(`# إلى أين تذهب التعهّدات`);
  out.push(
    `هدف الحملة ${riyals(p.fundingGoalHalalas)} ر.س. يغطي المبلغ تكاليف الإنتاج الأولى ورسوم المنصة ` +
      `والشحن داخل ${p.region ?? 'المملكة'}؛ وأي فائض يُوجَّه إلى توسيع الدفعة الأولى لا إلى بنود جديدة. ` +
      `نشارك الداعمين تحديثاً شهرياً بالصور والأرقام، ويبقى باب الأسئلة مفتوحاً في تبويب «التحديثات».`,
  );
  out.push(`نشكر كل من يقف خلف ${catName} في المملكة — وصولنا إلى هنا كان بدعمكم.`);

  return out.join('\n\n');
}

async function main() {
  const projects = await prisma.$queryRaw`
    SELECT p."id" FROM "Project" p
    WHERE p."status" = 'LIVE' AND p."hiddenAt" IS NULL
      AND p."isTestFixture" = false
      AND p."titleAr" !~ '[0-9]{10,}'`;

  const rows = await prisma.project.findMany({
    where: { id: { in: projects.map((r) => r.id) } },
    select: {
      id: true, slug: true, titleAr: true, shortDescAr: true, storyAr: true,
      fundingGoalHalalas: true, region: true,
      // `categoryRef`, NOT `category` — `category` is the legacy enum column and
      // selecting it silently hands back a wrong slug for every row.
      categoryRef: { select: { slug: true, nameAr: true, parent: { select: { slug: true, nameAr: true } } } },
    },
  });

  let changed = 0;
  let withVideo = 0;
  const unmapped = new Set();

  for (const p of rows) {
    const top = p.categoryRef?.parent ?? p.categoryRef ?? null;
    if (!FLAVOUR[top?.slug]) unmapped.add(top?.slug ?? '∅');

    const storyAr = buildStory(p);
    if (hasVideo(p.id)) withVideo++;
    if (storyAr === p.storyAr) continue;
    await prisma.project.update({ where: { id: p.id }, data: { storyAr } });
    changed++;
  }

  console.log(`[stories] ${rows.length} project(s), ${changed} rewritten, ${withVideo} carry a story video`);
  if (unmapped.size) {
    console.warn(
      `[stories] ${unmapped.size} top-level slug(s) had no FLAVOUR entry and took the ` +
        `neutral copy: ${[...unmapped].join(', ')}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
