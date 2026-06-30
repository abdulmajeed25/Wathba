import { FundingService } from './funding.service';
import { EscrowService } from '../escrow-payments/escrow.service';
import { ContractsService } from '../contracts/contracts.service';
import { FundingGateway } from './funding.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectStatus } from '@prisma/client';

/**
 * Unit tests for the §5 funding rule: at deadline, capture iff
 * raised ≥ goal × thresholdPct/100, else void/refund.
 */

describe('FundingService.settleProject (§5 FSM)', () => {
  const buildProject = (over: Partial<Record<string, unknown>> = {}) => ({
    id: 'p1',
    status: ProjectStatus.LIVE,
    deadline: new Date(Date.now() - 1000), // past
    fundingGoalHalalas: 100_000_000n, // 1,000,000 SAR
    releaseThresholdPct: 80,
    raisedHalalas: 80_000_000n,
    ...over,
  });

  const buildService = (project: ReturnType<typeof buildProject>) => {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue(project),
        update: jest.fn().mockResolvedValue(project),
      },
    } as unknown as PrismaService;
    const escrow = {
      captureAllHeld: jest.fn().mockResolvedValue({ captured: 0, failed: 0 }),
      refundAllHeld: jest.fn().mockResolvedValue({ refunded: 0, failed: 0 }),
    } as unknown as EscrowService;
    const contracts = {} as ContractsService;
    const gateway = { emitTick: jest.fn() } as unknown as FundingGateway;
    const community = {
      materializeFromPledge: jest.fn().mockResolvedValue(undefined),
    } as unknown as import('../community/community.service').CommunityService;
    return { svc: new FundingService(prisma, escrow, contracts, gateway, community), prisma, escrow };
  };

  it('captures when raised exactly meets the 80% threshold', async () => {
    const { svc, escrow } = buildService(buildProject({ raisedHalalas: 80_000_000n }));
    const res = await svc.settleProject('p1');
    expect(res.transition).toBe('funded');
    expect(escrow.captureAllHeld).toHaveBeenCalledWith('p1');
    expect(escrow.refundAllHeld).not.toHaveBeenCalled();
  });

  it('refunds when raised is 1 halala below the threshold', async () => {
    const { svc, escrow } = buildService(buildProject({ raisedHalalas: 79_999_999n }));
    const res = await svc.settleProject('p1');
    expect(res.transition).toBe('refunded');
    expect(escrow.refundAllHeld).toHaveBeenCalledWith('p1');
    expect(escrow.captureAllHeld).not.toHaveBeenCalled();
  });

  it('no-ops if deadline has not passed', async () => {
    const future = new Date(Date.now() + 60_000);
    const { svc, escrow } = buildService(buildProject({ deadline: future }));
    const res = await svc.settleProject('p1');
    expect(res.transition).toBe('noop');
    expect(escrow.captureAllHeld).not.toHaveBeenCalled();
    expect(escrow.refundAllHeld).not.toHaveBeenCalled();
  });

  it('no-ops if project is not LIVE', async () => {
    const { svc, escrow } = buildService(buildProject({ status: ProjectStatus.FUNDED }));
    const res = await svc.settleProject('p1');
    expect(res.transition).toBe('noop');
    expect(escrow.captureAllHeld).not.toHaveBeenCalled();
  });

  it('respects custom release threshold — 50% pass', async () => {
    const { svc, escrow } = buildService(
      buildProject({ releaseThresholdPct: 50, raisedHalalas: 50_000_000n }),
    );
    const res = await svc.settleProject('p1');
    expect(res.transition).toBe('funded');
    expect(escrow.captureAllHeld).toHaveBeenCalled();
  });

  it('respects custom release threshold — 50% fail at 49,999,999', async () => {
    const { svc, escrow } = buildService(
      buildProject({ releaseThresholdPct: 50, raisedHalalas: 49_999_999n }),
    );
    const res = await svc.settleProject('p1');
    expect(res.transition).toBe('refunded');
    expect(escrow.refundAllHeld).toHaveBeenCalled();
  });
});
