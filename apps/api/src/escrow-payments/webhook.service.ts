import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from './ledger.service';
import { LedgerEntryType, PledgeStatus, Prisma } from '@prisma/client';

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
    cfg: ConfigService,
  ) {
    this.secret = cfg.get<string>('MOYASAR_WEBHOOK_SECRET') ?? '';
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
        await this.prisma.pledge.update({
          where: { id: pledge.id },
          data: { status: PledgeStatus.CAPTURED, capturedAt: new Date() },
        });
        await this.ledger.record({
          entryType: LedgerEntryType.CAPTURE,
          amountHalalas: pledge.amountHalalas + pledge.addOnsHalalas,
          pspRef,
          pledgeId: pledge.id,
          projectId: pledge.projectId,
          source: 'webhook',
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
        return 'applied';
      }

      default:
        return 'ignored';
    }
  }
}
