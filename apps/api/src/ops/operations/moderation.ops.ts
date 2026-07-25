import { NotificationKind, SuspensionKind } from '@prisma/client';
import { z } from 'zod';

import type { OperationDef } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { EmailService } from '../../email/email.service';

/**
 * OPS Part 0 — trust & safety operations (STANDARD tier). Both actions now
 * carry the operator's written reason into the audit row — the census found
 * every comment-hide was a note-less, actor-less state change.
 *
 * Batch OPS (registry completion) adds the rest of the moderation arsenal:
 * comment unhide (the compensating half of hide), project takedown/restore
 * (hiddenAt — removes a project from every PUBLIC read while the creator and
 * ops keep seeing it), and the permanent ban/unban pair (SENSITIVE —
 * distinct from the administrative users.suspend/reactivate). Ban/unban need
 * post-commit side effects, so the factory now takes a deps object
 * (type-only imports — governance RULE 2).
 */

export interface ModerationOpsDeps {
  prisma: PrismaService;
  notifications: NotificationsService;
  email: EmailService;
}

/** ops.module.ts still calls moderationOps() bare until the coordinator
 *  wires the deps; the pre-existing ops never touch deps, and a ban/unban
 *  afterCommit reached before wiring fails loudly instead of silently
 *  no-oping. */
const UNWIRED_DEPS = new Proxy(
  {},
  {
    get(_t, prop) {
      throw new Error(`moderationOps deps not wired yet (accessed .${String(prop)})`);
    },
  },
) as ModerationOpsDeps;

const moderateInput = z.object({
  commentId: z.string().uuid(),
  action: z.enum(['hide', 'dismiss', 'unhide']),
});

const commentModerate: OperationDef<
  z.infer<typeof moderateInput>,
  { ok: true; action: string }
