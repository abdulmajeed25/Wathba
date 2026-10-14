import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationKind, PledgeStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { EscrowService } from '../escrow-payments/escrow.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MoyasarAdapter } from '../escrow-payments/moyasar.adapter';
import { AuditService } from '../identity/audit.service';

/**
 * Batch PAY (Part 2) — the configured failed-capture grace window.
 *
 * Every 30 minutes:
 *  1. RETRY — CARD pledges in CAPTURE_GRACE get automatic capture retries at
 *     +6h / +24h / +48h from graceStartedAt (attempt counter drives which
 *     mark is next). BNPL rows get REMINDER notifications at the same marks
 *     (no auto-retry is possible — the backer must complete the hosted
 *     checkout themselves).
 *  2. EXPIRE — past graceExpiresAt, matched uncharged provider evidence is required:
 *     excluded from REALIZED (it never entered it), the tier claim returns
 *     to stock, and both the backer and the creator are notified.
 *
 * All arithmetic in BigInt halalas; every transition idempotent via status
 * guards in the WHERE clauses.
 */
@Injectable()
export class GraceScheduler {
  private readonly logger = new Logger(GraceScheduler.name);
  /** Retry marks (ms after graceStartedAt), indexed by attempts-so-far. */
  private static readonly RETRY_MARKS_MS = [6, 24, 48].map((h) => h * 60 * 60 * 1000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly escrow: EscrowService,
    _moyasar: MoyasarAdapter,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'capture-grace-tick' })
  async tick(): Promise<void> {
    try {
      const { retried, expired } = await this.run();
      if (retried > 0 || expired > 0) {
        this.logger.log(`grace tick: retried=${retried} expired=${expired}`);
      }
    } catch (err) {
      this.logger.error('grace tick failed', err as Error);
    }
  }

  /** Extracted for tests + manual admin trigger. */
  async run(now = new Date()): Promise<{ retried: number; expired: number }> {
    let retried = 0;
    let expired = 0;

    // 1) Retries / reminders for rows still inside the window.
    const inGrace = await this.prisma.pledge.findMany({
      where: { status: PledgeStatus.CAPTURE_GRACE, authorizationIssue: null, graceExpiresAt: { gt: now } },
      include: {
        backer: { select: { id: true, email: true } },
        project: { select: { id: true, titleAr: true } },
      },
    });
    for (const p of inGrace) {
      const started = p.graceStartedAt?.getTime() ?? p.createdAt.getTime();
      // captureAttempts=1 means the settlement attempt happened; automatic
      // marks consume indexes 0..2 (+6h/+24h/+48h) via attempts 1→2→3→4.
      const markIdx = Math.min(Math.max(0, p.captureAttempts - 1), GraceScheduler.RETRY_MARKS_MS.length - 1);
      const nextDue = started + GraceScheduler.RETRY_MARKS_MS[markIdx]!;
      if (now.getTime() < nextDue || p.captureAttempts > GraceScheduler.RETRY_MARKS_MS.length) continue;

      if (p.paymentMethod === 'CARD') {
        retried++;
        try {
          if (await this.escrow.captureGracePledge(p)) {
            this.logger.log(`grace retry captured pledge=${p.id}`);
            // MONEY-AUDIT — a grace-retry recovered this capture. markCaptured
            // is the idempotent chokepoint that flips CAPTURE_GRACE→CAPTURED,
            // so this pledge leaves the CAPTURE_GRACE query on the next tick —
            // the row is audited once. Never throws.
            await this.audit.log({
              actorId: null,
              action: 'system.capture.recovered',
              entity: 'Pledge',
              entityId: p.id,
              detail: {
                projectId: p.project.id,
                pspRef: p.paymentRef,
                amountHalalas: (p.amountHalalas + p.addOnsHalalas).toString(),
                captureAttempts: p.captureAttempts,
              },
            });
            continue;
          }
        } catch {
          /* the shared service retains any durable financial claim */
        }
      } else {
        // BNPL — reminder only; the checkout is the backer's move.
        await this.prisma.pledge.update({
          where: { id: p.id },
          data: { captureAttempts: { increment: 1 } },
        });
        await this.notifications
          .create({
            userId: p.backer.id,
            kind: NotificationKind.CAPTURE_GRACE,
            payload: {
              projectId: p.project.id,
              projectTitleAr: p.project.titleAr,
              pledgeId: p.id,
              amountHalalas: Number(p.amountHalalas + p.addOnsHalalas),
              method: p.paymentMethod,
              reminder: true,
              graceExpiresAt: p.graceExpiresAt?.toISOString() ?? null,
            },
          })
          .catch(() => null);
      }
    }

    // 2) Verified expiry only; unknown results retain stock and grace state.
    const dead = await this.prisma.pledge.findMany({
      where: { status: PledgeStatus.CAPTURE_GRACE, authorizationIssue: null, graceExpiresAt: { lte: now } },
      include: {
        backer: { select: { id: true, email: true } },
        project: { select: { id: true, titleAr: true, createdById: true } },
      },
    });
    for (const p of dead) {
      // No deadline-only expiry: verify the payment before releasing inventory.
      let claimed = false;
      try { claimed = await this.escrow.expireGracePledge(p, now); }
      catch { this.logger.warn(`Grace expiry requires reconciliation pledge=${p.id}`); }
      if (!claimed) continue;
      expired++;
      // MONEY-AUDIT — grace expired: terminal CAPTURE_GRACE→FAILED_CAPTURE.
      // Guarded by the status-scoped updateMany claim above (claimed===false
      // → continue), so a re-run of an already-expired pledge writes nothing.
      // Never throws.
      await this.audit.log({
        actorId: null,
        action: 'system.capture.failed',
        entity: 'Pledge',
        entityId: p.id,
        detail: {
          projectId: p.project.id,
          pspRef: p.paymentRef,
          amountHalalas: (p.amountHalalas + p.addOnsHalalas).toString(),
          paymentMethod: p.paymentMethod,
          reason: 'grace_expired',
        },
      });
      try {
        await this.email.captureFailed(p.backer.email, {
          projectTitle: p.project.titleAr,
          amountHalalas: Number(p.amountHalalas + p.addOnsHalalas),
        });
      } catch {
        /* best-effort */
      }
      await this.notifications
        .create({
          userId: p.project.createdById,
          kind: NotificationKind.PLEDGE_CANCELLED,
          payload: {
            projectId: p.project.id,
            projectTitleAr: p.project.titleAr,
            amountHalalas: Number(p.amountHalalas + p.addOnsHalalas),
            reason: 'failed_capture',
          },
        })
        .catch(() => null);
      this.logger.warn(`pledge=${p.id} FAILED_CAPTURE after grace expiry`);
    }

    return { retried, expired };
  }
}
