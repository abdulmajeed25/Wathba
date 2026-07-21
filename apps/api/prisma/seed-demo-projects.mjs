// ============================================================================
// Wathba — rich demo-data GENERATOR (rewritten; the original was lost in a
// VPS reformat). Creates the base rows the two decorator scripts assume already
// exist, so the full demo is reproducible end to end:
//
//   node --env-file=.env prisma/seed-e2e.mjs            # categories + collections + OWNER
//   node --env-file=.env prisma/seed-demo-users.mjs     # role users (backer/creator/supplier/admin)
//   node --env-file=.env prisma/seed-demo-projects.mjs  # THIS — projects, RFQ, pledges, payouts
//   psql … -f prisma/_seed/demo-engagement.sql          # decorates the drone campaign
//   psql … -f prisma/_seed/demo-milestones.sql          # milestones on both core projects
//
// What it creates (all idempotent — safe to re-run):
//   · sirb@wathba.demo (creator 11111111…) + supplier-s3@ + demo backers
//   · the drone campaign (project 22222222…, LIVE) — FK target for demo-engagement.sql
//   · a funded project (project 6fff784b…, FUNDED) with its own milestones + a SENT
//     payout — FK target for demo-milestones.sql (whose NOT EXISTS guard then skips it)
//   · an OPEN RFQ on the funded project + a supplier bid
//   · a spread of LIVE projects across categories so /projects and /discover have variety
//   · sample CAPTURED/HELD pledges (incl. backer@wathba.demo, so "تعهداتي" renders)
//
// Money is BigInt halalas (100 halalas = 1 SAR). The funded project realized
// 684,200 SAR (68,420,000 h) so the decorator's M1 release (30% = 20,526,000 h)
// reconciles exactly.
// ============================================================================
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const h = (n) => BigInt(n);
const DAY = 864e5;
const daysAgo = (d) => new Date(Date.now() - d * DAY);
const daysHence = (d) => new Date(Date.now() + d * DAY);
const CONSENT = '2026-06-28';

// Fixed ids the decorator SQL hard-codes — must match exactly.
const SIRB_ID = '11111111-1111-1111-1111-111111111111';
const DRONE_ID = '22222222-2222-2222-2222-222222222222';
const FUNDED_ID = '6fff784b-21b0-4249-b254-384e96612e68';

const DEMO_PW = 'Wathba!2026';
const OWNER_PW = 'Str0ngPass!x';

