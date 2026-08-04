import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BidStatus, Prisma, RFQStatus, type RFQ, type SupplierBid } from '@prisma/client';
import { CreateRFQDto, ListRFQsQueryDto, SubmitBidDto } from './dto/procurement.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { notifyAwardOutcome } from './award-notify';

/**
 * Procurement — reverse supplier auction.
 *
 *  1. Creator opens an RFQ (OPEN).
 *  2. Suppliers post bids (one each); bids returned sorted asc by amount.
 *  3. Creator awards exactly one bid; chosen → AWARDED, others → REJECTED,
 *     RFQ → AWARDED. Atomic in a single $transaction.
 */
@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
  ) {}

  /**
   * CLOSEOUT C2 — the award fan-out, now covering BOTH sides of the decision
   * (winner + the non-winning bidders). The implementation is shared with the
   * operator override (`rfq.award`) via `notifyAwardOutcome`; this method stays
   * as the service-level seam. Exactly one path fires per RFQ (a second award
   * is refused once status=AWARDED), so no cross-path dedup is needed.
   * Fire-and-forget; a notify failure never rolls back an award.
   */
  async notifyAwardOutcome(rfqId: string, winningBidId: string): Promise<void> {
    await notifyAwardOutcome(
      { prisma: this.prisma, notifications: this.notifications, email: this.email },
      rfqId,
      winningBidId,
    );
  }

  async create(creatorId: string, dto: CreateRFQDto): Promise<RFQ> {
    const proj = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!proj) throw new NotFoundException('project not found');
    if (proj.createdById !== creatorId) {
      throw new ForbiddenException('only the project creator may publish an RFQ');
    }
    const dueDate = new Date(dto.dueDate);
    if (dueDate.getTime() <= Date.now()) {
      throw new BadRequestException('dueDate must be in the future');
    }
    return this.prisma.rFQ.create({
      data: { projectId: dto.projectId, specsAr: dto.specsAr, dueDate, status: RFQStatus.OPEN },
    });
  }

  async list(q: ListRFQsQueryDto): Promise<
    Array<RFQ & { project: { titleAr: string; category: string | null }; _count: { bids: number } }>
  > {
    const where: Prisma.RFQWhereInput = {};
    if (q.projectId) where.projectId = q.projectId;
    if (q.status) where.status = q.status as RFQStatus;
    return this.prisma.rFQ.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      include: {
        project: { select: { titleAr: true, category: true } },
        _count: { select: { bids: true } },
      },
    });
  }

  async findById(id: string): Promise<RFQ & { bids: SupplierBid[] }> {
    const rfq = await this.prisma.rFQ.findUnique({
      where: { id },
      include: { bids: { orderBy: { amountHalalas: 'asc' } } },
    });
    if (!rfq) throw new NotFoundException('rfq not found');
    return rfq;
  }

  async submitBid(supplierId: string, rfqId: string, dto: SubmitBidDto): Promise<SupplierBid> {
    const rfq = await this.prisma.rFQ.findUnique({ where: { id: rfqId } });
    if (!rfq) throw new NotFoundException('rfq not found');
    if (rfq.status !== RFQStatus.OPEN) {
      throw new BadRequestException(`rfq is ${rfq.status}, no longer accepting bids`);
    }
    if (rfq.dueDate.getTime() <= Date.now()) {
      throw new BadRequestException('rfq dueDate has passed');
    }
    const existing = await this.prisma.supplierBid.findFirst({ where: { rfqId, supplierId } });
    if (existing) {
      throw new BadRequestException('you already submitted a bid; delete it before resubmitting');
    }
    return this.prisma.supplierBid.create({
      data: {
        rfqId,
        supplierId,
        amountHalalas: BigInt(dto.amountHalalas),
        leadTimeDays: dto.leadTimeDays,
        specComplianceNote: dto.specComplianceNote,
        status: BidStatus.SUBMITTED,
      },
    });
  }

  async withdrawBid(supplierId: string, bidId: string): Promise<{ deleted: true }> {
    const bid = await this.prisma.supplierBid.findUnique({ where: { id: bidId } });
    if (!bid) throw new NotFoundException('bid not found');
    if (bid.supplierId !== supplierId) throw new ForbiddenException('not your bid');
    if (bid.status !== BidStatus.SUBMITTED) {
      throw new BadRequestException(`bid is ${bid.status} — cannot withdraw`);
    }
    await this.prisma.supplierBid.delete({ where: { id: bidId } });
    return { deleted: true };
  }

  async award(creatorId: string, rfqId: string, bidId: string): Promise<RFQ> {
    const rfq = await this.prisma.rFQ.findUnique({
      where: { id: rfqId },
      include: { project: true },
    });
    if (!rfq) throw new NotFoundException('rfq not found');
    if (rfq.project.createdById !== creatorId) {
      throw new ForbiddenException('only the project creator may award');
    }
    if (rfq.status !== RFQStatus.OPEN) {
      throw new BadRequestException(`rfq is ${rfq.status}, cannot award`);
    }
    const bid = await this.prisma.supplierBid.findUnique({ where: { id: bidId } });
    if (!bid || bid.rfqId !== rfqId) throw new NotFoundException('bid not found for this rfq');

    const updatedRFQ = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.rFQ.update({
        where: { id: rfqId },
        data: { status: RFQStatus.AWARDED, awardedBidId: bidId },
      });
      await tx.supplierBid.update({
        where: { id: bidId },
        data: { status: BidStatus.AWARDED },
      });
      await tx.supplierBid.updateMany({
        where: { rfqId, id: { not: bidId } },
        data: { status: BidStatus.REJECTED },
      });
      this.logger.log(`RFQ ${rfqId} awarded to bid ${bidId}`);
      return updated;
    });

    // CLOSEOUT C2 — notify the winner AND the non-winning bidders after commit.
    await this.notifyAwardOutcome(rfqId, bidId);
    return updatedRFQ;
  }

  async listMyBids(
    supplierId: string,
  ): Promise<Array<SupplierBid & { rfq?: { project: { titleAr: string } } }>> {
    return this.prisma.supplierBid.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
      include: { rfq: { select: { project: { select: { titleAr: true } } } } },
    });
  }

  toPublicRFQ(
    r: RFQ & {
      bids?: SupplierBid[];
      project?: { titleAr: string; category?: string | null };
      _count?: { bids: number };
    },
  ): Record<string, unknown> {
    return {
      id: r.id,
      projectId: r.projectId,
      // Web-SDK contract fields (ventures naming) — Sprint 3 / P0-302.
      ventureId: r.projectId,
      ventureSlug: r.projectId,
      ventureTitleAr: r.project?.titleAr ?? 'مشروع',
      category: r.project?.category ?? 'TECH',
      bidsCount: r._count?.bids ?? r.bids?.length ?? 0,
      specsAr: r.specsAr,
      dueDate: r.dueDate.toISOString(),
      status: r.status,
      /**
       * Whether a bid would actually be ACCEPTED right now.
       *
       * `status` and `dueDate` are two independent axes and nothing reconciles
       * them: an RFQ stays OPEN as its due date sails past, so `status: 'OPEN'`
       * alone is not an invitation to bid. createBid enforces both (see the
       * dueDate check there) — this exposes the same rule so a client does not
       * have to rediscover it, which is exactly what the supplier portal failed
       * to do: it offered the top OPEN request, and the bid was rejected with
       * "rfq dueDate has passed".
       *
       * Sorting compounds it. The list is ordered by dueDate ascending, so the
       * MOST expired request is the FIRST thing a supplier sees.
       */
      biddable: r.status === 'OPEN' && r.dueDate.getTime() > Date.now(),
      awardedBidId: r.awardedBidId,
      createdAt: r.createdAt.toISOString(),
      bids: r.bids?.map((b) => this.toPublicBid(b)),
    };
  }

  toPublicBid(
    b: SupplierBid & { rfq?: { project: { titleAr: string } } },
  ): Record<string, unknown> {
    return {
      id: b.id,
      rfqId: b.rfqId,
      rfqTitleAr: b.rfq?.project.titleAr ?? 'طلب توريد',
      supplierId: b.supplierId,
      amountHalalas: Number(b.amountHalalas),
      leadTimeDays: b.leadTimeDays,
      specComplianceNote: b.specComplianceNote,
      status: b.status,
      submittedAt: b.createdAt.toISOString(),
      createdAt: b.createdAt.toISOString(),
    };
  }
}
