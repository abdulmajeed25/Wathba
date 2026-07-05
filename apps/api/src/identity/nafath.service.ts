import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

/**
 * Nafath KYC adapter (Sprint 2 / P0-501).
 *
 * Real mode (NAFATH_API_KEY set): initiate opens a Nafath MFA request for
 * the national ID and returns the `random` two-digit challenge the user must
 * tap in the Nafath app; confirm polls the request status and ONLY marks
 * the user verified on an explicit COMPLETED response. REJECTED / EXPIRED /
 * pending are surfaced as distinct outcomes — never silently approved.
 *
 * Stub mode (no key): the full initiate → confirm flow still works locally
 * BUT is refused in production — a prod boot without Nafath credentials
 * cannot mint verified identities.
 */

export type NafathConfirmOutcome = 'verified' | 'pending' | 'rejected' | 'expired';

interface PendingTx {
  userId: string;
  nationalId: string;
  createdAt: number;
}

const TX_TTL_MS = 3 * 60 * 1000; // Nafath requests expire in ~3 minutes

@Injectable()
export class NafathService {
  private readonly logger = new Logger(NafathService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly appId: string;
  /** Stub-mode transaction store (real mode delegates state to Nafath). */
  private readonly stubTxs = new Map<string, PendingTx>();

  constructor(
    private readonly prisma: PrismaService,
    cfg: ConfigService,
    private readonly email: EmailService,
  ) {
    this.apiKey = cfg.get<string>('NAFATH_API_KEY') ?? '';
    this.baseUrl = cfg.get<string>('NAFATH_BASE_URL') ?? 'https://nafath.api.elm.sa';
    this.appId = cfg.get<string>('NAFATH_APP_ID') ?? 'wathba';
  }

  private get isStub(): boolean {
    return !this.apiKey;
  }

  private assertConfiguredInProd(): void {
    if (this.isStub && process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Nafath is not configured — identity verification is unavailable',
      );
    }
  }

  async initiate(
    userId: string,
    nationalId: string,
  ): Promise<{ transactionId: string; random?: string; expiresInSec: number }> {
    this.assertConfiguredInProd();

    if (this.isStub) {
      const transactionId = `stub-${userId.slice(0, 8)}-${Date.now()}`;
      this.stubTxs.set(transactionId, { userId, nationalId, createdAt: Date.now() });
      this.logger.warn(
        `[STUB] Nafath initiate user=${userId} nationalId=${maskNid(nationalId)} tx=${transactionId}`,
      );
      return { transactionId, expiresInSec: TX_TTL_MS / 1000 };
    }

    const res = await this.req('POST', '/api/v1/mfa/request', {
      nationalId,
      service: 'DigitalServiceEnrollmentWithoutBio',
      appId: this.appId,
    });
    this.logger.log(
      `Nafath initiate user=${userId} nid=${maskNid(nationalId)} tx=${String(res['transId'])}`,
    );
    return {
      transactionId: String(res['transId']),
      random: res['random'] != null ? String(res['random']) : undefined,
      expiresInSec: TX_TTL_MS / 1000,
    };
  }

  async confirm(
    userId: string,
    transactionId: string,
  ): Promise<{ outcome: NafathConfirmOutcome }> {
    this.assertConfiguredInProd();

    if (this.isStub) {
      const tx = this.stubTxs.get(transactionId);
      if (!tx || tx.userId !== userId) {
        throw new NotFoundException('nafath transaction not found for this user');
      }
      if (Date.now() - tx.createdAt > TX_TTL_MS) {
        this.stubTxs.delete(transactionId);
        return { outcome: 'expired' };
      }
      this.stubTxs.delete(transactionId);
      this.logger.warn(
        `[STUB] Nafath confirm auto-approves user=${userId} tx=${transactionId} (dev only)`,
      );
      await this.markVerified(userId);
      return { outcome: 'verified' };
    }

    const res = await this.req('POST', '/api/v1/mfa/request/status', {
      transId: transactionId,
      appId: this.appId,
    });
    const status = String(res['status'] ?? '').toUpperCase();
    switch (status) {
      case 'COMPLETED':
        await this.markVerified(userId);
        return { outcome: 'verified' };
      case 'REJECTED':
        this.logger.warn(`Nafath REJECTED user=${userId} tx=${transactionId}`);
        return { outcome: 'rejected' };
      case 'EXPIRED':
        return { outcome: 'expired' };
      case 'WAITING':
      case 'PENDING':
        return { outcome: 'pending' };
      default:
        throw new BadRequestException(`unexpected Nafath status: ${status || '(empty)'}`);
    }
  }

  private async markVerified(userId: string): Promise<void> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { nafathVerified: true, nafathVerifiedAt: new Date() },
      select: { email: true, name: true },
    });
    // STAKES follow-up (A7) — welcome the freshly-verified user (best-effort).
    try {
      await this.email.welcome(user.email, user.name);
    } catch (e) {
      this.logger.error(`welcome email failed for user=${userId}`, e as Error);
    }
  }

  private async req(method: string, path: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'APP-ID': this.appId,
        'APP-KEY': this.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      this.logger.error(`Nafath ${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
      throw new ServiceUnavailableException('Nafath request failed');
    }
    return json;
  }
}

function maskNid(id: string): string {
  return id.length <= 4 ? '****' : `${id.slice(0, 2)}******${id.slice(-2)}`;
}
