import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, ProjectStatus, type Project } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Review queue — projects awaiting admin sign-off. */
  async reviewQueue(): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { status: ProjectStatus.UNDER_REVIEW },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(projectId: string): Promise<Project> {
    const proj = await this.requireUnderReview(projectId);
    const now = new Date();
    const deadline = new Date(now.getTime() + proj.durationDays * 86_400_000);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.LIVE, publishedAt: now, deadline },
    });
  }

  async reject(projectId: string, _reason: string | undefined): Promise<Project> {
    const proj = await this.requireUnderReview(projectId);
    return this.prisma.project.update({
      where: { id: proj.id },
      data: { status: ProjectStatus.DRAFT },
    });
  }

  /**
   * §7 — set or clear the platform-partner marker. Mandatory disclosureAr
   * required when setting (≥ 20 chars validated by DTO).
   */
  async setPlatformPartner(
    projectId: string,
    value: { stakeType: 'equity' | 'profit-share' | 'co-founder'; disclosureAr: string } | null,
  ): Promise<Project> {
    const proj = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!proj) throw new NotFoundException('project not found');
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        platformPartner:
          value === null
            ? Prisma.JsonNull
            : ({
                isPartnered: true,
                stakeType: value.stakeType,
                disclosureAr: value.disclosureAr,
              } as unknown as Prisma.InputJsonValue),
      },
    });
  }

  async kycQueue(): Promise<Array<Record<string, unknown>>> {
    const users = await this.prisma.user.findMany({
      where: { nafathVerified: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  async forceVerifyKyc(userId: string): Promise<{ verified: true }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { nafathVerified: true, nafathVerifiedAt: new Date() },
    });
    return { verified: true };
  }

  private async requireUnderReview(projectId: string): Promise<Project> {
    const proj = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!proj) throw new NotFoundException('project not found');
    if (proj.status !== ProjectStatus.UNDER_REVIEW) {
      throw new BadRequestException(`project must be UNDER_REVIEW (was ${proj.status})`);
    }
    return proj;
  }
}
