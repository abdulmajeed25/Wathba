-- WATHBA demo seed v2 — column names corrected to match actual DB.
\set proj '22222222-2222-2222-2222-222222222222'
\set creator '11111111-1111-1111-1111-111111111111'

-- CreatorProfile
INSERT INTO "CreatorProfile" (id, "userId", "bioAr", "websiteUrl", collaborators, "followersCount", "createdProjectsCount", "backedProjectsCount", "lastSeenAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  :'creator',
  'مهندسون عرب نشتغل على درون يصوّر بدقة عالية ويتابع صاحبه. هذي حملتنا الثانية.',
  'https://sirb.example.sa',
  '[{"nameAr":"فهد القحطاني","role":"ميكانيكا"},{"nameAr":"سارة الحربي","role":"رؤية الكمبيوتر"},{"nameAr":"أحمد العنزي","role":"تصميم منتج"}]'::jsonb,
  142, 1, 3, now(), now()
) ON CONFLICT ("userId") DO UPDATE SET
  "bioAr" = EXCLUDED."bioAr",
  "websiteUrl" = EXCLUDED."websiteUrl",
  collaborators = EXCLUDED.collaborators,
  "updatedAt" = now();

-- Add-ons
INSERT INTO "AddOn" (id, "projectId", "titleAr", "descAr", "amountHalalas", "limitQty", "claimedQty", "sortOrder", "createdAt") VALUES
  ('aaaaaaaa-0001-0000-0000-000000000000', :'proj', 'بطارية احتياطية', 'بطارية ليثيوم إضافية تعطيك +٢٥ دقيقة طيران', 12000, NULL, 18, 0, now()),
  ('aaaaaaaa-0002-0000-0000-000000000000', :'proj', 'حقيبة محمولة', 'حقيبة عسكرية مقاومة للماء لحمل الدرون', 22000, 50, 11, 1, now())
ON CONFLICT (id) DO NOTHING;

-- Reward tiers (Featured + Limited)
INSERT INTO "RewardTier" (id, "projectId", "titleAr", "descAr", "amountHalalas", "limitQty", "claimedQty", "estDeliveryDate", "sortOrder", featured, "includedItems", "shipsTo", "createdAt", "includesPhysicalProduct", "requiresShipping", popular) VALUES
  ('bbbbbbbb-0001-0000-0000-000000000000', :'proj', 'سِرب · إصدار المؤسسين', 'العبوة الكاملة + اسمك ضمن مؤسسي الإصدار', 220000, NULL, 47, '2026-12-15'::timestamp, 1, true,
   '[{"nameAr":"درون سِرب","qty":1},{"nameAr":"بطارية إضافية","qty":1},{"nameAr":"حقيبة محمولة","qty":1}]'::jsonb,
   ARRAY['SA','AE','KW','QA','BH','OM'], now(), true, true, true),
  ('bbbbbbbb-0002-0000-0000-000000000000', :'proj', 'سِرب · الإصدار المحدود', 'فقط ٥٠ قطعة باللون الكحلي مع نقش رقم تسلسلي', 320000, 50, 12, '2026-12-15'::timestamp, 2, false,
   '[{"nameAr":"درون سِرب كحلي","qty":1},{"nameAr":"شهادة رقم تسلسلي","qty":1}]'::jsonb,
   ARRAY['SA'], now(), true, true, false)
ON CONFLICT (id) DO NOTHING;

