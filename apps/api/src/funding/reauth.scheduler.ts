import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PledgeStatus, ProjectStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { MoyasarAdapter } from '../escrow-payments/moyasar.adapter';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { claimHeldAction } from '../escrow-payments/held-payment-action';

/** Authorization-age maintenance. Every supported renewal claims the pledge
 * before HTTP. Ambiguous responses keep the claim and never invite repayment.
 * Unsupported integration is detected before claiming; it cannot lock out a
 * legitimate cancellation or pretend that a long-lived hold was renewed. */
@Injectable()
export class ReauthScheduler {
  private readonly logger = new Logger(ReauthScheduler.name);
  /** Default only; the effective age is the `funding.reauthAfterDays` setting. */
  static readonly REAUTH_AFTER_MS = Number(process.env.REAUTH_AFTER_DAYS ?? 6) * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly moyasar: MoyasarAdapter,
    _notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'pledge-reauth-tick' })
  async tick(): Promise<void> {
    try {
      const { reauthorized, parked } = await this.run();
      if (reauthorized > 0 || parked > 0) {
        this.logger.log(`reauth tick: reauthorized=${reauthorized} parked=${parked}`);
      }
    } catch (err) {
      this.logger.error('reauth tick failed', err as Error);
    }
  }

  async run(now = new Date()): Promise<{ reauthorized: number; parked: number }> {
    // OPS-GAPS Y2 — re-authorization age is a governed setting (default ~6 days).
    const reauthMs = (await this.settings.get('funding.reauthAfterDays')) * 24 * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - reauthMs);
    const stale = await this.prisma.pledge.findMany({
      where: {
        status: PledgeStatus.HELD,
        authorizationIssue: null,
        project: { status: { in: [ProjectStatus.LIVE, ProjectStatus.PAUSED] } },
        OR: [
          { reauthorizedAt: { lte: cutoff } },
          { reauthorizedAt: null, createdAt: { lte: cutoff } },
        ],
      },
      include: { project: { select: { id: true, titleAr: true } } },
      take: 200,
    });

    let reauthorized = 0;
    let parked = 0;
    for (const p of stale) {
      try { this.moyasar.assertReauthorizationAvailable(); }
      catch { parked++; this.logger.warn('Reauthorization integration unavailable; no request sent'); continue; }
      const key = await this.prisma.$transaction(tx => claimHeldAction(tx, p, 'REAUTHORIZE'));
      if (!key) continue;
      try {
        const { ok } = await this.moyasar.reauthorize(p.paymentRef);
        if (ok) {
          const updated = await this.prisma.pledge.updateMany({
            where: { id: p.id, status: PledgeStatus.HELD, paymentRef: p.paymentRef, authorizationIssue: key },
            data: { reauthorizedAt: now, authorizationIssue: null },
          });
          if (updated.count === 1) reauthorized++;
          continue;
        }
      } catch {
        /* fall through to park */
      }
      parked++;
      // Failure/timeout is not proof of expiry; preserve the attempt and
      // current status. Another scheduler or settlement cannot reuse it.
      this.logger.warn(`pledge=${p.id} re-authorization requires verification`);
    }
    return { reauthorized, parked };
  }
}
