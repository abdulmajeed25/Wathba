import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Append-only audit trail (Sprint 2 / P1-503).
 *
 * `log()` never throws — an audit-write failure must not fail the audited
 * action; it is logged loudly instead (the gap itself becomes evidence).
 * Call sites: every admin mutation, milestone approve/release, settlement
 * and disbursement triggers, KYC decisions, PDPL erasure.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: {
    actorId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          detail: (entry.detail ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      this.logger.error(
        `AUDIT WRITE FAILED action=${entry.action} entity=${entry.entity}:${entry.entityId ?? '-'}`,
        err as Error,
      );
    }
  }
}
