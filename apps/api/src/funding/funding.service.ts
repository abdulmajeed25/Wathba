import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CaptchaService } from '../common/captcha.service';
import { PrismaService } from '../prisma/prisma.service';
import { EscrowService } from '../escrow-payments/escrow.service';
import { LedgerService } from '../escrow-payments/ledger.service';
import { ContractsService } from '../contracts/contracts.service';
import { AuditService } from '../identity/audit.service';
import { FundingGateway } from './funding.gateway';
import { CommunityService } from '../community/community.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma, PledgeStatus, ProjectStatus, type Pledge } from '@prisma/client';
import { CreatePledgeDto } from './dto/pledge.dto';

/**
 * Funding bounded context — §5 FSM, exactly:
 *
 *   At deadline:
 *     if raised ≥ goal × releaseThresholdPct / 100  →  SUCCESSFUL  →  Capture  →  FUNDED
 *     else                                          →  FAILED      →  Void/Refund → REFUNDED
 *
 * All money BigInt halalas. Pledges are HELD (authorize only) while LIVE.
 * raisedHalalas + backersCount + tier.claimedQty + user.totalPledgedHalalas
 * are denormalized counters maintained in the same transaction as the
 * pledge insert.
 */
@Injectable()
export class FundingService {
  private readonly logger = new Logger(FundingService.name);
  /** CC-14 — cumulative pause cap per campaign (policy §5 amendment: 7 days). */
  private static readonly PAUSE_CAP_MS = 7 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly escrow: EscrowService,
    private readonly contracts: ContractsService,
    private readonly gateway: FundingGateway,
    private readonly community: CommunityService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
      private readonly captcha: CaptchaService,
  ) {}

  /**
   * STAKES/S-3 (F2/F4) — best-effort backer comms. Fire-and-forget: a mail or
   * notification failure must never fail (or roll back) the money action.
   */
  private async notifyPledgeReceipt(
    backer: { id: string; email: string },
    project: { id: string; titleAr: string },
    amountHalalas: number,
    tierTitle: string | null,
  ): Promise<void> {
    try {
      await this.notifications.create({
        userId: backer.id,
        kind: 'PLEDGE_RECEIVED',
        payload: {
          projectId: project.id,
          title: `تأكيد تعهّدك لمشروع «${project.titleAr}»`,
          body: `سجّلنا تعهّدك بمبلغ ${(amountHalalas / 100).toFixed(0)} ر.س.`,
        },
      });
      await this.email.pledgeReceipt(backer.email, {
        projectTitle: project.titleAr,
        amountHalalas,
        tierTitle,
      });
    } catch (e) {
      this.logger.error(`pledge-receipt comms failed for backer=${backer.id}`, e as Error);
    }
  }

  /** STAKES/S-3 — notify every backer of a settled project (funded/failed). */
  private async notifyBackersOfOutcome(
    project: { id: string; titleAr: string },
    funded: boolean,
  ): Promise<void> {
    try {
      const pledges = await this.prisma.pledge.findMany({
        where: {
          projectId: project.id,
          status: { in: [PledgeStatus.CAPTURED, PledgeStatus.REFUNDED, PledgeStatus.HELD] },
        },
        select: { amountHalalas: true, addOnsHalalas: true, backer: { select: { id: true, email: true } } },
      });
      // One message per backer, summing their total on the project.
      const byBacker = new Map<string, { email: string; total: number }>();
      for (const p of pledges) {
        const cur = byBacker.get(p.backer.id) ?? { email: p.backer.email, total: 0 };
        cur.total += Number(p.amountHalalas) + Number(p.addOnsHalalas ?? 0n);
        byBacker.set(p.backer.id, cur);
      }
      // STAKES/E2 — the in-app outcome notification always lands (charge/refund
      // state is transactional); the EMAIL honors the campaignOutcomes pref.
      const emailAllowed = new Set(
        await this.notifications.filterAllowed([...byBacker.keys()], 'campaignOutcomes'),
      );
      for (const [backerId, { email, total }] of byBacker) {
        await this.notifications.create({
          userId: backerId,
          kind: funded ? 'PROJECT_FUNDED' : 'PROJECT_FAILED',
          payload: {
            projectId: project.id,
            title: funded ? `نجحت حملة «${project.titleAr}» 🎉` : `لم تكتمل حملة «${project.titleAr}»`,
            body: funded
              ? 'تم تحصيل تعهّدك وينتقل المشروع للتنفيذ.'
              : 'لم تبلغ الحملة هدفها — جارٍ ردّ مبلغك تلقائياً.',
          },
        });
        if (!emailAllowed.has(backerId)) continue;
        if (funded) await this.email.projectFunded(email, { projectTitle: project.titleAr, amountHalalas: total });
        else await this.email.projectFailed(email, { projectTitle: project.titleAr, amountHalalas: total });
      }
    } catch (e) {
      this.logger.error(`outcome comms failed for project=${project.id}`, e as Error);
    }
  }

  async pledge(backerId: string, dto: CreatePledgeDto): Promise<Pledge> {
    // STAKES/S-14 P3 — env-flagged bot gate (no-op until the key is set).
    await this.captcha.assertHuman(dto.captchaToken, 'pledge');
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('project not found');
    if (project.status !== ProjectStatus.LIVE) {
      throw new BadRequestException(`project is not LIVE (was ${project.status})`);
    }
    if (project.deadline.getTime() <= Date.now()) {
      throw new BadRequestException('project has reached its deadline');
    }

    // STAKES/S-3/A6 — pledging requires a Nafath-verified account (mirror of the
    // creator-submission gate). The email is reused for the pledge receipt.
    const backer = await this.prisma.user.findUnique({
      where: { id: backerId },
      select: { id: true, email: true, nafathVerified: true },
    });
    if (!backer) throw new NotFoundException('user not found');
    if (!backer.nafathVerified) {
      throw new ForbiddenException('يجب توثيق حسابك عبر نفاذ (KYC) قبل دعم المشاريع');
    }

    const tier = await this.prisma.rewardTier.findUnique({ where: { id: dto.tierId } });
    if (!tier || tier.projectId !== dto.projectId) {
      throw new BadRequestException('invalid tier for this project');
    }
    // CC-13 — a closed tier accepts no new pledges.
    if (!tier.isActive) {
      throw new BadRequestException('this reward tier is closed');
    }
    // CC-13 — while early-bird is active (before its deadline + stock remains),
    // the effective minimum pledge drops to the early-bird price.
    const earlyBirdActive =
      tier.earlyBirdAmountHalalas !== null &&
      tier.earlyBirdUntil !== null &&
      tier.earlyBirdUntil.getTime() > Date.now() &&
      (tier.limitQty === null || tier.claimedQty < tier.limitQty);
    const minHalalas = earlyBirdActive ? tier.earlyBirdAmountHalalas! : tier.amountHalalas;
    if (Number(minHalalas) > dto.amountHalalas) {
      throw new BadRequestException(
        `amount ${dto.amountHalalas} is below the tier minimum ${Number(minHalalas)}`,
      );
    }
    if (tier.limitQty !== null && tier.claimedQty >= tier.limitQty) {
      throw new BadRequestException('tier is sold out');
    }
    if (tier.requiresShipping && !dto.shipping) {
      throw new BadRequestException('shipping address is required for this tier');
    }

    // Validate + price-resolve any add-ons. Sold-out add-ons reject the
    // pledge before we authorize anything against the PSP.
    const addOnRequests = dto.addOns ?? [];
    let addOnsSubtotal = 0n;
    const resolvedAddOns: Array<{ addOnId: string; qty: number; amountHalalas: bigint }> = [];
    if (addOnRequests.length > 0) {
      const fetched = await this.prisma.addOn.findMany({
        where: { id: { in: addOnRequests.map((a) => a.addOnId) } },
      });
      const byId = new Map(fetched.map((a) => [a.id, a]));
      for (const req of addOnRequests) {
        const a = byId.get(req.addOnId);
        if (!a || a.projectId !== dto.projectId) {
          throw new BadRequestException(`add-on ${req.addOnId} is not on this project`);
        }
        const qty = req.qty ?? 1;
        if (a.limitQty !== null && a.claimedQty + qty > a.limitQty) {
          throw new BadRequestException(`add-on "${a.titleAr}" is sold out`);
        }
        const subtotal = a.amountHalalas * BigInt(qty);
        addOnsSubtotal += subtotal;
        resolvedAddOns.push({ addOnId: a.id, qty, amountHalalas: subtotal });
      }
    }

    const contractType =
      dto.contractType ??
      this.contracts.inferType({ includesPhysicalProduct: tier.includesPhysicalProduct });

    // 1) Insert the pledge in HELD state, paymentRef='pending'. backerNo is
    //    NOT NULL (since migration 0002), so we assign it here from the current
    //    max for this project. The @@unique([projectId, backerNo]) constraint
    //    is the safety net against the rare two-concurrent-inserts race —
    //    second insert throws, caller can retry. Acceptable for v1 traffic.
    const lastBackerNo = await this.prisma.pledge.aggregate({
      where: { projectId: dto.projectId },
      _max: { backerNo: true },
    });
    const assignedBackerNo = (lastBackerNo._max.backerNo ?? 0) + 1;

    const pledge = await this.prisma.pledge.create({
      data: {
        backerId,
        projectId: dto.projectId,
        tierId: dto.tierId,
        amountHalalas: BigInt(dto.amountHalalas),
        addOnsHalalas: addOnsSubtotal,
        contractType,
        shipping: dto.shipping
          ? (dto.shipping as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        status: PledgeStatus.HELD,
        backerNo: assignedBackerNo,
        paymentRef: `pending-${Date.now()}-${backerId.slice(0, 8)}`,
        addOns: resolvedAddOns.length > 0
          ? { create: resolvedAddOns.map((r) => ({
              addOnId: r.addOnId,
              qty: r.qty,
              amountHalalas: r.amountHalalas,
            })) }
          : undefined,
      },
    });

    // 2) Authorize-only hold against the PSP (outside the DB tx — if it
    //    fails we mark the pledge FAILED and skip counter increments).
    //    Sprint 2: the hold MUST cover tier + add-ons — before this fix the
    //    PSP authorized only the tier amount while raisedHalalas credited
    //    the full contribution (systematic undercharge, surfaced by the
    //    Sprint-1 ledger).
    const chargeHalalas = pledge.amountHalalas + addOnsSubtotal;
    let payment: { paymentRef: string; status: 'authorized' | 'failed' };
    try {
      payment = await this.escrow.hold({
        pledgeId: pledge.id,
        amountHalalas: chargeHalalas,
        source: dto.source,
        description: `وثبة — دعم لمشروع ${project.titleAr}`,
        // 3DS hop returns the shopper's browser to the payment-return screen.
        callbackUrl: `${process.env.WEB_BASE_URL ?? 'http://localhost:3000'}/projects/${dto.projectId}/back/success`,
      });
    } catch (err) {
      this.logger.error(`hold failed for pledge=${pledge.id}`, err as Error);
      await this.prisma.pledge.update({
        where: { id: pledge.id },
        data: { status: PledgeStatus.FAILED, paymentRef: `failed-${pledge.id}` },
      });
      throw new BadRequestException('payment authorization failed');
    }

    if (payment.status === 'authorized') {
      await this.ledger.record({
        entryType: 'HOLD_AUTHORIZED',
        amountHalalas: chargeHalalas,
        pspRef: payment.paymentRef,
        pledgeId: pledge.id,
        projectId: dto.projectId,
      });
    }

    if (payment.status !== 'authorized') {
      await this.prisma.pledge.update({
        where: { id: pledge.id },
        data: { status: PledgeStatus.FAILED, paymentRef: payment.paymentRef },
      });
      throw new BadRequestException('payment was not authorized');
    }

    // 3) Commit paymentRef + bump counters atomically. backerNo was assigned
    //    at insert time (step 1); this tx only finalises the paymentRef + the
    //    funded counters.
    const totalContribution = pledge.amountHalalas + addOnsSubtotal;
    const { updated, totals } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.pledge.update({
        where: { id: pledge.id },
        data: { paymentRef: payment.paymentRef },
      });
      const proj = await tx.project.update({
        where: { id: dto.projectId },
        data: {
          raisedHalalas: { increment: totalContribution },
          backersCount: { increment: 1 },
        },
        select: { raisedHalalas: true, backersCount: true },
      });
      await tx.rewardTier.update({
        where: { id: dto.tierId },
        data: { claimedQty: { increment: 1 } },
      });
      for (const r of resolvedAddOns) {
        await tx.addOn.update({
          where: { id: r.addOnId },
          data: { claimedQty: { increment: r.qty } },
        });
      }
      await tx.user.update({
        where: { id: backerId },
        data: { totalPledgedHalalas: { increment: totalContribution } },
      });
      return { updated, totals: proj };
    });

    this.gateway.emitTick({
      projectId: dto.projectId,
      raisedHalalas: totals.raisedHalalas.toString(),
      backersCount: totals.backersCount,
      at: Date.now(),
    });

    // Slice 3 — Update community aggregates (top cities/countries +
    // NEW/RETURNING/TOTAL) AFTER the pledge tx commits. Failure here must
    // never roll back the pledge — log and move on.
    this.community
      .materializeFromPledge(updated.id)
      .catch((err) => this.logger.warn(`community.materialize failed: ${err}`));

    // STAKES/S-3 (F2/F4) — pledge-receipt notification + email (best-effort).
    await this.notifyPledgeReceipt(
      backer,
      project,
      Number(totalContribution),
      tier.titleAr,
    );

    return updated;
  }

  async listMine(
    backerId: string,
    opts: { take?: number; cursor?: string } = {},
  ): Promise<{ items: Pledge[]; nextCursor: string | null }> {
    const take = Math.min(50, Math.max(1, opts.take ?? 20));
    const items = await this.prisma.pledge.findMany({
      where: { backerId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(opts.cursor && { cursor: { id: opts.cursor }, skip: 1 }),
    });
    const nextCursor = items.length > take ? items[take]!.id : null;
    return { items: items.slice(0, take), nextCursor };
  }

  toPublic(p: Pledge): Record<string, unknown> {
    return {
      id: p.id,
      backerId: p.backerId,
      projectId: p.projectId,
      tierId: p.tierId,
      amountHalalas: Number(p.amountHalalas),
      addOnsHalalas: Number(p.addOnsHalalas),
      backerNo: p.backerNo,
      status: p.status,
      shipping: p.shipping,
      contractType: p.contractType,
      paymentRef: p.paymentRef,
      createdAt: p.createdAt.toISOString(),
      capturedAt: p.capturedAt?.toISOString() ?? null,
      refundedAt: p.refundedAt?.toISOString() ?? null,
    };
  }

  // -- FSM at deadline --------------------------------------------------------

  /**
   * Settle a single project: if past deadline & still LIVE, apply the §5
   * rule. Idempotent.
   */
  async settleProject(projectId: string): Promise<{
    projectId: string;
    transition: 'noop' | 'funded' | 'refunded';
  }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('project not found');
    // CC-14 — a PAUSED campaign still settles at its deadline: the clock keeps
    // running while paused (policy §5), pausing only freezes new pledges.
    if (project.status !== ProjectStatus.LIVE && project.status !== ProjectStatus.PAUSED) {
      return { projectId, transition: 'noop' };
    }
    if (project.deadline.getTime() > Date.now()) return { projectId, transition: 'noop' };

    const goal = project.fundingGoalHalalas;
    const threshold = (goal * BigInt(project.releaseThresholdPct)) / BigInt(100);
    const successful = project.raisedHalalas >= threshold;

    this.logger.log(
      `Settling project=${projectId} raised=${project.raisedHalalas} threshold=${threshold} successful=${successful}`,
    );

    // Sprint 1 / P1-306: atomic claim — only the updateMany that still sees
    // LIVE wins; a concurrent settler (double cron / manual trigger) no-ops.
    const claimed = await this.prisma.project.updateMany({
      where: { id: projectId, status: { in: [ProjectStatus.LIVE, ProjectStatus.PAUSED] } },
      data: { status: successful ? ProjectStatus.SUCCESSFUL : ProjectStatus.FAILED },
    });
    if (claimed.count === 0) return { projectId, transition: 'noop' };

    if (successful) {
      await this.escrow.captureAllHeld(projectId);
      // Straggler pass: pledges that passed the LIVE check before our claim
      // but committed after the first capture query are still HELD — sweep
      // them once more before declaring FUNDED.
      const straggler = await this.escrow.captureAllHeld(projectId);
      const residue = await this.countHeld(projectId);
      if (straggler.failed > 0 || residue > 0) {
        this.logger.error(
          `SETTLEMENT ALERT project=${projectId}: ${residue} pledge(s) still HELD after capture ` +
            `(authorization holds expire ~7 days — retry via POST /v1/admin/projects/${projectId}/settle)`,
        );
      }
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.FUNDED },
      });
      // STAKES/S-3 (F2/F4) — tell backers the campaign succeeded + they were charged.
      await this.notifyBackersOfOutcome(project, true);
      return { projectId, transition: 'funded' };
    }

    await this.escrow.refundAllHeld(projectId);
    const straggler = await this.escrow.refundAllHeld(projectId);
    const residue = await this.countHeld(projectId);
    if (straggler.failed > 0 || residue > 0) {
      this.logger.error(
        `SETTLEMENT ALERT project=${projectId}: ${residue} pledge(s) still HELD after refund — ` +
          `retry via POST /v1/admin/projects/${projectId}/settle`,
      );
    }
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.REFUNDED },
    });
    // STAKES/S-3 (F2/F4) — tell backers the campaign failed + refunds are underway.
    await this.notifyBackersOfOutcome(project, false);
    return { projectId, transition: 'refunded' };
  }

  private async countHeld(projectId: string): Promise<number> {
    return this.prisma.pledge.count({
      where: { projectId, status: PledgeStatus.HELD },
    });
  }

  /**
   * Sprint 1 / P0-303: manual re-settlement for a project stuck with HELD
   * pledges after its terminal transition (PSP outage mid-settle). Runs the
   * matching capture/refund sweep for the project's terminal state.
   */
  async resettleResidue(projectId: string): Promise<{
    projectId: string;
    swept: { ok: number; failed: number };
  }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('project not found');
    if (project.status === ProjectStatus.FUNDED || project.status === ProjectStatus.SUCCESSFUL) {
      const r = await this.escrow.captureAllHeld(projectId);
      return { projectId, swept: { ok: r.captured, failed: r.failed } };
    }
    if (project.status === ProjectStatus.REFUNDED || project.status === ProjectStatus.FAILED) {
      const r = await this.escrow.refundAllHeld(projectId);
      return { projectId, swept: { ok: r.refunded, failed: r.failed } };
    }
    throw new BadRequestException(
      `project is ${project.status} — residue sweep only applies after settlement`,
    );
  }

  /**
   * Creator-initiated cancellation (Sprint 3 / P1-209) — refund policy §5:
   *   DRAFT        → hard delete (nothing public, no money).
   *   UNDER_REVIEW → withdraw back to DRAFT.
   *   LIVE         → atomic claim to FAILED, void every HELD hold, → REFUNDED.
   * Anything post-settlement cannot be cancelled by the creator.
   */
  async cancelCampaign(
    creatorId: string,
    projectId: string,
  ): Promise<{ projectId: string; outcome: 'deleted' | 'withdrawn' | 'refunded' }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('project not found');
    if (project.createdById !== creatorId) {
      throw new ForbiddenException('not your project');
    }

    if (project.status === ProjectStatus.DRAFT) {
      // CC-06: audit the creator's delete decision BEFORE the row disappears.
      await this.audit.log({
        actorId: creatorId,
        action: 'creator.project.delete-draft',
        entity: 'Project',
        entityId: projectId,
        detail: { projectId, outcome: 'deleted', titleAr: project.titleAr },
      });
      await this.prisma.project.delete({ where: { id: projectId } });
      return { projectId, outcome: 'deleted' };
    }

    if (
      project.status === ProjectStatus.UNDER_REVIEW ||
      project.status === ProjectStatus.SCHEDULED
    ) {
      // CC-20 — a SCHEDULED (approved, not-yet-live) project withdraws to DRAFT
      // exactly like an under-review one; no money has moved.
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.DRAFT, scheduledLaunchAt: null },
      });
      await this.audit.log({
        actorId: creatorId,
        action: 'creator.project.cancel',
        entity: 'Project',
        entityId: projectId,
        detail: { projectId, outcome: 'withdrawn', from: project.status },
      });
      return { projectId, outcome: 'withdrawn' };
    }

    if (project.status === ProjectStatus.LIVE || project.status === ProjectStatus.PAUSED) {
      // Same atomic-claim discipline as settlement (P1-306) — a concurrent
      // deadline settle and a cancel can't both win. A PAUSED campaign is
      // cancellable exactly like a LIVE one (CC-14).
      const claimed = await this.prisma.project.updateMany({
        where: { id: projectId, status: { in: [ProjectStatus.LIVE, ProjectStatus.PAUSED] } },
        data: { status: ProjectStatus.FAILED },
      });
      if (claimed.count === 0) {
        throw new BadRequestException('project is being settled — cancellation unavailable');
      }

      // CC-06 — two distinct actor types (CREATOR-NO-MONEY invariant):
      // (1) the creator DECIDED to cancel; (2) the SYSTEM executed the refunds
      // as an automatic consequence. Correlate them so the audit view can show
      // "your cancel → N system refunds".
      const correlationId = randomUUID();
      await this.audit.log({
        actorId: creatorId,
        action: 'creator.project.cancel',
        entity: 'Project',
        entityId: projectId,
        detail: {
          projectId,
          outcome: 'refunded',
          correlationId,
          backersCount: project.backersCount,
          raisedHalalas: project.raisedHalalas.toString(),
        },
      });

      const first = await this.escrow.refundAllHeld(projectId);
      const straggler = await this.escrow.refundAllHeld(projectId);
      const refundedCount = first.refunded + straggler.refunded;
      const residue = await this.countHeld(projectId);
      if (straggler.failed > 0 || residue > 0) {
        this.logger.error(
          `CANCEL ALERT project=${projectId}: ${residue} pledge(s) still HELD after cancel-refund — ` +
            `retry via POST /v1/admin/projects/${projectId}/settle`,
        );
      }
      await this.prisma.project.update({
        where: { id: projectId },
        data: { status: ProjectStatus.REFUNDED },
      });
      // System-executed refunds — actorId null = النظام in the audit view.
      await this.audit.log({
        actorId: null,
        action: 'system.refund.cancel',
        entity: 'Project',
        entityId: projectId,
        detail: { projectId, correlationId, refundedCount, residueHeld: residue },
      });
      this.logger.log(`Creator cancelled LIVE project=${projectId} — all holds voided`);
      return { projectId, outcome: 'refunded' };
    }

    throw new BadRequestException(
      `cannot cancel a ${project.status} campaign — funds already settled`,
    );
  }

  /**
   * CC-14 — pause a LIVE campaign. Freezes NEW pledges (the pledge guard
   * rejects any non-LIVE status) WITHOUT extending the deadline: the funding
   * clock keeps running while paused (policy §5). Cumulative paused time is
   * capped at 7 days per campaign. The creator holds no money control here.
   */
  async pauseCampaign(
    creatorId: string,
    projectId: string,
  ): Promise<{ projectId: string; pausedMsAccrued: number; capMs: number }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('project not found');
    if (project.createdById !== creatorId) throw new ForbiddenException('not your project');
    if (project.status !== ProjectStatus.LIVE) {
      throw new BadRequestException(`only a LIVE campaign can be paused (was ${project.status})`);
    }
    if (project.deadline.getTime() <= Date.now()) {
      throw new BadRequestException('the campaign has reached its deadline — pausing is unavailable');
    }
    if (project.pausedMsAccrued >= BigInt(FundingService.PAUSE_CAP_MS)) {
      throw new BadRequestException('pause limit reached (7 days cumulative per campaign)');
    }
    // Atomic claim: a concurrent settle (LIVE→FAILED) must not be overwritten.
    const claimed = await this.prisma.project.updateMany({
      where: { id: projectId, status: ProjectStatus.LIVE },
      data: { status: ProjectStatus.PAUSED, pausedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('campaign is no longer LIVE — pause unavailable');
    }
    await this.audit.log({
      actorId: creatorId,
      action: 'creator.project.pause',
      entity: 'Project',
      entityId: projectId,
      detail: { projectId, pausedMsAccrued: project.pausedMsAccrued.toString() },
    });
    return {
      projectId,
      pausedMsAccrued: Number(project.pausedMsAccrued),
      capMs: FundingService.PAUSE_CAP_MS,
    };
  }

  /**
   * CC-14 — resume a PAUSED campaign back to LIVE, accruing the elapsed paused
   * time toward the 7-day cap. If the deadline passed while paused, the next
   * settlement tick settles it (the clock never stopped).
   */
  async unpauseCampaign(
    creatorId: string,
    projectId: string,
  ): Promise<{ projectId: string; pausedMsAccrued: number }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('project not found');
    if (project.createdById !== creatorId) throw new ForbiddenException('not your project');
    if (project.status !== ProjectStatus.PAUSED) {
      throw new BadRequestException(`only a PAUSED campaign can be resumed (was ${project.status})`);
    }
    const pausedFor = project.pausedAt
      ? BigInt(Math.max(0, Date.now() - project.pausedAt.getTime()))
      : 0n;
    const accrued = project.pausedMsAccrued + pausedFor;
    const claimed = await this.prisma.project.updateMany({
      where: { id: projectId, status: ProjectStatus.PAUSED },
      data: { status: ProjectStatus.LIVE, pausedAt: null, pausedMsAccrued: accrued },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('campaign is no longer PAUSED — resume unavailable');
    }
    await this.audit.log({
      actorId: creatorId,
      action: 'creator.project.unpause',
      entity: 'Project',
      entityId: projectId,
      detail: { projectId, pausedMsAccrued: accrued.toString() },
    });
    return { projectId, pausedMsAccrued: Number(accrued) };
  }

  /** Settle every project whose deadline has passed (called by deadline cron). */
  async settleDueProjects(): Promise<{ scanned: number; settled: number }> {
    const due = await this.prisma.project.findMany({
      where: {
        status: { in: [ProjectStatus.LIVE, ProjectStatus.PAUSED] },
        deadline: { lte: new Date() },
      },
      select: { id: true },
    });
    let settled = 0;
    for (const p of due) {
      try {
        const r = await this.settleProject(p.id);
        if (r.transition !== 'noop') settled++;
      } catch (err) {
        this.logger.error(`settle failed for project=${p.id}`, err as Error);
      }
    }
    return { scanned: due.length, settled };
  }
}
