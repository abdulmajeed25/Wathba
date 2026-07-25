import { NotificationKind } from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { EmailService } from '../email/email.service';

/**
 * CLOSEOUT C2 — the RFQ award fan-out, shared by BOTH award paths: the
 * creator's own award (ProcurementService.award) and the operator override
 * (the `rfq.award` op). It lives in a plain module rather than on the service
 * so the ops registry can call it without taking a dependency on
 * ProcurementService (which would close a module cycle).
 *
 * OPS-GAPS R2 notified only the WINNER; the losing bidders were left in
 * silence, with their bid appearing to sit open forever from their side. This
 * notifies both sides of the decision:
 *
 *  · winner  → RFQ_AWARDED  + the congratulatory email
 *  · others  → RFQ_DECIDED  + a neutral "a decision was made" email that names
 *              neither the winner nor the winning price (commercially
 *              confidential — a bidder must not learn a rival's bid).
 *
 * Preference/toggle gating is NOT re-implemented here: every notification goes
 * through NotificationsService.create, which already enforces the operator's
 * `notifications.disabledKinds` toggles and the per-user opt-out. Neither kind
 * is in LOCKED_NOTIFICATION_KINDS, so an operator can silence both.
 *
 * Fire-and-forget by contract: the award has already COMMITTED when this runs,
 * so a notify failure must never surface as an award failure.
 */

export interface AwardNotifyDeps {
  prisma: PrismaService;
  notifications: NotificationsService;
  email: EmailService;
}

export async function notifyAwardOutcome(
  deps: AwardNotifyDeps,
  rfqId: string,
  winningBidId: string,
): Promise<{ winner: number; others: number }> {
  const tally = { winner: 0, others: 0 };
  try {
    const [rfq, bids] = await Promise.all([
      deps.prisma.rFQ.findUnique({
        where: { id: rfqId },
        select: { project: { select: { titleAr: true } } },
      }),
      deps.prisma.supplierBid.findMany({
        where: { rfqId },
        select: { id: true, supplierId: true },
      }),
    ]);
    const projectTitleAr = rfq?.project?.titleAr ?? 'مشروع';

    const winning = bids.find((b) => b.id === winningBidId);
    const winnerId = winning?.supplierId ?? null;

    // Distinct suppliers, and NEVER tell the winner they lost — a supplier who
    // submitted several bids on one RFQ and won with one of them gets only the
    // award notice.
    const loserIds = [
      ...new Set(bids.filter((b) => b.supplierId !== winnerId).map((b) => b.supplierId)),
    ];

    if (winnerId) {
      await deps.notifications.create({
        userId: winnerId,
        kind: NotificationKind.RFQ_AWARDED,
        payload: { projectTitleAr, rfqId },
      });
      const supplier = await deps.prisma.user.findUnique({
        where: { id: winnerId },
        select: { email: true },
      });
      if (supplier?.email) {
        await deps.email.rfqAwarded(supplier.email, { projectTitle: projectTitleAr });
      }
      tally.winner = 1;
    }

    // One slow/failing recipient must not cost the others their notice, so each
    // is isolated. settled-per-recipient, not all-or-nothing.
    const results = await Promise.allSettled(
      loserIds.map(async (supplierId) => {
        await deps.notifications.create({
          userId: supplierId,
          kind: NotificationKind.RFQ_DECIDED,
          payload: { projectTitleAr, rfqId },
        });
        const supplier = await deps.prisma.user.findUnique({
          where: { id: supplierId },
          select: { email: true },
        });
        if (supplier?.email) {
          await deps.email.rfqDecided(supplier.email, { projectTitle: projectTitleAr });
        }
      }),
    );
    tally.others = results.filter((r) => r.status === 'fulfilled').length;
  } catch {
    /* best-effort — the award already committed */
  }
  return tally;
}
