import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { EscrowService } from './escrow.service';
import { AuditService } from '../identity/audit.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LedgerEntryType, NotificationKind, PledgeStatus, Prisma } from '@prisma/client';

/**
 * Moyasar webhook processor (Sprint 1 / P0-003).
 *
 * Contract with Moyasar:
 *  - Deliveries are at-least-once; duplicates MUST be harmless.
 *  - Authenticity = shared `secret_token` inside the JSON body, compared
 *    in constant time against MOYASAR_WEBHOOK_SECRET.
 *  - Non-2xx responses are retried by Moyasar; we therefore return 200 for
 *    everything we consciously decided about (applied / ignored / duplicate
 *    / mismatch) and only throw (→5xx) on genuine processing errors, so
 *    retries happen exactly when they can help.
 *
 * Event mapping onto the pledge FSM (paymentRef = Moyasar payment id):
 *   payment_authorized → HELD          (confirm; no state change)
 *   payment_paid       → HELD→CAPTURED (capture confirmed by PSP)
 *   payment_failed     → HELD→FAILED
 *   payment_voided     → HELD→REFUNDED (voided hold = our pre-capture refund)
 *   payment_refunded   → CAPTURED→REFUNDED
 * Anything else is recorded and ignored.
 */

export interface MoyasarWebhookPayload {
  id?: string;
  type?: string;
  secret_token?: string;
  data?: { id?: string; status?: string; [k: string]: unknown };
  [k: string]: unknown;
}

