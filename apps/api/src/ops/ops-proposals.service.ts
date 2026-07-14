import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { OperationsRegistry } from './operations.registry';
import type { ExecuteOutcome, OperationContext } from './operation.types';

/**
 * OPS Part 2 — the approval-queue lifecycle around OperationProposal (a
 * governance table this service owns, like ops-auth owns OpsSession).
 * Execution of an approved proposal is the registry's job
 * (executeProposal) — this service only lists, rejects and cancels.
 */
@Injectable()
export class OpsProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: OperationsRegistry,
  ) {}

  async list(status?: string) {
    return this.prisma.operationProposal.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async get(id: string) {
    const p = await this.prisma.operationProposal.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('الاقتراح غير موجود');
    return p;
  }

  approve(id: string, ctx: OperationContext): Promise<ExecuteOutcome> {
    return this.registry.executeProposal(id, ctx);
  }

  /** Reject — needs money.approve; the proposer cannot "reject" (they cancel). */
  async reject(id: string, ctx: OperationContext, reason: string) {
    if (!this.registry.permissionPort.has(ctx.actor, 'money.approve')) {
      throw new ForbiddenException('تفتقد الصلاحية المطلوبة: money.approve');
    }
    if (reason.trim().length < 10) {
      throw new ForbiddenException('رفض الاقتراح يتطلب سبباً مكتوباً (١٠ أحرف على الأقل)');
    }
    return this.decide(id, ctx, 'REJECTED', reason, 'ops.proposal.reject');
  }

  /** Cancel — the PROPOSER withdraws their own pending proposal. */
  async cancel(id: string, ctx: OperationContext, reason: string) {
    const p = await this.get(id);
    if (p.proposedById !== ctx.actor.id) {
      throw new ForbiddenException('لا يُلغي الاقتراحَ إلا صاحبُه — الرفض متاح لحامل صلاحية الاعتماد');
    }
    return this.decide(id, ctx, 'CANCELLED', reason, 'ops.proposal.cancel');
  }

  private async decide(
    id: string,
    ctx: OperationContext,
    status: 'REJECTED' | 'CANCELLED',
    reason: string,
    action: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.operationProposal.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status,
          decidedById: /^[0-9a-f-]{36}$/i.test(ctx.actor.id) ? ctx.actor.id : null,
          decidedAt: new Date(),
          decisionReason: reason,
        },
      });
      if (claimed.count === 0) {
        throw new ConflictException('الاقتراح ليس معلّقاً — لا يتغيّر');
      }
      await tx.auditLog.create({
        data: {
          actorId: /^[0-9a-f-]{36}$/i.test(ctx.actor.id) ? ctx.actor.id : null,
          action,
          entity: 'OperationProposal',
          entityId: id,
          detail: {
            reason,
            actorType: ctx.actor.type,
            ip: ctx.ip ?? null,
          } as Prisma.InputJsonValue,
        },
      });
      return tx.operationProposal.findUniqueOrThrow({ where: { id } });
    });
  }
}
