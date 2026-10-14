import { availableProjectFunds } from './project-liquidity';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { HeartbeatService } from '../common/heartbeat.service';
import { ZatcaService } from './zatca.service';
import { PayoutBeneficiaryService } from './payout-beneficiary.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../identity/audit.service';
import { LedgerEntryType, PayoutStatus, type Payout } from '@prisma/client';
import { commissionBreakdown } from '../config/fees';

/** A validated creator bank/wallet beneficiary — required by Moyasar's
 *  `POST /payouts` `destination` object (Sprint 5 / #4). */
export interface PayoutBeneficiary {
  type: 'bank_account' | 'wallet';
  iban?: string;
  name?: string;
  mobile: string;
  country?: string;
  city?: string;
}

/** Moyasar payout `status` values that mean "accepted / in flight". */
const ACCEPTED_STATUSES = new Set(['queued', 'initiated', 'paid']);
/** Terminal-failure statuses — OPS-0 correction #3: these now write FAILED. */
const FAILED_STATUSES = new Set(['failed', 'canceled']);

/** A local failure proved to occur before any provider request. */
class PayoutPreflightError extends Error {}
type ProviderEvidence = { id: string; status: string; amount: number; currency: string;
  sequence_number: string; source_id: string; failure_reason?: string };
type PayoutAttempt = 'sent' | 'failed' | 'pending';

/**
 * Build the Moyasar `POST /payouts` request body per the documented contract
 * (docs.moyasar.com/api/payouts/04-create-payout). Pure + unit-testable so
 * the contract shape is verified without live credentials.
 *
 * Moyasar has NO idempotency header; `sequence_number` is our stable
 * reference (deterministic from the payout id) so a retry reuses it and
 * reconciliation can match on it.
 */
export function buildPayoutRequest(input: {
  sourceId: string;
  amountHalalas: bigint;
  purpose: string;
  payoutId: string;
  projectId: string;
  milestoneId: string;
  destination: PayoutBeneficiary;
}): Record<string, unknown> {
  return {
    source_id: input.sourceId,
    amount: Number(input.amountHalalas), // Moyasar amount = smallest unit (halalas)
    currency: 'SAR',
    purpose: input.purpose,
    sequence_number: sequenceNumberFor(input.payoutId),
    destination: { ...input.destination, type: input.destination.type === 'bank_account' ? 'bank' : 'wallet' },
    comment: `Wathba milestone payout ${input.milestoneId}`,
    metadata: { payoutId: input.payoutId, projectId: input.projectId },
  };
}

/** Deterministic 16-digit reference from the payout id. */
export function sequenceNumberFor(payoutId: string): string {
  const hex = createHash('sha256').update(payoutId).digest('hex').slice(0, 15);
  return (BigInt('0x' + hex) % 10_000_000_000_000_000n).toString().padStart(16, '0');
}

/**
 * Payout disbursement worker (Sprint 1 / P0-301).
 *
 * Consumes PENDING payouts (written in-tx by milestone release, P0-601) and
 * pushes the money out through the payout provider. Provider integration
 * follows the MoyasarAdapter pattern: real call when PAYOUT_PROVIDER_KEY is
 * configured, deterministic stub otherwise so the full release → payout →
 * ledger pipeline runs locally.
 *
 * Crash-safety (OPS-0 correction #3): each payout is CLAIMED atomically
 * (PENDING→SENDING via a status-guarded updateMany) before the provider call,
 * so a concurrent tick — cron racing the manual ops trigger — can never
 * double-send. A crash mid-flight leaves the row visibly stuck in SENDING
 * (surfaced loudly each tick), never silently re-payable; the deterministic
 * `sequence_number` supports matching; it does not guarantee provider idempotency.
 * Only verified paid results write SENT. Unknown remote outcomes remain
 * SENDING; only preflight failures before an HTTP request return to PENDING.
 */
@Injectable()
export class PayoutDisburser {
  private readonly logger = new Logger(PayoutDisburser.name);
  private readonly providerKey: string;
  private readonly providerUrl: string;
  private readonly sourceId: string;
  private readonly purpose: string;
  private static readonly BATCH = 25;

