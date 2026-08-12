import { Injectable, Logger } from '@nestjs/common';
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
const FAILED_STATUSES = new Set(['failed', 'canceled', 'returned']);

/** OPS-0 correction #3 — a provider-terminal rejection (vs a transient
 *  config/network error): the payout is marked FAILED with the reason instead
 *  of silently returning to PENDING forever. */
export class TerminalPayoutError extends Error {}

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
    destination: input.destination,
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
 * `sequence_number` doubles as the provider-side idempotency reference.
 * Terminal provider rejections write FAILED + failureReason; transient errors
 * (config/network) release the claim back to PENDING for the next tick.
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
    private readonly ledger: LedgerService,
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

  async disbursePending(): Promise<{ sent: number; failed: number }> {
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
    for (const p of pending) {
      // Sequential on purpose: payouts are low-volume, high-stakes.
      if (await this.disburseOne(p)) sent++;
      else failed++;
    }
    return { sent, failed };
  }

  private async disburseOne(p: Payout): Promise<boolean> {
    // OPS-0 correction #3 — atomic claim: only the caller that flips
    // PENDING→SENDING owns this payout; a concurrent tick claims 0 rows.
    const claim = await this.prisma.payout.updateMany({
      where: { id: p.id, status: PayoutStatus.PENDING },
      data: { status: PayoutStatus.SENDING, claimedAt: new Date() },
    });
    if (claim.count === 0) return false;

    // OPS-0 correction #2 — withhold exactly what the ZATCA invoice bills
    // (commission + VAT) and transfer the NET; same breakdown function as
    // the invoice, so they agree to the halala.
    const fees = commissionBreakdown(p.amountHalalas);
    try {
      const transferRef = await this.sendViaProvider(p, fees.netHalalas);
      await this.prisma.payout.update({
        where: { id: p.id },
        data: {
          status: PayoutStatus.SENT,
          sentAt: new Date(),
          feeWithheldHalalas: fees.withheldHalalas,
          netHalalas: fees.netHalalas,
        },
      });
      // Batch ACCOUNT — the settlement clock. This is the moment the money
      // finished moving, which is what the between-projects cooldown counts
      // from. NOT the campaign end (`deadline`) and NOT the outcome decision
      // (funding.service sets SUCCESSFUL/FAILED at close, often long before a
      // payout lands). Written idempotently: a project with several payouts
      // stamps the first one that lands and keeps it, so a later payout cannot
      // push the creator's cooldown further out.
      await this.prisma.project.updateMany({
        where: { id: p.projectId, settledAt: null },
        data: { settledAt: new Date() },
      });
      await this.ledger.record({
        entryType: LedgerEntryType.PAYOUT_SENT,
        amountHalalas: fees.netHalalas,
        pspRef: transferRef,
        payoutId: p.id,
        projectId: p.projectId,
        source: 'disburser',
      });
      // The withheld leg: PAYOUT_SENT (net) + COMMISSION (withheld) = gross.
      await this.ledger.record({
        entryType: LedgerEntryType.COMMISSION,
        amountHalalas: fees.withheldHalalas,
        pspRef: `commission-${p.id}`,
        payoutId: p.id,
        projectId: p.projectId,
        source: 'disburser',
      });
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
      // log loudly; generateForPayout is idempotent so the next tick heals.
      try {
        const inv = await this.zatca.generateForPayout(p);
        this.logger.log(`ZATCA invoice ${inv.invoiceNumber} issued for payout=${p.id}`);
      } catch (err) {
        this.logger.error(`ZATCA invoice FAILED for payout=${p.id} — backfill required`, err as Error);
      }
      return true;
    } catch (err) {
      if (err instanceof TerminalPayoutError) {
        // OPS-0 correction #3 — the provider terminally rejected: FAILED is
        // finally reachable, with the reason on the row. Retry is an explicit
        // ops decision (money.payout.retry, census N₄), never automatic.
        await this.prisma.payout.update({
          where: { id: p.id },
          data: { status: PayoutStatus.FAILED, failureReason: err.message.slice(0, 500) },
        });
        // MONEY-AUDIT — the SENDING→FAILED terminal flip. Reached only by the
        // owner of the atomic claim (one tick), so no duplicate row. Never throws.
        await this.audit.log({
          actorId: null,
          action: 'system.payout.failed',
          entity: 'Payout',
          entityId: p.id,
          detail: {
            projectId: p.projectId,
            creatorId: p.creatorId,
            milestoneId: p.milestoneId,
            grossHalalas: p.amountHalalas.toString(),
            failureReason: err.message.slice(0, 500),
          },
        });
        this.logger.error(`payout FAILED (terminal) id=${p.id}: ${err.message}`);
      } else {
        // Transient (config/network/beneficiary-missing): release the claim —
        // back to PENDING for the next tick.
        await this.prisma.payout.updateMany({
          where: { id: p.id, status: PayoutStatus.SENDING },
          data: { status: PayoutStatus.PENDING, claimedAt: null },
        });
        this.logger.error(`payout disburse failed id=${p.id} (returned to PENDING)`, err as Error);
      }
      return false;
    }
  }

  /**
   * Sprint 5 / #4 — real Moyasar Payouts integration
   * (docs.moyasar.com/api/payouts/04-create-payout).
   *
   * Two hard prerequisites gate the real path; when either is absent the
   * payout stays PENDING (never SENT on an unconfirmed transfer):
   *   1. MOYASAR_PAYOUT_SOURCE_ID — Wathba's payout source account.
   *   2. A validated creator beneficiary (IBAN/mobile) — NOT yet captured
   *      by the platform; `resolveBeneficiary` throws until that lands.
   *
   * Idempotency: Moyasar has no idempotency header, so we send a
   * deterministic `sequence_number` (from the payout id) and rely on our own
   * "only disburse PENDING" guard + reconciliation to avoid double-pay. A
   * follow-up payout-status webhook should confirm final `paid`.
   *
   * Stub mode (no PAYOUT_PROVIDER_KEY) is unchanged for local/dev.
   */
  private async sendViaProvider(p: Payout, netHalalas: bigint): Promise<string> {
    if (!this.providerKey) {
      this.logger.warn(
        `[STUB] Disburse payout=${p.id} net=${Number(netHalalas) / 100} SAR (gross=${Number(p.amountHalalas) / 100}) to creator=${p.creatorId}`,
      );
      return `stub-transfer-${p.id.slice(0, 8)}-${randomUUID().slice(0, 8)}`;
    }
    if (!this.sourceId) {
      throw new Error('MOYASAR_PAYOUT_SOURCE_ID not configured — cannot create a payout');
    }
    const destination = await this.resolveBeneficiary(p);
    const res = await fetch(this.providerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.providerKey}`,
      },
      body: JSON.stringify(
        buildPayoutRequest({
          sourceId: this.sourceId,
          // OPS-0 correction #2 — the transfer is the NET (gross − withheld).
          amountHalalas: netHalalas,
          purpose: this.purpose,
          payoutId: p.id,
          projectId: p.projectId,
          milestoneId: p.milestoneId,
          destination,
        }),
      ),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      // 4xx = the provider examined and rejected this request — terminal.
      // 5xx/network stays transient (generic Error → back to PENDING).
      if (res.status >= 400 && res.status < 500) {
        throw new TerminalPayoutError(`Moyasar payouts ${res.status}: ${JSON.stringify(json)}`);
      }
      throw new Error(`Moyasar payouts ${res.status}: ${JSON.stringify(json)}`);
    }
    const status = String(json['status'] ?? '');
    if (FAILED_STATUSES.has(status)) {
      throw new TerminalPayoutError(
        `payout ${status}: ${String(json['failure_reason'] ?? 'no reason given')}`,
      );
    }
    if (!ACCEPTED_STATUSES.has(status) && status !== '') {
      throw new Error(`payout returned unexpected status "${status}"`);
    }
    const ref = json['id'];
    if (typeof ref !== 'string' || ref.length === 0) {
      throw new Error('Moyasar payouts returned no payout id');
    }
    return ref;
  }

  /**
   * Resolve the creator's payout beneficiary (Moyasar `destination`).
   *
   * Wathba does not yet capture creator bank beneficiaries (IBAN / mobile /
   * name). Until that feature ships, a real payout cannot be constructed —
   * we refuse rather than send a malformed request, which correctly leaves
   * the payout PENDING. Tracked on issue #4's checklist.
   */
  private async resolveBeneficiary(p: Payout): Promise<PayoutBeneficiary> {
    const dest = await this.beneficiaries.resolveDestination(p.creatorId);
    if (!dest) {
      // Correct behaviour: refuse to pay a creator with no beneficiary on
      // file — the payout stays PENDING until they add bank details (#7).
      throw new Error(
        `no payout beneficiary on file for creator=${p.creatorId} — creator must add bank details (see #7)`,
      );
    }
    return dest;
  }
}
