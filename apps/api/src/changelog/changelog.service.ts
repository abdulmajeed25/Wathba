import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Public transparency change-log reader (Creator-CC / CC-11). Writes happen
 * inline in the services that mutate content (ProjectsService.updateStory,
 * RewardsService copy-fix); this exposes the append-only log to backers.
 */
@Injectable()
export class ChangelogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    projectId: string,
    opts: { take?: number; cursor?: string } = {},
  ): Promise<{ items: Array<Record<string, unknown>>; nextCursor: string | null }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('project not found');

    const take = Math.min(50, Math.max(1, opts.take ?? 20));
    const rows = await this.prisma.projectChangeLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(opts.cursor && { cursor: { id: opts.cursor }, skip: 1 }),
    });
    const nextCursor = rows.length > take ? rows[take]!.id : null;
    const items = rows.slice(0, take).map((r) => ({
      id: r.id,
      field: r.field,
      summaryAr: r.summaryAr,
      createdAt: r.createdAt.toISOString(),
    }));
    return { items, nextCursor };
  }
}
