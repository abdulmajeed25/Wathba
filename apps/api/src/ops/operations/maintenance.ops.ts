import { FaqQuestionStatus, type Prisma } from '@prisma/client';
import { z } from 'zod';

import type { OperationDef } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';

/**
 * Batch OPS-PRO Phase 1 — content-misc & DBA maintenance (STANDARD).
 *
 *  · faq.question.hide — moderating a user-submitted question. The public
 *    read paths already exclude HIDDEN, so flipping the status is the whole
 *    action (no new filter needed).
 *
 *  · search.reindex — TRUTHFUL SCOPE. Project.searchVector is a Postgres
 *    GENERATED ALWAYS column: the tsvector is ALWAYS current, there is no
 *    data to rebuild. What CAN degrade is GIN-index bloat, so this op is pure
 *    index maintenance: REINDEX INDEX CONCURRENTLY on the two search GIN
 *    indexes. REINDEX CONCURRENTLY cannot run inside a transaction block, so
 *    the op is `orchestrated: true` — the registry runs orchestrated execute
 *    on the RAW prisma client, OUTSIDE its $transaction (see
 *    operations.registry.ts executeOrchestrated: `op.execute(this.prisma, …)`),
 *    which is exactly the non-transactional context CONCURRENTLY requires.
 *
 *  · notifications.resend (OPS-360 Unit 6) — the notifications-inspector
 *    re-deliver seat: re-emits an existing notification (same kind + payload)
 *    to its owner via the notifications outbox. Support-desk action
 *    (support.tickets); needs the notifications dep.
 */

export interface MaintenanceOpsDeps {
  prisma: PrismaService;
  // OPS-360 Unit 6 — notifications.resend re-delivers an existing notification
  // through the notifications outbox. Wired by the coordinator from
  // NotificationsModule (already imported by ops.module.ts; see report).
  notifications: NotificationsService;
}

/** ops.module.ts wires the real deps at boot; a bare call fails loudly. */
const UNWIRED_DEPS = new Proxy(
  {},
  {
    get(_t, prop) {
      throw new Error(`maintenanceOps deps not wired yet (accessed .${String(prop)})`);
    },
  },
) as MaintenanceOpsDeps;

/** The two GIN indexes backing project search (defined in
 *  prisma/_raw/searchVector.sql). REINDEX target names are quoted verbatim. */
const SEARCH_INDEXES = ['Project_searchVector_gin', 'Project_titleAr_trgm'] as const;

