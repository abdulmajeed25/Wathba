import { BadRequestException, Injectable, Logger } from '@nestjs/common';

/**
 * STAKES/S-14 (P3) — Cloudflare Turnstile slot, env-flagged:
 *  - TURNSTILE_SECRET_KEY unset (dev/e2e/default) → assertHuman is a no-op.
 *  - set → the signup + pledge endpoints require a valid captchaToken.
 * Fails CLOSED when the key is set (a missing/invalid token 400s) and
 * fails OPEN on Cloudflare outages (never brick signups over a 3rd party).
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly secret = process.env.TURNSTILE_SECRET_KEY ?? '';

  get enabled(): boolean {
    return this.secret.length > 0;
  }

  async assertHuman(token: string | undefined, context: string): Promise<void> {
    if (!this.enabled) return;
    if (!token) {
      throw new BadRequestException('التحقق من أنك لست روبوتاً مطلوب — حدّث الصفحة وحاول مجدداً');
    }
    try {
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret: this.secret, response: token }),
      });
      const body = (await res.json()) as { success?: boolean };
      if (!body.success) {
        throw new BadRequestException('فشل التحقق — حدّث الصفحة وحاول مجدداً');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      // Cloudflare unreachable — log and let the request through.
      this.logger.warn(`turnstile verify unreachable (${context}): ${String(err)}`);
    }
  }
}
