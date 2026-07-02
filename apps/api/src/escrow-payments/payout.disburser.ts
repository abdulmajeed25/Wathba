import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { LedgerEntryType, PayoutStatus, type Payout } from '@prisma/client';

/**
 * Payout disbursement worker (Sprint 1 / P0-301).
 *
 * Consumes PENDING payouts (written in-tx by milestone release, P0-601) and
 * pushes the money out through the payout provider. Provider integration
 * follows the MoyasarAdapter pattern: real call when PAYOUT_PROVIDER_KEY is
 * configured, deterministic stub otherwise so the full release → payout →
 * ledger pipeline runs locally.
 *
 * Crash-safety note: the provider call and the SENT update are not atomic.
 * A crash in between would re-send on the next tick — acceptable for the
 * stub; the real provider integration MUST pass `payout.id` as its
 * idempotency key so the retry is absorbed provider-side.
 */
@Injectable()
export class PayoutDisburser {
  private readonly logger = new Logger(PayoutDisburser.name);
  private readonly providerKey: string;
  private static readonly BATCH = 25;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    cfg: ConfigService,
  ) {
    this.providerKey = cfg.get<string>('PAYOUT_PROVIDER_KEY') ?? '';
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'payout-disburse-tick' })
  async tick(): Promise<void> {
    if (process.env.PAYOUT_TICK_DISABLED === 'true') {
      this.logger.warn('payout tick SKIPPED — PAYOUT_TICK_DISABLED=true (unset this after maintenance!)');
      return;
    }
    try {
      const { sent, failed } = await this.disbursePending();
      if (sent + failed > 0) this.logger.log(`Payout tick: sent=${sent} failed=${failed}`);
    } catch (err) {
      this.logger.error('payout tick failed', err as Error);
    }
  }

  async disbursePending(): Promise<{ sent: number; failed: number }> {
    const pending = await this.prisma.payout.findMany({
      where: { status: PayoutStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: PayoutDisburser.BATCH,
    });
    let sent = 0;
    let failed = 0;
    for (const p of pending) {
      // Sequential on purpose: payouts are low-volume, high-stakes.
      if (await this.disburseOne(p)) sent++;
      else failed++;
    }
    return { sent, failed };
  }

  private async disburseOne(p: Payout): Promise<boolean> {
    try {
      const transferRef = await this.sendViaProvider(p);
      await this.prisma.payout.update({
        where: { id: p.id },
        data: { status: PayoutStatus.SENT, sentAt: new Date() },
      });
      await this.ledger.record({
        entryType: LedgerEntryType.PAYOUT_SENT,
        amountHalalas: p.amountHalalas,
        pspRef: transferRef,
        payoutId: p.id,
        projectId: p.projectId,
        source: 'disburser',
      });
      this.logger.log(
        `Payout SENT id=${p.id} creator=${p.creatorId} amount=${p.amountHalalas} ref=${transferRef}`,
      );
      return true;
    } catch (err) {
      // Stays PENDING — retried next tick; repeated failures surface in logs.
      this.logger.error(`payout disburse failed id=${p.id} (stays PENDING)`, err as Error);
      return false;
    }
  }

  private async sendViaProvider(p: Payout): Promise<string> {
    if (!this.providerKey) {
      this.logger.warn(
        `[STUB] Disburse payout=${p.id} amount=${Number(p.amountHalalas) / 100} SAR to creator=${p.creatorId}`,
      );
      return `stub-transfer-${p.id.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
    }
    // Real provider integration lands in Sprint 2 (bank transfer / Moyasar
    // Payouts) — MUST use p.id as the idempotency key.
    throw new Error('real payout provider not yet integrated — unset PAYOUT_PROVIDER_KEY to use stub');
  }
}
