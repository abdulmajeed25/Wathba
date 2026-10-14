import { ProjectStatus, type PrismaClient } from '@prisma/client';

/** Completion is a database condition, not the fact that a sweep ran.
 * In-flight authorizations and inconsistent historical counters deliberately
 * prevent a claim that every commitment has been returned. */
export async function completeProjectRefund(db: Pick<PrismaClient, 'project'>, projectId: string): Promise<boolean> {
  const complete = await db.project.updateMany({
    where: { id: projectId, status: { in: [ProjectStatus.FAILED, ProjectStatus.REFUNDED] },
      raisedHalalas: 0n, realizedHalalas: 0n, backersCount: 0,
      pledges: { none: { status: { not: 'REFUNDED' } } },
    },
    data: { status: ProjectStatus.REFUNDED },
  });
  return complete.count === 1;
}
