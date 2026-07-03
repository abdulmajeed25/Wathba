import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRewardTierDto, UpdateRewardTierDto } from './dto/reward.dto';
import { Prisma, ProjectStatus, type RewardTier } from '@prisma/client';

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
        featured: dto.featured ?? false,
        includedItems: (dto.includedItems ?? []) as unknown as Prisma.InputJsonValue,
        shipsTo: dto.shipsTo ?? [],
        sortOrder: dto.sortOrder ?? 0,
        // CC-13 — optional early-bird pricing (must be below the tier price).
        ...(dto.earlyBirdAmountHalalas !== undefined && {
          earlyBirdAmountHalalas: BigInt(dto.earlyBirdAmountHalalas),
        }),
        ...(dto.earlyBirdUntil !== undefined && { earlyBirdUntil: new Date(dto.earlyBirdUntil) }),
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
    // CC-13 — tier edits are now allowed post-launch (LIVE/PAUSED), not just
    // pre-launch; only settled/terminal states are frozen.
    const EDITABLE: ProjectStatus[] = [
      ProjectStatus.DRAFT,
      ProjectStatus.UNDER_REVIEW,
      ProjectStatus.LIVE,
      ProjectStatus.PAUSED,
    ];
    if (!EDITABLE.includes(proj.status)) {
      throw new BadRequestException(`cannot edit tiers in status ${proj.status}`);
    }
    const tier = await this.prisma.rewardTier.findUnique({ where: { id: tierId } });
    if (!tier || tier.projectId !== projectId) throw new NotFoundException('tier not found');

    const hasBackers = tier.claimedQty > 0;

    // Policy §3 — a tier WITH backers is locked to protect the deal they bought:
    // only a limit INCREASE, copy (title/desc) fixes, and close/reopen are
    // allowed. Price, contents, delivery and early-bird are frozen.
    if (hasBackers) {
      if (dto.amountHalalas !== undefined && BigInt(dto.amountHalalas) !== tier.amountHalalas) {
        throw new BadRequestException('لا يمكن تغيير سعر مكافأة لها داعمون');
      }
      if (dto.earlyBirdAmountHalalas !== undefined || dto.earlyBirdUntil !== undefined) {
        throw new BadRequestException('لا يمكن تعديل التسعير المبكر لمكافأة لها داعمون');
      }
      if (
        dto.estDeliveryDate !== undefined ||
        dto.includedItems !== undefined ||
        dto.includesPhysicalProduct !== undefined ||
        dto.requiresShipping !== undefined
      ) {
        throw new BadRequestException('لا يمكن تغيير محتوى أو تسليم مكافأة لها داعمون');
      }
      if (
        dto.limitQty !== undefined &&
        (dto.limitQty === null
          ? tier.limitQty !== null
          : tier.limitQty !== null && dto.limitQty < tier.limitQty)
      ) {
        throw new BadRequestException('يمكن فقط زيادة حدّ الكمية لمكافأة لها داعمون');
      }
    }

    // Early-bird sanity: the early-bird price must be below the tier price.
    const targetAmount =
      dto.amountHalalas !== undefined ? BigInt(dto.amountHalalas) : tier.amountHalalas;
    const targetEarly =
      dto.earlyBirdAmountHalalas === undefined
        ? tier.earlyBirdAmountHalalas
        : dto.earlyBirdAmountHalalas === null
          ? null
          : BigInt(dto.earlyBirdAmountHalalas);
    if (targetEarly !== null && targetEarly >= targetAmount) {
      throw new BadRequestException('سعر التسعير المبكر يجب أن يكون أقلّ من سعر المكافأة');
    }

    const updated = await this.prisma.rewardTier.update({
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
        ...(dto.featured !== undefined && { featured: dto.featured }),
        ...(dto.includedItems !== undefined && {
          includedItems: dto.includedItems as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.shipsTo !== undefined && { shipsTo: dto.shipsTo }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.earlyBirdAmountHalalas !== undefined && {
          earlyBirdAmountHalalas:
            dto.earlyBirdAmountHalalas === null ? null : BigInt(dto.earlyBirdAmountHalalas),
        }),
        ...(dto.earlyBirdUntil !== undefined && {
          earlyBirdUntil: dto.earlyBirdUntil ? new Date(dto.earlyBirdUntil) : null,
        }),
      },
    });

    // Post-launch copy fix on a backed tier → public change-log (policy §3).
    const postLaunch = proj.status === ProjectStatus.LIVE || proj.status === ProjectStatus.PAUSED;
    const copyChanged =
      (dto.titleAr !== undefined && dto.titleAr !== tier.titleAr) ||
      (dto.descAr !== undefined && dto.descAr !== tier.descAr);
    if (postLaunch && hasBackers && copyChanged) {
      await this.prisma.projectChangeLog.create({
        data: {
          projectId,
          actorId: userId,
          field: 'reward-tier',
          summaryAr: `عُدّل وصف مكافأة «${updated.titleAr}»`,
        },
      });
    }
    return updated;
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
    // CC-13 — early-bird is active while its deadline hasn't passed and stock
    // remains; the effective minimum pledge drops to the early-bird price.
    const earlyBirdActive =
      t.earlyBirdAmountHalalas !== null &&
      t.earlyBirdUntil !== null &&
      t.earlyBirdUntil.getTime() > Date.now() &&
      (t.limitQty === null || t.claimedQty < t.limitQty);
    const effective = earlyBirdActive ? t.earlyBirdAmountHalalas! : t.amountHalalas;
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
      featured: t.featured,
      includedItems: t.includedItems,
      shipsTo: t.shipsTo,
      sortOrder: t.sortOrder,
      // CC-13
      isActive: t.isActive,
      earlyBirdAmountHalalas: t.earlyBirdAmountHalalas === null ? null : Number(t.earlyBirdAmountHalalas),
      earlyBirdUntil: t.earlyBirdUntil?.toISOString() ?? null,
      earlyBirdActive,
      effectiveAmountHalalas: Number(effective),
    };
  }

  private async requireOwned(userId: string, projectId: string) {
    const proj = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!proj) throw new NotFoundException('project not found');
    if (proj.createdById !== userId) throw new ForbiddenException('not your project');
    return proj;
  }
}
