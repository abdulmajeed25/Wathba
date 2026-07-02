import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MoyasarAdapter } from './moyasar.adapter';
import { LedgerService } from './ledger.service';
import { LedgerEntryType, PledgeStatus, type Pledge } from '@prisma/client';

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
    private readonly ledger: LedgerService,
  ) {}

  async hold(input: {
    pledgeId: string;
    amountHalalas: bigint;
    source: string;
    description: string;
    callbackUrl?: string;
  }): Promise<{ paymentRef: string; status: 'authorized' | 'failed' }> {
    return this.moyasar.hold({
      pledgeId: input.pledgeId,
      amountHalalas: Number(input.amountHalalas),
      source: input.source,
      description: input.description,
      callbackUrl: input.callbackUrl,
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

  /**
   * Sprint 1 / P0-303: PSP calls retry 3× with exponential backoff before
   * counting as failed. Moyasar capture/void are idempotent per paymentRef,
   * so a retry after an ambiguous timeout is safe.
   */
  private async withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        this.logger.warn(`${label} attempt ${attempt}/3 failed: ${String(err)}`);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));
      }
    }
    throw lastErr;
  }

  private async captureOne(p: Pledge): Promise<boolean> {
    try {
      const { ok } = await this.withRetry(`capture pledge=${p.id}`, () =>
        this.moyasar.capture(p.paymentRef),
      );
      if (!ok) return false;
      await this.prisma.pledge.update({
        where: { id: p.id },
        data: { status: PledgeStatus.CAPTURED, capturedAt: new Date() },
      });
      await this.ledger.record({
        entryType: LedgerEntryType.CAPTURE,
        // Full held amount = tier + add-ons (Sprint 2 undercharge fix).
        amountHalalas: p.amountHalalas + p.addOnsHalalas,
        pspRef: p.paymentRef,
        pledgeId: p.id,
        projectId: p.projectId,
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
      const { ok } = await this.withRetry(`void pledge=${p.id}`, () =>
        this.moyasar.void(p.paymentRef),
      );
      if (!ok) return false;
      await this.prisma.pledge.update({
        where: { id: p.id },
        data: { status: PledgeStatus.REFUNDED, refundedAt: new Date() },
      });
      await this.ledger.record({
        entryType: LedgerEntryType.VOID,
        amountHalalas: p.amountHalalas + p.addOnsHalalas,
        pspRef: p.paymentRef,
        pledgeId: p.id,
        projectId: p.projectId,
      });
      return true;
    } catch (err) {
      this.logger.error(`refund failed for pledge=${p.id}`, err as Error);
      return false;
    }
  }
}
