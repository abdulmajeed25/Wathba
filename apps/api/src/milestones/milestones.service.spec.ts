import { MilestonesService } from './milestones.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectStatus } from '@prisma/client';

/**
 * OPS Part 0 — approve/release moved into the operations registry; their FSM
 * tests (incl. the realized-vs-raised 27M proof) live in
 * src/ops/operations.registry.spec.ts. This spec keeps the creator-side
 * plan validation.
 */
describe('MilestonesService.setMilestones', () => {
  it('rejects when releasePct sum != 100', async () => {
    const prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p', status: ProjectStatus.DRAFT, raisedHalalas: 0n, createdById: 'u1',
        }),
      },
    } as unknown as PrismaService;
    const svc = new MilestonesService(prisma);
    await expect(
      svc.setMilestones('u1', 'p', {
        milestones: [
          { order: 1, titleAr: 'a', releasePct: 30, evidenceRequired: '...' },
          { order: 2, titleAr: 'b', releasePct: 50, evidenceRequired: '...' },
        ],
      }),
    ).rejects.toThrow(/sum to 100/);
  });
});
