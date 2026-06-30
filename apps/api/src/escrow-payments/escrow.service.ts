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

  /**
   * Max concurrent PSP calls per settlement. Tuned for Moyasar's documented
   * rate limit (~25 req/s). A project with 500 backers settles in ~20 batches
   * of 25 instead of 500 sequential roundtrips.
   */
  private static readonly BATCH_CONCURRENCY = 25;

  async captureAllHeld(projectId: string): Promise<{ captured: number; failed: number }> {
    const pledges = await this.prisma.pledge.findMany({
      where: { projectId, status: PledgeStatus.HELD },
    });
    const { ok, fail } = await this.runConcurrent(pledges, (p) => this.captureOne(p));
    this.logger.log(`Captured ${ok} / failed ${fail} pledges for project=${projectId}`);
    return { captured: ok, failed: fail };
  }

  async refundAllHeld(projectId: string): Promise<{ refunded: number; failed: number }> {
    const pledges = await this.prisma.pledge.findMany({
      where: { projectId, status: PledgeStatus.HELD },
    });
    const { ok, fail } = await this.runConcurrent(pledges, (p) => this.refundOne(p));
    this.logger.log(`Refunded ${ok} / failed ${fail} pledges for project=${projectId}`);
    return { refunded: ok, failed: fail };
  }

  /**
   * Bounded-concurrency runner: walks `pledges` in batches of
   * BATCH_CONCURRENCY using Promise.allSettled, so a single PSP timeout
   * stalls only its own pledge instead of every later one in the list.
   * Returns counts; per-pledge errors are logged inside captureOne /
   * refundOne. The pledge stays in HELD on failure so the next settlement
   * attempt or operator intervention can retry — explicit "mark FAILED on
   * settlement-time failure" is a separate decision (Tier 2/3 cleanup).
   */
  private async runConcurrent(
    pledges: Pledge[],
    task: (p: Pledge) => Promise<boolean>,
  ): Promise<{ ok: number; fail: number }> {
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < pledges.length; i += EscrowService.BATCH_CONCURRENCY) {
      const slice = pledges.slice(i, i + EscrowService.BATCH_CONCURRENCY);
      const results = await Promise.allSettled(slice.map((p) => task(p)));
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) ok++;
        else fail++;
      }
    }
    return { ok, fail };
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
