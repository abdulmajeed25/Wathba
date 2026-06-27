import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BidStatus, Prisma, RFQStatus, type RFQ, type SupplierBid } from '@prisma/client';
import { CreateRFQDto, ListRFQsQueryDto, SubmitBidDto } from './dto/procurement.dto';

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

  constructor(private readonly prisma: PrismaService) {}

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

  async list(q: ListRFQsQueryDto): Promise<RFQ[]> {
    const where: Prisma.RFQWhereInput = {};
    if (q.projectId) where.projectId = q.projectId;
    if (q.status) where.status = q.status as RFQStatus;
    return this.prisma.rFQ.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
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

    return this.prisma.$transaction(async (tx) => {
      const updatedRFQ = await tx.rFQ.update({
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
      return updatedRFQ;
    });
  }

  async listMyBids(supplierId: string): Promise<SupplierBid[]> {
    return this.prisma.supplierBid.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
    });
  }

  toPublicRFQ(r: RFQ & { bids?: SupplierBid[] }): Record<string, unknown> {
    return {
      id: r.id,
      projectId: r.projectId,
      specsAr: r.specsAr,
      dueDate: r.dueDate.toISOString(),
      status: r.status,
      awardedBidId: r.awardedBidId,
      createdAt: r.createdAt.toISOString(),
      bids: r.bids?.map((b) => this.toPublicBid(b)),
    };
  }

  toPublicBid(b: SupplierBid): Record<string, unknown> {
    return {
      id: b.id,
      rfqId: b.rfqId,
      supplierId: b.supplierId,
      amountHalalas: Number(b.amountHalalas),
      leadTimeDays: b.leadTimeDays,
      specComplianceNote: b.specComplianceNote,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
    };
  }
}
