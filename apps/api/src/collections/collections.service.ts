import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Batch DISC — curated collections (حملات وثبة). Public + admin READS —
 *  OPS Part 0 moved every mutation into the operations registry. */
@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active collections, optionally only those flagged for the discover menu. */
  async listActive(menuOnly = false): Promise<
    Array<{ slug: string; nameAr: string; descriptionAr: string; showInMenu: boolean }>
  > {
    return this.prisma.collection.findMany({
      where: { isActive: true, ...(menuOnly ? { showInMenu: true } : {}) },
      orderBy: [{ sortOrder: 'asc' }],
      select: { slug: true, nameAr: true, descriptionAr: true, showInMenu: true },
    });
  }

  /** Admin — every collection incl. inactive, with project counts. */
  async listAll() {
    return this.prisma.collection.findMany({
      orderBy: [{ sortOrder: 'asc' }],
      include: { _count: { select: { projects: true } } },
    });
  }

}