> = {
  key: 'moderation.comment.moderate',
  titleAr: 'معالجة تعليق مُبلَّغ عنه',
  descriptionAr:
    'hide: يخفي نص التعليق علنياً مع بقاء السجل · dismiss: يمسح البلاغات ويُبقي التعليق ظاهراً · unhide: يعيد إظهار تعليق سبق إخفاؤه.',
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
          : input.action === 'unhide'
            ? 'سيُعاد إظهار نص التعليق علنياً'
            : `ستُعلَّم ${c?.reportCount ?? 0} بلاغات كمُعالجة (تبقى للسجل عبر resolvedAt) ويبقى التعليق ظاهراً`,
      before: { hidden: c?.hidden ?? null, reportCount: c?.reportCount ?? null },
      after:
        input.action === 'hide'
          ? { hidden: true, reportCount: c?.reportCount ?? 0 }
          : input.action === 'unhide'
            ? { hidden: false, reportCount: c?.reportCount ?? 0 }
            : { hidden: c?.hidden ?? false, reportCount: 0 },
    };
  },
  async execute(tx, input) {
    if (input.action === 'hide') {
      await tx.comment.update({ where: { id: input.commentId }, data: { hidden: true } });
    } else if (input.action === 'unhide') {
      await tx.comment.update({ where: { id: input.commentId }, data: { hidden: false } });
    } else {
      // CLOSEOUT C1 — dismissal RESOLVES the reports (keeps them for the
      // record + throughput metrics) instead of hard-deleting them. Mirrors
      // moderation.project-reports.dismiss.
      await tx.commentReport.updateMany({
        where: { commentId: input.commentId, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
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

/* ── Batch OPS (registry completion) — project takedown/restore ─────────── */

const projectRef = z.object({ projectId: z.string().uuid() });

const projectHide: OperationDef<
  z.infer<typeof projectRef>,
  { ok: true; hiddenAt: string }
> = {
  key: 'moderation.project.hide',
  titleAr: 'إخفاء مشروع من العرض العام',
  descriptionAr:
    'إنزال إشرافي: يزيل المشروع من كل القراءات العامة (الاكتشاف، الرئيسية، البحث، خريطة الموقع، صفحة التفاصيل لغير صاحبه) — صاحب المشروع ومركز العمليات يبقيان يريانه. الإخفاء مستقل تماماً عن آلة حالات التمويل: عدّاد الموعد النهائي يواصل العمل ولا تتغير حالة الحملة.',
  inputSchema: projectRef,
  permission: 'moderation.queue',
  riskTier: 'STANDARD',
  reversible: true,
  compensatingKey: 'moderation.project.unhide',
  // A takedown always has a written reason — it is shown to the creator.
  requiresReason: true,
  preconditions: [
    {
      code: 'project-missing',
      reasonAr: 'المشروع غير موجود',
      check: async (db, input) =>
        !!(await db.project.findUnique({ where: { id: input.projectId }, select: { id: true } })),
    },
    {
      code: 'already-hidden',
      reasonAr: 'المشروع مخفيّ أصلاً',
      check: async (db, input) => {
        const p = await db.project.findUnique({
          where: { id: input.projectId },
          select: { hiddenAt: true },
        });
        return p?.hiddenAt == null;
      },
    },
  ],
  async dryRun(db, input) {
    const p = await db.project.findUnique({
      where: { id: input.projectId },
      select: { titleAr: true, hiddenAt: true, status: true },
    });
    return {
      summaryAr: `سيُخفى مشروع «${p?.titleAr ?? input.projectId}» من كل القراءات العامة (يبقى ظاهراً لصاحبه ولمركز العمليات؛ عدّاد الحملة لا يتوقف)`,
      before: { visiblePublicly: true, hiddenAt: null, status: p?.status ?? null },
      after: { visiblePublicly: false, hiddenAt: 'now', status: p?.status ?? null },
    };
  },
  async execute(tx, input, ctx) {
    const now = new Date();
    await tx.project.update({
      where: { id: input.projectId },
      data: { hiddenAt: now, hiddenReasonAr: ctx.reason ?? null },
    });
    return { ok: true as const, hiddenAt: now.toISOString() };
  },
};

const projectUnhide: OperationDef<z.infer<typeof projectRef>, { ok: true }> = {
  key: 'moderation.project.unhide',
  titleAr: 'إعادة إظهار مشروع مخفيّ',
  descriptionAr:
    'يرفع الإنزال الإشرافي: يعيد المشروع إلى كل القراءات العامة ويمسح سبب الإخفاء.',
  inputSchema: projectRef,
  permission: 'moderation.queue',
  riskTier: 'STANDARD',
  reversible: true,
  compensatingKey: 'moderation.project.hide',
  requiresReason: false,
  preconditions: [
    {
      code: 'not-hidden',
      reasonAr: 'المشروع ليس مخفياً — لا شيء يُرفع',
      check: async (db, input) => {
        const p = await db.project.findUnique({
          where: { id: input.projectId },
          select: { hiddenAt: true },
        });
        return p?.hiddenAt != null;
      },
    },
  ],
  async dryRun(db, input) {
    const p = await db.project.findUnique({
      where: { id: input.projectId },
      select: { titleAr: true, hiddenAt: true, hiddenReasonAr: true },
    });
    return {
      summaryAr: `سيُعاد إظهار مشروع «${p?.titleAr ?? input.projectId}» في كل القراءات العامة`,
      before: {
        visiblePublicly: false,
        hiddenAt: p?.hiddenAt?.toISOString() ?? null,
        hiddenReasonAr: p?.hiddenReasonAr ?? null,
      },
      after: { visiblePublicly: true, hiddenAt: null, hiddenReasonAr: null },
    };
  },
  async execute(tx, input) {
    await tx.project.update({
      where: { id: input.projectId },
      data: { hiddenAt: null, hiddenReasonAr: null },
    });
    return { ok: true as const };
  },
};

/* ── Batch OPS (registry completion) — permanent ban/unban ──────────────── */

const userRef = z.object({ userId: z.string().uuid() });

export function moderationOps(
  deps: ModerationOpsDeps = UNWIRED_DEPS,
): Array<OperationDef<never, unknown>> {
  const userBan: OperationDef<
    z.infer<typeof userRef>,
    { bannedAt: string; sessionsRevoked: number }
  > = {
    key: 'moderation.user.ban',
    titleAr: 'حظر مستخدم نهائياً',
    descriptionAr:
      'حظر إشرافي دائم (BANNED): يمنع الدخول فوراً — كل الجلسات النشطة تُلغى في المعاملة نفسها. الإيقاف الإداري المؤقت عمليةُ users.suspend المستقلة، لا هذه؛ ورفع الحظر قرار إشرافي عبر moderation.user.unban.',
    inputSchema: userRef,
    permission: 'moderation.queue',
    riskTier: 'SENSITIVE',
    reversible: true,
    compensatingKey: 'moderation.user.unban',
    requiresReason: true,
    preconditions: [
      {
        code: 'user-missing',
        reasonAr: 'المستخدم غير موجود',
        check: async (db, input) =>
          !!(await db.user.findUnique({ where: { id: input.userId }, select: { id: true } })),
      },
      {
        code: 'already-suspended',
        reasonAr: 'الحساب موقوف أو محظور أصلاً',
        check: async (db, input) => {
          const u = await db.user.findUnique({
            where: { id: input.userId },
            select: { suspendedAt: true },
          });
          return u?.suspendedAt == null;
        },
      },
      {
        code: 'target-is-operator',
        reasonAr:
          'الحساب يحمل دوراً تشغيلياً في مركز العمليات — اسحب أدواره التشغيلية أولاً (users.ops-role.revoke) ثم احظره',
        check: async (db, input) =>
          (await db.opsRoleGrant.count({ where: { userId: input.userId } })) === 0,
      },
    ],
    async dryRun(db, input) {
      const u = await db.user.findUnique({
        where: { id: input.userId },
        select: { name: true, suspendedAt: true, suspendedKind: true },
      });
      const sessions = await db.refreshToken.count({
        where: { userId: input.userId, revokedAt: null },
      });
      return {
        summaryAr: `سيُحظر حساب «${u?.name ?? input.userId}» نهائياً وتُلغى ${sessions} جلسة نشطة`,
        before: {
          suspendedAt: u?.suspendedAt?.toISOString() ?? null,
          suspendedKind: u?.suspendedKind ?? null,
        },
        after: { suspendedKind: SuspensionKind.BANNED },
        counts: { sessionsToRevoke: sessions },
      };
    },
    async execute(tx, input, ctx) {
      const now = new Date();
      await tx.user.update({
        where: { id: input.userId },
        data: {
          suspendedAt: now,
          suspendedKind: SuspensionKind.BANNED,
          suspendedReasonAr: ctx.reason ?? null,
        },
      });
      const { count } = await tx.refreshToken.updateMany({
        where: { userId: input.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return { bannedAt: now.toISOString(), sessionsRevoked: count };
    },
    async afterCommit(_result, input, ctx) {
      await deps.notifications.create({
        userId: input.userId,
        kind: NotificationKind.ACCOUNT_SUSPENDED,
        payload: { banned: true, reasonAr: ctx.reason ?? null },
      });
      const u = await deps.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true },
      });
      if (u) await deps.email.accountSuspended(u.email, { banned: true, reasonAr: ctx.reason ?? null });
    },
  };

  const userUnban: OperationDef<z.infer<typeof userRef>, { unbanned: true }> = {
    key: 'moderation.user.unban',
    titleAr: 'رفع الحظر عن مستخدم',
    descriptionAr:
      'يرفع الحظر الدائم (BANNED فقط) ويعيد الدخول. الحساب الموقوف إدارياً (SUSPENDED) يُعاد عبر users.reactivate وليس من هنا.',
    inputSchema: userRef,
    permission: 'moderation.queue',
    riskTier: 'SENSITIVE',
    reversible: true,
    compensatingKey: 'moderation.user.ban',
    requiresReason: true,
    preconditions: [
      {
        code: 'not-banned',
        reasonAr:
          'الحساب ليس محظوراً (BANNED) — الموقوف إدارياً (SUSPENDED) يُعاد تفعيله عبر users.reactivate',
        check: async (db, input) => {
          const u = await db.user.findUnique({
            where: { id: input.userId },
            select: { suspendedKind: true },
          });
          return u?.suspendedKind === SuspensionKind.BANNED;
        },
      },
    ],
    async dryRun(db, input) {
      const u = await db.user.findUnique({
        where: { id: input.userId },
        select: { name: true, suspendedAt: true, suspendedKind: true, suspendedReasonAr: true },
      });
      return {
        summaryAr: `سيُرفع الحظر عن حساب «${u?.name ?? input.userId}» ويُمسح سبب الحظر`,
        before: {
          suspendedAt: u?.suspendedAt?.toISOString() ?? null,
          suspendedKind: u?.suspendedKind ?? null,
          suspendedReasonAr: u?.suspendedReasonAr ?? null,
        },
        after: { suspendedAt: null, suspendedKind: null, suspendedReasonAr: null },
      };
    },
    async execute(tx, input) {
      await tx.user.update({
        where: { id: input.userId },
        data: { suspendedAt: null, suspendedKind: null, suspendedReasonAr: null },
      });
      return { unbanned: true as const };
    },
    async afterCommit(_result, input) {
      await deps.notifications.create({
        userId: input.userId,
        kind: NotificationKind.ACCOUNT_REACTIVATED,
        payload: {},
      });
      const u = await deps.prisma.user.findUnique({
        where: { id: input.userId },
        select: { email: true, name: true },
      });
      if (u) await deps.email.accountReactivated(u.email, u.name);
    },
  };

  return [
    commentModerate,
    projectReportsDismiss,
    projectHide,
    projectUnhide,
    userBan,
    userUnban,
  ] as unknown as Array<OperationDef<never, unknown>>;
}
