import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationKind, PledgeStatus, ProjectStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { MoyasarAdapter } from '../escrow-payments/moyasar.adapter';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Batch PAY (Part 5) — authorization-age maintenance for long campaigns.
 *
 * Card authorization holds expire in days-to-weeks depending on the issuer
 * (documented assumption: ~7 days for mada/Visa/MC via Moyasar — we
 * re-authorize at day 6). Daily sweep:
 *   HELD pledge on a LIVE/PAUSED project, auth older than REAUTH_AFTER_MS
 *   (from reauthorizedAt ?? createdAt) → re-authorize.
 *   Success → stamp reauthorizedAt. Failure → PENDING_REAUTH (non-terminal;
 *   excluded from realized until the backer refreshes their card via the
 *   same grace UX; it still counts toward PLEDGED and is re-attempted at
 *   settlement like a HELD pledge).
 *
 * LONG_DURATION — durations beyond 120 days are BLOCKED IN CODE pending
 * legal counsel + a capture-model decision (owner task): a year-long
 * campaign cannot ride authorize-then-capture at all.
 */
@Injectable()
export class ReauthScheduler {
  private readonly logger = new Logger(ReauthScheduler.name);
  static readonly REAUTH_AFTER_MS = Number(process.env.REAUTH_AFTER_DAYS ?? 6) * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly moyasar: MoyasarAdapter,
    private readonly notifications: NotificationsService,
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
    const cutoff = new Date(now.getTime() - ReauthScheduler.REAUTH_AFTER_MS);
    const stale = await this.prisma.pledge.findMany({
      where: {
        status: PledgeStatus.HELD,
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
      try {
        const { ok } = await this.moyasar.reauthorize(p.paymentRef);
        if (ok) {
          await this.prisma.pledge.update({
            where: { id: p.id },
            data: { reauthorizedAt: now },
          });
          reauthorized++;
          continue;
        }
      } catch {
        /* fall through to park */
      }
      parked++;
      await this.prisma.pledge.updateMany({
        where: { id: p.id, status: PledgeStatus.HELD },
        data: { status: PledgeStatus.PENDING_REAUTH },
      });
      await this.notifications
        .create({
          userId: p.backerId,
          kind: NotificationKind.CAPTURE_GRACE,
          payload: {
            projectId: p.project.id,
            projectTitleAr: p.project.titleAr,
            pledgeId: p.id,
            amountHalalas: Number(p.amountHalalas + p.addOnsHalalas),
            method: p.paymentMethod,
            reauth: true,
          },
        })
        .catch(() => null);
      this.logger.warn(`pledge=${p.id} parked PENDING_REAUTH (re-authorization failed)`);
    }
    return { reauthorized, parked };
  }
}