async function main() {
  const demoHash = await bcrypt.hash(DEMO_PW, 12);
  const ownerHash = await bcrypt.hash(OWNER_PW, 12);

  const verified = {
    nafathVerified: true,
    nafathVerifiedAt: new Date(),
    emailVerified: true,
    consentVersion: CONSENT,
    consentAt: new Date(),
  };

  // ── PHASE 1 — users ───────────────────────────────────────────────────────
  // sirb: the drone-campaign creator, fixed id (FK target for CreatorProfile /
  // Comment / ContestWinner in demo-engagement.sql).
  const sirb = await prisma.user.upsert({
    where: { id: SIRB_ID },
    update: { roles: ['BACKER', 'CREATOR'], passwordHash: demoHash, handle: 'sirb', ...verified },
    create: {
      id: SIRB_ID,
      name: 'فريق سِرب',
      email: 'sirb@wathba.demo',
      handle: 'sirb',
      city: 'الرياض',
      bioAr: 'مهندسون عرب نبني درون تصوير ذكي يتابع صاحبه.',
      roles: ['BACKER', 'CREATOR'],
      passwordHash: demoHash,
      ...verified,
    },
  });

  // Funded-project owner — matches seed-e2e's OWNER account when present
  // (upsert by email keeps its id + OWNER ops grant); created standalone otherwise.
  const owner = await prisma.user.upsert({
    where: { email: 'smoke-s1@test.wathba.sa' },
    update: { roles: ['BACKER', 'ADMIN', 'CREATOR'], passwordHash: ownerHash, ...verified },
    create: {
      name: 'مالك المنصة',
      email: 'smoke-s1@test.wathba.sa',
      roles: ['BACKER', 'ADMIN', 'CREATOR'],
      passwordHash: ownerHash,
      ...verified,
    },
  });

  // A second demo creator for category variety.
  const creator2 = await prisma.user.upsert({
    where: { email: 'creator@wathba.demo' },
    update: { roles: ['BACKER', 'CREATOR'], passwordHash: demoHash, ...verified },
    create: { name: 'مبدع تجريبي', email: 'creator@wathba.demo', roles: ['BACKER', 'CREATOR'], passwordHash: demoHash, ...verified },
  });

  // Supplier who owns a bid (FK target referenced by _seed/demo-users.mjs).
  const supplier = await prisma.user.upsert({
    where: { email: 'supplier-s3@test.wathba.sa' },
    update: { roles: ['BACKER', 'SUPPLIER'], passwordHash: demoHash, ...verified },
    create: { name: 'مؤسسة الإمداد التقني', email: 'supplier-s3@test.wathba.sa', roles: ['BACKER', 'SUPPLIER'], passwordHash: demoHash, ...verified },
  });

  // Backer pool (backer@wathba.demo first so "تعهداتي" renders for the canonical demo backer).
  const backerEmails = [
    ['backer@wathba.demo', 'داعم تجريبي'],
    ['nora.backer@wathba.demo', 'نورة الداعمة'],
    ['saad.backer@wathba.demo', 'سعد الداعم'],
    ['lama.backer@wathba.demo', 'لمى الداعمة'],
    ['faisal.backer@wathba.demo', 'فيصل الداعم'],
    ['huda.backer@wathba.demo', 'هدى الداعمة'],
  ];
  const backers = [];
  for (const [email, name] of backerEmails) {
    backers.push(
      await prisma.user.upsert({
        where: { email },
        update: { passwordHash: demoHash, ...verified },
        create: { name, email, roles: ['BACKER'], passwordHash: demoHash, ...verified },
      }),
    );
  }

  // ── category lookups ──────────────────────────────────────────────────────
  const topBySlug = async (slug) => prisma.category.findFirst({ where: { slug, parentId: null } });
  const childBySlug = async (slug) => prisma.category.findFirst({ where: { slug, parentId: { not: null } } });
  const catId = async (slug, child = false) => (child ? await childBySlug(slug) : await topBySlug(slug))?.id ?? null;

  const flightCat = await catId('flight', true); // technology → flight (the drone)
  const foodCat = await catId('food');

  // ── PHASE 2 — the two core projects (fixed ids; FK targets for decorators) ──
  const GOAL = 50_000_000; // 500,000 SAR
  const REALIZED = 68_420_000; // 684,200 SAR — reconciles M1 (30% = 20,526,000 h)

  await prisma.project.upsert({
    where: { id: DRONE_ID },
    update: {},
    create: {
      id: DRONE_ID,
      titleAr: 'سِرب — درون التصوير الذكي',
      shortDescAr: 'درون سعودي يصوّر بدقة ٨K ويتابع صاحبه تلقائياً في المناطق المفتوحة.',
      storyAr:
        'سِرب مشروع سعودي بالكامل: درون خفيف مزوّد بكاميرا ٨K وذكاء تتبّع يبقيك في الإطار وأنت تتحرك. ' +
        'صُمّم للظروف القاسية — حرارة حتى ٥٥°م ومقاومة غبار IP54 — وطوّرناه على مدى عامين مع مصنّعين محليين. ' +
        'هذه حملتنا الثانية، ونهدف لإنزال أول دفعة إنتاج للسوق الخليجي قبل نهاية ٢٠٢٦ بإذن الله.',
      category: 'TECH',
      categoryId: flightCat,
      region: 'RIYADH',
      isStaffPick: true,
      fundingGoalHalalas: h(GOAL),
      raisedHalalas: h(REALIZED),
      realizedHalalas: h(REALIZED),
      backersCount: 1138,
      durationDays: 45,
      deadline: daysHence(18),
      status: 'LIVE',
      publishedAt: daysAgo(27),
      slug: 'sirb-drone',
      createdById: sirb.id,
    },
  });

  await prisma.project.upsert({
    where: { id: FUNDED_ID },
    update: {},
    create: {
      id: FUNDED_ID,
      titleAr: 'نخبة — تمر سعودي فاخر معبّأ بحرفية',
      shortDescAr: 'خط تعبئة حديث لتمور القصيم الفاخرة بمعايير تصدير عالمية.',
      storyAr:
        'مشروع نخبة أنشأ خط تعبئة وتغليف حديث لتمور القصيم الفاخرة بمعايير تصدير عالمية. ' +
        'بعد نجاح الحملة، اكتمل التمويل ودخلنا مرحلة الإنتاج: جُهّز خط الإنتاج الأول، ونعمل على أول دفعة تصدير. ' +
        'شفافية الإنفاق ومعالم التنفيذ منشورة بالكامل في تبويب «الشفافية».',
      category: 'FOOD',
      categoryId: foodCat,
      region: 'QASSIM',
      fundingGoalHalalas: h(GOAL),
      raisedHalalas: h(REALIZED),
      realizedHalalas: h(REALIZED),
      backersCount: 842,
      durationDays: 40,
      deadline: daysAgo(22),
      status: 'FUNDED',
      publishedAt: daysAgo(80),
      reviewedAt: daysAgo(78),
      slug: 'nukhba-dates',
      createdById: owner.id,
    },
  });

  // ── PHASE 3 — funded-project reward tiers (its own ids) ────────────────────
  const fundedTiers = [
    { id: '6fff7001-0000-4000-8000-000000000001', titleAr: 'علبة الذوّاقة', amount: 15_000, descAr: 'علبة ٥٠٠غ من التمر الفاخر مع بطاقة شكر.', delivery: daysAgo(10), sortOrder: 0, claimedQty: 210 },
    { id: '6fff7001-0000-4000-8000-000000000002', titleAr: 'صندوق الهدية', amount: 45_000, descAr: 'صندوق هدايا خشبي ٣ أصناف + تغليف فاخر.', delivery: daysAgo(5), sortOrder: 1, claimedQty: 96, featured: true },
    { id: '6fff7001-0000-4000-8000-000000000003', titleAr: 'باقة المؤسسين', amount: 120_000, descAr: 'صندوقان فاخران + اسمك ضمن داعمي الإصدار الأول.', delivery: daysHence(20), sortOrder: 2, claimedQty: 34 },
  ];
  for (const t of fundedTiers) {
    await prisma.rewardTier.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        projectId: FUNDED_ID,
        titleAr: t.titleAr,
        amountHalalas: h(t.amount),
        descAr: t.descAr,
        includesPhysicalProduct: true,
        requiresShipping: true,
        estDeliveryDate: t.delivery,
        claimedQty: t.claimedQty,
        featured: !!t.featured,
        shipsTo: ['SA', 'AE', 'KW'],
        sortOrder: t.sortOrder,
      },
    });
  }

  // ── PHASE 4 — funded-project milestones (fixed ids) + a SENT payout ─────────
  // Created here so demo-milestones.sql's NOT EXISTS guard skips this project
  // (it still fills the drone), and so the payout can reference a real milestone.
  const M1_ID = '6fff7100-0000-4000-8000-000000000001';
  const funMilestones = [
    { id: M1_ID, order: 1, titleAr: 'تجهيز خط الإنتاج الأول', releasePct: 30, status: 'RELEASED', releasedHalalas: 20_526_000, submittedAt: daysAgo(30), approvedAt: daysAgo(25), releasedAt: daysAgo(20), evidenceUrl: 'https://example.sa/evidence/m1-factory-line.pdf' },
    { id: '6fff7100-0000-4000-8000-000000000002', order: 2, titleAr: 'إنتاج أول دفعة (٢٥٠ وحدة)', releasePct: 30, status: 'APPROVED', releasedHalalas: 0, submittedAt: daysAgo(12), approvedAt: daysAgo(5), evidenceUrl: 'https://example.sa/evidence/m2-qc-report.pdf' },
    { id: '6fff7100-0000-4000-8000-000000000003', order: 3, titleAr: 'تغليف ومستندات الشحن', releasePct: 20, status: 'SUBMITTED', releasedHalalas: 0, submittedAt: daysAgo(2), evidenceUrl: 'https://example.sa/evidence/m3-packing.pdf' },
    { id: '6fff7100-0000-4000-8000-000000000004', order: 4, titleAr: 'تسليم الدُفعة الأولى للداعمين', releasePct: 20, status: 'PENDING', releasedHalalas: 0 },
  ];
  for (const m of funMilestones) {
    await prisma.milestone.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id,
        projectId: FUNDED_ID,
        order: m.order,
        titleAr: m.titleAr,
        releasePct: m.releasePct,
        evidenceRequired: 'صور + مستندات إثبات',
        status: m.status,
        releasedHalalas: h(m.releasedHalalas),
        submittedAt: m.submittedAt ?? null,
        approvedAt: m.approvedAt ?? null,
        releasedAt: m.releasedAt ?? null,
        evidenceUrl: m.evidenceUrl ?? null,
      },
    });
  }

  // Payout beneficiary + a SENT payout for the released milestone (OPS-0 #2:
  // gross = net + feeWithheld; 5% commission + 15% VAT on it).
  await prisma.payoutBeneficiary.upsert({
    where: { userId: owner.id },
    update: {},
    create: { userId: owner.id, type: 'BANK_ACCOUNT', iban: 'SA0380000000608010167519', name: 'مالك المنصة', mobile: '+966500000000', city: 'الرياض', verifiedAt: daysAgo(40) },
  });
  await prisma.payout.upsert({
    where: { id: '6fff7200-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '6fff7200-0000-4000-8000-000000000001',
      projectId: FUNDED_ID,
      creatorId: owner.id,
      milestoneId: M1_ID,
      amountHalalas: h(20_526_000),
      feeWithheldHalalas: h(1_180_245), // 5% (1,026,300) + 15% VAT on it (153,945)
      netHalalas: h(19_345_755),
      status: 'SENT',
      sentAt: daysAgo(19),
      zatcaInvoiceId: 'WTHB-2026-000042',
    },
  });

  // ── PHASE 5 — RFQ + supplier bid (on the funded project) ───────────────────
  const RFQ_ID = '6fff7300-0000-4000-8000-000000000001';
  await prisma.rFQ.upsert({
    where: { id: RFQ_ID },
    update: {},
    create: {
      id: RFQ_ID,
      projectId: FUNDED_ID,
      specsAr: 'توريد مواد تغليف صديقة للبيئة لعشرة آلاف علبة تمر بمواصفات تصدير ومطابقة لمعايير الهيئة السعودية للغذاء والدواء.',
      dueDate: daysHence(14),
      status: 'OPEN',
    },
  });
  await prisma.supplierBid.upsert({
    where: { id: '6fff7301-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '6fff7301-0000-4000-8000-000000000001',
      rfqId: RFQ_ID,
      supplierId: supplier.id,
      amountHalalas: h(3_800_000),
      leadTimeDays: 21,
      specComplianceNote: 'نلتزم بكامل المواصفات؛ الكرتون معاد التدوير بنسبة ٩٠٪ وشهادات المطابقة مرفقة.',
      status: 'SUBMITTED',
    },
  });

  // ── PHASE 6 — a spread of LIVE projects across categories ──────────────────
  const extras = [
    { n: 1, slug: 'khatt-arabic-type',  titleAr: 'خط — عائلة خطوط عربية حديثة',        shortDescAr: 'عائلة خطوط عربية مفتوحة بأوزان متعددة للمصممين.',        story: 'مشروع خط يبني عائلة خطوط عربية حديثة بثمانية أوزان، مصممة للشاشات والطباعة معاً، مع دعم كامل للتشكيل.', cat: 'design',     legacy: 'DESIGN',     region: 'MAKKAH',  goal: 8_000_000,  raised: 6_400_000,  backers: 512, creator: 'c2', pct: 80 },
    { n: 2, slug: 'sadu-board-game',    titleAr: 'سدو — لعبة لوحية تراثية',            shortDescAr: 'لعبة لوحية مستوحاة من نقوش السدو النجدي.',              story: 'سدو لعبة لوحية استراتيجية لعائلتك مستوحاة من نقوش السدو، بمكوّنات مصنوعة يدوياً ودليل عربي كامل.', cat: 'games',      legacy: 'GAMES',      region: 'RIYADH',  goal: 12_000_000, raised: 15_600_000, backers: 934, creator: 'sirb', pct: 130 },
    { n: 3, slug: 'raheeq-novel',       titleAr: 'رحيق — رواية سعودية مصوّرة',          shortDescAr: 'رواية سعودية مصوّرة بطبعة فاخرة محدودة.',              story: 'رحيق رواية سعودية مصوّرة تجمع النص والرسم، تُطبع طبعة فاخرة محدودة موقّعة من الكاتب والرسّام.', cat: 'publishing', legacy: 'PUBLISHING', region: 'EASTERN', goal: 5_000_000,  raised: 2_100_000,  backers: 173, creator: 'c2', pct: 42 },
    { n: 4, slug: 'nasij-abaya',        titleAr: 'نسيج — عباءات بأقمشة مستدامة',        shortDescAr: 'عباءات معاصرة من أقمشة معاد تدويرها بالكامل.',          story: 'نسيج علامة أزياء تصنع عباءات معاصرة من أقمشة مستدامة معاد تدويرها، بخياطة محلية ومقاسات شاملة.', cat: 'fashion',    legacy: 'FASHION',    region: 'MAKKAH',  goal: 9_000_000,  raised: 7_650_000,  backers: 388, creator: 'c2', pct: 85 },
    { n: 5, slug: 'daw-short-film',     titleAr: 'ضوء — فيلم قصير سعودي',              shortDescAr: 'فيلم قصير عن الحرفيين في الأحياء القديمة.',            story: 'ضوء فيلم قصير يوثّق حكايات حرفيين في الأحياء القديمة، بإنتاج سعودي مستقل وفريق شاب بالكامل.', cat: 'film-video', legacy: 'FILM',       region: 'MADINAH', goal: 20_000_000, raised: 11_200_000, backers: 604, creator: 'sirb', pct: 56 },
    { n: 6, slug: 'ramz-art-prints',    titleAr: 'رمز — مطبوعات فنية بخط اليد',        shortDescAr: 'سلسلة مطبوعات فنية محدودة موقّعة يدوياً.',              story: 'رمز سلسلة مطبوعات فنية تدمج الحرف العربي بالتجريد اللوني، تُنتج نسخاً محدودة موقّعة ومرقّمة يدوياً.', cat: 'art',        legacy: 'ART',        region: 'ASIR',    goal: 4_000_000,  raised: 4_320_000,  backers: 297, creator: 'c2', pct: 108 },
    { n: 7, slug: 'ufuq-photobook',     titleAr: 'أفق — كتاب تصوير الصحراء',           shortDescAr: 'كتاب تصوير فوتوغرافي لصحارى الجزيرة.',                  story: 'أفق كتاب تصوير فوتوغرافي يوثّق صحارى الجزيرة عبر أربعة فصول، بطباعة متحفية وورق مؤرشف.', cat: 'photography', legacy: null,        region: 'NAJRAN',  goal: 6_000_000,  raised: 900_000,    backers: 78,  creator: 'sirb', pct: 15 },
  ];

  const creatorOf = { sirb: sirb.id, c2: creator2.id };
  for (const p of extras) {
    const pid = `33333333-0000-4000-8000-00000000000${p.n}`;
    const cid = await catId(p.cat);
    await prisma.project.upsert({
      where: { id: pid },
      update: {},
      create: {
        id: pid,
        titleAr: p.titleAr,
        shortDescAr: p.shortDescAr,
        storyAr: p.story + ' ' + 'انضم إلى الحملة وكن جزءاً من إطلاقها؛ كل تعهّد يقرّبنا خطوة من التنفيذ والتسليم في موعده.',
        category: p.legacy ?? null,
        categoryId: cid,
        region: p.region,
        fundingGoalHalalas: h(p.goal),
        raisedHalalas: h(p.raised),
        realizedHalalas: h(0),
        backersCount: p.backers,
        durationDays: 30,
        deadline: daysHence(30 - p.n * 2),
        status: 'LIVE',
        publishedAt: daysAgo(p.n * 2),
        slug: p.slug,
        isStaffPick: p.n === 2 || p.n === 6,
        createdById: creatorOf[p.creator],
        // one featured + one standard tier each
        rewardTiers: {
          create: [
            { titleAr: 'باقة الدعم', amountHalalas: h(Math.round(p.goal / 400)), descAr: 'شكراً + تحديثات حصرية عبر المنصة.', requiresShipping: false, estDeliveryDate: daysHence(120), sortOrder: 0, featured: true },
            { titleAr: 'الباقة الكاملة', amountHalalas: h(Math.round(p.goal / 120)), descAr: 'المنتج النهائي + اسمك ضمن الداعمين.', includesPhysicalProduct: true, requiresShipping: true, estDeliveryDate: daysHence(150), sortOrder: 1, shipsTo: ['SA'] },
          ],
        },
      },
    });
  }

  // ── PHASE 7 — sample pledges (subset; denormalized counts already set) ─────
  // Funded project: CAPTURED pledges referencing its tiers.
  const fundedPledges = [
    { ref: 'demo-funded-1', backer: 0, tier: 1, amount: 45_000, no: 1 },
    { ref: 'demo-funded-2', backer: 1, tier: 0, amount: 15_000, no: 2 },
    { ref: 'demo-funded-3', backer: 2, tier: 2, amount: 120_000, no: 3 },
    { ref: 'demo-funded-4', backer: 3, tier: 1, amount: 45_000, no: 4 },
    { ref: 'demo-funded-5', backer: 4, tier: 0, amount: 15_000, no: 5 },
    { ref: 'demo-funded-6', backer: 5, tier: 1, amount: 45_000, no: 6 },
  ];
  for (const pl of fundedPledges) {
    await prisma.pledge.upsert({
      where: { paymentRef: pl.ref },
      update: {},
      create: {
        backerId: backers[pl.backer].id,
        projectId: FUNDED_ID,
        tierId: fundedTiers[pl.tier].id,
        amountHalalas: h(pl.amount),
        status: 'CAPTURED',
        rewardStatus: pl.no <= 3 ? 'SENT' : 'IN_PROGRESS',
        paymentRef: pl.ref,
        backerNo: pl.no,
        createdAt: daysAgo(60 - pl.no),
        capturedAt: daysAgo(22),
      },
    });
  }

  // Drone (LIVE): HELD auth pledges, no tier (tiers are owned by the decorator).
  const dronePledges = [
    { ref: 'demo-drone-1', backer: 0, amount: 220_000, no: 1 },
    { ref: 'demo-drone-2', backer: 2, amount: 320_000, no: 2 },
    { ref: 'demo-drone-3', backer: 4, amount: 220_000, no: 3 },
    { ref: 'demo-drone-4', backer: 5, amount: 120_000, no: 4 },
  ];
  for (const pl of dronePledges) {
    await prisma.pledge.upsert({
      where: { paymentRef: pl.ref },
      update: {},
      create: {
        backerId: backers[pl.backer].id,
        projectId: DRONE_ID,
        amountHalalas: h(pl.amount),
        status: 'HELD',
        paymentRef: pl.ref,
        backerNo: pl.no,
        createdAt: daysAgo(10 - pl.no),
      },
    });
  }

  // ── summary ───────────────────────────────────────────────────────────────
  const [projects, tiers, pledges, rfqs, bids, payouts] = await Promise.all([
    prisma.project.count(),
    prisma.rewardTier.count(),
    prisma.pledge.count(),
    prisma.rFQ.count(),
    prisma.supplierBid.count(),
    prisma.payout.count(),
  ]);
  console.log('[seed-demo-projects] done:');
  console.log(`  projects=${projects}  rewardTiers=${tiers}  pledges=${pledges}  rfqs=${rfqs}  bids=${bids}  payouts=${payouts}`);
  console.log(`  core: drone ${DRONE_ID} (LIVE) · funded ${FUNDED_ID} (FUNDED) · creator sirb@wathba.demo`);
  console.log('  next: run _seed/demo-engagement.sql then _seed/demo-milestones.sql to decorate.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
