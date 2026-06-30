import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddOnDto, UpdateAddOnDto } from './dto/addon.dto';
import { ProjectStatus, type AddOn } from '@prisma/client';

@Injectable()
export class AddonsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForProject(projectId: string): Promise<AddOn[]> {
    return this.prisma.addOn.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { amountHalalas: 'asc' }],
    });
  }

  async create(userId: string, projectId: string, dto: CreateAddOnDto): Promise<AddOn> {
    const proj = await this.requireOwned(userId, projectId);
    if (proj.status === ProjectStatus.DELIVERED || proj.status === ProjectStatus.REFUNDED) {
      throw new BadRequestException(`cannot add add-ons in status ${proj.status}`);
    }
    return this.prisma.addOn.create({
      data: {
        projectId,
        titleAr: dto.titleAr,
        amountHalalas: BigInt(dto.amountHalalas),
        descAr: dto.descAr,
        imageUrl: dto.imageUrl ?? null,
        limitQty: dto.limitQty ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(
    userId: string,
    projectId: string,
    addOnId: string,
    dto: UpdateAddOnDto,
  ): Promise<AddOn> {
    await this.requireOwned(userId, projectId);
    const addon = await this.prisma.addOn.findUnique({ where: { id: addOnId } });
    if (!addon || addon.projectId !== projectId) {
      throw new NotFoundException('addon not found');
    }
    return this.prisma.addOn.update({
      where: { id: addOnId },
      data: {
        ...(dto.titleAr !== undefined && { titleAr: dto.titleAr }),
        ...(dto.amountHalalas !== undefined && { amountHalalas: BigInt(dto.amountHalalas) }),
        ...(dto.descAr !== undefined && { descAr: dto.descAr }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.limitQty !== undefined && { limitQty: dto.limitQty }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async remove(userId: string, projectId: string, addOnId: string): Promise<{ deleted: true }> {
    const proj = await this.requireOwned(userId, projectId);
    if (proj.status !== ProjectStatus.DRAFT) {
      throw new BadRequestException('only DRAFT projects allow add-on deletion');
    }
    const addon = await this.prisma.addOn.findUnique({ where: { id: addOnId } });
    if (!addon || addon.projectId !== projectId) {
      throw new NotFoundException('addon not found');
    }
    if (addon.claimedQty > 0) {
      throw new BadRequestException('cannot delete a claimed add-on');
    }
    await this.prisma.addOn.delete({ where: { id: addOnId } });
    return { deleted: true };
  }

  toPublic(a: AddOn): Record<string, unknown> {
    return {
      id: a.id,
      projectId: a.projectId,
      titleAr: a.titleAr,
      amountHalalas: Number(a.amountHalalas),
      descAr: a.descAr,
      imageUrl: a.imageUrl,
      limitQty: a.limitQty,
      claimedQty: a.claimedQty,
      sortOrder: a.sortOrder,
    };
  }

  private async requireOwned(userId: string, projectId: string) {
    const proj = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!proj) throw new NotFoundException('project not found');
    if (proj.createdById !== userId) throw new ForbiddenException('not your project');
    return proj;
  }
}