export type WebhookOutcome = 'applied' | 'ignored' | 'duplicate' | 'mismatch';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly escrow: EscrowService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
    cfg: ConfigService,
  ) {
    this.secret = cfg.get<string>('MOYASAR_WEBHOOK_SECRET') ?? '';
  }

  /**
   * STAKES/S-12 F-08 — "your refund landed": in-app + email to the backer
   * when a pledge reaches REFUNDED. The template + kind existed but nothing
   * ever fired them. Transactional (money truth) → NOT pref-gated.
   * Best-effort: a notification glitch never fails the webhook.
   */
  private async notifyRefundCompleted(pledgeId: string): Promise<void> {
    const row = await this.prisma.pledge.findUnique({
      where: { id: pledgeId },
      select: {
        amountHalalas: true,
        addOnsHalalas: true,
        backer: { select: { id: true, email: true } },
        project: { select: { id: true, titleAr: true } },
      },
    });
    if (!row) return;
    const amountHalalas = Number(row.amountHalalas + row.addOnsHalalas);
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

  /** Constant-time shared-secret check. */
  verify(payload: MoyasarWebhookPayload): void {
    if (!this.secret) {
      if (process.env.NODE_ENV === 'production') {
        // Refuse to process unauthenticated money events in prod.
        throw new ServiceUnavailableException('webhook secret not configured');
      }
      this.logger.warn('[STUB] MOYASAR_WEBHOOK_SECRET unset — accepting webhook unverified (dev only)');
      return;
    }
    const given = Buffer.from(String(payload.secret_token ?? ''));
    const want = Buffer.from(this.secret);
    const ok = given.length === want.length && timingSafeEqual(given, want);
    if (!ok) throw new UnauthorizedException('bad webhook secret');
  }

  async process(payload: MoyasarWebhookPayload): Promise<{ outcome: WebhookOutcome }> {
    const eventType = String(payload.type ?? 'unknown');
    const pspRef = String(payload.data?.id ?? '');
    const dedupKey =
      payload.id != null
        ? `moyasar:${String(payload.id)}`
        : `moyasar:${createHash('sha256')
            .update(`${eventType}|${pspRef}|${String(payload.data?.status ?? '')}`)
            .digest('hex')}`;

    // Idempotency claim — unique(dedupKey) makes the second delivery lose.
    let eventRowId: string;
    try {
      const row = await this.prisma.webhookEvent.create({
        data: {
          eventType,
          pspRef,
          dedupKey,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });
      eventRowId = row.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.log(`webhook duplicate dedupKey=${dedupKey}`);
        return { outcome: 'duplicate' };
      }
      throw err;
    }

    const outcome = await this.apply(eventType, pspRef);
    await this.prisma.webhookEvent.update({
      where: { id: eventRowId },
      data: { processedAt: new Date(), outcome },
    });
    if (outcome === 'mismatch') {
      this.logger.error(
        `WEBHOOK MISMATCH type=${eventType} pspRef=${pspRef} — no matching pledge/transition; needs reconciliation`,
      );
    }
    return { outcome };
  }

  /**
   * OPS-INTEGRITY — replay a STORED webhook event through the FSM, bypassing
   * the dedup claim. `process()` re-delivery would just return 'duplicate';
   * this re-invokes `apply()` directly for an already-persisted row so a
   * money-integrity operator can heal a `mismatch`-class event — one that
   * arrived against the wrong pledge state (e.g. before the sync path had
   * moved the pledge to HELD) and is now applicable.
   *
   * apply() is idempotent via its per-branch status guards, so a replay is
   * safe: it re-applies when the transition is now valid and returns
   * 'ignored'/'mismatch' otherwise, never double-charging. The event row is
   * NOT append-only, so re-stamping processedAt/outcome on the SAME row is
   * correct (only LedgerEntry/AuditLog are locked).
   */
  async replayStored(webhookEventId: string): Promise<{ outcome: WebhookOutcome }> {
    const row = await this.prisma.webhookEvent.findUnique({ where: { id: webhookEventId } });
    if (!row) throw new NotFoundException('webhook event not found');
    const outcome = await this.apply(row.eventType, row.pspRef);
    await this.prisma.webhookEvent.update({
      where: { id: row.id },
      data: { processedAt: new Date(), outcome },
    });
    if (outcome === 'mismatch') {
      this.logger.error(
        `WEBHOOK REPLAY still mismatched id=${row.id} type=${row.eventType} pspRef=${row.pspRef} — no valid transition even on replay`,
      );
    }
    return { outcome };
  }

  private async apply(eventType: string, pspRef: string): Promise<WebhookOutcome> {
    if (!pspRef) return 'ignored';
    const pledge = await this.prisma.pledge.findFirst({ where: { paymentRef: pspRef } });
    if (!pledge) return 'mismatch';

    switch (eventType) {
      case 'payment_authorized':
        // Hold confirmed; our pledge is already HELD from the sync path.
        return pledge.status === PledgeStatus.HELD ? 'applied' : 'ignored';

      case 'payment_paid': {
        if (pledge.status === PledgeStatus.CAPTURED) return 'ignored';
        if (pledge.status !== PledgeStatus.HELD) return 'mismatch';
        // OPS-0 correction #1 — a webhook-confirmed capture goes through the
        // SAME markCaptured chokepoint as the sync path: realizedHalalas is
        // credited and the ledger row written once. Before this fix, captures
        // confirmed via payment_paid never counted toward REALIZED, so
        // milestone releases under-paid the creator.
        await this.escrow.markCaptured(pledge, { source: 'webhook' });
        // MONEY-AUDIT — webhook-confirmed capture (HELD→CAPTURED). The status
        // guards above (already-CAPTURED → 'ignored') make this branch fire
        // only on the real transition, so a duplicate/replayed delivery does
        // not re-audit. Never throws.
        await this.audit.log({
          actorId: null,
          action: 'system.webhook.captured',
          entity: 'Pledge',
          entityId: pledge.id,
          detail: {
            pspRef,
            projectId: pledge.projectId,
            amountHalalas: (pledge.amountHalalas + pledge.addOnsHalalas).toString(),
          },
        });
        return 'applied';
      }

      case 'payment_failed': {
        if (pledge.status === PledgeStatus.FAILED) return 'ignored';
        if (pledge.status !== PledgeStatus.HELD) return 'mismatch';
        await this.prisma.pledge.update({
          where: { id: pledge.id },
          data: { status: PledgeStatus.FAILED },
        });
        // MONEY-AUDIT — HELD→FAILED (authorization declined by the PSP).
        // Guarded by the status checks (already-FAILED → 'ignored'). Never throws.
        await this.audit.log({
          actorId: null,
          action: 'system.webhook.failed',
          entity: 'Pledge',
          entityId: pledge.id,
          detail: { pspRef, projectId: pledge.projectId },
        });
        return 'applied';
      }

      case 'payment_voided': {
        if (pledge.status === PledgeStatus.REFUNDED) return 'ignored';
        if (pledge.status !== PledgeStatus.HELD) return 'mismatch';
        await this.prisma.pledge.update({
          where: { id: pledge.id },
          data: { status: PledgeStatus.REFUNDED, refundedAt: new Date() },
        });
        await this.ledger.record({
          entryType: LedgerEntryType.VOID,
          amountHalalas: pledge.amountHalalas + pledge.addOnsHalalas,
          pspRef,
          pledgeId: pledge.id,
          projectId: pledge.projectId,
          source: 'webhook',
        });
        // MONEY-AUDIT — voided hold = pre-capture refund (HELD→REFUNDED).
        // Status-guarded (already-REFUNDED → 'ignored'), so replay-safe. Never throws.
        await this.audit.log({
          actorId: null,
          action: 'system.webhook.voided',
          entity: 'Pledge',
          entityId: pledge.id,
          detail: {
            pspRef,
            projectId: pledge.projectId,
            amountHalalas: (pledge.amountHalalas + pledge.addOnsHalalas).toString(),
          },
        });
        // STAKES/S-12 F-08 — tell the backer their money is back.
        this.notifyRefundCompleted(pledge.id).catch(() => {});
        return 'applied';
      }

      case 'payment_refunded': {
        if (pledge.status === PledgeStatus.REFUNDED) return 'ignored';
        if (pledge.status !== PledgeStatus.CAPTURED) return 'mismatch';
        await this.prisma.pledge.update({
          where: { id: pledge.id },
          data: { status: PledgeStatus.REFUNDED, refundedAt: new Date() },
        });
        await this.ledger.record({
          entryType: LedgerEntryType.REFUND,
          amountHalalas: pledge.amountHalalas + pledge.addOnsHalalas,
          pspRef,
          pledgeId: pledge.id,
          projectId: pledge.projectId,
          source: 'webhook',
        });
        // MONEY-AUDIT — post-capture refund (CAPTURED→REFUNDED). Status-guarded
        // (already-REFUNDED → 'ignored'), so replay-safe. Never throws.
        await this.audit.log({
          actorId: null,
          action: 'system.webhook.refunded',
          entity: 'Pledge',
          entityId: pledge.id,
          detail: {
            pspRef,
            projectId: pledge.projectId,
            amountHalalas: (pledge.amountHalalas + pledge.addOnsHalalas).toString(),
          },
        });
        // STAKES/S-12 F-08 — tell the backer their money is back.
        this.notifyRefundCompleted(pledge.id).catch(() => {});
        return 'applied';
      }

      case 'payment_disputed':
      case 'chargeback': {
        // Sprint 5 / #5: a chargeback claws back a captured pledge. Record
        // a reversing DISPUTE ledger entry so the journal reconciles to PSP
        // truth, flip the pledge to DISPUTED, and raise an audit + alert.
        if (pledge.status === PledgeStatus.DISPUTED) return 'ignored';
        if (pledge.status !== PledgeStatus.CAPTURED) return 'mismatch';
        await this.prisma.pledge.update({
          where: { id: pledge.id },
          data: { status: PledgeStatus.DISPUTED },
        });
        await this.ledger.record({
          entryType: LedgerEntryType.DISPUTE,
          amountHalalas: pledge.amountHalalas + pledge.addOnsHalalas,
          pspRef,
          pledgeId: pledge.id,
          projectId: pledge.projectId,
          source: 'webhook',
        });
        await this.audit.log({
          action: 'pledge.disputed',
          entity: 'Pledge',
          entityId: pledge.id,
          detail: { pspRef, projectId: pledge.projectId },
        });
        this.logger.error(
          `DISPUTE ALERT pledge=${pledge.id} pspRef=${pspRef} — chargeback clawed back a CAPTURED pledge; funds reconciliation required`,
        );
        return 'applied';
      }

      default:
        return 'ignored';
    }
  }
}
