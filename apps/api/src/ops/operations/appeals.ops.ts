import { AppealKind, AppealStatus, NotificationKind, ProjectStatus, SuspensionKind } from '@prisma/client';
import { z } from 'zod';

import type { OperationDef, ReadOnlyDb } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../../notifications/notifications.service';
import type { EmailService } from '../../email/email.service';

/**
 * Batch OPS-GAPS R1 — the appeals adjudication ops (SENSITIVE tier).
 *
 * An appeal is a plea against a governed decision the platform already took
 * against the appellant: a permanent ban (moderation.user.ban) or a project
 * rejection (projects.review.reject). Adjudicating one is itself governed —
 * it flows through the registry with the operator's written reason and an
 * audit row, exactly like the decision it re-examines.
 *
 * TWO principles the ops below enforce:
 *
 *  · FOUR EYES — the operator who ISSUED the original decision may not judge
 *    the appeal against it. We recover the original decider from the immutable
 *    AuditLog (the ban/reject wrote `ops.moderation.user.ban` on the User /
 *    `ops.projects.review.reject` on the Project) and refuse if it is the
 *    deciding actor. The check sits on DECIDE (where it is load-bearing) and,
 *    for good UX, also on CLAIM so the wrong reviewer is turned away up front.
 *
 *  · COMPENSATING TRANSITION IN THE SAME GOVERNED TX — an OVERTURNED appeal
 *    does not just record an outcome, it UNDOES the original action inside the
 *    decide transaction: an overturned ban clears the suspension (unban); an
 *    overturned rejection sends the project back to review. This is the
 *    "through the registry, never a raw write" rule — the reversal rides the
 *    same audited tx as the appeal's own state change.
 */

export interface AppealsOpsDeps {
  prisma: PrismaService;
  notifications: NotificationsService;
  email: EmailService;
}

/** ops.module.ts still calls appealsOps() bare until the coordinator wires
 *  the deps; any afterCommit reached before wiring fails loudly instead of
 *  silently no-oping (same guard shape as usersOps/moderationOps). */
const UNWIRED_DEPS = new Proxy(
  {},
  {
    get(_t, prop) {
      throw new Error(`appealsOps deps not wired yet (accessed .${String(prop)})`);
    },
  },
) as AppealsOpsDeps;

/** Arabic label for the appealed decision (email + previews). */
const KIND_AR: Record<AppealKind, string> = {
  ACCOUNT_BAN: 'حظر الحساب',
  PROJECT_REJECTION: 'رفض المشروع',
  CONTENT_TAKEDOWN: 'إخفاء تعليق',
};

/** Arabic label for the adjudication outcome (email + previews). */
const OUTCOME_AR: Record<'UPHELD' | 'OVERTURNED' | 'PARTIALLY_GRANTED', string> = {
  UPHELD: 'رُفض التظلّم — القرار الأصلي قائم',
  OVERTURNED: 'قُبل التظلّم — نُقض القرار الأصلي',
  PARTIALLY_GRANTED: 'قُبل التظلّم جزئياً — خُفّف القرار الأصلي',
};

type AppealSubject = { kind: AppealKind; subjectId: string } | null;

/** The operator who issued the decision this appeal contests, recovered from
 *  the append-only audit ledger. Returns null when no such decision is on the
 *  record (nothing to violate four-eyes against — the check then passes). */
async function originalDeciderId(db: ReadOnlyDb, appeal: AppealSubject): Promise<string | null> {
  if (!appeal) return null;
  // CLOSEOUT C4 — CONTENT_TAKEDOWN joins the map. The hide was written by
  // moderation.comment.moderate against the Comment, so four-eyes recovers the
  // hiding moderator the same way it recovers a banning or rejecting one.
  const ACTION_BY_KIND: Record<AppealKind, { action: string; entity: string }> = {
    ACCOUNT_BAN: { action: 'ops.moderation.user.ban', entity: 'User' },
    PROJECT_REJECTION: { action: 'ops.projects.review.reject', entity: 'Project' },
    CONTENT_TAKEDOWN: { action: 'ops.moderation.comment.moderate', entity: 'Comment' },
  };
  const { action, entity } = ACTION_BY_KIND[appeal.kind];
  const log = await db.auditLog.findFirst({
    where: { action, entity, entityId: appeal.subjectId },
    orderBy: { createdAt: 'desc' },
    select: { actorId: true },
  });
  return log?.actorId ?? null;
}

async function loadSubject(db: ReadOnlyDb, appealId: string): Promise<AppealSubject> {
  return db.appeal.findUnique({
    where: { id: appealId },
    select: { kind: true, subjectId: true },
  });
}

const appealRef = z.object({ appealId: z.string().uuid() });

