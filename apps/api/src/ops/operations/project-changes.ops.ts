import { ConflictException } from '@nestjs/common';
import { z } from 'zod';
import { campaignTerms } from '../../projects/project-changes.service';
import { affectedPledgeStatuses, consentTermsCurrent } from '../../projects/change-consent.service';
import type { OperationDef } from '../operation.types';

/** Review records an intent only. Applying terms requires a separate consent-aware operation. */
export function projectChangesOps(): Array<OperationDef<never, unknown>> {
  const schema = z.object({ projectId: z.string().uuid(), requestId: z.string().uuid(), decision: z.enum(['accept', 'reject']), noteAr: z.string().trim().min(10).max(4000) });
  const op: OperationDef<z.infer<typeof schema>, { id: string; status: string }> = {
    key: 'projects.changes.review',
    titleAr: 'مراجعة طلب تغيير شروط حملة',
    descriptionAr: 'قبول مبدئي لتجهيز التغيير أو رفضه مع رد لصاحب الحملة. لا يغيّر الهدف أو الموعد ولا ينوب عن موافقات الداعمين.',
    inputSchema: schema, permission: 'projects.review', riskTier: 'SENSITIVE', reversible: false, requiresReason: true,
    preconditions: [{
      code: 'not-reviewable', reasonAr: 'الطلب غير معلق أو مقدم الطلب هو المراجع نفسه',
      check: async (db, input, ctx) => {
        const row = await db.projectChangeRequest.findUnique({ where: { id: input.requestId } });
        return !!row && row.projectId === input.projectId && row.status === 'SUBMITTED' && row.requestedById !== ctx.actor.id;
      },
    }, {
      code: 'terms-changed', reasonAr: 'تغيرت شروط الحملة أو انتهت؛ اطلب مقترحًا جديدًا بدل اعتماد معاينة قديمة',
      check: async (db, input) => {
        if (input.decision === 'reject') return true;
        const row = await db.projectChangeRequest.findUnique({ where: { id: input.requestId }, include: { project: true } });
        if (!row || !['LIVE', 'PAUSED'].includes(row.project.status)) return false;
        const before = row.before as Record<string, unknown>;
        return Object.entries(campaignTerms(row.project)).every(([key, value]) => before[key] === value);
      },
    }],
    async dryRun(db, input) {
      const row = await db.projectChangeRequest.findUniqueOrThrow({ where: { id: input.requestId }, include: { project: true } });
      return {
        summaryAr: input.decision === 'accept' ? 'سيقبل المقترح مبدئيًا للتجهيز فقط. التطبيق غير متاح حتى استكمال موافقات المتأثرين وجاهزية التنفيذ.' : 'سيرفض المقترح مع إظهار الملاحظات لصاحب الحملة.',
        before: { status: row.status, campaignTerms: row.before },
        after: { status: input.decision === 'accept' ? 'ACCEPTED_FOR_PREPARATION' : 'REJECTED', proposed: row.proposed, campaignUnchanged: true },
        counts: { currentBackers: row.project.backersCount },
      };
    },
    async execute(tx, input, ctx) {
      const status = input.decision === 'accept' ? 'ACCEPTED_FOR_PREPARATION' : 'REJECTED';
      const result = await tx.projectChangeRequest.updateMany({
        where: { id: input.requestId, projectId: input.projectId, status: 'SUBMITTED', requestedById: { not: ctx.actor.id } },
        data: { status, reviewedById: ctx.actor.id, reviewedAt: new Date(), reviewNoteAr: input.noteAr },
      });
      if (!result.count) throw new ConflictException('تغيرت حالة الطلب؛ أعد المعاينة');
      return { id: input.requestId, status };
    },
  };
  const openSchema = z.object({ projectId: z.string().uuid(), requestId: z.string().uuid() });
  const open: OperationDef<z.infer<typeof openSchema>, { id: string; status: string }> = {
    key: 'projects.changes.open-consent', titleAr: 'فتح الرد الفردي للداعمين',
    descriptionAr: 'عرض المقترح الموافق عليه مبدئيًا على أصحاب التعهدات. لا تطبق الموافقات أي تغيير ولا يعد عدم الرد موافقة.',
    inputSchema: openSchema, permission: 'projects.review', riskTier: 'SENSITIVE', reversible: false, requiresReason: true,
    preconditions: [{ code: 'consent-not-ready', reasonAr: 'الطلب غير معتمد مبدئيًا أو تغيرت الشروط أو انتهت الحملة أو مقدم الطلب هو المراجع نفسه',
      check: async (db, input, ctx) => {
        const row = await db.projectChangeRequest.findUnique({ where: { id: input.requestId }, include: { project: true } });
        return !!row && row.projectId === input.projectId && row.status === 'ACCEPTED_FOR_PREPARATION'
          && row.requestedById !== ctx.actor.id && consentTermsCurrent(row, row.project);
      },
    }],
    async dryRun(db, input) {
      const row = await db.projectChangeRequest.findUniqueOrThrow({ where: { id: input.requestId } });
      return { summaryAr: 'سيفتح الرد الفردي لكل تعهد مؤهل. لا يغير الرفض أو عدم الرد حقوق الداعم، ولا تتحرك أموال.',
        before: { status: row.status, terms: row.before }, after: { status: 'CONSENT_OPEN', proposed: row.proposed, campaignUnchanged: true },
        counts: { eligiblePledges: await db.pledge.count({ where: { projectId: input.projectId, status: { in: affectedPledgeStatuses } } }) } };
    },
    async execute(tx, input, ctx) {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${input.projectId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "ProjectChangeRequest" WHERE "id" = ${input.requestId}::uuid FOR UPDATE`;
      if (!(await open.preconditions[0]!.check(tx, input, ctx))) throw new ConflictException('تغير الطلب أو شروطه؛ أعد المعاينة');
      await tx.projectChangeRequest.update({ where: { id: input.requestId }, data: { status: 'CONSENT_OPEN', consentOpenedAt: new Date() } });
      return { id: input.requestId, status: 'CONSENT_OPEN' };
    },
  };
  return [op, open] as unknown as Array<OperationDef<never, unknown>>;
}
