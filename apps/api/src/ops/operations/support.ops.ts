import { SupportTicketStatus } from '@prisma/client';
import { z } from 'zod';

import type { OperationDef, ReadOnlyDb } from '../operation.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { EmailService } from '../../email/email.service';

/**
 * Batch OPS (registry completion) — support-ticket lifecycle (STANDARD tier).
 * Tickets arrive from «اتصل بنا» (support.controller); everything after that
 * — assignment, status, internal notes, the outbound reply — flows through
 * these operations so the queue has an audited actor on every touch.
 *
 * deps (prisma + email) are used ONLY in afterCommit: the reply email fires
 * after the note/status commit, never inside the transaction.
 */

export interface SupportOpsDeps {
  prisma: PrismaService;
  email: EmailService;
}

const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

export function supportOps(deps: SupportOpsDeps): Array<OperationDef<never, unknown>> {
  const ticketExists = {
    code: 'ticket-missing',
    reasonAr: 'التذكرة غير موجودة',
    check: async (db: ReadOnlyDb, input: { ticketId: string }) =>
      !!(await db.supportTicket.findUnique({
        where: { id: input.ticketId },
        select: { id: true },
      })),
  };

  const ticketNotClosed = {
    code: 'ticket-closed',
    reasonAr: 'التذكرة مُغلقة (CLOSED) — أعد فتحها أولاً عبر تغيير الحالة',
    check: async (db: ReadOnlyDb, input: { ticketId: string }) => {
      const t = await db.supportTicket.findUnique({
        where: { id: input.ticketId },
        select: { status: true },
      });
      return t?.status !== SupportTicketStatus.CLOSED;
    },
  };

  /* ── assign ────────────────────────────────────────────────────────── */
  const assignInput = z.object({
    ticketId: z.string().uuid(),
    assigneeId: z.string().uuid(),
  });

  const ticketAssign: OperationDef<
    z.infer<typeof assignInput>,
    { ticketId: string; assignedToId: string; status: string }
  > = {
    key: 'support.ticket.assign',
    titleAr: 'إسناد تذكرة دعم',
    descriptionAr:
      'يسند التذكرة إلى مشغّل يحمل دوراً تشغيلياً (RBAC). إسناد تذكرة مفتوحة ينقلها تلقائياً إلى قيد المعالجة.',
    inputSchema: assignInput,
    permission: 'support.tickets',
    riskTier: 'STANDARD',
    reversible: true,
    compensatingKey: 'support.ticket.assign',
    requiresReason: false,
    preconditions: [
      ticketExists as never,
      ticketNotClosed as never,
      {
        // The assignee must be a real user holding at least one ops role —
        // a ticket must never point at a non-operator.
        code: 'assignee-not-operator',
        reasonAr: 'المُسنَد إليه ليس مشغّلاً — لا يحمل أي دور تشغيلي (RBAC)',
        check: async (db, input) => {
          const user = await db.user.findUnique({
            where: { id: input.assigneeId },
            select: { id: true },
          });
          if (!user) return false;
          return !!(await db.opsRoleGrant.findFirst({
            where: { userId: input.assigneeId },
            select: { id: true },
          }));
        },
      },
    ],
    async dryRun(db, input) {
      const t = await db.supportTicket.findUnique({
        where: { id: input.ticketId },
        select: { topic: true, status: true, assignedToId: true },
      });
      const willProgress = t?.status === SupportTicketStatus.OPEN;
      return {
        summaryAr: `ستُسند تذكرة «${t?.topic ?? input.ticketId}» إلى المشغّل${
          willProgress ? ' وتنتقل إلى قيد المعالجة' : ''
        }`,
        before: { assignedToId: t?.assignedToId ?? null, status: t?.status ?? null },
        after: {
          assignedToId: input.assigneeId,
          status: willProgress ? SupportTicketStatus.IN_PROGRESS : t?.status ?? null,
        },
      };
    },
    async execute(tx, input) {
      const t = await tx.supportTicket.findUniqueOrThrow({
        where: { id: input.ticketId },
        select: { status: true },
      });
      const updated = await tx.supportTicket.update({
        where: { id: input.ticketId },
        data: {
          assignedToId: input.assigneeId,
          // Side effect by policy: assigning an OPEN ticket starts work on it.
          ...(t.status === SupportTicketStatus.OPEN
            ? { status: SupportTicketStatus.IN_PROGRESS }
            : {}),
        },
      });
      return {
        ticketId: input.ticketId,
        assignedToId: input.assigneeId,
        status: updated.status,
      };
    },
  };

  /* ── status ────────────────────────────────────────────────────────── */
  const statusInput = z.object({
    ticketId: z.string().uuid(),
    status: z.enum(TICKET_STATUSES),
  });

  const ticketStatusSet: OperationDef<
    z.infer<typeof statusInput>,
    { ticketId: string; status: string; resolvedAt: string | null }
  > = {
    key: 'support.ticket.status.set',
    titleAr: 'تغيير حالة تذكرة دعم',
    descriptionAr:
      'ينقل التذكرة بين OPEN/IN_PROGRESS/RESOLVED/CLOSED. الدخول إلى RESOLVED أو CLOSED يختم resolvedAt؛ إعادة الفتح تمسحه.',
    inputSchema: statusInput,
    permission: 'support.tickets',
    riskTier: 'STANDARD',
    reversible: true,
    compensatingKey: 'support.ticket.status.set',
    requiresReason: false,
    preconditions: [
      ticketExists as never,
      {
        code: 'no-change',
        reasonAr: 'التذكرة في هذه الحالة بالفعل — لا تغيير',
        check: async (db, input) => {
          const t = await db.supportTicket.findUnique({
            where: { id: input.ticketId },
            select: { status: true },
          });
          return t?.status !== input.status;
        },
      },
    ],
    async dryRun(db, input) {
      const t = await db.supportTicket.findUnique({
        where: { id: input.ticketId },
        select: { topic: true, status: true, resolvedAt: true },
      });
      const settles = input.status === 'RESOLVED' || input.status === 'CLOSED';
      return {
        summaryAr: `ستنتقل تذكرة «${t?.topic ?? input.ticketId}» من ${t?.status ?? '—'} إلى ${input.status}`,
        before: { status: t?.status ?? null, resolvedAt: t?.resolvedAt?.toISOString() ?? null },
        after: { status: input.status, resolvedAt: settles ? '(الآن)' : null },
      };
    },
    async execute(tx, input) {
      const current = await tx.supportTicket.findUniqueOrThrow({
        where: { id: input.ticketId },
        select: { status: true, resolvedAt: true },
      });
      const settledFamily = (s: string): boolean => s === 'RESOLVED' || s === 'CLOSED';
      // Entering RESOLVED/CLOSED stamps resolvedAt; RESOLVED→CLOSED keeps the
      // original resolution time; reopening (→OPEN/IN_PROGRESS) clears it.
      const resolvedAt = settledFamily(input.status)
        ? settledFamily(current.status)
          ? current.resolvedAt
          : new Date()
        : null;
      const updated = await tx.supportTicket.update({
        where: { id: input.ticketId },
        data: { status: input.status as SupportTicketStatus, resolvedAt },
      });
      return {
        ticketId: input.ticketId,
        status: updated.status,
        resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      };
    },
  };

  /* ── internal note ─────────────────────────────────────────────────── */
  const noteInput = z.object({
    ticketId: z.string().uuid(),
    noteAr: z.string().min(2).max(4000),
  });

  const ticketNoteAdd: OperationDef<z.infer<typeof noteInput>, { noteId: string }> = {
    key: 'support.ticket.note.add',
    titleAr: 'إضافة ملاحظة داخلية على تذكرة',
    descriptionAr:
      'ملاحظة داخلية للفريق فقط — لا تُرسل بالبريد إلى صاحب التذكرة أبداً. للرد الخارجي استخدم عملية الرد (support.ticket.reply).',
    inputSchema: noteInput,
    permission: 'support.tickets',
    riskTier: 'STANDARD',
    reversible: false,
    requiresReason: false,
    preconditions: [ticketExists as never],
    async dryRun(db, input) {
      const t = await db.supportTicket.findUnique({
        where: { id: input.ticketId },
        select: { topic: true },
      });
      return {
        summaryAr: `ستُضاف ملاحظة داخلية على تذكرة «${t?.topic ?? input.ticketId}» — لن يصل منها شيء لصاحب التذكرة`,
        before: null,
        after: { noteAr: input.noteAr },
      };
    },
    async execute(tx, input, ctx) {
      const note = await tx.supportTicketNote.create({
        data: {
          ticketId: input.ticketId,
          authorId: ctx.actor.id,
          noteAr: input.noteAr,
        },
      });
      return { noteId: note.id };
    },
  };

  /* ── outbound reply ────────────────────────────────────────────────── */
  const replyInput = z.object({
    ticketId: z.string().uuid(),
    replyAr: z.string().min(2).max(8000),
  });

  const ticketReply: OperationDef<
    z.infer<typeof replyInput>,
    { ticketId: string; noteId: string; status: string }
  > = {
    key: 'support.ticket.reply',
    titleAr: 'الرد على صاحب تذكرة',
    descriptionAr:
      'يدوّن الرد كملاحظة موسومة «ردّ مُرسَل» ثم يرسله بالبريد إلى صاحب التذكرة بعد الالتزام. غير قابلة للعكس — البريد المُرسَل لا يُسترد.',
    inputSchema: replyInput,
    permission: 'support.tickets',
    riskTier: 'STANDARD',
    reversible: false,
    requiresReason: false,
    preconditions: [ticketExists as never, ticketNotClosed as never],
    async dryRun(db, input) {
      const t = await db.supportTicket.findUnique({
        where: { id: input.ticketId },
        select: { topic: true, status: true },
      });
      const willProgress = t?.status === SupportTicketStatus.OPEN;
      return {
        summaryAr: `سيُرسل الرد بالبريد إلى صاحب تذكرة «${t?.topic ?? input.ticketId}»${
          willProgress ? ' وتنتقل التذكرة إلى قيد المعالجة' : ''
        } — الإرسال لا يُعكس`,
        before: { status: t?.status ?? null },
        after: {
          status: willProgress ? SupportTicketStatus.IN_PROGRESS : t?.status ?? null,
          replyAr: input.replyAr,
        },
      };
    },
    async execute(tx, input, ctx) {
      const t = await tx.supportTicket.findUniqueOrThrow({
        where: { id: input.ticketId },
        select: { status: true },
      });
      // The reply is durably part of the ticket thread BEFORE any email —
      // if the send fails afterCommit, the record of intent still exists.
      const note = await tx.supportTicketNote.create({
        data: {
          ticketId: input.ticketId,
          authorId: ctx.actor.id,
          noteAr: `«ردّ مُرسَل»: ${input.replyAr}`,
        },
      });
      let status: SupportTicketStatus = t.status;
      if (t.status === SupportTicketStatus.OPEN) {
        const updated = await tx.supportTicket.update({
          where: { id: input.ticketId },
          data: { status: SupportTicketStatus.IN_PROGRESS },
        });
        status = updated.status;
      }
      return { ticketId: input.ticketId, noteId: note.id, status };
    },
    async afterCommit(_result, input) {
      const ticket = await deps.prisma.supportTicket.findUnique({
        where: { id: input.ticketId },
        select: { name: true, email: true, topic: true },
      });
      if (!ticket) return;
      await deps.email.supportReply(ticket.email, {
        name: ticket.name,
        topic: ticket.topic,
        replyAr: input.replyAr,
      });
    },
  };

  return [
    ticketAssign,
    ticketStatusSet,
    ticketNoteAdd,
    ticketReply,
  ] as unknown as Array<OperationDef<never, unknown>>;
}
