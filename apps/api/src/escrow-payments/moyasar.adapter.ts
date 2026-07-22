import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

/**
 * Minimal Moyasar Split adapter — Hold (authorize), Capture, Refund/Void.
 *
 * In production we POST Moyasar REST; in dev (when MOYASAR_API_KEY is empty)
 * we use deterministic stub responses so the full pledge → capture → refund
 * pipeline runs locally without a network round-trip.
 */
export interface HoldRequest {
  amountHalalas: number;
  description: string;
  source: string;
  pledgeId: string;
  /** Browser return URL for 3-D Secure hops (Moyasar `callback_url`). */
  callbackUrl?: string;
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

  private get isStub(): boolean {
    return !this.apiKey;
  }

  /**
   * Batch OPS-PRO — refuse to fabricate money movements in production.
   * Parity with NafathService.assertConfiguredInProd and the webhook secret
   * guard: without MOYASAR_API_KEY the adapter would silently stub
   * "authorized" holds/captures/refunds. In prod that is a catastrophe (real
   * pledges recorded against fake authorizations), so every PSP entry point
   * calls this first. Dev/test keep the stub, with a [STUB] warn.
   */
  private assertConfiguredInProd(): void {
    if (this.isStub && process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Moyasar is not configured — payment processing is unavailable',
      );
    }
  }

  async hold(req: HoldRequest): Promise<HoldResponse> {
    this.assertConfiguredInProd();
    if (this.isStub) {
      this.logger.warn(
        `[STUB] Authorize-only hold pledge=${req.pledgeId} amount=${req.amountHalalas / 100} SAR`,
      );
      return {
        paymentRef: `stub-pay-${req.pledgeId}-${randomUUID().slice(0, 8)}`,
        status: 'authorized',
      };
    }
    const body = {
      amount: req.amountHalalas,
      currency: 'SAR',
      description: req.description,
      source: { type: 'token', token: req.source },
      capture: false,
      metadata: { pledgeId: req.pledgeId },
      ...(req.callbackUrl ? { callback_url: req.callbackUrl } : {}),
    };
    const res = await this.req('POST', '/payments', body);
    return {
      paymentRef: String(res['id']),
      status: res['status'] === 'authorized' ? 'authorized' : 'failed',
      raw: res,
    };
  }

  async capture(paymentRef: string): Promise<{ ok: boolean }> {
    this.assertConfiguredInProd();
    if (this.isStub) {
      this.logger.warn(`[STUB] Capture payment=${paymentRef}`);
      return { ok: true };
    }
    const res = await this.req('POST', `/payments/${paymentRef}/capture`, {});
    return { ok: res['status'] === 'paid' };
  }

  async refund(paymentRef: string): Promise<{ ok: boolean }> {
    this.assertConfiguredInProd();
    if (this.isStub) {
      this.logger.warn(`[STUB] Refund payment=${paymentRef}`);
      return { ok: true };
    }
    const res = await this.req('POST', `/payments/${paymentRef}/refund`, {});
    return { ok: res['status'] === 'refunded' };
  }

  /**
   * Batch PAY (Part 5) — re-authorization for long campaigns. Issuer holds
   * expire in days-to-weeks (assumption documented in ReauthScheduler); the
   * real flow re-authorizes against the saved payment source. Stub always
   * succeeds unless the ref carries the test marker 'reauth-fail'.
   */
  async reauthorize(paymentRef: string): Promise<{ ok: boolean }> {
    this.assertConfiguredInProd();
    if (this.isStub) {
      this.logger.warn(`[STUB] Reauthorize payment=${paymentRef}`);
      return { ok: !paymentRef.includes('reauth-fail') };
    }
    const res = await this.req('POST', `/payments/${paymentRef}/reauthorize`, {});
    return { ok: res['status'] === 'authorized' };
  }

  async void(paymentRef: string): Promise<{ ok: boolean }> {
    this.assertConfiguredInProd();
    if (this.isStub) {
      this.logger.warn(`[STUB] Void payment=${paymentRef}`);
      return { ok: true };
    }
    const res = await this.req('POST', `/payments/${paymentRef}/void`, {});
    return { ok: res['status'] === 'voided' };
  }

  /**
   * Batch OPS (money.reconcile.run) — read the PSP's view of a payment so the
   * ledger can be compared against it. In stub mode there is no PSP truth to
   * fetch, so we return status:null and the reconciler counts the row as
   * SKIPPED (never as matched — a stub must not fake a clean reconciliation).
   */
  async fetchPayment(paymentRef: string): Promise<{ status: string | null; amountHalalas: number | null; raw?: Record<string, unknown> }> {
    if (this.isStub) {
      this.logger.warn(`[STUB] Fetch payment=${paymentRef} — no PSP truth in stub mode`);
      return { status: null, amountHalalas: null };
    }
    const res = await this.req('GET', `/payments/${paymentRef}`, undefined);
    return {
      status: typeof res['status'] === 'string' ? res['status'] : null,
      amountHalalas: typeof res['amount'] === 'number' ? res['amount'] : null,
      raw: res,
    };
  }

  private async req(method: string, path: string, body: unknown): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      this.logger.error(`Moyasar ${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
      throw new Error(`moyasar: ${res.status} ${JSON.stringify(json)}`);
    }
    return json;
  }
}
