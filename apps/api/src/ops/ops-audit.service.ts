import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * OPS Part 3 — the audit browser + chain verification. READ-ONLY over
 * AuditLog (the RULE-4 carve-out here owns no writes at all — RULE 5 pins
 * it to zero mutating calls). The chain itself is DB-enforced: the
 * audit_chain trigger links every insert, audit_block_mutation() raises on
 * UPDATE/DELETE/TRUNCATE, and audit_row_hash() is the ONE hash formula —
 * verification below recomputes with the same SQL function, so the checker
 * can never drift from the writer.
 */

export interface AuditFilter {
  actorId?: string;
  actorType?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  riskTier?: string;
  /** Free text over action/entity/reason. */
  q?: string;
  from?: Date;
  to?: Date;
  cursor?: bigint;
  limit?: number;
}

export interface ChainVerdict {
  ok: boolean;
  checked: number;
  /** First broken link, when any. */
  brokenAtSeq: string | null;
  verifiedAt: string;
}

@Injectable()
export class OpsAuditService {
  private readonly logger = new Logger(OpsAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(f: AuditFilter) {
    const where: Prisma.AuditLogWhereInput = {
      ...(f.actorId ? { actorId: f.actorId } : {}),
      ...(f.actorType ? { actorType: f.actorType } : {}),
      ...(f.action ? { action: { contains: f.action } } : {}),
      ...(f.entity ? { entity: f.entity } : {}),
      ...(f.entityId ? { entityId: f.entityId } : {}),
      ...(f.riskTier ? { riskTier: f.riskTier } : {}),
      ...(f.q
        ? {
            OR: [
              { action: { contains: f.q, mode: 'insensitive' } },
              { entity: { contains: f.q, mode: 'insensitive' } },
              { reason: { contains: f.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(f.from || f.to
        ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } }
        : {}),
      ...(f.cursor ? { chainSeq: { lt: f.cursor } } : {}),
    };
    const take = Math.min(f.limit ?? 50, 200);
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { chainSeq: 'desc' },
      take: take + 1,
    });
    const hasMore = rows.length > take;
    const page = rows.slice(0, take).map((r) => this.serialize(r));
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1]!.chainSeq : null,
    };
  }

  /** The per-entity «history» panel: everything that ever touched a subject. */
  async entityTrail(entity: string, entityId: string, limit = 100) {
    const rows = await this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { chainSeq: 'desc' },
      take: Math.min(limit, 200),
    });
    return { items: rows.map((r) => this.serialize(r)) };
  }

  /**
   * Recompute the whole chain with the SAME SQL function the trigger uses.
   * Any relink (prevHash ≠ predecessor's hash) or recompute mismatch
   * (hash ≠ audit_row_hash(row)) surfaces as the first broken seq.
   */
  async verify(): Promise<ChainVerdict> {
    const rows = await this.prisma.$queryRaw<Array<{ total: bigint; brokenAt: bigint | null }>>`
      WITH ordered AS (
        SELECT *, lag("hash", 1, 'GENESIS') OVER (ORDER BY "chainSeq") AS expected_prev
        FROM "AuditLog"
      )
      SELECT count(*)::bigint AS total,
             min("chainSeq") FILTER (
               WHERE "prevHash" IS DISTINCT FROM expected_prev
                  OR "hash" IS DISTINCT FROM audit_row_hash(
                       "prevHash", id, "actorId", "actorType", action, entity,
                       "entityId", reason, "inputHash", ip, "userAgent",
                       detail, "createdAt", "chainSeq")
             ) AS "brokenAt"
      FROM ordered;
    `;
    const { total, brokenAt } = rows[0]!;
    return {
      ok: brokenAt === null,
      checked: Number(total),
      brokenAtSeq: brokenAt === null ? null : String(brokenAt),
      verifiedAt: new Date().toISOString(),
    };
  }

  /** Daily sentinel — a broken chain is an incident, not a log line. */
  @Cron('0 4 * * *')
  async verifyDaily(): Promise<void> {
    try {
      const v = await this.verify();
      if (!v.ok) {
        this.logger.error(
          `AUDIT CHAIN BROKEN at chainSeq=${v.brokenAtSeq} (checked ${v.checked}) — ` +
            'the log has been tampered with or a write bypassed the trigger. Investigate NOW.',
        );
      } else {
        this.logger.log(`audit chain verified: ${v.checked} entries, intact`);
      }
    } catch (err) {
      this.logger.error(`audit chain verification failed to run: ${String(err)}`);
    }
  }

  private serialize(r: {
    chainSeq: bigint;
    [k: string]: unknown;
  }): Record<string, unknown> & { chainSeq: string } {
    return { ...r, chainSeq: String(r.chainSeq) };
  }
}