  constructor(
    private readonly prisma: PrismaService,
    _ledger: LedgerService,
    private readonly zatca: ZatcaService,
    private readonly heartbeat: HeartbeatService,
    private readonly beneficiaries: PayoutBeneficiaryService,
    cfg: ConfigService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {
    this.providerKey = cfg.get<string>('PAYOUT_PROVIDER_KEY') ?? '';
    this.providerUrl =
      cfg.get<string>('PAYOUT_PROVIDER_URL') ?? 'https://api.moyasar.com/v1/payouts';
    // Wathba's Moyasar payout SOURCE account id (created once in the dashboard).
    this.sourceId = cfg.get<string>('MOYASAR_PAYOUT_SOURCE_ID') ?? '';
    this.purpose = cfg.get<string>('MOYASAR_PAYOUT_PURPOSE') ?? 'expenses_services';
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

  async disbursePending(): Promise<{ sent: number; failed: number; pending: number }> {
    // OPS-0 correction #3 — a row stuck in SENDING means a crash mid-provider
    // call: it must NEVER be auto-resent (double-pay risk); surface it loudly
    // every tick until an operator reconciles it (money.reconcile, Part 5§4).
    const stuck = await this.prisma.payout.findMany({
      where: { status: PayoutStatus.SENDING, claimedAt: { lt: new Date(Date.now() - 15 * 60_000) } },
      select: { id: true },
    });
    if (stuck.length > 0) {
      this.logger.error(
        `PAYOUTS STUCK IN SENDING (crash mid-send, need manual reconciliation): ${stuck.map((s) => s.id).join(', ')}`,
      );
    }
    const pending = await this.prisma.payout.findMany({
      where: { status: PayoutStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: PayoutDisburser.BATCH,
    });
    let sent = 0;
    let failed = 0;
    let awaiting = 0;
    for (const p of pending) {
      // Sequential on purpose: payouts are low-volume, high-stakes.
      const result = await this.disburseOne(p);
      if (result === 'sent') sent++;
      else if (result === 'pending') awaiting++;
      else failed++;
    }
    return { sent, failed, pending: awaiting };
  }

  private async disburseOne(p: Payout): Promise<PayoutAttempt> {
    const fees = commissionBreakdown(p.amountHalalas);
    const sequence = sequenceNumberFor(p.id);
    const claim = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
      if (await availableProjectFunds(tx, p.projectId) < 0n) {
        await tx.payout.updateMany({ where: { id: p.id, status: PayoutStatus.PENDING },
          data: { failureReason: 'insufficient-unreserved-funds' } });
        return { count: 0 };
      }
    return tx.payout.updateMany({
      where: { id: p.id, status: PayoutStatus.PENDING, amountHalalas: p.amountHalalas, providerRef: null },
      data: { status: PayoutStatus.SENDING, claimedAt: new Date(), failureReason: null,
        providerSequenceNumber: sequence, providerSourceId: this.sourceId || 'local-stub',
        netHalalas: fees.netHalalas, feeWithheldHalalas: fees.withheldHalalas },
    });
    });
    if (claim.count === 0) return 'failed';
    const claimed = { ...p, providerSequenceNumber: sequence, providerSourceId: this.sourceId || 'local-stub',
      netHalalas: fees.netHalalas, feeWithheldHalalas: fees.withheldHalalas };
    try {
      return await this.applyProviderEvidence(claimed, await this.sendViaProvider(claimed));
    } catch (error) {
      const preflight = error instanceof PayoutPreflightError;
      // Once a request may have left this process, never put it back in the
      // automatic POST queue. This also covers failure after remote success.
      await this.prisma.payout.updateMany({
        where: { id: p.id, status: PayoutStatus.SENDING },
        data: preflight ? { status: PayoutStatus.PENDING, claimedAt: null, failureReason: 'configuration-incomplete' }
          : { failureReason: 'provider-outcome-needs-reconciliation' },
      });
      this.logger.error(`Payout ${p.id}: ${preflight ? 'preflight blocked' : 'reconciliation required'}`);
      return preflight ? 'failed' : 'pending';
    }
  }

  /** Governed operator read: GET only. No resubmission of a transfer. */
  async reconcilePayout(payoutId: string): Promise<{ status: string; providerStatus: string | null }> {
    const p = await this.prisma.payout.findUniqueOrThrow({ where: { id: payoutId } });
    if (p.status !== PayoutStatus.SENDING || !p.providerRef || !p.providerSequenceNumber ||
        !p.providerSourceId || p.netHalalas === null || p.feeWithheldHalalas === null) {
      throw new ConflictException('Payout requires a saved provider reference and original payment snapshot');
    }
    if (!this.providerKey) throw new ConflictException('Provider verification is unavailable in stub mode');
    // Official Fetch Payout endpoint is singular /payout/:id.
    const base = this.providerUrl.replace(/\/payouts\/?$/, '/payout');
    const res = await fetch(`${base}/${encodeURIComponent(p.providerRef)}`, {
      headers: { authorization: this.authorization() }, signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new ConflictException('Provider read failed; payout has not been resubmitted');
    const evidence = this.validateEvidence(await res.json(), p);
    await this.applyProviderEvidence(p, evidence);
    const current = await this.prisma.payout.findUniqueOrThrow({ where: { id: p.id } });
    return { status: current.status, providerStatus: current.providerStatus };
  }

  private authorization(): string {
    return `Basic ${Buffer.from(`${this.providerKey}:`).toString('base64')}`;
  }

  private validateEvidence(raw: unknown, p: Payout): ProviderEvidence {
    const e = raw as Partial<ProviderEvidence> | null;
    if (!e || typeof e.id !== 'string' || !e.id || (p.providerRef && e.id !== p.providerRef) ||
        !Number.isSafeInteger(e.amount) || BigInt(e.amount!) !== p.netHalalas || e.currency !== 'SAR' ||
        e.sequence_number !== p.providerSequenceNumber || e.source_id !== p.providerSourceId ||
        typeof e.status !== 'string' || (!ACCEPTED_STATUSES.has(e.status) && !FAILED_STATUSES.has(e.status) && e.status !== 'returned')) {
      throw new ConflictException('Provider evidence does not match the saved payout; reconciliation required');
    }
    return e as ProviderEvidence;
  }

  private async applyProviderEvidence(p: Payout, e: ProviderEvidence): Promise<PayoutAttempt> {
    const paid = e.status === 'paid';
    const failed = FAILED_STATUSES.has(e.status);
    const saved = await this.prisma.payout.updateMany({
      where: { id: p.id, status: PayoutStatus.SENDING, amountHalalas: p.amountHalalas,
        netHalalas: p.netHalalas, feeWithheldHalalas: p.feeWithheldHalalas,
        providerSequenceNumber: p.providerSequenceNumber,
        AND: [{ OR: [{ providerRef: null }, { providerRef: e.id }] },
          ...(paid ? [] : [{ OR: [{ providerStatus: null }, { providerStatus: { not: 'paid' } }] }])],
      },
      data: { providerRef: e.id, providerStatus: e.status, providerCheckedAt: new Date(),
        ...(failed ? { status: PayoutStatus.FAILED } : {}),
        failureReason: paid ? null : failed ? 'provider-rejected' : e.status === 'returned'
          ? 'provider-returned-needs-reconciliation' : 'awaiting-provider-confirmation',
      },
    });
    if (saved.count !== 1) {
      const current = await this.prisma.payout.findUniqueOrThrow({ where: { id: p.id } });
      return current.status === 'SENT' ? 'sent' : current.status === 'FAILED' ? 'failed' : 'pending';
    }
    if (failed) {
      await this.audit.log({ actorId: null, action: 'system.payout.failed', entity: 'Payout', entityId: p.id,
        detail: { projectId: p.projectId, providerStatus: e.status, pspRef: e.id } });
      return 'failed';
    }
    if (!paid) return 'pending';
    const applied = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
      const claim = await tx.payout.updateMany({
        where: { id: p.id, status: PayoutStatus.SENDING, providerRef: e.id, providerStatus: 'paid',
          amountHalalas: p.amountHalalas, netHalalas: p.netHalalas, feeWithheldHalalas: p.feeWithheldHalalas },
        data: { status: PayoutStatus.SENT, sentAt: new Date(), failureReason: null },
      });
      if (claim.count !== 1) return false;
      await tx.project.updateMany({ where: { id: p.projectId, settledAt: null }, data: { settledAt: new Date() } });
      await tx.ledgerEntry.create({ data: { entryType: LedgerEntryType.PAYOUT_SENT, amountHalalas: p.netHalalas!,
        pspRef: e.id, payoutId: p.id, projectId: p.projectId, source: 'disburser' } });
      await tx.ledgerEntry.create({ data: { entryType: LedgerEntryType.COMMISSION, amountHalalas: p.feeWithheldHalalas!,
        pspRef: `commission-${p.id}`, payoutId: p.id, projectId: p.projectId, source: 'disburser' } });
      return true;
    });
    if (applied) {
      await this.notifyConfirmed(p, e.id);
      return 'sent';
    }
    const current = await this.prisma.payout.findUniqueOrThrow({ where: { id: p.id } });
    return current.status === 'SENT' ? 'sent' : 'pending';
  }

  private async notifyConfirmed(p: Payout, transferRef: string): Promise<void> {
    const fees = { netHalalas: p.netHalalas!, withheldHalalas: p.feeWithheldHalalas! };
      this.logger.log(
        `Payout SENT id=${p.id} creator=${p.creatorId} gross=${p.amountHalalas} net=${fees.netHalalas} withheld=${fees.withheldHalalas} ref=${transferRef}`,
      );
      // MONEY-AUDIT — the PENDING→SENT money flip. Guarded by the atomic
      // PENDING→SENDING claim above (claim.count===0 → return false), so a
      // concurrent tick / re-run cannot re-audit an already-sent payout.
      // actorId null = النظام. Never throws.
      await this.audit.log({
        actorId: null,
        action: 'system.payout.sent',
        entity: 'Payout',
        entityId: p.id,
        detail: {
          projectId: p.projectId,
          creatorId: p.creatorId,
          milestoneId: p.milestoneId,
          grossHalalas: p.amountHalalas.toString(),
          netHalalas: fees.netHalalas.toString(),
          withheldHalalas: fees.withheldHalalas.toString(),
          pspRef: transferRef,
        },
      });
      // STAKES follow-up (F2/F4) — notify + email the creator (best-effort; a
      // comms glitch must never undo a sent payout).
      try {
        const [creator, project] = await Promise.all([
          this.prisma.user.findUnique({ where: { id: p.creatorId }, select: { email: true } }),
          this.prisma.project.findUnique({ where: { id: p.projectId }, select: { titleAr: true } }),
        ]);
        await this.notifications.create({
          userId: p.creatorId,
          kind: 'PAYOUT_SENT',
          payload: {
            projectId: p.projectId,
            payoutId: p.id,
            title: `تم تحويل دفعة مشروع «${project?.titleAr ?? ''}»`,
            // OPS-0 correction #2 — the creator is told the NET actually sent.
            body: `حوّلنا دفعة بقيمة ${(Number(fees.netHalalas) / 100).toFixed(0)} ر.س إلى حسابك (بعد خصم عمولة المنصة وضريبتها).`,
          },
        });
        if (creator?.email && project) {
          await this.email.payoutSent(creator.email, {
            projectTitle: project.titleAr,
            amountHalalas: Number(fees.netHalalas),
          });
        }
      } catch (err) {
        this.logger.error(`payout-sent comms failed id=${p.id}`, err as Error);
      }
      // ZATCA (Sprint 2 / P0-701): each disbursed tranche carries the
      // platform-commission tax invoice. Failure must not undo the payout —
      // log loudly; the governed invoice retry is required to backfill.
      try {
        const inv = await this.zatca.generateForPayout(p);
        this.logger.log(`ZATCA invoice ${inv.invoiceNumber} issued for payout=${p.id}`);
      } catch (err) {
        this.logger.error(`ZATCA invoice FAILED for payout=${p.id} — backfill required`, err as Error);
      }
  }

  private async sendViaProvider(p: Payout): Promise<ProviderEvidence> {
    if (!Number.isSafeInteger(Number(p.netHalalas)) || p.netHalalas! <= 0n) throw new PayoutPreflightError('Invalid payout amount');
    if (!this.providerKey) {
      return { id: `stub-transfer-${p.id}-${randomUUID()}`, status: 'paid', amount: Number(p.netHalalas),
        currency: 'SAR', source_id: p.providerSourceId!, sequence_number: p.providerSequenceNumber! };
    }
    if (!this.sourceId) throw new PayoutPreflightError('Payout source is missing');
    const destination = await this.beneficiaries.resolveDestination(p.creatorId);
    if (!destination) throw new PayoutPreflightError('Payout beneficiary is missing');
    if (destination.type === 'bank_account' && (!destination.iban || !destination.name || !destination.city || !destination.country)) {
      throw new PayoutPreflightError('Bank beneficiary details are incomplete');
    }
    const res = await fetch(this.providerUrl, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: this.authorization() },
      body: JSON.stringify(buildPayoutRequest({ sourceId: p.providerSourceId!, amountHalalas: p.netHalalas!,
        purpose: this.purpose, payoutId: p.id, projectId: p.projectId, milestoneId: p.milestoneId, destination })),
      signal: AbortSignal.timeout(15_000),
    });
    // HTTP errors, timeouts, malformed or mismatched replies are ambiguous.
    // Only a validated provider object can certify a paid/failed outcome.
    if (!res.ok) throw new Error('Payout request outcome is unconfirmed');
    return this.validateEvidence(await res.json(), p);
  }
}