export function appealsOps(deps: AppealsOpsDeps = UNWIRED_DEPS): Array<OperationDef<never, unknown>> {
  const claim: OperationDef<z.infer<typeof appealRef>, { status: AppealStatus }> = {
    key: 'appeals.claim',
    titleAr: 'استلام تظلّم للمراجعة',
    descriptionAr:
      'ينقل التظلّم من «مُقدَّم» (SUBMITTED) إلى «قيد المراجعة» (UNDER_REVIEW): المراجع يأخذه على عاتقه. مبدأ العيون الأربع يُطبَّق عند الحسم، ويُطبَّق هنا أيضاً تحسيناً للتجربة — مُصدِر القرار الأصلي لا يستلم تظلّماً ضد قراره.',
    inputSchema: appealRef,
    permission: 'trust.appeals',
    riskTier: 'SENSITIVE',
    reversible: false,
    requiresReason: true,
    preconditions: [
      {
        code: 'not-claimable',
        reasonAr: 'التظلّم ليس في حالة «مُقدَّم» (SUBMITTED) — لا يمكن استلامه',
        check: async (db, input) => {
          const a = await db.appeal.findUnique({
            where: { id: input.appealId },
            select: { status: true },
          });
          return a?.status === AppealStatus.SUBMITTED;
        },
      },
      {
        // Four-eyes, applied early: the original decider is turned away before
        // taking the case rather than at the decision step.
        code: 'self-review',
        reasonAr: 'أنت مُصدِر القرار محل التظلّم — لا يجوز أن تراجع قرارك بنفسك (مبدأ العيون الأربع)',
        check: async (db, input, ctx) => {
          const subject = await loadSubject(db, input.appealId);
          const decider = await originalDeciderId(db, subject);
          return decider === null || decider !== ctx.actor.id;
        },
      },
    ],
    async dryRun(db, input) {
      const a = await db.appeal.findUnique({
        where: { id: input.appealId },
        select: { kind: true, status: true },
      });
      return {
        summaryAr: a
          ? `سيُستلم تظلّم «${KIND_AR[a.kind]}» للمراجعة (SUBMITTED → UNDER_REVIEW)`
          : 'التظلّم غير موجود',
        before: { status: a?.status ?? null },
        after: { status: AppealStatus.UNDER_REVIEW },
      };
    },
    async execute(tx, input) {
      const updated = await tx.appeal.update({
        where: { id: input.appealId },
        data: { status: AppealStatus.UNDER_REVIEW },
        select: { status: true },
      });
      return { status: updated.status };
    },
  };

  const decideInput = z.object({
    appealId: z.string().uuid(),
    outcome: z.enum(['UPHELD', 'OVERTURNED', 'PARTIALLY_GRANTED']),
    // The written reason IS the decision reason — persisted on the appeal and
    // delivered to the appellant. Registry also forces a reason on SENSITIVE.
    decisionReason: z.string().trim().min(10),
  });

  const decide: OperationDef<
    z.infer<typeof decideInput>,
    {
      status: AppealStatus;
      kind: AppealKind;
      submittedById: string;
      decisionReason: string;
      compensation: string | null;
    }
  > = {
    key: 'appeals.decide',
    titleAr: 'حسم تظلّم',
    descriptionAr:
      'يحسم تظلّماً قيد المراجعة بأحد المخرجات الثلاثة: UPHELD (تأييد القرار — لا تعويض)، OVERTURNED (نقض القرار مع التراجع التعويضي في المعاملة نفسها: رفع الحظر / إعادة المشروع للمراجعة)، PARTIALLY_GRANTED (تخفيف: مشروع يعود للمراجعة، وحساب محظور يُخفَّض إلى إيقاف إداري). مبدأ العيون الأربع: مُصدِر القرار الأصلي لا يحسم التظلّم ضده.',
    inputSchema: decideInput,
    permission: 'trust.appeals',
    riskTier: 'SENSITIVE',
    reversible: false,
    requiresReason: true,
    preconditions: [
      {
        code: 'not-under-review',
        reasonAr: 'التظلّم ليس «قيد المراجعة» (UNDER_REVIEW) — استلمه أولاً (appeals.claim)',
        check: async (db, input) => {
          const a = await db.appeal.findUnique({
            where: { id: input.appealId },
            select: { status: true },
          });
          return a?.status === AppealStatus.UNDER_REVIEW;
        },
      },
      {
        // FOUR EYES — the load-bearing check: the operator who issued the
        // original ban/rejection cannot be the one who now judges the appeal.
        code: 'self-review',
        reasonAr:
          'أنت مُصدِر القرار محل التظلّم — لا يجوز أن تحكم على قرارك بنفسك (مبدأ العيون الأربع)',
        check: async (db, input, ctx) => {
          const subject = await loadSubject(db, input.appealId);
          const decider = await originalDeciderId(db, subject);
          return decider === null || decider !== ctx.actor.id;
        },
      },
    ],
    async dryRun(db, input) {
      const a = await db.appeal.findUnique({
        where: { id: input.appealId },
        select: { kind: true, status: true },
      });
      const compAr =
        input.outcome === 'UPHELD'
          ? 'لا تعويض — القرار قائم'
          : a?.kind === AppealKind.CONTENT_TAKEDOWN
            ? input.outcome === 'OVERTURNED'
              ? 'سيُعاد إظهار التعليق'
              : 'سيبقى التعليق مخفياً مع تدوين المعالجة'
            : a?.kind === AppealKind.ACCOUNT_BAN
              ? input.outcome === 'OVERTURNED'
                ? 'سيُرفع الحظر عن الحساب'
                : 'سيُخفَّض الحظر إلى إيقاف إداري (SUSPENDED)'
              : 'سيعود المشروع إلى المراجعة (UNDER_REVIEW)';
      return {
        summaryAr: a
          ? `سيُحسم تظلّم «${KIND_AR[a.kind]}» بنتيجة «${OUTCOME_AR[input.outcome]}» — ${compAr}`
          : 'التظلّم غير موجود',
        before: { status: a?.status ?? null },
        after: { status: input.outcome, compensation: compAr },
      };
    },
    async execute(tx, input, ctx) {
      const appeal = await tx.appeal.findUniqueOrThrow({
        where: { id: input.appealId },
        select: { kind: true, subjectId: true, submittedById: true },
      });
      const now = new Date();
      await tx.appeal.update({
        where: { id: input.appealId },
        data: {
          status: input.outcome as AppealStatus,
          decidedById: ctx.actor.id,
          decisionReason: input.decisionReason,
          decidedAt: now,
        },
      });

      // ── the compensating transition, IN THIS SAME GOVERNED TX ──────────
      let compensation: string | null = null;
      if (input.outcome === 'OVERTURNED') {
        if (appeal.kind === AppealKind.CONTENT_TAKEDOWN) {
          // CLOSEOUT C4 — restore the comment exactly as the 'unhide' branch of
          // moderation.comment.moderate does, inside this same governed tx.
          await tx.comment.update({
            where: { id: appeal.subjectId },
            data: { hidden: false },
          });
          compensation = 'comment-unhidden';
        } else if (appeal.kind === AppealKind.ACCOUNT_BAN) {
          // Undo the ban exactly as moderation.user.unban does.
          await tx.user.update({
            where: { id: appeal.subjectId },
            data: { suspendedAt: null, suspendedKind: null, suspendedReasonAr: null },
          });
          compensation = 'account-unbanned';
        } else {
          // Send the rejected project back into the review queue.
          await tx.project.update({
            where: { id: appeal.subjectId },
            data: { status: ProjectStatus.UNDER_REVIEW, reviewFeedback: null },
          });
          compensation = 'project-returned-to-review';
        }
      } else if (input.outcome === 'PARTIALLY_GRANTED') {
        // DECISION — a partial grant is a documented lesser remedy:
        //  · PROJECT_REJECTION: same relief as overturned — back to review
        //    (there is no "half a review"; the creator gets another look).
        //  · ACCOUNT_BAN: convert the permanent BAN into an administrative
        //    SUSPENSION (a lesser, reversible sanction) rather than a full
        //    unban — the account stays out but is no longer permanently
        //    banned; support can lift the suspension via users.reactivate.
        if (appeal.kind === AppealKind.CONTENT_TAKEDOWN) {
          // DECISION — there is no "half hidden" comment. A partial grant on a
          // takedown records the outcome for manual follow-up (the operator's
          // written reason carries the remedy) and leaves the comment hidden;
          // only OVERTURNED restores it.
          compensation = 'takedown-upheld-with-remedy-noted';
        } else if (appeal.kind === AppealKind.ACCOUNT_BAN) {
          await tx.user.update({
            where: { id: appeal.subjectId },
            data: { suspendedKind: SuspensionKind.SUSPENDED },
          });
          compensation = 'ban-downgraded-to-suspension';
        } else {
          await tx.project.update({
            where: { id: appeal.subjectId },
            data: { status: ProjectStatus.UNDER_REVIEW, reviewFeedback: null },
          });
          compensation = 'project-returned-to-review';
        }
      }
      // UPHELD: no compensation — the original decision stands.

      return {
        status: input.outcome as AppealStatus,
        kind: appeal.kind,
        submittedById: appeal.submittedById,
        decisionReason: input.decisionReason,
        compensation,
      };
    },
    async afterCommit(result) {
      await deps.notifications.create({
        userId: result.submittedById,
        kind: NotificationKind.APPEAL_DECIDED,
        payload: {
          outcome: result.status,
          decisionReason: result.decisionReason,
          deepLink: '/appeals/mine',
        },
      });
      const u = await deps.prisma.user.findUnique({
        where: { id: result.submittedById },
        select: { email: true },
      });
      if (u?.email) {
        await deps.email.appealDecided(u.email, {
          kindAr: KIND_AR[result.kind],
          outcomeAr: OUTCOME_AR[result.status as 'UPHELD' | 'OVERTURNED' | 'PARTIALLY_GRANTED'],
          reasonAr: result.decisionReason,
        });
      }
    },
  };

  return [claim, decide] as unknown as Array<OperationDef<never, unknown>>;
}
