import { z } from 'zod';

import type { OperationDef } from '../operation.types';

/**
 * OPS Part 0 — trust & safety operations (STANDARD tier). Both actions now
 * carry the operator's written reason into the audit row — the census found
 * every comment-hide was a note-less, actor-less state change.
 */

const moderateInput = z.object({
  commentId: z.string().uuid(),
  action: z.enum(['hide', 'dismiss']),
});

const commentModerate: OperationDef<
  z.infer<typeof moderateInput>,
  { ok: true; action: string }
> = {
  key: 'moderation.comment.moderate',
  titleAr: 'معالجة تعليق مُبلَّغ عنه',
  descriptionAr:
    'hide: يخفي نص التعليق علنياً مع بقاء السجل · dismiss: يمسح البلاغات ويُبقي التعليق ظاهراً.',
  inputSchema: moderateInput,
  permission: 'moderation.queue',
  riskTier: 'STANDARD',
  reversible: true,
  compensatingKey: 'moderation.comment.moderate',
  // The census flagged note-less hides; the free-text note field arrives
  // with the Part-5 moderation screen — until then the reason is optional
  // (the audit row still records actor + action + any reason sent).
  requiresReason: false,
  preconditions: [
    {
      code: 'comment-missing',
      reasonAr: 'التعليق غير موجود',
      check: async (db, input) =>
        !!(await db.comment.findUnique({ where: { id: input.commentId }, select: { id: true } })),
    },
  ],
  async dryRun(db, input) {
    const c = await db.comment.findUnique({
      where: { id: input.commentId },
      select: { hidden: true, reportCount: true, bodyAr: true },
    });
    return {
      summaryAr:
        input.action === 'hide'
          ? 'سيُخفى نص التعليق علنياً (يبقى السجل)'
          : `ستُمسح ${c?.reportCount ?? 0} بلاغات ويبقى التعليق ظاهراً`,
      before: { hidden: c?.hidden ?? null, reportCount: c?.reportCount ?? null },
      after:
        input.action === 'hide'
          ? { hidden: true, reportCount: c?.reportCount ?? 0 }
          : { hidden: c?.hidden ?? false, reportCount: 0 },
    };
  },
  async execute(tx, input) {
    if (input.action === 'hide') {
      await tx.comment.update({ where: { id: input.commentId }, data: { hidden: true } });
    } else {
      await tx.commentReport.deleteMany({ where: { commentId: input.commentId } });
      await tx.comment.update({ where: { id: input.commentId }, data: { reportCount: 0 } });
    }
    return { ok: true as const, action: input.action };
  },
};

const dismissInput = z.object({ projectId: z.string().uuid() });

const projectReportsDismiss: OperationDef<
  z.infer<typeof dismissInput>,
  { ok: true; resolved: number }
> = {
  key: 'moderation.project-reports.dismiss',
  titleAr: 'صرف بلاغات مشروع',
  descriptionAr: 'يعلّم كل البلاغات المفتوحة على المشروع كمُعالجة (تبقى للسجل عبر resolvedAt).',
  inputSchema: dismissInput,
  permission: 'moderation.queue',
  riskTier: 'STANDARD',
  reversible: false,
  requiresReason: false,
  preconditions: [
    {
      code: 'no-open-reports',
      reasonAr: 'لا توجد بلاغات مفتوحة على هذا المشروع',
      check: async (db, input) =>
        (await db.projectReport.count({ where: { projectId: input.projectId, resolvedAt: null } })) > 0,
    },
  ],
  async dryRun(db, input) {
    const open = await db.projectReport.count({
      where: { projectId: input.projectId, resolvedAt: null },
    });
    return {
      summaryAr: `ستُصرف ${open} بلاغات مفتوحة (تبقى في السجل)`,
      before: { openReports: open },
      after: { openReports: 0 },
      counts: { resolved: open },
    };
  },
  async execute(tx, input) {
    const { count } = await tx.projectReport.updateMany({
      where: { projectId: input.projectId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    return { ok: true as const, resolved: count };
  },
};

export function moderationOps(): Array<OperationDef<never, unknown>> {
  return [commentModerate, projectReportsDismiss] as unknown as Array<OperationDef<never, unknown>>;
}
