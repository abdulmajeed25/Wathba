import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Creator self-audit view (Creator-CC / CC-18). Read side of the append-only
 * AuditLog, owner-gated to a single project. Returns the creator's own actions
 * (actor=أنت), admin review actions (actor=الإدارة), and system-executed
 * consequences like cancel refunds (actor=النظام).
 *
 * A cancel entry is enriched with the refund count from its correlated
 * `system.refund.cancel` sibling so the UI can expand "your cancel → N refunds".
 */
@Injectable()
export class AuditViewService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProject(
    creatorId: string,
    projectId: string,
    opts: { take?: number; cursor?: string; action?: string } = {},
  ): Promise<{ items: Array<Record<string, unknown>>; nextCursor: string | null }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true },
    });
    if (!project) throw new NotFoundException('project not found');
    if (project.createdById !== creatorId) throw new ForbiddenException('not your project');

    const take = Math.min(50, Math.max(1, opts.take ?? 20));
    const where: Prisma.AuditLogWhereInput = {
      OR: [
        { entity: 'Project', entityId: projectId },
        { detail: { path: ['projectId'], equals: projectId } },
      ],
      ...(opts.action ? { action: opts.action } : {}),
    };

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(opts.cursor && { cursor: { id: opts.cursor }, skip: 1 }),
    });
    const nextCursor = rows.length > take ? rows[take]!.id : null;
    const page = rows.slice(0, take);

    // Correlate cancel decisions with their system refund execution.
    const refundByCorrelation = new Map<string, number>();
    for (const r of page) {
      const d = (r.detail ?? {}) as Record<string, unknown>;
      if (r.action === 'system.refund.cancel' && typeof d.correlationId === 'string') {
        refundByCorrelation.set(d.correlationId, Number(d.refundedCount ?? 0));
      }
    }

    const items = page.map((r) => {
      const detail = (r.detail ?? {}) as Record<string, unknown>;
      const actorType =
        r.actorId === null ? 'system' : r.actorId === creatorId ? 'you' : 'admin';
      const correlationId = typeof detail.correlationId === 'string' ? detail.correlationId : null;
      return {
        id: r.id,
        action: r.action,
        actorType,
        entity: r.entity,
        entityId: r.entityId,
        detail,
        createdAt: r.createdAt.toISOString(),
        // For a cancel decision, expose the linked system refund count (if the
        // sibling event is on this page).
        linkedRefundCount:
          r.action === 'creator.project.cancel' && correlationId
            ? refundByCorrelation.get(correlationId) ?? null
            : null,
      };
    });

    return { items, nextCursor };
  }
}
