import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MoyasarAdapter } from './moyasar.adapter';
import { LedgerService } from './ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { SettingsService } from '../settings/settings.service';
import { LedgerEntryType, NotificationKind, PledgeStatus, Prisma, type Pledge } from '@prisma/client';

/** Batch OPS (registry completion) — outcome of an ops-surface refund. */
export interface AdminRefundResult {
  ok: boolean;
  /** HELD/PENDING_REAUTH → the authorization is voided; CAPTURED → refunded. */
  mode: 'void' | 'refund';
  amountHalalas: bigint;
  failureReason?: string;
}

/**
 * Escrow facade — internal-only. The funding context calls these from
 * inside transactions to keep DB and PSP state consistent.
 */
@Injectable()
export class EscrowService {
  /** Batch PAY (Part 2) — the failed-capture grace window (default; the
   *  effective value is the `funding.graceWindowHours` setting × 1h). */
  static readonly GRACE_MS = 72 * 60 * 60 * 1000;

  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly moyasar: MoyasarAdapter,
    private readonly ledger: LedgerService,
    // Batch OPS (registry completion) — the ops refund tells the backer
    // directly instead of waiting on a PSP webhook that may never arrive.
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    // OPS-GAPS Y2 — the grace window is a governed setting (default 72h).
    private readonly settings: SettingsService,
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
    // PENDING_REAUTH still counts toward PLEDGED and gets a settlement-time
    // capture attempt (it may succeed; else it enters the grace window).
    const pledges = await this.prisma.pledge.findMany({
      where: { projectId, status: { in: [PledgeStatus.HELD, PledgeStatus.PENDING_REAUTH] } },
    });
    const { ok, fail } = await this.runConcurrent(pledges, (p) => this.captureOne(p));
    this.logger.log(`Captured ${ok} / failed ${fail} pledges for project=${projectId}`);
    return { captured: ok, failed: fail };
  }

  async refundAllHeld(projectId: string): Promise<{ refunded: number; failed: number }> {
    const pledges = await this.prisma.pledge.findMany({
      where: { projectId, status: { in: [PledgeStatus.HELD, PledgeStatus.PENDING_REAUTH] } },
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
      if (!ok) return this.enterGrace(p);
      await this.markCaptured(p);
      return true;
    } catch (err) {
      this.logger.error(`capture failed for pledge=${p.id}`, err as Error);
      return this.enterGrace(p);
    }
  }

  /** Batch PAY — a confirmed capture: pledge CAPTURED + REALIZED counter.
   *  OPS-0 correction #1 — this is THE chokepoint: every capture-confirm
   *  path (sync settlement, grace retry, PSP webhook) must land here, or
   *  realizedHalalas under-counts and milestone releases short the creator. */
  async markCaptured(
    p: Pick<Pledge, 'id' | 'amountHalalas' | 'addOnsHalalas' | 'paymentRef' | 'projectId'>,
    opts?: { source?: 'sync-path' | 'webhook' | 'disburser' },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.pledge.update({
        where: { id: p.id },
        data: { status: PledgeStatus.CAPTURED, capturedAt: new Date() },
      });
      // Part 2 — REALIZED is maintained here, the single capture-confirm
      // chokepoint. Payout milestones read realizedHalalas, never raised.
      await tx.project.update({
        where: { id: p.projectId },
        data: { realizedHalalas: { increment: p.amountHalalas + p.addOnsHalalas } },
      });
    });
    await this.ledger.record({
      entryType: LedgerEntryType.CAPTURE,
      // Full held amount = tier + add-ons (Sprint 2 undercharge fix).
      amountHalalas: p.amountHalalas + p.addOnsHalalas,
      pspRef: p.paymentRef,
      pledgeId: p.id,
      projectId: p.projectId,
      source: opts?.source,
    });
  }

  /**
   * Batch PAY (Part 2) — a failed capture at settlement does NOT fail the
   * campaign (success was decided by the raised amount at the deadline). The
   * pledge enters a 72-hour grace window: the backer is notified to refresh
   * their payment; retries run at +6h/+24h/+48h (GraceScheduler); expiry →
   * FAILED_CAPTURE.
   */
  private async enterGrace(p: Pledge): Promise<boolean> {
    const now = new Date();
    // OPS-GAPS Y2 — grace window is a governed setting (default 72h).
    const graceHours = await this.settings.get('funding.graceWindowHours');
    const graceMs = graceHours * 60 * 60 * 1000;
    await this.prisma.pledge.update({
      where: { id: p.id },
      data: {
        status: PledgeStatus.CAPTURE_GRACE,
        graceStartedAt: now,
        graceExpiresAt: new Date(now.getTime() + graceMs),
        captureAttempts: { increment: 1 },
      },
    });
    this.logger.warn(`pledge=${p.id} entered CAPTURE_GRACE (${graceHours}h)`);
    return false;
  }

  /**
   * Batch PAY (Part 2) — the backer fixes a failed capture with a fresh
   * payment source: authorize the full amount on the new card and capture
   * immediately (the campaign already succeeded — no reason to hold).
   */
  async captureWithNewSource(p: Pledge, source: string, description: string): Promise<boolean> {
    const amount = p.amountHalalas + p.addOnsHalalas;
    const auth = await this.moyasar.hold({
      pledgeId: p.id,
      amountHalalas: Number(amount),
      source,
      description,
    });
    if (auth.status !== 'authorized') return false;
    const cap = await this.withRetry(`grace-capture pledge=${p.id}`, () =>
      this.moyasar.capture(auth.paymentRef),
    );
    if (!cap.ok) return false;
    await this.prisma.pledge.update({
      where: { id: p.id },
      data: { paymentRef: auth.paymentRef },
    });
    await this.markCaptured({ ...p, paymentRef: auth.paymentRef });
    return true;
  }

  /** Batch PAY (Part 1) — single-pledge void for backer cancellation. */
  async voidPledge(p: Pledge): Promise<boolean> {
    return this.refundOne(p);
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

  /**
   * Batch OPS (registry completion) — the single-pledge ADMIN refund
   * (money.refund.pledge). Unlike settlement's refundAllHeld this also
   * handles CAPTURED pledges (first caller of MoyasarAdapter.refund) and
   * compensates every live counter the pledge ever incremented:
   *   raised (always), REALIZED (captured only — refunding captured money
   *   without leaving REALIZED would let milestone releases pay the creator
   *   from clawed-back funds), backersCount (last-active-pledge rule, mirror
   *   of FundingService.cancelPledge), tier stock and the backer's
   *   totalPledgedHalalas. PSP-first: a PSP failure mutates nothing.
   */
  async adminRefundPledge(pledgeId: string): Promise<AdminRefundResult> {
    const pledge = await this.prisma.pledge.findUnique({ where: { id: pledgeId } });
    if (!pledge) {
      return { ok: false, mode: 'void', amountHalalas: 0n, failureReason: 'pledge-missing' };
    }
    const captured = pledge.status === PledgeStatus.CAPTURED;
    const held =
      pledge.status === PledgeStatus.HELD || pledge.status === PledgeStatus.PENDING_REAUTH;
    const mode: 'void' | 'refund' = captured ? 'refund' : 'void';
    const amount = pledge.amountHalalas + pledge.addOnsHalalas;
    if (!captured && !held) {
      return {
        ok: false,
        mode,
        amountHalalas: amount,
        failureReason: `not-refundable:${pledge.status}`,
      };
    }

    // PSP first — the DB flip rides on PSP success; failure mutates nothing.
    try {
      const { ok } = await this.withRetry(`admin-${mode} pledge=${pledge.id}`, () =>
        captured ? this.moyasar.refund(pledge.paymentRef) : this.moyasar.void(pledge.paymentRef),
      );
      if (!ok) {
        return { ok: false, mode, amountHalalas: amount, failureReason: `psp-${mode}-declined` };
      }
    } catch (err) {
      return { ok: false, mode, amountHalalas: amount, failureReason: String(err) };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.pledge.update({
        where: { id: pledge.id },
        data: { status: PledgeStatus.REFUNDED, refundedAt: new Date() },
      });
      // Journal row rides the SAME transaction as the counter compensation
      // (LedgerService.record commits on its own client), so a rollback
      // never leaves a ledger row describing counters that didn't move.
      // Column shape mirrors LedgerService.record / the webhook writer.
      await tx.ledgerEntry.create({
        data: {
          entryType: captured ? LedgerEntryType.REFUND : LedgerEntryType.VOID,
          amountHalalas: amount,
          pspRef: pledge.paymentRef,
          pledgeId: pledge.id,
          payoutId: null,
          projectId: pledge.projectId,
          source: 'ops-refund',
        },
      });
      // backersCount drops only when this was the backer's LAST active
      // pledge on the project (cancelPledge's rule) — this pledge is already
      // REFUNDED inside this tx, so it no longer counts itself.
      const remaining = await tx.pledge.count({
        where: {
          projectId: pledge.projectId,
          backerId: pledge.backerId,
          status: { in: [PledgeStatus.HELD, PledgeStatus.PENDING_BNPL, PledgeStatus.CAPTURED] },
        },
      });
      await tx.project.update({
        where: { id: pledge.projectId },
        data: {
          raisedHalalas: { decrement: amount },
          // Post-capture refund leaves REALIZED too — milestone releases
          // compute from realizedHalalas and must never see refunded money.
          ...(captured ? { realizedHalalas: { decrement: amount } } : {}),
          ...(remaining === 0 ? { backersCount: { decrement: 1 } } : {}),
        },
      });
      if (pledge.tierId) {
        // Stock release, floored at 0 via the guarded WHERE.
        await tx.rewardTier.updateMany({
          where: { id: pledge.tierId, claimedQty: { gt: 0 } },
          data: { claimedQty: { decrement: 1 } },
        });
      }
      await tx.user.update({
        where: { id: pledge.backerId },
        data: { totalPledgedHalalas: { decrement: amount } },
      });
    });

    // Post-commit comms — best-effort; a comms glitch never undoes a refund.
    await this.notifyAdminRefund(pledge, mode).catch((err) =>
      this.logger.warn(`ops-refund comms failed pledge=${pledge.id}: ${String(err)}`),
    );
    this.logger.log(`ops ${mode} pledge=${pledge.id} amount=${amount} project=${pledge.projectId}`);
    return { ok: true, mode, amountHalalas: amount };
  }

  /**
   * Tell the backer their money is back — WITHOUT waiting for the PSP's
   * `payment_voided`/`payment_refunded` webhook (it may never arrive in stub
   * mode). Double-notify is prevented from both sides: the webhook processor
   * ignores a pledge already REFUNDED (its FSM guard → 'ignored', no
   * notification), and our own side claims a unique dedupKey row on the same
   * table the webhook dedups through, so a replayed ops refund is silent.
   */
  private async notifyAdminRefund(p: Pledge, mode: 'void' | 'refund'): Promise<void> {
    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider: 'wathba-ops',
          eventType: mode === 'refund' ? 'ops.pledge.refunded' : 'ops.pledge.voided',
          pspRef: p.paymentRef,
          dedupKey: `ops-refund-notify:${p.id}`,
          payload: { pledgeId: p.id, mode, source: 'ops-refund' },
          processedAt: new Date(),
          outcome: 'applied',
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw err;
    }
    const row = await this.prisma.pledge.findUnique({
      where: { id: p.id },
      select: {
        backer: { select: { id: true, email: true } },
        project: { select: { id: true, titleAr: true } },
      },
    });
    if (!row) return;
    const amountHalalas = Number(p.amountHalalas + p.addOnsHalalas);
    await this.notifications.create({
      userId: row.backer.id,
      kind: NotificationKind.REFUND_COMPLETED,
      payload: { projectId: row.project.id, projectTitleAr: row.project.titleAr, amountHalalas },
    });
    await this.email.refundCompleted(row.backer.email, {
      projectTitle: row.project.titleAr,
      amountHalalas,
    });
  }

  /**
   * Batch OPS (registry completion) — the whole-project refund sweep
   * (money.refund.project): every HELD/PENDING_REAUTH/CAPTURED pledge goes
   * through adminRefundPledge with partial-failure isolation — one PSP
   * refusal never halts the sweep (refundAllHeld's batching style).
   */
  async adminRefundProject(
    projectId: string,
  ): Promise<{ refunded: number; failed: number; totalHalalas: bigint }> {
    const pledges = await this.prisma.pledge.findMany({
      where: {
        projectId,
        status: {
          in: [PledgeStatus.HELD, PledgeStatus.PENDING_REAUTH, PledgeStatus.CAPTURED],
        },
      },
      select: { id: true },
    });
    let refunded = 0;
    let failed = 0;
    let totalHalalas = 0n;
    for (let i = 0; i < pledges.length; i += EscrowService.BATCH_CONCURRENCY) {
      const slice = pledges.slice(i, i + EscrowService.BATCH_CONCURRENCY);
      const results = await Promise.allSettled(slice.map((p) => this.adminRefundPledge(p.id)));
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.ok) {
          refunded++;
          totalHalalas += r.value.amountHalalas;
        } else {
          failed++;
        }
      }
    }
    this.logger.log(
      `ops refund sweep project=${projectId}: refunded=${refunded} failed=${failed} total=${totalHalalas}`,
    );
    return { refunded, failed, totalHalalas };
  }

  /**
   * Batch OPS (registry completion) — operator-triggered capture retry
   * (money.capture.retry-cohort):
   *   · CAPTURE_GRACE — immediate capture attempt (the operator IS the
   *     retry; no waiting on the +6h/+24h/+48h marks), success lands on the
   *     markCaptured chokepoint, failure bumps captureAttempts only.
   *   · FAILED_CAPTURE (opt-in) — grace expiry released the tier stock, so
   *     the claim is re-taken ATOMICALLY before any PSP call; a sold-out
   *     tier skips the pledge (never charge a backer for a reward that can
   *     no longer be honored). PSP failure rolls the re-claim back.
   */
  async retryCaptureCohort(
    projectId: string,
    opts: { includeFailed: boolean },
  ): Promise<{ attempted: number; captured: number; stillFailed: number }> {
    let attempted = 0;
    let captured = 0;
    let stillFailed = 0;

    const inGrace = await this.prisma.pledge.findMany({
      where: { projectId, status: PledgeStatus.CAPTURE_GRACE },
    });
    for (const p of inGrace) {
      attempted++;
      let ok = false;
      try {
        ok = (await this.moyasar.capture(p.paymentRef)).ok;
      } catch (err) {
        this.logger.warn(`retry-cohort capture failed pledge=${p.id}: ${String(err)}`);
      }
      if (ok) {
        await this.markCaptured(p);
        captured++;
      } else {
        await this.prisma.pledge.update({
          where: { id: p.id },
          data: { captureAttempts: { increment: 1 } },
        });
        stillFailed++;
      }
    }

    if (opts.includeFailed) {
      const dead = await this.prisma.pledge.findMany({
        where: { projectId, status: PledgeStatus.FAILED_CAPTURE },
      });
      for (const p of dead) {
        attempted++;
        if (!(await this.reclaimTierStock(p))) {
          this.logger.warn(`retry-cohort pledge=${p.id} skipped: tier-stock-exhausted`);
          stillFailed++;
          continue;
        }
        let ok = false;
        try {
          // The old authorization died with the grace window — re-authorize,
          // then capture immediately (the campaign already succeeded).
          const re = await this.moyasar.reauthorize(p.paymentRef);
          if (re.ok) ok = (await this.moyasar.capture(p.paymentRef)).ok;
        } catch (err) {
          this.logger.warn(`retry-cohort reauth+capture failed pledge=${p.id}: ${String(err)}`);
        }
        if (ok) {
          await this.markCaptured(p);
          captured++;
        } else {
          // Give the re-claimed stock back — the pledge stays FAILED_CAPTURE.
          if (p.tierId) {
            await this.prisma.rewardTier.updateMany({
              where: { id: p.tierId, claimedQty: { gt: 0 } },
              data: { claimedQty: { decrement: 1 } },
            });
          }
          stillFailed++;
        }
      }
    }
    return { attempted, captured, stillFailed };
  }

  /**
   * Atomic tier-stock re-claim for a FAILED_CAPTURE retry. limitQty null =
   * unlimited tier; otherwise the guarded updateMany claims a unit only
   * while stock remains (0 rows matched = exhausted → caller skips).
   */
  private async reclaimTierStock(p: Pledge): Promise<boolean> {
    if (!p.tierId) return true;
    const tier = await this.prisma.rewardTier.findUnique({
      where: { id: p.tierId },
      select: { limitQty: true },
    });
    if (!tier) return false; // tier deleted — cannot honor the reward
    if (tier.limitQty == null) {
      await this.prisma.rewardTier.update({
        where: { id: p.tierId },
        data: { claimedQty: { increment: 1 } },
      });
      return true;
    }
    const claim = await this.prisma.rewardTier.updateMany({
      where: { id: p.tierId, claimedQty: { lt: tier.limitQty } },
      data: { claimedQty: { increment: 1 } },
    });
    return claim.count > 0;
  }

  /**
   * Batch OPS-PRO Phase 1 — operator resolution of a chargeback dispute
   * (money.dispute.resolve). A pledge reaches DISPUTED via the chargeback
   * webhook, which flips status ONLY (raised/realized/backersCount stay put
   * and a reversing DISPUTE ledger row is written). The operator's ruling
   * closes it:
   *   · WON  — the bank sided with the platform; funds are retained. Pledge
   *     returns DISPUTED→CAPTURED, no counter moves (they were never
   *     decremented), a positive DISPUTE ledger note records the win.
   *   · LOST — the chargeback stands; the money already left externally, so
   *     there is NO PSP call. Pledge DISPUTED→REFUNDED with the SAME
   *     captured-branch compensation as adminRefundPledge (raised + realized +
   *     last-pledge backersCount + tier stock + backer totalPledged) and a
   *     REFUND ledger row (source dispute-lost). All in one transaction.
   */
  async resolveDispute(
    pledgeId: string,
    outcome: 'WON' | 'LOST',
  ): Promise<{ ok: true; outcome: 'WON' | 'LOST'; status: PledgeStatus; amountHalalas: bigint }> {
    const pledge = await this.prisma.pledge.findUniqueOrThrow({ where: { id: pledgeId } });
    const amount = pledge.amountHalalas + pledge.addOnsHalalas;
    const now = new Date();

    if (outcome === 'WON') {
      await this.prisma.$transaction(async (tx) => {
        await tx.pledge.update({
          where: { id: pledge.id },
          data: {
            status: PledgeStatus.CAPTURED,
            disputeOutcome: 'WON',
            disputeResolvedAt: now,
          },
        });
        // Append-only journal: a DISPUTE note recording the win. No counter
        // moved (the webhook never decremented them), so this is purely a
        // reconciling ledger row against the earlier reversing DISPUTE entry.
        await tx.ledgerEntry.create({
          data: {
            entryType: LedgerEntryType.DISPUTE,
            amountHalalas: amount,
            pspRef: pledge.paymentRef,
            pledgeId: pledge.id,
            payoutId: null,
            projectId: pledge.projectId,
            source: 'dispute-won',
          },
        });
      });
      this.logger.log(`dispute WON pledge=${pledge.id} amount=${amount} — funds retained`);
      return { ok: true, outcome, status: PledgeStatus.CAPTURED, amountHalalas: amount };
    }

    // LOST — chargeback stands. The money moved externally; compensate the
    // counters exactly like a captured-money refund. No moyasar call.
    await this.prisma.$transaction(async (tx) => {
      await tx.pledge.update({
        where: { id: pledge.id },
        data: {
          status: PledgeStatus.REFUNDED,
          disputeOutcome: 'LOST',
          disputeResolvedAt: now,
          refundedAt: now,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          entryType: LedgerEntryType.REFUND,
          amountHalalas: amount,
          pspRef: pledge.paymentRef,
          pledgeId: pledge.id,
          payoutId: null,
          projectId: pledge.projectId,
          source: 'dispute-lost',
        },
      });
      // backersCount drops only when this was the backer's LAST active pledge
      // (the disputed pledge itself is not in the active set).
      const remaining = await tx.pledge.count({
        where: {
          projectId: pledge.projectId,
          backerId: pledge.backerId,
          status: { in: [PledgeStatus.HELD, PledgeStatus.PENDING_BNPL, PledgeStatus.CAPTURED] },
        },
      });
      await tx.project.update({
        where: { id: pledge.projectId },
        data: {
          raisedHalalas: { decrement: amount },
          // Captured money left the platform — REALIZED must drop too, or a
          // later milestone release would pay the creator from clawed funds.
          realizedHalalas: { decrement: amount },
          ...(remaining === 0 ? { backersCount: { decrement: 1 } } : {}),
        },
      });
      if (pledge.tierId) {
        await tx.rewardTier.updateMany({
          where: { id: pledge.tierId, claimedQty: { gt: 0 } },
          data: { claimedQty: { decrement: 1 } },
        });
      }
      await tx.user.update({
        where: { id: pledge.backerId },
        data: { totalPledgedHalalas: { decrement: amount } },
      });
    });
    this.logger.log(`dispute LOST pledge=${pledge.id} amount=${amount} — refunded + compensated`);
    return { ok: true, outcome, status: PledgeStatus.REFUNDED, amountHalalas: amount };
  }

  /**
   * Batch OPS-PRO Phase 1 — revive a single terminally-failed capture
   * (money.pledge.revive). The single-pledge form of retryCaptureCohort's
   * includeFailed branch: re-claim the tier stock ATOMICALLY (grace expiry
   * released it) before any PSP call, then re-authorize + capture. A sold-out
   * tier short-circuits with tier-stock-exhausted (never charge for a reward
   * that can no longer be honored); a PSP refusal rolls the re-claim back and
   * leaves the pledge FAILED_CAPTURE.
   */
  async reviveFailedPledge(
    pledgeId: string,
  ): Promise<{ ok: boolean; reason?: string; status: PledgeStatus }> {
    const p = await this.prisma.pledge.findUniqueOrThrow({ where: { id: pledgeId } });

    if (!(await this.reclaimTierStock(p))) {
      this.logger.warn(`revive pledge=${p.id} skipped: tier-stock-exhausted`);
      return { ok: false, reason: 'tier-stock-exhausted', status: PledgeStatus.FAILED_CAPTURE };
    }

    let ok = false;
    try {
      const re = await this.moyasar.reauthorize(p.paymentRef);
      if (re.ok) ok = (await this.moyasar.capture(p.paymentRef)).ok;
    } catch (err) {
      this.logger.warn(`revive reauth+capture failed pledge=${p.id}: ${String(err)}`);
    }

    if (ok) {
      await this.markCaptured(p);
      this.logger.log(`revive pledge=${p.id} — re-authorized + captured`);
      return { ok: true, status: PledgeStatus.CAPTURED };
    }

    // Give the re-claimed stock back; the pledge stays FAILED_CAPTURE.
    if (p.tierId) {
      await this.prisma.rewardTier.updateMany({
        where: { id: p.tierId, claimedQty: { gt: 0 } },
        data: { claimedQty: { decrement: 1 } },
      });
    }
    return { ok: false, reason: 'psp-declined', status: PledgeStatus.FAILED_CAPTURE };
  }
}
