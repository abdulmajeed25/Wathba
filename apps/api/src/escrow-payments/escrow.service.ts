import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MoyasarAdapter } from './moyasar.adapter';
import { PledgeStatus, type Pledge } from '@prisma/client';

/**
 * Escrow facade — internal-only. The funding context calls these from
 * inside transactions to keep DB and PSP state consistent.
 */
@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moyasar: MoyasarAdapter,
  ) {}

  async hold(input: {
    pledgeId: string;
    amountHalalas: bigint;
    source: string;
    description: string;
  }): Promise<{ paymentRef: string; status: 'authorized' | 'failed' }> {
    return this.moyasar.hold({
      pledgeId: input.pledgeId,
      amountHalalas: Number(input.amountHalalas),
      source: input.source,
      description: input.description,
    });
  }

  async captureAllHeld(projectId: string): Promise<{ captured: number; failed: number }> {
    const pledges = await this.prisma.pledge.findMany({
      where: { projectId, status: PledgeStatus.HELD },
    });
    let captured = 0;
    let failed = 0;
    for (const p of pledges) {
      if (await this.captureOne(p)) captured++;
      else failed++;
    }
    this.logger.log(`Captured ${captured} / failed ${failed} pledges for project=${projectId}`);
    return { captured, failed };
  }

  async refundAllHeld(projectId: string): Promise<{ refunded: number; failed: number }> {
    const pledges = await this.prisma.pledge.findMany({
      where: { projectId, status: PledgeStatus.HELD },
    });
    let refunded = 0;
    let failed = 0;
    for (const p of pledges) {
      if (await this.refundOne(p)) refunded++;
      else failed++;
    }
    this.logger.log(`Refunded ${refunded} / failed ${failed} pledges for project=${projectId}`);
    return { refunded, failed };
  }

  private async captureOne(p: Pledge): Promise<boolean> {
    try {
      const { ok } = await this.moyasar.capture(p.paymentRef);
      if (!ok) return false;
      await this.prisma.pledge.update({
        where: { id: p.id },
        data: { status: PledgeStatus.CAPTURED, capturedAt: new Date() },
      });
      return true;
    } catch (err) {
      this.logger.error(`capture failed for pledge=${p.id}`, err as Error);
      return false;
    }
  }

  private async refundOne(p: Pledge): Promise<boolean> {
    try {
      // Held funds are voided rather than refunded; stub returns ok.
      const { ok } = await this.moyasar.void(p.paymentRef);
      if (!ok) return false;
      await this.prisma.pledge.update({
        where: { id: p.id },
        data: { status: PledgeStatus.REFUNDED, refundedAt: new Date() },
      });
      return true;
    } catch (err) {
      this.logger.error(`refund failed for pledge=${p.id}`, err as Error);
      return false;
    }
  }
}
