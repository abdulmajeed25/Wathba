import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { HeartbeatService } from '../common/heartbeat.service';
import { ZatcaService } from './zatca.service';
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
  private readonly providerUrl: string;
  private static readonly BATCH = 25;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly zatca: ZatcaService,
    private readonly heartbeat: HeartbeatService,
    cfg: ConfigService,
  ) {
    this.providerKey = cfg.get<string>('PAYOUT_PROVIDER_KEY') ?? '';
    this.providerUrl =
      cfg.get<string>('PAYOUT_PROVIDER_URL') ?? 'https://api.moyasar.com/v1/payouts';
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'payout-disburse-tick' })
  async tick(): Promise<void> {
    this.heartbeat.beat('payout-tick');
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
      // ZATCA (Sprint 2 / P0-701): each disbursed tranche carries the
      // platform-commission tax invoice. Failure must not undo the payout —
      // log loudly; generateForPayout is idempotent so the next tick heals.
      try {
        const inv = await this.zatca.generateForPayout(p);
        this.logger.log(`ZATCA invoice ${inv.invoiceNumber} issued for payout=${p.id}`);
      } catch (err) {
        this.logger.error(`ZATCA invoice FAILED for payout=${p.id} — backfill required`, err as Error);
      }
      return true;
    } catch (err) {
      // Stays PENDING — retried next tick; repeated failures surface in logs.
      this.logger.error(`payout disburse failed id=${p.id} (stays PENDING)`, err as Error);
      return false;
    }
  }

  /**
   * Sprint 5 / #4 — real payout provider (Moyasar Payouts-style REST).
   *
   * `Idempotency-Key: payout-<id>` makes a retry after an ambiguous timeout
   * safe: the provider dedups it, so we never double-pay. A non-2xx or a
   * missing transfer reference throws — the caller keeps the payout PENDING
   * for the next tick (never marks SENT on an unconfirmed transfer).
   *
   * Stub mode (no PAYOUT_PROVIDER_KEY) is unchanged for local/dev so the full
   * release → payout → disburse → ledger → ZATCA pipeline runs offline.
   */
  private async sendViaProvider(p: Payout): Promise<string> {
    if (!this.providerKey) {
      this.logger.warn(
        `[STUB] Disburse payout=${p.id} amount=${Number(p.amountHalalas) / 100} SAR to creator=${p.creatorId}`,
      );
      return `stub-transfer-${p.id.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
    }
    const res = await fetch(this.providerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.providerKey}`,
        'idempotency-key': `payout-${p.id}`,
      },
      body: JSON.stringify({
        amount: Number(p.amountHalalas),
        currency: 'SAR',
        destination: p.creatorId,
        description: `وثبة — صرف دفعة مرحلة ${p.milestoneId}`,
        metadata: { payoutId: p.id, projectId: p.projectId },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(`payout provider ${res.status}: ${JSON.stringify(json)}`);
    }
    const ref = json['id'] ?? json['transfer_id'] ?? json['reference'];
    if (typeof ref !== 'string' || ref.length === 0) {
      throw new Error('payout provider returned no transfer reference');
    }
    return ref;
  }
}
