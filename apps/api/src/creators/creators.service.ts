import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MilestoneStatus, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CollaboratorDto,
  CreatorProfileResponseDto,
  FollowResponseDto,
  PastProjectDto,
  UpdateCreatorProfileDto,
} from './dto/creator-profile.dto';

/**
 * Creators bounded context — backs the web `WathbaCreatorTab` profile page
 * and its follow / unfollow buttons.
 *
 *   GET    /v1/creators/:userId         → CreatorProfileResponseDto
 *   POST   /v1/creators/:userId/follow  → {following:true, followersCount}
 *   DELETE /v1/creators/:userId/follow  → {following:false, followersCount}
 *
 * The Prisma `CreatorFollow` row is keyed by (followerId, creatorProfileId),
 * so the service resolves the target `User.id` → `CreatorProfile.id` on every
 * mutating call. A profile is lazily created on first follow so a creator can
 * still be followed before they themselves have ever opened the dashboard.
 *
 * Privacy: the SELECT shape for the User read is intentionally narrow — we
 * never expose email / phone / passwordHash / nationalIdHash on this surface.
 */
@Injectable()
export class CreatorsService {
  constructor(private readonly prisma: PrismaService) {}

  // --------------------------------------------------------------------------
  // GET /v1/creators/:userId
  // --------------------------------------------------------------------------

  async getProfile(userId: string): Promise<CreatorProfileResponseDto> {
    // Narrow projection — never select email / phone / passwordHash.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        nafathVerified: true,
        creatorProfile: {
          select: {
            avatarUrl: true,
            bioAr: true,
            websiteUrl: true,
            collaborators: true,
            followersCount: true,
            createdProjectsCount: true,
            backedProjectsCount: true,
            lastSeenAt: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('creator not found');

    // Past projects — published only, exclude DRAFT (matches brief).
    const projects = await this.prisma.project.findMany({
      where: {
        createdById: userId,
        status: { not: ProjectStatus.DRAFT },
        publishedAt: { not: null },
      },
      select: {
        id: true,
        titleAr: true,
        raisedHalalas: true,
        fundingGoalHalalas: true,
        status: true,
        publishedAt: true,
        milestones: { select: { status: true } },
      },
      orderBy: { publishedAt: 'desc' },
    });

    // Brief: 404 if user not found OR has no published projects.
    if (projects.length === 0) {
      throw new NotFoundException('creator has no published projects');
    }

    const pastProjects: PastProjectDto[] = projects.map((p) => {
      // BigInt-safe percentage. Guard divide-by-zero (a goal of 0 means
      // the project was misconfigured — surface 0% rather than NaN/Infinity).
      const goal = p.fundingGoalHalalas;
      const raised = p.raisedHalalas;
      let fundedPct = 0;
      if (goal > 0n) {
        // Scale by 1000 so we get one decimal of precision after the divide.
        const scaled = Number((raised * 1000n) / goal);
        fundedPct = Math.round(scaled / 10 * 10) / 10;
      }
      const delivered =
        p.milestones.length > 0 &&
        p.milestones.every((m) => m.status === MilestoneStatus.RELEASED);

      return {
        id: p.id,
        titleAr: p.titleAr,
        raisedHalalas: Number(raised),
        fundingGoalHalalas: Number(goal),
        status: p.status,
        fundedPct,
        delivered,
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      };
    });

    const profile = user.creatorProfile;
    return {
      userId: user.id,
      name: user.name,
      nafathVerified: user.nafathVerified,
      avatarUrl: profile?.avatarUrl ?? null,
      bioAr: profile?.bioAr ?? null,
      websiteUrl: profile?.websiteUrl ?? null,
      collaborators: this.parseCollaborators(profile?.collaborators),
      followersCount: profile?.followersCount ?? 0,
      createdProjectsCount: profile?.createdProjectsCount ?? projects.length,
      backedProjectsCount: profile?.backedProjectsCount ?? 0,
      lastSeenAt: profile?.lastSeenAt ? profile.lastSeenAt.toISOString() : null,
      pastProjects,
    };
  }

  // --------------------------------------------------------------------------
  // PATCH /v1/creators/:userId (owner-only)
  // --------------------------------------------------------------------------

  async updateProfile(
    userId: string,
    dto: UpdateCreatorProfileDto,
  ): Promise<CreatorProfileResponseDto> {
    const data: Record<string, unknown> = {};
    if (dto.bioAr !== undefined) data.bioAr = dto.bioAr;
    if (dto.websiteUrl !== undefined) data.websiteUrl = dto.websiteUrl;
    if (dto.collaborators !== undefined) {
      data.collaborators = dto.collaborators.map((c) => ({
        nameAr: c.nameAr,
        ...(c.role !== undefined ? { role: c.role } : {}),
        ...(c.avatarUrl !== undefined ? { avatarUrl: c.avatarUrl } : {}),
      }));
    }
    await this.prisma.creatorProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    return this.getProfile(userId);
  }

  // --------------------------------------------------------------------------
  // POST /v1/creators/:userId/follow
  // --------------------------------------------------------------------------

  async follow(
    followerId: string,
    targetUserId: string,
  ): Promise<FollowResponseDto> {
    if (followerId === targetUserId) {
      throw new BadRequestException('cannot follow yourself');
    }

    return this.prisma.$transaction(async (tx) => {
      // Ensure target user exists.
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { id: true },
      });
      if (!target) throw new NotFoundException('creator not found');

      // Lazy-create the profile so a creator can be followed even before
      // they've personally opened the creator dashboard.
      const profile = await tx.creatorProfile.upsert({
        where: { userId: targetUserId },
        create: { userId: targetUserId },
        update: {},
        select: { id: true, followersCount: true },
      });

      // Idempotent: if a row already exists, return current count untouched.
      const existing = await tx.creatorFollow.findUnique({
        where: {
          followerId_creatorProfileId: {
            followerId,
            creatorProfileId: profile.id,
          },
        },
        select: { id: true },
      });

      if (existing) {
        return { following: true, followersCount: profile.followersCount };
      }

      await tx.creatorFollow.create({
        data: { followerId, creatorProfileId: profile.id },
      });
      const updated = await tx.creatorProfile.update({
        where: { id: profile.id },
        data: { followersCount: { increment: 1 } },
        select: { followersCount: true },
      });
      return { following: true, followersCount: updated.followersCount };
    });
  }

