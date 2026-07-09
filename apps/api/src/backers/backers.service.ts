import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../identity/audit.service';
import {
  Prisma,
  PledgeStatus,
  ProjectStatus,
  RewardFulfillmentStatus,
  type Project,
} from '@prisma/client';
import type {
  BulkRewardStatusDto,
  ExportBackersQueryDto,
  ListBackersQueryDto,
} from './dto/backers.dto';

/**
 * Backer roster (Creator-CC / CC-02) + CSV export (CC-03) — Kickstarter
 * "Backer Report" parity, owner-gated and READ-ONLY on money.
 *
 * CREATOR-NO-MONEY invariant: nothing here refunds, captures, or moves money.
 * Pledge (money) status is surfaced as a read-only badge; the only mutable
 * field is `rewardStatus`, pure fulfillment bookkeeping.
 */
@Injectable()
export class BackersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async requireOwned(creatorId: string, projectId: string): Promise<Project> {
    const proj = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!proj) throw new NotFoundException('project not found');
    if (proj.createdById !== creatorId) throw new ForbiddenException('not your project');
    return proj;
  }

  /** Build the Prisma `where` shared by the roster list and the CSV export. */
  private buildWhere(
    projectId: string,
    f: {
      tierId?: string;
      status?: PledgeStatus;
      rewardStatus?: RewardFulfillmentStatus;
      shippingRequired?: boolean;
      search?: string;
    },
  ): Prisma.PledgeWhereInput {
    const where: Prisma.PledgeWhereInput = { projectId };
    if (f.tierId) where.tierId = f.tierId;
    if (f.status) where.status = f.status;
    if (f.rewardStatus) where.rewardStatus = f.rewardStatus;
    if (f.shippingRequired !== undefined) {
      where.tier = { requiresShipping: f.shippingRequired };
    }
    if (f.search && f.search.trim()) {
      const term = f.search.trim();
      const or: Prisma.PledgeWhereInput[] = [
        { backer: { name: { contains: term, mode: 'insensitive' } } },
      ];
      const asNum = Number(term.replace(/^#/, ''));
      if (Number.isInteger(asNum) && asNum > 0) or.push({ backerNo: asNum });
      where.OR = or;
    }
    return where;
  }

  async list(
    creatorId: string,
    projectId: string,
    q: ListBackersQueryDto,
  ): Promise<{
    items: Array<Record<string, unknown>>;
    nextCursor: string | null;
    total: number;
  }> {
    await this.requireOwned(creatorId, projectId);
    const take = Math.min(100, Math.max(1, q.take ?? 30));
    const where = this.buildWhere(projectId, q);

    const [rows, total] = await Promise.all([
      this.prisma.pledge.findMany({
        where,
        orderBy: [{ backerNo: 'desc' }],
        take: take + 1,
        ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
        include: {
          backer: { select: { name: true, handle: true, avatarUrl: true } },
          tier: { select: { titleAr: true, requiresShipping: true } },
          addOns: { include: { addOn: { select: { titleAr: true } } } },
        },
      }),
      this.prisma.pledge.count({ where }),
    ]);

    const nextCursor = rows.length > take ? rows[take]!.id : null;
    const items = rows.slice(0, take).map((p) => this.toRosterRow(p));
    return { items, nextCursor, total };
  }

  private toRosterRow(p: {
    id: string;
    backerNo: number;
    amountHalalas: bigint;
    addOnsHalalas: bigint;
    status: PledgeStatus;
    rewardStatus: RewardFulfillmentStatus;
    createdAt: Date;
    tierId: string;
    backer: { name: string; handle: string | null; avatarUrl: string | null };
    tier: { titleAr: string; requiresShipping: boolean };
    addOns: Array<{ qty: number; addOn: { titleAr: string } }>;
  }): Record<string, unknown> {
    return {
      pledgeId: p.id,
      backerNo: p.backerNo,
      backerName: p.backer.name,
      // STAKES/S-11 F-18 (C10) — the roster links each backer to /u/[handle].
      backerHandle: p.backer.handle,
      backerAvatarUrl: p.backer.avatarUrl,
      tierId: p.tierId,
      tierTitleAr: p.tier.titleAr,
      requiresShipping: p.tier.requiresShipping,
      addOns: p.addOns.map((a) => ({ titleAr: a.addOn.titleAr, qty: a.qty })),
      totalHalalas: Number(p.amountHalalas + p.addOnsHalalas),
      status: p.status, // money status — READ-ONLY badge
      rewardStatus: p.rewardStatus, // fulfillment — creator-editable
      pledgedAt: p.createdAt.toISOString(),
    };
  }

  /** Per-pledge fulfillment update (no money effect). */
  async updateRewardStatus(
    creatorId: string,
    projectId: string,
    pledgeId: string,
    rewardStatus: RewardFulfillmentStatus,
  ): Promise<{ pledgeId: string; rewardStatus: RewardFulfillmentStatus }> {
    await this.requireOwned(creatorId, projectId);
    const pledge = await this.prisma.pledge.findFirst({
      where: { id: pledgeId, projectId },
      select: { id: true },
    });
    if (!pledge) throw new NotFoundException('pledge not found on this project');
    await this.prisma.pledge.update({ where: { id: pledgeId }, data: { rewardStatus } });
    return { pledgeId, rewardStatus };
  }

  /** Bulk fulfillment update, optionally scoped to a tier. Audited (CC-06). */
  async bulkUpdateRewardStatus(
    creatorId: string,
    projectId: string,
    dto: BulkRewardStatusDto,
  ): Promise<{ updated: number }> {
    await this.requireOwned(creatorId, projectId);
    const where: Prisma.PledgeWhereInput = { projectId, ...(dto.tierId && { tierId: dto.tierId }) };
    const { count } = await this.prisma.pledge.updateMany({
      where,
      data: { rewardStatus: dto.rewardStatus },
    });
    await this.audit.log({
      actorId: creatorId,
      action: 'creator.reward-status.bulk',
      entity: 'Project',
      entityId: projectId,
      detail: { projectId, tierId: dto.tierId ?? null, rewardStatus: dto.rewardStatus, count },
    });
    return { updated: count };
  }

  /**
   * Two-level CSV export (CC-03), PDPL-scoped:
   *   - summary (default): NO addresses/email/phone, any project status.
   *   - fulfillment: WITH shipping addresses, ONLY for FUNDED/IN_PRODUCTION/
   *     DELIVERED (server-enforced). Both audited.
   * UTF-8 BOM so Arabic opens correctly in Excel.
   */
  async exportCsv(
    creatorId: string,
    projectId: string,
    q: ExportBackersQueryDto,
  ): Promise<{ filename: string; csv: string }> {
    const project = await this.requireOwned(creatorId, projectId);
    const level = q.level ?? 'summary';
    const FULFILLMENT_ALLOWED: ProjectStatus[] = [
      ProjectStatus.FUNDED,
      ProjectStatus.IN_PRODUCTION,
      ProjectStatus.DELIVERED,
    ];
    if (level === 'fulfillment' && !FULFILLMENT_ALLOWED.includes(project.status)) {
      throw new ForbiddenException(
        'fulfillment export (with addresses) is only available once the project is FUNDED',
      );
    }

    const where = this.buildWhere(projectId, q);
    const rows = await this.prisma.pledge.findMany({
      where,
      orderBy: [{ backerNo: 'asc' }],
      include: {
        backer: { select: { name: true } },
        tier: { select: { titleAr: true, requiresShipping: true } },
        addOns: { include: { addOn: { select: { titleAr: true } } } },
      },
    });

    const withAddresses = level === 'fulfillment';
    const header = [
      'رقم الداعم',
      'الاسم',
      'المكافأة',
      'الإضافات',
      'المبلغ (ريال)',
      'حالة الدفع',
      'حالة التسليم',
      'تاريخ الدعم',
      ...(withAddresses ? ['يتطلب شحن', 'المدينة', 'العنوان'] : []),
    ];
    const lines = [header.map(csvCell).join(',')];
    for (const p of rows) {
      const addOns = p.addOns.map((a) => `${a.addOn.titleAr}×${a.qty}`).join(' | ');
      const shipping = (p.shipping ?? {}) as Record<string, unknown>;
      const cells = [
        `#${p.backerNo}`,
        p.backer.name,
        p.tier.titleAr,
        addOns,
        ((Number(p.amountHalalas + p.addOnsHalalas)) / 100).toFixed(2),
        PLEDGE_STATUS_AR[p.status] ?? p.status,
        REWARD_STATUS_AR[p.rewardStatus] ?? p.rewardStatus,
        p.createdAt.toISOString().slice(0, 10),
        ...(withAddresses
          ? [
              p.tier.requiresShipping ? 'نعم' : 'لا',
              String(shipping['city'] ?? ''),
              String(shipping['address'] ?? ''),
            ]
          : []),
      ];
      lines.push(cells.map(csvCell).join(','));
    }

    // UTF-8 BOM prefix so Excel renders Arabic correctly.
    const csv = '﻿' + lines.join('\r\n') + '\r\n';
    const stamp = project.updatedAt.toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `wathba-backers-${projectId}-${stamp}.csv`;

    await this.audit.log({
      actorId: creatorId,
      action: 'creator.backers.export',
      entity: 'Project',
      entityId: projectId,
      detail: {
        projectId,
        exportLevel: level,
        rowCount: rows.length,
        fieldScope: withAddresses ? 'with-addresses' : 'no-pii',
      },
    });

    return { filename, csv };
  }
}

const PLEDGE_STATUS_AR: Record<string, string> = {
  HELD: 'محجوز',
  CAPTURED: 'محصّل',
  REFUNDED: 'مُسترَد',
  FAILED: 'فشل',
  DISPUTED: 'متنازع عليه',
};

const REWARD_STATUS_AR: Record<string, string> = {
  PENDING: 'بانتظار التجهيز',
  IN_PROGRESS: 'قيد التجهيز',
  SENT: 'تم الإرسال',
};

/** CSV-escape a cell: wrap in quotes if it contains comma/quote/newline. */
function csvCell(value: string): string {
  const s = String(value ?? '');
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
