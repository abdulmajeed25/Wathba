import { randomUUID } from 'node:crypto';
import { canRecoverAuthorization, verifyAuthorizationEvidence } from './authorization-evidence';
import { readAuthorizationContext } from '../funding/authorization-context';
import { finalizePledge } from '../funding/pledge-finalization';
import { verifyRefundEvidence, type RefundVerification } from './refund-evidence';
import { claimHeldAction, heldAction, verifyHeldEvidence, verifyUnchargedPayment, type HeldVerification } from './held-payment-action';
import { claimUncountedVoid, finalizeUncountedVoid, verifyVoidEvidence, VOID_PENDING_ISSUES, type VoidVerification } from './uncounted-void';
import { completeProjectRefund } from '../funding/refund-completion';
import { reserveCapturedRefund } from './project-liquidity';
import { finalizeRefund } from './refund-finalization';
import { ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MoyasarAdapter, type HoldResponse } from './moyasar.adapter';
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
 * Escrow facade — internal-only. Provider calls precede local confirmation;
 * confirmation owns its transaction. Remote success still needs reconciliation
 * if the subsequent local commit fails.
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
    _ledger: LedgerService,
    // Batch OPS (registry completion) — the ops refund tells the backer
    // directly instead of waiting on a PSP webhook that may never arrive.
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    _settings: SettingsService,
  ) {}

  async hold(input: {
    pledgeId: string;
    amountHalalas: bigint;
    source: string;
    description: string;
    callbackUrl?: string;
    givenId?: string;
  }): Promise<HoldResponse> {
    return this.moyasar.hold({
      pledgeId: input.pledgeId,
      amountHalalas: Number(input.amountHalalas),
      source: input.source,
      description: input.description,
      callbackUrl: input.callbackUrl,
      givenId: input.givenId,
    });
  }

  /** One authorization journal even if POST completion and GET recovery race. */
  async recordInitialAuthorization(p: Pledge): Promise<void> {
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
      const current = await tx.pledge.findUniqueOrThrow({ where: { id: p.id } });
      if (current.paymentRef !== p.paymentRef || current.amountHalalas !== p.amountHalalas || current.addOnsHalalas !== p.addOnsHalalas)
        throw new ConflictException('تغير مرجع الحجز؛ يلزم المراجعة.');
      const existing = await tx.ledgerEntry.findFirst({ where: { pledgeId: p.id, pspRef: p.paymentRef, entryType: 'HOLD_AUTHORIZED' } });
      if (existing) {
        if (existing.amountHalalas !== p.amountHalalas + p.addOnsHalalas) throw new ConflictException('قيد الحجز لا يطابق المبلغ.');
        return;
      }
      await tx.ledgerEntry.create({ data: { pledgeId: p.id, projectId: p.projectId, pspRef: p.paymentRef,
        amountHalalas: p.amountHalalas + p.addOnsHalalas, entryType: 'HOLD_AUTHORIZED', source: 'authorization-proof' } });
    });
  }

  /** Provider GET and local completion only: never a new payment or automatic void. */
  async reconcileInitialAuthorization(pledgeId: string): Promise<{ outcome: 'confirmed' | 'uncharged' | 'challenge' | 'needs-review'; transactionUrl?: string; applied?: boolean }> {
    const p = await this.prisma.pledge.findUniqueOrThrow({ where: { id: pledgeId } });
    if (p.paymentMethod !== 'CARD') throw new ConflictException('هذا المسار مخصص لحجز البطاقة.');
    if (p.status === 'HELD' || p.status === 'CAPTURED') return { outcome: 'confirmed', applied: false };
    if ((p.status === 'FAILED' || p.status === 'REFUNDED') && !p.capturedAt && p.authorizationContext)
      return { outcome: 'uncharged', applied: false };
    if (!canRecoverAuthorization(p)) throw new ConflictException('هذا الحجز يحتاج مراجعة مستقلة؛ لا يمكن استنتاج شروطه أو تجاوز محاولة فك محفوظة.');
    const terms = readAuthorizationContext(p);
    let raw: unknown;
    try { raw = (await this.moyasar.fetchPayment(p.paymentRef)).raw; }
    catch { throw new ServiceUnavailableException('تعذر قراءة نتيجة الحجز؛ لا تنشئ دفعًا جديدًا.'); }
    const proof = verifyAuthorizationEvidence(raw, p);
    if (proof.outcome !== 'authorized') {
      const result = await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
        return tx.pledge.updateMany({ where: { id: p.id, status: 'PENDING_AUTH', paymentRef: p.paymentRef,
          authorizationIssue: p.authorizationIssue, amountHalalas: p.amountHalalas, addOnsHalalas: p.addOnsHalalas },
          data: proof.outcome === 'challenge' ? { authorizationIssue: 'authorization-challenge' } : { status: 'FAILED', authorizationIssue: null } });
      });
      if (result.count !== 1) throw new ConflictException('تغيرت نتيجة الحجز أثناء القراءة؛ حدّث الحالة.');
      return { outcome: proof.outcome, transactionUrl: proof.transactionUrl, applied: proof.outcome === 'uncharged' };
    }
    await this.recordInitialAuthorization(p);
    try {
      const applied = await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
        const current = await tx.pledge.findUniqueOrThrow({ where: { id: p.id } });
        if (current.status === 'HELD' && current.paymentRef === p.paymentRef && current.amountHalalas === p.amountHalalas && current.addOnsHalalas === p.addOnsHalalas) return false;
        await finalizePledge(tx, { pledgeId: p.id, backerId: p.backerId, paymentRef: p.paymentRef,
          total: p.amountHalalas + p.addOnsHalalas, amountHalalas: Number(p.amountHalalas),
          project: terms.project, tier: terms.tier, addOns: terms.addOns, isBnpl: false, authorizationIssue: p.authorizationIssue });
        return true;
      });
      return { outcome: 'confirmed', applied };
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      await this.prisma.pledge.updateMany({ where: { id: p.id, status: 'PENDING_AUTH', paymentRef: p.paymentRef, authorizationIssue: p.authorizationIssue },
        data: { authorizationIssue: 'authorization-terms-changed' } });
      return { outcome: 'needs-review' };
    }
  }

  /**
   * Max concurrent PSP calls per settlement. Tuned for Moyasar's documented
   * rate limit (~25 req/s). A project with 500 backers settles in ~20 batches
   * of 25 instead of 500 sequential roundtrips.
   */
  private static readonly BATCH_CONCURRENCY = 25;

  async captureAllHeld(projectId: string): Promise<{ captured: number; failed: number }> {
    // PENDING_REAUTH still counts toward PLEDGED and gets a settlement-time
    // capture attempt. An unconfirmed result stays reserved for verification.
    const pledges = await this.prisma.pledge.findMany({
      where: { projectId, status: { in: [PledgeStatus.HELD, PledgeStatus.PENDING_REAUTH] } },
    });
    const { ok, fail } = await this.runConcurrent(pledges, (p) => this.captureOne(p));
    this.logger.log(`Captured ${ok} / failed ${fail} pledges for project=${projectId}`);
    return { captured: ok, failed: fail };
  }

  async refundAllHeld(projectId: string): Promise<{ refunded: number; failed: number }> {
    const pledges = await this.prisma.pledge.findMany({
      where: { projectId, status: { in: [PledgeStatus.HELD, PledgeStatus.PENDING_REAUTH, PledgeStatus.PENDING_BNPL] } },
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
   * refundOne. An ambiguous held-payment result retains its durable claim;
   * repeated settlement cannot send a second financial request.
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
    const attemptKey = await this.prisma.$transaction(tx => claimHeldAction(tx, p, 'CAPTURE'));
    if (!attemptKey) return false;
    try {
      const { ok } = await this.moyasar.capture(p.paymentRef, p.amountHalalas + p.addOnsHalalas);
      if (!ok) return false;
    } catch (err) {
      this.logger.warn(`capture requires verification pledge=${p.id}`);
      return false;
    }
    // A local persistence failure after PSP success is a reconciliation
    // failure, not a declined capture. Do not regress it into grace.
    await this.markCaptured(p, { attemptKey });
    return true;
  }

  /** Batch PAY — a confirmed capture: pledge CAPTURED + REALIZED counter.
   *  OPS-0 correction #1 — this is THE chokepoint: every capture-confirm
   *  path (sync settlement, grace retry, PSP webhook) must land here, or
   *  realizedHalalas under-counts and milestone releases short the creator. */
  async markCaptured(
    p: Pick<Pledge, 'id' | 'amountHalalas' | 'addOnsHalalas' | 'paymentRef' | 'projectId'>,
    opts?: { source?: 'sync-path' | 'webhook' | 'disburser'; attemptKey?: string },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
      const currentAttempt = await tx.pledge.findUnique({ where: { id: p.id } });
      const action = heldAction(currentAttempt?.authorizationIssue);
      if (action && !['CAPTURE', 'AUTHORIZE'].includes(action)) throw new ConflictException('تأكيد التحصيل يتعارض مع محاولة مالية محفوظة؛ يلزم مطابقة الدفع.');
      const claimed = await tx.pledge.updateMany({
        where: {
          id: p.id, projectId: p.projectId, paymentRef: p.paymentRef,
          amountHalalas: p.amountHalalas, addOnsHalalas: p.addOnsHalalas,
          capturedAt: null,
          ...(opts?.attemptKey ? { authorizationIssue: opts.attemptKey } : {}),
          status: { in: [PledgeStatus.HELD, PledgeStatus.PENDING_REAUTH,
            PledgeStatus.CAPTURE_GRACE] },
        },
        data: { status: PledgeStatus.CAPTURED, capturedAt: new Date(), authorizationIssue: null },
      });
      if (claimed.count !== 1) {
        const current = await tx.pledge.findUnique({ where: { id: p.id } });
        // A second sync/webhook confirmation, including one arriving after
        // refund, must not credit the same captured money again.
        if (current?.capturedAt && current.paymentRef === p.paymentRef &&
            current.projectId === p.projectId && current.amountHalalas === p.amountHalalas &&
            current.addOnsHalalas === p.addOnsHalalas) return;
        throw new ConflictException('Capture confirmation no longer matches the pledge; reconcile payment state');
      }
      // Part 2 — REALIZED is maintained here, the single capture-confirm
      // chokepoint. Payout milestones read realizedHalalas, never raised.
      await tx.project.update({
        where: { id: p.projectId },
        data: { realizedHalalas: { increment: p.amountHalalas + p.addOnsHalalas } },
      });
      // Status, realized balance and journal are one commit. A failed journal
      // write leaves all three retryable through the confirmation path.
      await tx.ledgerEntry.create({ data: {
        entryType: LedgerEntryType.CAPTURE,
        amountHalalas: p.amountHalalas + p.addOnsHalalas,
        pspRef: p.paymentRef,
        pledgeId: p.id,
        projectId: p.projectId,
        source: opts?.source ?? 'sync-path',
      } });
    });
  }

  /** All grace callers share the same durable claim, including the scheduler. */
  async captureGracePledge(p: Pledge): Promise<boolean> {
    if (p.status !== 'CAPTURE_GRACE' || p.paymentMethod !== 'CARD') return false;
    if (p.authorizationIssue) return false;
    try {
      const proof = verifyHeldEvidence((await this.moyasar.fetchPayment(p.paymentRef)).raw, p, 'CAPTURE');
      if (proof.outcome === 'confirmed') { await this.markCaptured(p); return true; }
    } catch { return false; }
    return this.captureOne(p);
  }

  /** Only replace a definitively uncharged old payment. The new reference and
   * audit trail commit BEFORE POST; neither card fields nor tokens are stored. */
  async captureWithNewSource(p: Pledge, source: string, description: string): Promise<boolean> {
    if (p.status !== 'CAPTURE_GRACE' || p.paymentMethod !== 'CARD' || p.authorizationIssue ||
        !p.graceExpiresAt || p.graceExpiresAt <= new Date()) return false;
    let raw: unknown;
    try { raw = (await this.moyasar.fetchPayment(p.paymentRef)).raw; } catch { return false; }
    if (!verifyUnchargedPayment(raw, p)) return false;
    const key = await this.prisma.$transaction(async tx => {
      const key = await claimHeldAction(tx, p, 'AUTHORIZE');
      if (!key) return null;
      const givenId = key.slice('payment:AUTHORIZE:'.length);
      await tx.pledge.update({ where: { id: p.id }, data: { paymentRef: givenId } });
      await tx.auditLog.create({ data: { actorId: p.backerId, action: 'payment.source-replacement.started',
        entity: 'Pledge', entityId: p.id, detail: { previousPaymentRef: p.paymentRef,
          paymentRef: givenId, attemptKey: key, amountHalalas: (p.amountHalalas + p.addOnsHalalas).toString() } } });
      return key;
    });
    if (!key) return false;
    const paymentRef = key.slice('payment:AUTHORIZE:'.length);
    const replacement = { ...p, paymentRef, authorizationIssue: key };
    try {
      const auth = await this.moyasar.hold({ pledgeId: p.id, givenId: paymentRef,
        amountHalalas: Number(p.amountHalalas + p.addOnsHalalas), source, description });
      // A transport label is insufficient, including a response for another ref.
      const proof = verifyHeldEvidence(auth.raw, replacement, 'AUTHORIZE');
      if (proof.outcome === 'confirmed') { await this.markCaptured(replacement, { attemptKey: key }); return true; }
      return await this.captureAuthorizedReplacement(replacement, key);
    } catch { return false; } // reference survives timeout/local failure for GET
  }

  private async captureAuthorizedReplacement(p: Pledge, key: string): Promise<boolean> {
    const captureKey = key.replace('payment:AUTHORIZE:', 'payment:CAPTURE:');
    const claimed = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
      const changed = await tx.pledge.updateMany({ where: { id: p.id, status: 'CAPTURE_GRACE', paymentRef: p.paymentRef,
        amountHalalas: p.amountHalalas, addOnsHalalas: p.addOnsHalalas, capturedAt: null, authorizationIssue: key },
        data: { authorizationIssue: captureKey, captureAttempts: { increment: 1 } } });
      if (changed.count === 1) await tx.ledgerEntry.create({ data: {
        entryType: LedgerEntryType.HOLD_AUTHORIZED, amountHalalas: p.amountHalalas + p.addOnsHalalas,
        pspRef: p.paymentRef, pledgeId: p.id, projectId: p.projectId, source: 'grace-authorized',
      } });
      return changed;
    });
    if (claimed.count !== 1) return false;
    try {
      if (!(await this.moyasar.capture(p.paymentRef, p.amountHalalas + p.addOnsHalalas)).ok) return false;
      await this.markCaptured(p, { attemptKey: captureKey }); return true;
    } catch { return false; }
  }

  /** Explicit governed continuation, never a hidden POST from GET reconciliation. */
  async resumeReplacementCapture(pledgeId: string): Promise<{ ok: true }> {
    const p = await this.prisma.pledge.findUniqueOrThrow({ where: { id: pledgeId } });
    if (p.status !== 'CAPTURE_GRACE' || heldAction(p.authorizationIssue) !== 'AUTHORIZE')
      throw new ConflictException('لا توجد محاولة بطاقة جديدة مؤهلة للاستكمال.');
    const proof = verifyHeldEvidence((await this.moyasar.fetchPayment(p.paymentRef)).raw, p, 'AUTHORIZE');
    if (proof.outcome === 'confirmed') await this.markCaptured(p, { attemptKey: p.authorizationIssue! });
    else if (!await this.captureAuthorizedReplacement(p, p.authorizationIssue!))
      throw new ConflictException('لم يتأكد التحصيل؛ راجع نتيجة المحاولة دون إعادة الطلب.');
    return { ok: true };
  }

  /** A clock cannot prove that a payment failed. Only matched, uncharged
   * provider evidence can release inventory, and never over a pending claim. */
  async expireGracePledge(p: Pledge, now: Date): Promise<boolean> {
    if (p.paymentMethod !== 'CARD' || p.status !== 'CAPTURE_GRACE' || p.authorizationIssue ||
        !p.graceExpiresAt || p.graceExpiresAt > now) return false;
    let raw: unknown;
    try { raw = (await this.moyasar.fetchPayment(p.paymentRef)).raw; } catch { return false; }
    if (!verifyUnchargedPayment(raw, p)) {
      try { if (verifyHeldEvidence(raw, p, 'CAPTURE').outcome === 'confirmed') await this.markCaptured(p); } catch { /* unresolved */ }
      return false;
    }
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
      const changed = await tx.pledge.updateMany({ where: { id: p.id, status: 'CAPTURE_GRACE', paymentRef: p.paymentRef,
        capturedAt: null, authorizationIssue: null, graceExpiresAt: { lte: now },
        amountHalalas: p.amountHalalas, addOnsHalalas: p.addOnsHalalas }, data: { status: 'FAILED_CAPTURE' } });
      if (changed.count !== 1) return false;
      if (p.tierId) {
        const stock = await tx.rewardTier.updateMany({ where: { id: p.tierId, claimedQty: { gt: 0 } }, data: { claimedQty: { decrement: 1 } } });
        if (stock.count !== 1) throw new ConflictException('مخزون المكافأة يحتاج مطابقة؛ لم يعتمد انتهاء التعهد.');
      }
      await tx.auditLog.create({ data: { action: 'payment.grace-expiry.confirmed', entity: 'Pledge', entityId: p.id,
        detail: { paymentRef: p.paymentRef, providerStatus: (raw as Record<string, unknown>).status as string,
          amountHalalas: (p.amountHalalas + p.addOnsHalalas).toString() } } });
      return true;
    });
  }

  /** Batch PAY (Part 1) — single-pledge void for backer cancellation. */
  async voidPledge(p: Pledge): Promise<boolean> {
    return this.refundOne(p);
  }

  /** Compensation for an authorization rejected BEFORE any funding counters
   * were credited. Do not reuse the counted-pledge refund compensation. */
  async voidUncountedAuthorization(p: Pledge, expectedIssue: null | 'authorization-terms-changed' = null): Promise<boolean> {
    const current = await this.prisma.pledge.findUnique({ where: { id: p.id } });
    if (!current || current.status !== PledgeStatus.PENDING_AUTH || current.paymentRef !== p.paymentRef) return false;
    if (!await this.prisma.$transaction(tx => claimUncountedVoid(tx, p, expectedIssue))) return false;
    try {
      if (!(await this.moyasar.void(p.paymentRef, p.amountHalalas + p.addOnsHalalas)).ok) throw new Error('provider void not confirmed');
      return await this.prisma.$transaction(async tx => {
        const result = await finalizeUncountedVoid(tx, p, 'sync-path');
        if (result !== 'mismatch') await completeProjectRefund(tx, p.projectId);
        return result !== 'mismatch';
      });
    } catch {
      this.logger.warn(`Uncounted authorization requires reconciliation pledge=${p.id}`);
      await this.prisma.pledge.updateMany({ where: { id: p.id, status: PledgeStatus.PENDING_AUTH, paymentRef: p.paymentRef,
        authorizationIssue: { in: VOID_PENDING_ISSUES } },
        data: { authorizationIssue: 'void-outcome-unknown' } }).catch(() => {});
      return false;
    }
  }

  /** Explicit operator decision, separate from GET recovery. Only a rejected
   * uncounted initial authorization is eligible, never an ambiguous void. */
  async releaseRejectedAuthorization(pledgeId: string): Promise<{ ok: true }> {
    const p = await this.prisma.pledge.findUniqueOrThrow({ where: { id: pledgeId } });
    if (!canRecoverAuthorization(p) || p.authorizationIssue !== 'authorization-terms-changed' || p.capturedAt)
      throw new ConflictException('يلزم حجز أول غير محتسب تعذر اعتماده بسبب تغير الشروط.');
    readAuthorizationContext(p);
    let raw: unknown;
    try { raw = (await this.moyasar.fetchPayment(p.paymentRef)).raw; }
    catch { throw new ServiceUnavailableException('تعذرت قراءة الحجز؛ لم يُرسل طلب فك.'); }
    const proof = verifyVoidEvidence(raw, p);
    if (proof.outcome === 'confirmed') {
      await this.prisma.$transaction(async tx => {
        const result = await finalizeUncountedVoid(tx, p, 'rejected-authorization-reconcile');
        if (result === 'mismatch') throw new ConflictException('تغيرت حالة الحجز؛ حدّث البيانات.');
        await completeProjectRefund(tx, p.projectId);
      });
      return { ok: true };
    }
    await this.recordInitialAuthorization(p);
    if (!await this.voidUncountedAuthorization(p, 'authorization-terms-changed'))
      throw new ServiceUnavailableException('لم يتأكد فك الحجز؛ تحقق من نتيجة المحاولة المحفوظة قبل أي إجراء آخر.');
    return { ok: true };
  }

  async reconcileUncountedVoid(pledgeId: string): Promise<VoidVerification> {
    const p = await this.prisma.pledge.findUnique({ where: { id: pledgeId } });
    if (!p || p.status !== 'PENDING_AUTH' || p.capturedAt || !VOID_PENDING_ISSUES.includes(p.authorizationIssue ?? '')) {
      throw new ConflictException('يلزم حجز غير محتسب له محاولة فك محفوظة؛ حدّث بيانات الصفحة.');
    }
    let raw: unknown;
    try { raw = (await this.moyasar.fetchPayment(p.paymentRef)).raw; }
    catch { throw new ServiceUnavailableException('تعذر قراءة نتيجة فك الحجز؛ بقي التعهد قيد المراجعة ولم يرسل طلب جديد.'); }
    const evidence = verifyVoidEvidence(raw, p);
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
      if (evidence.outcome === 'pending') {
        const changed = await tx.pledge.updateMany({ where: { id: p.id, status: 'PENDING_AUTH', paymentRef: p.paymentRef,
          amountHalalas: p.amountHalalas, addOnsHalalas: p.addOnsHalalas, authorizationIssue: { in: VOID_PENDING_ISSUES } },
          data: { authorizationIssue: 'void-not-confirmed' } });
        if (changed.count !== 1) throw new ConflictException('تغيرت حالة الحجز أثناء التحقق؛ حدّث البيانات.');
      } else {
        const result = await finalizeUncountedVoid(tx, p, 'ops-void-reconcile');
        if (result === 'mismatch') throw new ConflictException('تغيرت حالة الحجز أثناء التحقق؛ حدّث البيانات.');
        await completeProjectRefund(tx, p.projectId);
      }
    });
    return evidence;
  }

  async reconcileHeldPayment(pledgeId: string): Promise<HeldVerification> {
    const p = await this.prisma.pledge.findUnique({ where: { id: pledgeId } });
    const action = heldAction(p?.authorizationIssue);
    if (!p || !action || !['HELD', 'PENDING_REAUTH', 'CAPTURE_GRACE'].includes(p.status) || p.capturedAt) {
      throw new ConflictException('يلزم تعهد محجوز له محاولة مالية محفوظة؛ حدّث البيانات.');
    }
    let raw: unknown;
    try { raw = (await this.moyasar.fetchPayment(p.paymentRef)).raw; }
    catch { throw new ServiceUnavailableException('تعذرت قراءة نتيجة المحاولة؛ لم يرسل طلب مالي جديد.'); }
    if (p.status === 'CAPTURE_GRACE' && ['CAPTURE', 'AUTHORIZE'].includes(action) && verifyUnchargedPayment(raw, p)) {
      const changed = await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
        return tx.pledge.updateMany({ where: { id: p.id, status: 'CAPTURE_GRACE', paymentRef: p.paymentRef,
          capturedAt: null, authorizationIssue: p.authorizationIssue, amountHalalas: p.amountHalalas,
          addOnsHalalas: p.addOnsHalalas }, data: { authorizationIssue: null } });
      });
      if (changed.count !== 1) throw new ConflictException('تغيرت حالة التعهد؛ حدّث البيانات.');
      return { outcome: 'uncharged', action, paymentRef: p.paymentRef,
        amountHalalas: (p.amountHalalas + p.addOnsHalalas).toString(), providerStatus: (raw as Record<string, unknown>).status as string };
    }
    const proof = verifyHeldEvidence(raw, p, action);
    if (proof.outcome === 'confirmed') {
      if (action === 'CAPTURE' || action === 'AUTHORIZE') {
        await this.markCaptured(p, { attemptKey: p.authorizationIssue! });
      } else {
        await this.prisma.$transaction(async tx => {
          const result = await finalizeRefund(tx, p, { source: 'ops-held-payment-reconcile', attemptKey: p.authorizationIssue! });
          if (result === 'mismatch') throw new ConflictException('تغيرت حالة التعهد أثناء التحقق؛ يلزم المراجعة.');
          await completeProjectRefund(tx, p.projectId);
        });
      }
    }
    if (proof.outcome === 'pending') {
      const current = await this.prisma.pledge.findUnique({ where: { id: p.id } });
      if (!current || current.status !== p.status || current.paymentRef !== p.paymentRef || current.authorizationIssue !== p.authorizationIssue) {
        throw new ConflictException('تغيرت حالة التعهد أثناء التحقق؛ حدّث البيانات.');
      }
    }
    return proof;
  }

  private async refundOne(p: Pledge): Promise<boolean> {
    if (p.status === PledgeStatus.PENDING_BNPL) {
      const result = await this.prisma.$transaction(tx => finalizeRefund(tx, p, { source: 'bnpl-intent-cancel' }));
      return result !== 'mismatch';
    }
    if (p.status !== PledgeStatus.HELD && p.status !== PledgeStatus.PENDING_REAUTH) return false;
    const attemptKey = await this.prisma.$transaction(tx => claimHeldAction(tx, p, 'VOID'));
    if (!attemptKey) return false;
    try {
      const { ok } = await this.moyasar.void(p.paymentRef, p.amountHalalas + p.addOnsHalalas);
      if (!ok) return false;
      const result = await this.prisma.$transaction(tx => finalizeRefund(tx, p, { source: 'sync-path', attemptKey }));
      return result !== 'mismatch';
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
   *   totalPledgedHalalas. Captured refunds reserve funds before contacting the PSP.
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

    let attemptKey: string | null = null;
    // A captured refund reserves liquidity durably before any provider call.
    if (captured) {
      try { await this.prisma.$transaction(tx => reserveCapturedRefund(tx, pledge)); }
      catch (error) {
        if (!(error instanceof ConflictException)) throw error;
        return { ok: false, mode, amountHalalas: amount, failureReason: error.message };
      }
    } else if (!(attemptKey = await this.prisma.$transaction(tx => claimHeldAction(tx, pledge, 'VOID')))) {
      return { ok: false, mode, amountHalalas: amount, failureReason: 'payment-action-needs-verification' };
    }
    const uncertain = async () => {
      if (captured) await this.prisma.pledge.updateMany({
        where: { id: pledge.id, status: 'CAPTURED', refundReservedHalalas: { gt: 0n } },
        data: { refundIssue: 'refund-outcome-unknown' },
      });
      return { ok: false, mode, amountHalalas: amount,
        failureReason: captured ? 'refund-outcome-unknown' : 'payment-action-needs-verification' };
    };
    try {
      // A timeout may occur AFTER the remote refund. Never automatically retry it.
      const { ok } = captured ? await this.moyasar.refund(pledge.paymentRef, amount)
        : await this.moyasar.void(pledge.paymentRef, amount);
      if (!ok) return await uncertain();
    } catch { return await uncertain(); }

    const result = await this.prisma.$transaction(tx => finalizeRefund(tx, pledge, { source: 'ops-refund', ...(attemptKey ? { attemptKey } : {}) }));
    if (result === 'mismatch') {
      return { ok: false, mode, amountHalalas: amount, failureReason: 'refund-state-conflict:reconciliation-required' };
    }

    // Post-commit comms — best-effort; a comms glitch never undoes a refund.
    await this.notifyAdminRefund(pledge, mode).catch((err) =>
      this.logger.warn(`ops-refund comms failed pledge=${pledge.id}: ${String(err)}`),
    );
    this.logger.log(`ops ${mode} pledge=${pledge.id} amount=${amount} project=${pledge.projectId}`);
    return { ok: true, mode, amountHalalas: amount };
  }

  /** GET-only reconciliation of a previously reserved captured refund.
   * Paid/partial snapshots never release the reservation or create a new refund. */
  async reconcileCapturedRefund(pledgeId: string): Promise<RefundVerification> {
    const p = await this.prisma.pledge.findUnique({ where: { id: pledgeId } });
    if (!p || p.status !== 'CAPTURED' || !p.refundRequestedAt ||
        p.refundReservedHalalas !== p.amountHalalas + p.addOnsHalalas || p.refundReservedHalalas <= 0n) {
      throw new ConflictException('يلزم تعهد محصل له محاولة استرداد محفوظة وحجز مطابق؛ حدّث بيانات الصفحة.');
    }
    let raw: unknown;
    try { raw = (await this.moyasar.fetchPayment(p.paymentRef)).raw; }
    catch { throw new ServiceUnavailableException('تعذر قراءة نتيجة الاسترداد لدى المزود؛ لم يرسل طلب جديد وبقي الحجز محفوظًا.'); }
    const evidence = verifyRefundEvidence(raw, p);
    const result = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
      const current = await tx.pledge.findUnique({ where: { id: p.id } });
      const same = current && current.projectId === p.projectId && current.paymentRef === p.paymentRef &&
        current.amountHalalas === p.amountHalalas && current.addOnsHalalas === p.addOnsHalalas;
      if (same && current.status === 'REFUNDED' && evidence.outcome === 'confirmed') return 'duplicate';
      if (!same || current.status !== 'CAPTURED' || current.refundReservedHalalas !== p.refundReservedHalalas ||
          current.refundRequestedAt?.getTime() !== p.refundRequestedAt?.getTime()) {
        throw new ConflictException('تغيرت حالة التعهد أثناء التحقق؛ حدّث البيانات قبل المتابعة.');
      }
      if (evidence.outcome !== 'confirmed') {
        await tx.pledge.update({ where: { id: p.id }, data: {
          refundIssue: evidence.outcome === 'partial' ? 'refund-partial-needs-review' : 'refund-not-confirmed',
        } });
        return 'pending';
      }
      const applied = await finalizeRefund(tx, p, { source: 'ops-refund-reconcile' });
      if (applied === 'mismatch') throw new ConflictException('تعذر تثبيت الاسترداد؛ يلزم مطابقة حالة التعهد.');
      await completeProjectRefund(tx, p.projectId);
      return applied;
    });
    if (result === 'applied') await this.notifyAdminRefund(p, 'refund').catch(() =>
      this.logger.warn(`Refund verification notification needs recovery pledge=${p.id}`));
    return evidence;
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
   *     markCaptured chokepoint; unknown results retain a durable claim.
   *   · FAILED_CAPTURE (opt-in) — grace expiry released the tier stock, so
   *     the claim is re-taken ATOMICALLY before any PSP call; a sold-out
   *     tier skips the pledge (never charge a backer for a reward that can
   *     no longer be honored). An ambiguous result keeps inventory reserved.
   */
  async retryCaptureCohort(
    projectId: string,
    opts: { includeFailed: boolean },
  ): Promise<{ attempted: number; captured: number; stillFailed: number }> {
    let attempted = 0;
    let captured = 0;
    let stillFailed = 0;

    const inGrace = await this.prisma.pledge.findMany({ where: { projectId, status: PledgeStatus.CAPTURE_GRACE } });
    for (const p of inGrace) {
      attempted++;
      try { if (await this.captureGracePledge(p)) captured++; else stillFailed++; }
      catch { stillFailed++; }
    }
    if (opts.includeFailed) {
      const dead = await this.prisma.pledge.findMany({ where: { projectId, status: PledgeStatus.FAILED_CAPTURE } });
      for (const p of dead) {
        attempted++;
        try { if ((await this.reviveFailedPledge(p.id)).ok) captured++; else stillFailed++; }
        catch { stillFailed++; }
      }
    }
    return { attempted, captured, stillFailed };
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
    if (pledge.status !== PledgeStatus.DISPUTED) throw new ConflictException('Only an unresolved dispute may be resolved');
    const amount = pledge.amountHalalas + pledge.addOnsHalalas;
    const now = new Date();

    if (outcome === 'WON') {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${pledge.projectId}::uuid FOR UPDATE`;
        const claim = await tx.pledge.updateMany({
          where: { id: pledge.id, status: PledgeStatus.DISPUTED, paymentRef: pledge.paymentRef,
            amountHalalas: pledge.amountHalalas, addOnsHalalas: pledge.addOnsHalalas },
          data: { status: PledgeStatus.CAPTURED, disputeOutcome: 'WON', disputeResolvedAt: now },
        });
        if (claim.count !== 1) throw new ConflictException('Dispute state changed; refresh before resolving');
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
    const result = await this.prisma.$transaction(tx => finalizeRefund(tx, pledge, { source: 'dispute-lost', disputeLost: true }));
    if (result !== 'applied') throw new ConflictException('Dispute state changed; refresh before resolving');
    this.logger.log(`dispute LOST pledge=${pledge.id} amount=${amount} — refunded + compensated`);
    return { ok: true, outcome, status: PledgeStatus.REFUNDED, amountHalalas: amount };
  }

  /**
   * Batch OPS-PRO Phase 1 — revive a single terminally-failed capture
   * (money.pledge.revive). The single-pledge form of retryCaptureCohort's
   * includeFailed branch: re-claim the tier stock ATOMICALLY (grace expiry
   * released it) before any PSP call, then re-authorize + capture. A sold-out
   * tier short-circuits with tier-stock-exhausted (never charge for a reward
   * that can no longer be honored). Unsupported renewal exits before claiming;
   * an unknown provider outcome retains both the attempt and reserved stock.
   */
  async reviveFailedPledge(
    pledgeId: string,
  ): Promise<{ ok: boolean; reason?: string; status: PledgeStatus }> {
    const p = await this.prisma.pledge.findUniqueOrThrow({ where: { id: pledgeId } });

    if (p.status !== 'FAILED_CAPTURE' || p.paymentMethod !== 'CARD' || p.authorizationIssue)
      return { ok: false, reason: 'not-revivable', status: p.status };
    try { this.moyasar.assertReauthorizationAvailable(); }
    catch { return { ok: false, reason: 'renewal-integration-unavailable', status: p.status }; }
    const key = `payment:REAUTHORIZE:${randomUUID()}`;
    try {
      const claimed = await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${p.projectId}::uuid FOR UPDATE`;
        const c = await tx.pledge.updateMany({ where: { id: p.id, status: 'FAILED_CAPTURE', paymentRef: p.paymentRef,
          capturedAt: null, authorizationIssue: null, amountHalalas: p.amountHalalas, addOnsHalalas: p.addOnsHalalas },
          data: { status: 'CAPTURE_GRACE', authorizationIssue: key } });
        if (c.count !== 1) return false;
        if (p.tierId) {
          const tier = await tx.rewardTier.findUnique({ where: { id: p.tierId } });
          if (!tier) throw new ConflictException('tier-stock-exhausted');
          const stock = await tx.rewardTier.updateMany({ where: { id: p.tierId,
            ...(tier.limitQty == null ? {} : { claimedQty: { lt: tier.limitQty } }) }, data: { claimedQty: { increment: 1 } } });
          if (stock.count !== 1) throw new ConflictException('tier-stock-exhausted');
        }
        return true;
      });
      if (!claimed) return { ok: false, reason: 'payment-action-needs-verification', status: p.status };
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      return { ok: false, reason: 'tier-stock-exhausted', status: p.status };
    }
    // Unknown renewal keeps stock reserved and the attempt durable.
    try {
      if ((await this.moyasar.reauthorize(p.paymentRef)).ok) {
        const authorizeKey = key.replace('payment:REAUTHORIZE:', 'payment:AUTHORIZE:');
        const changed = await this.prisma.pledge.updateMany({ where: { id: p.id, status: 'CAPTURE_GRACE', paymentRef: p.paymentRef, authorizationIssue: key },
          data: { authorizationIssue: authorizeKey, reauthorizedAt: new Date() } });
        if (changed.count === 1 && await this.captureAuthorizedReplacement({ ...p, status: 'CAPTURE_GRACE' }, authorizeKey))
          return { ok: true, status: 'CAPTURED' };
      }
    } catch { /* pending; never release stock on an ambiguous result */ }
    return { ok: false, reason: 'payment-action-needs-verification', status: 'CAPTURE_GRACE' };
  }
}
