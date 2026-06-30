import { Injectable, NotFoundException } from '@nestjs/common';
import { CommunityStatScope } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CommunityRow {
  key: string;
  backers: number;
}

export interface CommunitySnapshot {
  topCities: CommunityRow[];
  topCountries: CommunityRow[];
  totals: { newCount: number; returningCount: number; total: number };
}

@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(projectId: string): Promise<CommunitySnapshot> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('project not found');

    const [cities, countries, totals] = await Promise.all([
      this.prisma.communityStat.findMany({
        where: { projectId, scope: CommunityStatScope.CITY },
        orderBy: { backers: 'desc' },
        take: 5,
      }),
      this.prisma.communityStat.findMany({
        where: { projectId, scope: CommunityStatScope.COUNTRY },
        orderBy: { backers: 'desc' },
        take: 5,
      }),
      this.prisma.communityStat.findMany({
        where: { projectId, scope: CommunityStatScope.TOTALS },
      }),
    ]);

    const get = (k: string): number => totals.find((t) => t.key === k)?.backers ?? 0;
    return {
      topCities: cities.map((c) => ({ key: c.key, backers: c.backers })),
      topCountries: countries.map((c) => ({ key: c.key, backers: c.backers })),
      totals: {
        newCount: get('NEW'),
        returningCount: get('RETURNING'),
        total: get('TOTAL'),
      },
    };
  }

  /**
   * Idempotent per-pledge materialiser. Called by FundingService after a
   * pledge commits. Increments city + country + TOTAL + NEW|RETURNING for
   * the pledge's backer. Safe to call twice — the dedupe is via
   * `CommunityStat.uniqueIndex(projectId, scope, key)` upserts.
   *
   * "New" means the backer has no OTHER captured/authorised pledge across
   * the whole platform; otherwise they're returning.
   */
  async materializeFromPledge(pledgeId: string): Promise<void> {
    const pledge = await this.prisma.pledge.findUnique({
      where: { id: pledgeId },
      select: {
        id: true,
        projectId: true,
        backerId: true,
      },
    });
    if (!pledge) return;

    const addr = await this.prisma.address.findFirst({
      where: { userId: pledge.backerId, isDefault: true },
      select: { city: true, country: true },
    });
    const city = addr?.city?.trim() ?? null;
    const country = (addr?.country ?? 'SA').toUpperCase();

    const otherPledges = await this.prisma.pledge.count({
      where: {
        backerId: pledge.backerId,
        projectId: { not: pledge.projectId },
        status: { in: ['HELD', 'CAPTURED'] },
      },
    });
    const newOrReturning = otherPledges === 0 ? 'NEW' : 'RETURNING';

    // Tier 3.5 idempotency guard. Reserve the pledge BEFORE the increment
    // tx — a PK collision means "already materialised, skip" and we never
    // touch the aggregate counters again. Done outside the main $transaction
    // because Prisma's interactive tx aborts on the first failed statement
    // (Postgres semantics), so we can't catch-and-continue inside it.
    try {
      await this.prisma.communityMaterialised.create({ data: { pledgeId: pledge.id } });
    } catch {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      if (city) {
        await tx.communityStat.upsert({
          where: {
            projectId_scope_key: {
              projectId: pledge.projectId,
              scope: CommunityStatScope.CITY,
              key: city,
            },
          },
          create: {
            projectId: pledge.projectId,
            scope: CommunityStatScope.CITY,
            key: city,
            backers: 1,
          },
          update: { backers: { increment: 1 } },
        });
      }
      await tx.communityStat.upsert({
        where: {
          projectId_scope_key: {
            projectId: pledge.projectId,
            scope: CommunityStatScope.COUNTRY,
            key: country,
          },
        },
        create: {
          projectId: pledge.projectId,
          scope: CommunityStatScope.COUNTRY,
          key: country,
          backers: 1,
        },
        update: { backers: { increment: 1 } },
      });
      for (const k of ['TOTAL', newOrReturning]) {
        await tx.communityStat.upsert({
          where: {
            projectId_scope_key: {
              projectId: pledge.projectId,
              scope: CommunityStatScope.TOTALS,
              key: k,
            },
          },
          create: {
            projectId: pledge.projectId,
            scope: CommunityStatScope.TOTALS,
            key: k,
            backers: 1,
          },
          update: { backers: { increment: 1 } },
        });
      }
    });
  }
}
