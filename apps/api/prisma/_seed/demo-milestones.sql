-- Seed milestones + spend logs into both demo projects so Transparency renders.
\set proj1 '6fff784b-21b0-4249-b254-384e96612e68'
\set proj2 '22222222-2222-2222-2222-222222222222'

-- ── Milestones ─────────────────────────────────────────────────────────────
-- 4 milestones each: 1 RELEASED, 1 APPROVED, 1 SUBMITTED, 1 PENDING — releasePct sums to 100.

DO $$
DECLARE pids uuid[] := ARRAY[
  '6fff784b-21b0-4249-b254-384e96612e68'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid];
DECLARE pid uuid;
BEGIN
  FOREACH pid IN ARRAY pids
  LOOP
    -- M1 — RELEASED
    INSERT INTO "Milestone" (id, "projectId", "order", "titleAr", "releasePct", "evidenceRequired", status, "releasedHalalas", "submittedAt", "approvedAt", "releasedAt", "evidenceUrl")
    SELECT gen_random_uuid(), pid, 1, 'تجهيز خط الإنتاج الأول', 30, 'صور المصنع + عقد المُورِّد',
      'RELEASED'::"MilestoneStatus", 20526000, now() - interval '30 days', now() - interval '25 days', now() - interval '20 days',
      'https://example.sa/evidence/m1-factory-line.pdf'
    WHERE NOT EXISTS (SELECT 1 FROM "Milestone" WHERE "projectId"=pid AND "order"=1);

    -- M2 — APPROVED (awaiting release)
    INSERT INTO "Milestone" (id, "projectId", "order", "titleAr", "releasePct", "evidenceRequired", status, "releasedHalalas", "submittedAt", "approvedAt", "releasedAt", "evidenceUrl")
    SELECT gen_random_uuid(), pid, 2, 'إنتاج أول دفعة (٢٥٠ وحدة)', 30, 'صور القياس + شهادة الجودة',
      'APPROVED'::"MilestoneStatus", 0, now() - interval '12 days', now() - interval '5 days', NULL,
      'https://example.sa/evidence/m2-qc-report.pdf'
    WHERE NOT EXISTS (SELECT 1 FROM "Milestone" WHERE "projectId"=pid AND "order"=2);

    -- M3 — SUBMITTED
    INSERT INTO "Milestone" (id, "projectId", "order", "titleAr", "releasePct", "evidenceRequired", status, "releasedHalalas", "submittedAt", "approvedAt", "releasedAt", "evidenceUrl")
    SELECT gen_random_uuid(), pid, 3, 'تغليف ومستندات الشحن', 20, 'صور التغليف + بوليصة شحن',
      'SUBMITTED'::"MilestoneStatus", 0, now() - interval '2 days', NULL, NULL,
      'https://example.sa/evidence/m3-packing.pdf'
    WHERE NOT EXISTS (SELECT 1 FROM "Milestone" WHERE "projectId"=pid AND "order"=3);

    -- M4 — PENDING
    INSERT INTO "Milestone" (id, "projectId", "order", "titleAr", "releasePct", "evidenceRequired", status, "releasedHalalas", "submittedAt", "approvedAt", "releasedAt", "evidenceUrl")
    SELECT gen_random_uuid(), pid, 4, 'تسليم الدُفعة الأولى للداعمين', 20, 'إيصالات التوصيل من شركة الشحن',
      'PENDING'::"MilestoneStatus", 0, NULL, NULL, NULL, NULL
    WHERE NOT EXISTS (SELECT 1 FROM "Milestone" WHERE "projectId"=pid AND "order"=4);
  END LOOP;
END $$;

-- ── Spend logs (tied to RELEASED milestone) ─────────────────────────────────
INSERT INTO "SpendLog" (id, "projectId", "milestoneId", "amountHalalas", "descAr", date, "proofUrl")
SELECT gen_random_uuid(), m."projectId", m.id, 8500000,
  'دفعة أولى للمصنع — تجهيز قوالب الإنتاج', now() - interval '18 days',
  'https://example.sa/proof/invoice-1.pdf'
FROM "Milestone" m
WHERE m."order"=1 AND m.status='RELEASED'
  AND NOT EXISTS (SELECT 1 FROM "SpendLog" WHERE "milestoneId"=m.id AND "descAr" LIKE 'دفعة أولى%');

INSERT INTO "SpendLog" (id, "projectId", "milestoneId", "amountHalalas", "descAr", date, "proofUrl")
SELECT gen_random_uuid(), m."projectId", m.id, 6200000,
  'مواد خام — شريحة الكاميرا والمستشعرات', now() - interval '15 days',
  'https://example.sa/proof/invoice-2.pdf'
FROM "Milestone" m
WHERE m."order"=1 AND m.status='RELEASED'
  AND NOT EXISTS (SELECT 1 FROM "SpendLog" WHERE "milestoneId"=m.id AND "descAr" LIKE 'مواد خام%');

INSERT INTO "SpendLog" (id, "projectId", "milestoneId", "amountHalalas", "descAr", date, "proofUrl")
SELECT gen_random_uuid(), m."projectId", m.id, 5826000,
  'رواتب الفريق — شهر يونيو', now() - interval '10 days',
  'https://example.sa/proof/payroll-jun.pdf'
FROM "Milestone" m
WHERE m."order"=1 AND m.status='RELEASED'
  AND NOT EXISTS (SELECT 1 FROM "SpendLog" WHERE "milestoneId"=m.id AND "descAr" LIKE 'رواتب%');

SELECT 'milestones-done' AS result,
  (SELECT COUNT(*) FROM "Milestone" WHERE "projectId"=:'proj1') AS p1_m,
  (SELECT COUNT(*) FROM "Milestone" WHERE "projectId"=:'proj2') AS p2_m,
  (SELECT COUNT(*) FROM "SpendLog" WHERE "projectId"=:'proj1') AS p1_s,
  (SELECT COUNT(*) FROM "SpendLog" WHERE "projectId"=:'proj2') AS p2_s;
