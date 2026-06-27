import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRewardTierDto, UpdateRewardTierDto } from './dto/reward.dto';
import { ProjectStatus, type RewardTier } from '@prisma/client';

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    projectId: string,
    dto: CreateRewardTierDto,
  ): Promise<RewardTier> {
    const proj = await this.requireOwned(userId, projectId);
    if (proj.status !== ProjectStatus.DRAFT && proj.status !== ProjectStatus.UNDER_REVIEW) {
      throw new BadRequestException(`cannot add tiers in status ${proj.status}`);
    }
    return this.prisma.rewardTier.create({
      data: {
        projectId,
        titleAr: dto.titleAr,
        amountHalalas: BigInt(dto.amountHalalas),
        descAr: dto.descAr,
        includesPhysicalProduct: dto.includesPhysicalProduct ?? false,
        requiresShipping: dto.requiresShipping ?? false,
        estDeliveryDate: new Date(dto.estDeliveryDate),
        limitQty: dto.limitQty ?? null,
        popular: dto.popular ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(
    userId: string,
    projectId: string,
    tierId: string,
    dto: UpdateRewardTierDto,
  ): Promise<RewardTier> {
    const proj = await this.requireOwned(userId, projectId);
    if (proj.status !== ProjectStatus.DRAFT && proj.status !== ProjectStatus.UNDER_REVIEW) {
      throw new BadRequestException(`cannot edit tiers in status ${proj.status}`);
    }
    const tier = await this.prisma.rewardTier.findUnique({ where: { id: tierId } });
    if (!tier || tier.projectId !== projectId) throw new NotFoundException('tier not found');
    return this.prisma.rewardTier.update({
      where: { id: tierId },
      data: {
        ...(dto.titleAr !== undefined && { titleAr: dto.titleAr }),
        ...(dto.amountHalalas !== undefined && { amountHalalas: BigInt(dto.amountHalalas) }),
        ...(dto.descAr !== undefined && { descAr: dto.descAr }),
        ...(dto.includesPhysicalProduct !== undefined && {
          includesPhysicalProduct: dto.includesPhysicalProduct,
        }),
        ...(dto.requiresShipping !== undefined && { requiresShipping: dto.requiresShipping }),
        ...(dto.estDeliveryDate !== undefined && {
          estDeliveryDate: new Date(dto.estDeliveryDate),
        }),
        ...(dto.limitQty !== undefined && { limitQty: dto.limitQty }),
        ...(dto.popular !== undefined && { popular: dto.popular }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async remove(userId: string, projectId: string, tierId: string): Promise<{ deleted: true }> {
    const proj = await this.requireOwned(userId, projectId);
    if (proj.status !== ProjectStatus.DRAFT) {
      throw new BadRequestException('only DRAFT projects allow tier deletion');
    }
    const tier = await this.prisma.rewardTier.findUnique({ where: { id: tierId } });
    if (!tier || tier.projectId !== projectId) throw new NotFoundException('tier not found');
    if (tier.claimedQty > 0) throw new BadRequestException('cannot delete claimed tier');
    await this.prisma.rewardTier.delete({ where: { id: tierId } });
    return { deleted: true };
  }

  async listForProject(projectId: string): Promise<RewardTier[]> {
    return this.prisma.rewardTier.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { amountHalalas: 'asc' }],
    });
  }

  toPublic(t: RewardTier): Record<string, unknown> {
    return {
      id: t.id,
      projectId: t.projectId,
      titleAr: t.titleAr,
      amountHalalas: Number(t.amountHalalas),
      descAr: t.descAr,
      includesPhysicalProduct: t.includesPhysicalProduct,
      requiresShipping: t.requiresShipping,
      estDeliveryDate: t.estDeliveryDate.toISOString(),
      limitQty: t.limitQty,
      claimedQty: t.claimedQty,
      popular: t.popular,
      sortOrder: t.sortOrder,
    };
  }

  private async requireOwned(userId: string, projectId: string) {
    const proj = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!proj) throw new NotFoundException('project not found');
    if (proj.createdById !== userId) throw new ForbiddenException('not your project');
    return proj;
  }
}
