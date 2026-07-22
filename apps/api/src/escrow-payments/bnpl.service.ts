import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PledgeStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { EscrowService } from './escrow.service';
import { AuditService } from '../identity/audit.service';

/**
 * Batch PAY (Part 4) — Tabby & Tamara, SANDBOX ONLY (production credentials
 * are an owner task).
 *
 * MODEL: BNPL providers pay the merchant up-front and collect installments
 * themselves — there is NO authorize-now/capture-later. So Wathba records a
 * BNPL pledge as an INTENT (PENDING_BNPL) that counts toward the total, and
 * only AFTER the campaign succeeds at its deadline does the backer complete
 * the provider's hosted checkout (within the 72h grace window). A failed
 * campaign simply discards the intent — strictly safer for the backer.
 *
 * Stub mode (no *_API_KEY env): createCheckout returns a deterministic
 * sandbox URL; webhooks accept unsigned events (mirrors MoyasarAdapter).
 */

export type BnplProvider = 'TABBY' | 'TAMARA';

const PROVIDERS: Record<BnplProvider, { base: string; keyEnv: string; secretEnv: string; installments: number }> = {
  TABBY: { base: 'https://api.tabby.ai/api/v2', keyEnv: 'TABBY_API_KEY', secretEnv: 'TABBY_WEBHOOK_SECRET', installments: 4 },
  TAMARA: { base: 'https://api.tamara.co', keyEnv: 'TAMARA_API_KEY', secretEnv: 'TAMARA_WEBHOOK_SECRET', installments: 4 },
};

@Injectable()
export class BnplService {
  private readonly logger = new Logger(BnplService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly escrow: EscrowService,
    private readonly audit: AuditService,
  ) {}

  private isStub(provider: BnplProvider): boolean {
    return !process.env[PROVIDERS[provider].keyEnv];
  }

  /** Installment disclosure for the pledge sheet (count + per-installment). */
  installmentsFor(provider: BnplProvider, amountHalalas: bigint): { count: number; perInstallmentHalalas: bigint } {
    const count = PROVIDERS[provider].installments;
    // BigInt ceil-division — the last installment absorbs the remainder.
    return { count, perInstallmentHalalas: (amountHalalas + BigInt(count - 1)) / BigInt(count) };
  }

  /**
   * The backer completes a DUE intent (campaign succeeded → CAPTURE_GRACE).
   * Returns the provider's hosted-checkout URL.
   */
  async createCheckout(backerId: string, pledgeId: string): Promise<{ url: string; provider: BnplProvider }> {
    const pledge = await this.prisma.pledge.findUnique({
      where: { id: pledgeId },
      include: { project: { select: { titleAr: true, status: true } } },
    });
    if (!pledge) throw new NotFoundException('pledge not found');
    if (pledge.backerId !== backerId) throw new BadRequestException('not your pledge');
    if (pledge.status !== PledgeStatus.CAPTURE_GRACE || pledge.paymentMethod === 'CARD') {
      throw new BadRequestException('لا يوجد تقسيط مستحق على هذا التعهد');
    }
    const provider = pledge.paymentMethod as BnplProvider;
    if (this.isStub(provider)) {
      this.logger.warn(`[STUB] ${provider} checkout for pledge=${pledgeId}`);
      return { url: `https://sandbox.${provider.toLowerCase()}.example/checkout/${pledgeId}`, provider };
    }
    // Real integration point (sandbox creds): create a checkout session with
    // amount, reference_id=pledgeId, success/cancel URLs; store session ref.
    throw new BadRequestException(`${provider} sandbox credentials not configured`);
  }

  /**
   * Webhook: signature-verified (HMAC-SHA256 of the raw body), idempotent
   * (status-guarded transition), replay-safe (a second identical event
   * no-ops on the guard). Event: payment captured/authorised for pledgeId.
   */
  async handleWebhook(
    provider: BnplProvider,
    rawBody: string,
    signature: string | undefined,
    payload: { pledgeId?: string; status?: string; eventId?: string },
  ): Promise<{ outcome: 'applied' | 'ignored' | 'mismatch' }> {
    this.verifySignature(provider, rawBody, signature);
    if (!payload.pledgeId || payload.status !== 'captured') return { outcome: 'ignored' };

    const pledge = await this.prisma.pledge.findUnique({ where: { id: payload.pledgeId } });
    if (!pledge || pledge.paymentMethod !== provider) return { outcome: 'mismatch' };
    if (pledge.status === PledgeStatus.CAPTURED) return { outcome: 'ignored' }; // replay
    if (pledge.status !== PledgeStatus.CAPTURE_GRACE) return { outcome: 'mismatch' };

    // Same chokepoint as card captures: CAPTURED + REALIZED + ledger CAPTURE.
    await this.escrow.markCaptured(pledge);
    this.logger.log(`${provider} webhook captured pledge=${pledge.id}`);
    // MONEY-AUDIT — BNPL installment plan captured (CAPTURE_GRACE→CAPTURED).
    // The status guards above (already-CAPTURED → 'ignored') make this fire
    // only on the real transition, so a replayed event does not re-audit.
    // Never throws.
    await this.audit.log({
      actorId: null,
      action: 'system.bnpl.captured',
      entity: 'Pledge',
      entityId: pledge.id,
      detail: {
        projectId: pledge.projectId,
        provider,
        amountHalalas: (pledge.amountHalalas + pledge.addOnsHalalas).toString(),
        pspRef: pledge.paymentRef,
      },
    });
    return { outcome: 'applied' };
  }

  private verifySignature(provider: BnplProvider, rawBody: string, signature: string | undefined): void {
    const secret = process.env[PROVIDERS[provider].secretEnv] ?? '';
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('webhook secret not configured');
      }
      return; // stub mode — same posture as the Moyasar webhook.
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const given = Buffer.from(signature ?? '', 'utf8');
    const want = Buffer.from(expected, 'utf8');
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      throw new UnauthorizedException('invalid webhook signature');
    }
  }
}
