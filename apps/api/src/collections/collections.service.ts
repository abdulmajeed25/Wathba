import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Batch DISC — curated collections (حملات وثبة). Public reads here; admin
 *  CRUD + project assignment land in Part 4. */
@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active collections, optionally only those flagged for the discover menu. */
  async listActive(menuOnly = false): Promise<
    Array<{ slug: string; nameAr: string; descriptionAr: string; showInMenu: boolean }>
  > {
    const rows = await this.prisma.collection.findMany({
      where: { isActive: true, ...(menuOnly ? { showInMenu: true } : {}) },
      orderBy: [{ sortOrder: 'asc' }],
      select: { slug: true, nameAr: true, descriptionAr: true, showInMenu: true },
    });
    return rows;
  }
}
