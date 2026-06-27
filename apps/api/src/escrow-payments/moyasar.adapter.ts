import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

/**
 * Minimal Moyasar Split adapter — Hold (authorize), Capture, Refund.
 *
 * In production we POST to Moyasar's REST endpoints; here we have a
 * dev/test mode (when MOYASAR_API_KEY is empty) that returns
 * deterministic stub responses so the entire pledge → capture → refund
 * pipeline can be tested locally without leaving the box.
 */
export interface HoldRequest {
  amountHalalas: number;
  /** Display description (Arabic). */
  description: string;
  /** Backer's tokenized card or pay-method ref from the mobile SDK. */
  source: string;
  /** Wathba pledge id for idempotency. */
  pledgeId: string;
}

export interface HoldResponse {
  paymentRef: string;
  status: 'authorized' | 'failed';
  raw?: Record<string, unknown>;
}

@Injectable()
export class MoyasarAdapter {
  private readonly logger = new Logger(MoyasarAdapter.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.moyasar.com/v1';

  constructor(cfg: ConfigService) {
    this.apiKey = cfg.get<string>('MOYASAR_API_KEY') ?? '';
  }

  private get isStubMode(): boolean {
    return !this.apiKey;
  }

  async hold(req: HoldRequest): Promise<HoldResponse> {
    if (this.isStubMode) {
      this.logger.warn(
        `[STUB] Authorize-only hold for pledge=${req.pledgeId} amount=${req.amountHalalas / 100} SAR`,
      );
      return {
        paymentRef: `stub-pay-${req.pledgeId}-${randomUUID().slice(0, 8)}`,
        status: 'authorized',
      };
    }
    const body = {
      amount: req.amountHalalas, // Moyasar uses minor units
      currency: 'SAR',
      description: req.description,
      source: { type: 'token', token: req.source },
      capture: false, // hold only
      metadata: { pledgeId: req.pledgeId },
    };
    const res = await this.req('POST', '/payments', body);
    return {
      paymentRef: String(res['id']),
      status: res['status'] === 'authorized' ? 'authorized' : 'failed',
      raw: res,
    };
  }

  async capture(paymentRef: string): Promise<{ ok: boolean }> {
    if (this.isStubMode) {
      this.logger.warn(`[STUB] Capture payment=${paymentRef}`);
      return { ok: true };
    }
    const res = await this.req('POST', `/payments/${paymentRef}/capture`, {});
    return { ok: res['status'] === 'paid' };
  }

  async refund(paymentRef: string, _reason: string): Promise<{ ok: boolean }> {
    if (this.isStubMode) {
      this.logger.warn(`[STUB] Refund payment=${paymentRef}`);
      return { ok: true };
    }
    const res = await this.req('POST', `/payments/${paymentRef}/refund`, {});
    return { ok: res['status'] === 'refunded' };
  }

  async void(paymentRef: string): Promise<{ ok: boolean }> {
    if (this.isStubMode) {
      this.logger.warn(`[STUB] Void payment=${paymentRef}`);
      return { ok: true };
    }
    const res = await this.req('POST', `/payments/${paymentRef}/void`, {});
    return { ok: res['status'] === 'voided' };
  }

  private async req(method: string, path: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      this.logger.error(`Moyasar ${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
      throw new Error(`moyasar: ${res.status} ${JSON.stringify(json)}`);
    }
    return json;
  }
}
