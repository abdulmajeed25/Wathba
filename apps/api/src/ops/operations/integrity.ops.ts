import { LedgerEntryType } from '@prisma/client';
import { z } from 'zod';

import type { OperationDef } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { WebhookService } from '../../escrow-payments/webhook.service';
import type { LedgerService } from '../../escrow-payments/ledger.service';

/**
 * Batch OPS-PRO Phase 1 — OPS-INTEGRITY group: the two money-integrity
 * repair operations. Both touch money truth, so both carry `money.execute`,
 * force a written reason, and are `orchestrated` — they delegate to a domain
 * service that owns its own side effects (the webhook FSM / the append-only
 * ledger writer), so the registry claims idempotency + audit atomically
 * BEFORE the service runs.
 *
 *  · webhooks.replay        — re-run a STORED webhook event through the FSM,
 *                             healing an event that arrived against the wrong
 *                             pledge state (outcome 'mismatch').
 *  · money.ledger.backfill  — evidence-gated INSERT-ONLY correction of a real
 *                             journal gap (record() swallows write failures).
 */

export interface IntegrityOpsDeps {
  prisma: PrismaService;
  webhook: WebhookService;
  ledger: LedgerService;
}

export function integrityOps(deps: IntegrityOpsDeps): Array<OperationDef<never, unknown>> {
  /* ── webhooks.replay (SENSITIVE — re-drives the FSM, no new money) ───── */
  const replayInput = z.object({ webhookEventId: z.string().uuid() });

  const webhooksReplay: OperationDef<
    z.infer<typeof replayInput>,
    { outcome: string }
  > = {
    key: 'webhooks.replay',
    titleAr: 'إعادة تشغيل حدث ويبهوك مخزّن',
    descriptionAr:
      'يعيد تمرير حدث ويبهوك مخزّن عبر آلة حالة التعهد دون ادعاء منع التكرار (إعادة التسليم العادية تُرجع «مكرر» فقط). الغرض: أحداث وصلت بينما كان التعهد في حالة خاطئة (النتيجة «mismatch») وصارت الآن قابلة للتطبيق. التطبيق idempotent عبر حرّاس الحالة، فإعادة التشغيل آمنة ولا تُكرّر أي قطف. لا يُخزَّن سوى أحداث مُيسّر — فلا شيء لإعادته لغير ذلك.',
    inputSchema: replayInput,
    permission: 'money.execute',
    riskTier: 'SENSITIVE',
    reversible: true,
    requiresReason: true,
    orchestrated: true,
    preconditions: [
      {
        code: 'event-missing',
        reasonAr: 'حدث الويبهوك غير موجود',
        check: async (db, input) =>
          !!(await db.webhookEvent.findUnique({
            where: { id: input.webhookEventId },
            select: { id: true },
          })),
      },
      {
        code: 'not-replayable',
        reasonAr: 'يمكن إعادة تشغيل أحداث مُيسّر المخزّنة فقط — تعهدات التقسيط (BNPL) لا تُخزَّن كأحداث ويبهوك',
        check: async (db, input) => {
          const ev = await db.webhookEvent.findUnique({
            where: { id: input.webhookEventId },
            select: { provider: true },
          });
          return ev?.provider === 'moyasar';
        },
      },
    ],
    async dryRun(db, input) {
      const ev = await db.webhookEvent.findUnique({ where: { id: input.webhookEventId } });
      if (!ev) return { summaryAr: 'حدث الويبهوك غير موجود', before: null, after: null };
      // What apply() would target: the pledge carrying this payment ref, and
      // its current FSM status — WITHOUT invoking apply() (dryRun is pure).
      const pledge = ev.pspRef
        ? await db.pledge.findFirst({
            where: { paymentRef: ev.pspRef },
            select: { id: true, status: true },
          })
        : null;
      return {
        summaryAr: `سيُعاد تطبيق حدث «${ev.eventType}» (مرجع الدفع ${ev.pspRef || '—'}, النتيجة الحالية ${ev.outcome ?? 'لم يُعالَج'}) على التعهد ${pledge ? `${pledge.id} في حالة ${pledge.status}` : 'غير الموجود (سيبقى mismatch)'}`,
        before: {
          eventType: ev.eventType,
          pspRef: ev.pspRef,
          currentOutcome: ev.outcome ?? null,
          targetPledgeStatus: pledge?.status ?? null,
        },
        after: {
          targetPledgeId: pledge?.id ?? null,
          note: 'إعادة التطبيق ستُحدّث outcome/processedAt على نفس الصف',
        },
      };
    },
    async execute(_db, input) {
      // Orchestrated: replayStored loads the row, re-invokes the (private,
      // in-class) apply FSM directly and re-stamps outcome/processedAt.
      return deps.webhook.replayStored(input.webhookEventId);
    },
  };

  /* ── money.ledger.backfill (MONEY — INSERT-ONLY journal repair) ──────── */
  const backfillInput = z
    .object({
      pledgeId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
      entryType: z.nativeEnum(LedgerEntryType),
      // BigInt-as-string; may be negative for a correcting reversal.
      amountHalalas: z.string().regex(/^-?\d+$/),
      pspRef: z.string().min(3),
      evidenceUrl: z.string().url(),
      noteAr: z.string().min(10),
    })
    .refine((v) => !!v.pledgeId || !!v.projectId, {
      message: 'يجب تحديد pledgeId أو projectId على الأقل',
    });
  type BackfillInput = z.infer<typeof backfillInput>;

  const ledgerBackfill: OperationDef<BackfillInput, { id: string }> = {
    key: 'money.ledger.backfill',
    titleAr: 'ترميم قيد دفتر مفقود (إدراج فقط)',
    descriptionAr:
      'تصحيح مدعوم بدليل لفجوة في دفتر المال: record() لا يرمي استثناءً أبداً، فالفجوات حقيقية. يُدرج قيد LedgerEntry واحداً (المصدر ops-backfill) — للصفوف المفقودة فقط، لا لتعديل قائم. الدفتر أحادي الاتجاه (لا تعديل/حذف) وبلا حقل ملاحظات، لذا لا يعيش أثر الدليل على الصف: يعيش في سجل التدقيق الذي تكتبه السجلّة لكل تنفيذ (evidenceUrl وnoteAr ضمن مدخلات العملية المُخزَّنة والمُجزَّأة هناك). غير قابل للعكس — لا يمكن حذف قيد دفتر.',
    inputSchema: backfillInput as unknown as z.ZodType<BackfillInput>,
    permission: 'money.execute',
    riskTier: 'MONEY',
    reversible: false,
    requiresReason: true,
    orchestrated: true,
    preconditions: [
      {
        code: 'pledge-missing',
        reasonAr: 'التعهد غير موجود',
        check: async (db, input) => {
          if (!input.pledgeId) return true;
          return !!(await db.pledge.findUnique({
            where: { id: input.pledgeId },
            select: { id: true },
          }));
        },
      },
      {
        code: 'project-missing',
        reasonAr: 'المشروع غير موجود',
        check: async (db, input) => {
          if (!input.projectId) return true;
          return !!(await db.project.findUnique({
            where: { id: input.projectId },
            select: { id: true },
          }));
        },
      },
      {
        code: 'duplicate-entry',
        reasonAr: 'يوجد قيد دفتر بنفس مرجع الدفع والنوع بالفعل — الترميم للصفوف المفقودة فقط',
        check: async (db, input) =>
          !(await db.ledgerEntry.findFirst({
            where: { pspRef: input.pspRef, entryType: input.entryType },
            select: { id: true },
          })),
      },
    ],
    async dryRun(db, input) {
      const dup = await db.ledgerEntry.findFirst({
        where: { pspRef: input.pspRef, entryType: input.entryType },
        select: { id: true },
      });
      return {
        summaryAr: `سيُدرج قيد ${input.entryType} بمبلغ ${input.amountHalalas} هللة (مرجع ${input.pspRef}) — ${dup ? 'تحذير: قيد مطابق موجود' : 'لا قيد مطابق'}. الدليل يُحفظ في سجل التدقيق.`,
        before: { existingMatchingEntry: dup ? dup.id : null },
        after: {
          entryType: input.entryType,
          amountHalalas: input.amountHalalas,
          pspRef: input.pspRef,
          pledgeId: input.pledgeId ?? null,
          projectId: input.projectId ?? null,
          source: 'ops-backfill',
        },
        monetaryDeltasHalalas: { ledgerEntry: input.amountHalalas },
      };
    },
    async execute(_db, input) {
      // Orchestrated: LedgerService.backfill owns the INSERT (append-only —
      // never update/delete). It THROWS on failure so the claim is FAILED.
      return deps.ledger.backfill({
        entryType: input.entryType,
        amountHalalas: BigInt(input.amountHalalas),
        pspRef: input.pspRef,
        pledgeId: input.pledgeId,
        projectId: input.projectId,
      });
    },
  };

  return [webhooksReplay, ledgerBackfill] as unknown as Array<OperationDef<never, unknown>>;
}
