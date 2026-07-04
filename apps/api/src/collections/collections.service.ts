import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCollectionDto, UpdateCollectionDto } from './dto/collection.dto';

/** Batch DISC — curated collections (حملات وثبة). Public reads + admin CRUD. */
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

  async create(dto: CreateCollectionDto) {
    try {
      return await this.prisma.collection.create({
        data: {
          slug: dto.slug,
          nameAr: dto.nameAr,
          descriptionAr: dto.descriptionAr,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new NotFoundException('المُعرّف (slug) مستخدَم بالفعل');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateCollectionDto) {
    await this.requireCollection(id);
    return this.prisma.collection.update({
      where: { id },
      data: {
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.descriptionAr !== undefined && { descriptionAr: dto.descriptionAr }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.showInMenu !== undefined && { showInMenu: dto.showInMenu }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.requireCollection(id);
    await this.prisma.collection.delete({ where: { id } });
    return { deleted: true };
  }

  async assign(collectionId: string, projectId: string): Promise<{ assigned: true }> {
    await this.requireCollection(collectionId);
    await this.prisma.projectCollection.upsert({
      where: { collectionId_projectId: { collectionId, projectId } },
      create: { collectionId, projectId },
      update: {},
    });
    return { assigned: true };
  }

  async unassign(collectionId: string, projectId: string): Promise<{ assigned: false }> {
    await this.prisma.projectCollection.deleteMany({ where: { collectionId, projectId } });
    return { assigned: false };
  }

  private async requireCollection(id: string): Promise<void> {
    const c = await this.prisma.collection.findUnique({ where: { id }, select: { id: true } });
    if (!c) throw new NotFoundException('الحملة غير موجودة');
  }
}
