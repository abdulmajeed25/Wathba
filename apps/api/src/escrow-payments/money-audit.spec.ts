/* eslint-disable @typescript-eslint/no-explicit-any */
import { PayoutStatus, PledgeStatus, ProjectStatus } from '@prisma/client';
import { PayoutDisburser } from './payout.disburser';
import { WebhookService } from './webhook.service';
import { FundingService } from '../funding/funding.service';
import { NafathService } from '../identity/nafath.service';

/**
 * MONEY-AUDIT-HARDENING — every money-moving system path (and the Nafath KYC
 * flip) now writes a domain AuditLog row through AuditService.log. These tests
 * prove the row is written with the right action + entityId on the four
 * canonical paths; the underlying money logic is covered by the per-service
 * specs. AuditService is always mocked (never-throws logger).
 */

const auditMock = (): any => ({ log: jest.fn().mockResolvedValue(undefined) });

describe('MONEY-AUDIT — settle funded (FundingService.settleProject)', () => {
  it('writes system.settle.funded with the project id on the SUCCESSFUL→FUNDED flip', async () => {
    const project = {
      id: 'p1',
      status: ProjectStatus.LIVE,
      deadline: new Date(Date.now() - 1000),
      fundingGoalHalalas: 100_000_000n,
      releaseThresholdPct: 80,
      raisedHalalas: 90_000_000n,
      backersCount: 3,
    };
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(project),
        update: jest.fn().mockResolvedValue(project),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      pledge: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    } as any;
    const escrow = {
      captureAllHeld: jest.fn().mockResolvedValue({ captured: 2, failed: 0 }),
      refundAllHeld: jest.fn().mockResolvedValue({ refunded: 0, failed: 0 }),
    } as any;
    const gateway = { emitTick: jest.fn() } as any;
    const community = { materializeFromPledge: jest.fn() } as any;
    const notifications = { create: jest.fn(), filterAllowed: jest.fn().mockResolvedValue([]) } as any;
    const email = { projectFunded: jest.fn(), projectFailed: jest.fn(), captureGrace: jest.fn() } as any;
    const audit = auditMock();
    const svc = new FundingService(
      prisma, escrow, {} as any, gateway, community, { record: jest.fn() } as any,
      audit, email, notifications, { assertHuman: jest.fn() } as any,
      { get: jest.fn() } as any,
    );
    const r = await svc.settleProject('p1');
    expect(r.transition).toBe('funded');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'system.settle.funded', entity: 'Project', entityId: 'p1' }),
    );
  });
});

describe('MONEY-AUDIT — payout SENT (PayoutDisburser)', () => {
  it('writes system.payout.sent with the payout id on the PENDING→SENT flip', async () => {
    const payout = {
      id: 'po-1',
      projectId: 'proj-1',
      creatorId: 'creator-1',
      milestoneId: 'm-1',
      amountHalalas: 5_000_000n,
      status: PayoutStatus.PENDING,
      createdAt: new Date(),
    };
    const prisma = {
      payout: {
        findMany: jest.fn((args: any) =>
          Promise.resolve(args?.where?.status === PayoutStatus.SENDING ? [] : [payout]),
        ),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ email: 'c@test.sa' }) },
      project: { findUnique: jest.fn().mockResolvedValue({ titleAr: 'مشروع' }) },
    } as any;
    const cfg = { get: jest.fn().mockReturnValue('') } as any; // stub mode
    const audit = auditMock();
    const d = new PayoutDisburser(
      prisma,
      { record: jest.fn() } as any,
      { generateForPayout: jest.fn().mockResolvedValue({ invoiceNumber: 'WTB-1' }) } as any,
      { beat: jest.fn() } as any,
      { resolveDestination: jest.fn().mockResolvedValue(null) } as any,
      cfg,
      { payoutSent: jest.fn() } as any,
      { create: jest.fn() } as any,
      audit,
    );
    const res = await d.disbursePending();
    expect(res).toEqual({ sent: 1, failed: 0 });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'system.payout.sent', entity: 'Payout', entityId: 'po-1' }),
    );
  });
});

describe('MONEY-AUDIT — webhook capture (WebhookService)', () => {
  it('writes system.webhook.captured with the pledge id on a payment_paid HELD→CAPTURED', async () => {
    const prisma = {
      webhookEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      pledge: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pl-1', paymentRef: 'pay_x', status: PledgeStatus.HELD,
          amountHalalas: 10_000n, addOnsHalalas: 0n, projectId: 'proj-1',
        }),
        update: jest.fn(),
      },
    } as any;
    const audit = auditMock();
    const svc = new WebhookService(
      prisma,
      { record: jest.fn() } as any,
      { markCaptured: jest.fn().mockResolvedValue(undefined) } as any,
      audit,
      { create: jest.fn() } as any,
      { refundCompleted: jest.fn() } as any,
      { get: jest.fn().mockReturnValue('whsec') } as any,
    );
    const r = await svc.process({ id: 'evt-1', type: 'payment_paid', data: { id: 'pay_x' } });
    expect(r.outcome).toBe('applied');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'system.webhook.captured', entity: 'Pledge', entityId: 'pl-1' }),
    );
  });
});

describe('MONEY-AUDIT — Nafath KYC flip (NafathService)', () => {
  it('writes system.kyc.nafath-verified with the user id on markVerified', async () => {
    const prisma = { user: { update: jest.fn().mockResolvedValue({ email: 'u@test.sa', name: 'U' }) } } as any;
    const cfg = { get: jest.fn((k: string) => (k === 'NAFATH_API_KEY' ? '' : undefined)) } as any;
    const audit = auditMock();
    const svc = new NafathService(prisma, cfg, { welcome: jest.fn() } as any, audit);
    const { transactionId } = await svc.initiate('user-1', '1234567890');
    const r = await svc.confirm('user-1', transactionId);
    expect(r.outcome).toBe('verified');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'system.kyc.nafath-verified', entity: 'User', entityId: 'user-1' }),
    );
  });
});