  // --------------------------------------------------------------------------
  // DELETE /v1/creators/:userId/follow
  // --------------------------------------------------------------------------

  async unfollow(
    followerId: string,
    targetUserId: string,
  ): Promise<FollowResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.creatorProfile.findUnique({
        where: { userId: targetUserId },
        select: { id: true, followersCount: true },
      });
      // No profile = no follow row = treat as already-unfollowed (idempotent).
      if (!profile) {
        return { following: false, followersCount: 0 };
      }

      // Try to delete; if the row doesn't exist, deleteMany returns count 0
      // and we just report the current counter unchanged.
      const del = await tx.creatorFollow.deleteMany({
        where: { followerId, creatorProfileId: profile.id },
      });

      if (del.count === 0) {
        return { following: false, followersCount: profile.followersCount };
      }

      const updated = await tx.creatorProfile.update({
        where: { id: profile.id },
        data: {
          followersCount: { decrement: 1 },
        },
        select: { followersCount: true },
      });
      // Guard against the counter ever going negative due to historical drift.
      const safeCount = Math.max(updated.followersCount, 0);
      if (safeCount !== updated.followersCount) {
        await tx.creatorProfile.update({
          where: { id: profile.id },
          data: { followersCount: safeCount },
        });
      }
      return { following: false, followersCount: safeCount };
    });
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  /**
   * Defensively parses the Json `collaborators` column. The shape is
   * creator-supplied; we discard malformed entries instead of 500ing.
   */
  private parseCollaborators(raw: unknown): CollaboratorDto[] {
    if (!Array.isArray(raw)) return [];
    const out: CollaboratorDto[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const nameAr = typeof obj.nameAr === 'string' ? obj.nameAr : null;
      if (!nameAr) continue;
      const entry: CollaboratorDto = { nameAr };
      if (typeof obj.role === 'string') entry.role = obj.role;
      if (typeof obj.avatarUrl === 'string') entry.avatarUrl = obj.avatarUrl;
      out.push(entry);
    }
    return out;
  }
}