export function maintenanceOps(
  deps: MaintenanceOpsDeps = UNWIRED_DEPS,
): Array<OperationDef<never, unknown>> {
  /* ── faq.question.hide ─────────────────────────────────────────────── */
  const hideInput = z.object({ questionId: z.string().uuid() });

  const faqQuestionHide: OperationDef<
    z.infer<typeof hideInput>,
    { id: string; status: string }
  > = {
    key: 'faq.question.hide',
    titleAr: 'إخفاء سؤال شائع',
    descriptionAr:
      'إشراف على الأسئلة المُرسلة من المستخدمين: يخفي سؤالاً (→HIDDEN). قراءات الواجهة تستثني HIDDEN أصلاً، فتغيير الحالة هو الإجراء كاملاً. قابل للعكس بإعادة الحالة لاحقاً.',
    inputSchema: hideInput,
    permission: 'moderation.queue',
    riskTier: 'STANDARD',
    reversible: true,
    requiresReason: false,
    preconditions: [
      {
        code: 'question-missing',
        reasonAr: 'السؤال غير موجود',
        check: async (db, input) =>
          !!(await db.faqQuestion.findUnique({
            where: { id: input.questionId },
            select: { id: true },
          })),
      },
      {
        code: 'already-hidden',
        reasonAr: 'السؤال مخفيّ أصلاً',
        check: async (db, input) => {
          const q = await db.faqQuestion.findUnique({
            where: { id: input.questionId },
            select: { status: true },
          });
          return q?.status !== FaqQuestionStatus.HIDDEN;
        },
      },
    ],
    async dryRun(db, input) {
      const q = await db.faqQuestion.findUnique({
        where: { id: input.questionId },
        select: { status: true },
      });
      return {
        summaryAr: 'سيُخفى السؤال من كل القراءات العامة',
        before: { status: q?.status ?? null },
        after: { status: FaqQuestionStatus.HIDDEN },
      };
    },
    async execute(tx, input) {
      const updated = await tx.faqQuestion.update({
        where: { id: input.questionId },
        data: { status: FaqQuestionStatus.HIDDEN },
      });
      return { id: updated.id, status: updated.status };
    },
  };

  /* ── search.reindex ────────────────────────────────────────────────── */
  const reindexInput = z.object({});

  const searchReindex: OperationDef<
    Record<string, never>,
    { reindexed: string[] }
  > = {
    key: 'search.reindex',
    titleAr: 'صيانة فهارس البحث',
    descriptionAr:
      'صيانة فهارس (DBA)، لا إعادة بناء بيانات: عمود Project.searchVector مولَّد دائماً (GENERATED ALWAYS) فالـtsvector محدَّث أبداً ولا شيء يُعاد حسابه. تُعاد فهرسة فهرسي البحث (Project_searchVector_gin وProject_titleAr_trgm) بأسلوب CONCURRENTLY لمعالجة تضخّم GIN دون قفل الجدول للقرّاء.',
    inputSchema: reindexInput as z.ZodType<Record<string, never>>,
    permission: 'settings.write',
    riskTier: 'STANDARD',
    reversible: true,
    requiresReason: false,
    // REINDEX CONCURRENTLY must run OUTSIDE a transaction — orchestrated
    // execute runs on the raw client, not inside the registry's $transaction.
    orchestrated: true,
    preconditions: [],
    async dryRun() {
      return {
        summaryAr: `ستُعاد فهرسة ${SEARCH_INDEXES.length} فهرساً (${SEARCH_INDEXES.join('، ')}) — صيانة فقط، لا تغيير بيانات`,
        before: null,
        after: { reindexed: [...SEARCH_INDEXES] },
        counts: { indexes: SEARCH_INDEXES.length },
      };
    },
    async execute() {
      // One standalone command per index (each REINDEX CONCURRENTLY is its own
      // non-transactional statement). Index names are a fixed allow-list —
      // never interpolated from input — so the unsafe raw call carries no
      // injection surface.
      for (const idx of SEARCH_INDEXES) {
        await deps.prisma.$executeRawUnsafe(`REINDEX INDEX CONCURRENTLY "${idx}"`);
      }
      return { reindexed: [...SEARCH_INDEXES] };
    },
  };

  /* ── notifications.resend (OPS-360 Unit 6) ─────────────────────────── */
  // Census A7 / A2: the notifications inspector can VIEW a notification but not
  // re-deliver it. This gives support the missing verb — re-emit a prior
  // notice (e.g. a missed payout or verification notification) to the same
  // user. Truthful minimal re-deliver: a NEW row with the SAME kind + payload
  // via the notifications outbox; the original is never mutated.
  const resendInput = z.object({ notificationId: z.string().uuid() });

  const notificationsResend: OperationDef<
    z.infer<typeof resendInput>,
    { resent: boolean; notificationId: string | null; kind: string }
  > = {
    key: 'notifications.resend',
    titleAr: 'إعادة إرسال إشعار لمستخدم',
    descriptionAr:
      'مقعد مفتّش الإشعارات المفقود: كان بالإمكان عرض الإشعار دون إعادة تسليمه. يُعيد تسليم إشعار سابق إلى صاحبه نفسه (كإشعار صرف أو توثيق فاته) بإنشاء صف إشعار جديد بنفس النوع والحمولة عبر خدمة الإشعارات — لا يُمسّ الأصل. أنواع التفاعل (تحديثات/تعليقات) تحترم اختيار المستخدم في التلقّي، بينما إشعارات المال والحساب تصل دائماً.',
    inputSchema: resendInput,
    // Support-desk action (OPS-360 Unit 6 decision): support.tickets.
    permission: 'support.tickets',
    riskTier: 'STANDARD',
    reversible: false,
    requiresReason: true,
    preconditions: [
      {
        code: 'notification-missing',
        reasonAr: 'الإشعار غير موجود',
        check: async (db, input) =>
          !!(await db.notification.findUnique({
            where: { id: input.notificationId },
            select: { id: true },
          })),
      },
    ],
    async dryRun(db, input) {
      const n = await db.notification.findUnique({
        where: { id: input.notificationId },
        select: { userId: true, kind: true, createdAt: true },
      });
      return {
        summaryAr: `سيُعاد تسليم إشعار من نوع «${n?.kind ?? '—'}» إلى المستخدم نفسه (صف جديد بنفس الحمولة، والأصل لا يُمسّ)`,
        before: { originalCreatedAt: n?.createdAt?.toISOString() ?? null },
        after: { willCreate: 1, kind: n?.kind ?? null, userId: n?.userId ?? null },
        counts: { notificationsToCreate: 1 },
      };
    },
    async execute(tx, input) {
      const original = await tx.notification.findUniqueOrThrow({
        where: { id: input.notificationId },
        select: { userId: true, kind: true, payload: true },
      });
      // Re-deliver through the outbox on the registry's tx (commits atomically
      // with the audit row). No dedupKey → never collides with the original's
      // UNIQUE key. create() returns null when an engagement kind is opted out
      // by the recipient — that opt-out is honored, and the result records it.
      const created = await deps.notifications.create({
        userId: original.userId,
        kind: original.kind,
        payload: (original.payload ?? {}) as Prisma.InputJsonValue,
        tx,
      });
      return {
        resent: created != null,
        notificationId: created?.id ?? null,
        kind: original.kind,
      };
    },
  };

  return [faqQuestionHide, searchReindex, notificationsResend] as unknown as Array<
    OperationDef<never, unknown>
  >;
}