-- FAQ
INSERT INTO "FaqItem" (id, "projectId", "questionAr", "answerAr", "sortOrder", "createdAt", "updatedAt") VALUES
  ('cccccccc-0001-0000-0000-000000000000', :'proj', 'متى راح يصل المنتج؟', 'إن شاء الله نهاية ٢٠٢٦ — جدولنا الزمني في تبويب «الشفافية».', 0, now(), now()),
  ('cccccccc-0002-0000-0000-000000000000', :'proj', 'هل في ضمان؟', 'نعم — ضمان سنتين على المحرّك والبطارية.', 1, now(), now()),
  ('cccccccc-0003-0000-0000-000000000000', :'proj', 'مدة الطيران؟', '٤٥ دقيقة عادي، ٢٥ دقيقة في وضع التتبع.', 2, now(), now()),
  ('cccccccc-0004-0000-0000-000000000000', :'proj', 'يشتغل في الصحراء؟', 'مصمَّم للظروف القاسية: حرارة حتى ٥٥°م، مقاومة غبار IP54.', 3, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Updates
INSERT INTO "ProjectUpdate" (id, "projectId", "titleAr", "bodyAr", "orderNum", "likeCount", "commentCount", date) VALUES
  ('dddddddd-0001-0000-0000-000000000000', :'proj', 'تحديث #١ — تجربة الطيران الأولى', 'الحمدلله طار سِرب لأول مرة فوق الدرعية! شاركونا حماسكم.', 1, 87, 12, now() - interval '14 days'),
  ('dddddddd-0002-0000-0000-000000000000', :'proj', 'تحديث #٢ — وصول البطاريات', 'وصلت دفعة البطاريات من كوريا. كل بطارية تتجاوز اختبار ١٥ دورة شحن.', 2, 54, 8, now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

-- Comments
INSERT INTO "Comment" (id, "projectId", "userId", "bodyAr", "isCreator", pinned, "pinnedAt", hidden, "likeCount", date) VALUES
  ('eeeeeeee-0001-0000-0000-000000000000', :'proj', :'creator',
   'شكراً لكل اللي دعمنا 🙏 — وصلنا أعلى نسبة ممكنة قبل ٤ شهور. استعدوا لجولة «علّق واربح» يوم الخميس.',
   true, true, now() - interval '2 days', false, 64, now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- Contest
INSERT INTO "Contest" (id, "projectId", "roundNum", "promptAr", "prizeRewardTierId", "winnersCount", status, "startsAt", "endsAt", "announcedAt", "createdAt", "updatedAt")
VALUES (
  'ffffffff-0001-0000-0000-000000000000', :'proj', 1,
  'وش أكثر مكان تحلم تصوّره بسِرب؟ علّق وادخل السحب!',
  'bbbbbbbb-0001-0000-0000-000000000000', 1, 'ANNOUNCED'::"ContestStatus",
  now() - interval '10 days', now() - interval '3 days', now() - interval '2 days', now() - interval '10 days', now() - interval '2 days'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO "ContestWinner" (id, "contestId", "backerId", "backerNo", "createdAt")
SELECT gen_random_uuid(), 'ffffffff-0001-0000-0000-000000000000', :'creator', 42, now() - interval '2 days'
WHERE NOT EXISTS (SELECT 1 FROM "ContestWinner" WHERE "contestId" = 'ffffffff-0001-0000-0000-000000000000');

-- Community stats
INSERT INTO "CommunityStat" (id, "projectId", scope, key, backers) VALUES
  (gen_random_uuid(), :'proj', 'CITY'::"CommunityStatScope", 'الرياض', 412),
  (gen_random_uuid(), :'proj', 'CITY'::"CommunityStatScope", 'جدة', 287),
  (gen_random_uuid(), :'proj', 'CITY'::"CommunityStatScope", 'الدمام', 156),
  (gen_random_uuid(), :'proj', 'CITY'::"CommunityStatScope", 'مكة', 98),
  (gen_random_uuid(), :'proj', 'CITY'::"CommunityStatScope", 'أبها', 67),
  (gen_random_uuid(), :'proj', 'COUNTRY'::"CommunityStatScope", 'SA', 1020),
  (gen_random_uuid(), :'proj', 'COUNTRY'::"CommunityStatScope", 'AE', 78),
  (gen_random_uuid(), :'proj', 'COUNTRY'::"CommunityStatScope", 'KW', 24),
  (gen_random_uuid(), :'proj', 'COUNTRY'::"CommunityStatScope", 'QA', 16),
  (gen_random_uuid(), :'proj', 'TOTALS'::"CommunityStatScope", 'TOTAL', 1138),
  (gen_random_uuid(), :'proj', 'TOTALS'::"CommunityStatScope", 'NEW', 892),
  (gen_random_uuid(), :'proj', 'TOTALS'::"CommunityStatScope", 'RETURNING', 246)
ON CONFLICT ("projectId", scope, key) DO UPDATE SET backers = EXCLUDED.backers;

SELECT 'seed-done' AS result;
