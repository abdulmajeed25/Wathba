import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Per-project collaborators (Creator-CC / CC-24) — REAL, owner-managed access,
 * unlike the decorative CreatorProfile.collaborators list. A collaborator gets
 * CONTENT access (currently: project updates); money & lifecycle controls stay
 * owner-only (CREATOR-NO-MONEY). Invited by the owner via an existing user's
 * email.
 */
@Injectable()
export class CollaboratorsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireOwned(ownerId: string, projectId: string): Promise<void> {
    const p = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { createdById: true },
    });
    if (!p) throw new NotFoundException('project not found');
    if (p.createdById !== ownerId) throw new ForbiddenException('not your project');
  }

  async list(ownerId: string, projectId: string): Promise<{ items: Array<Record<string, unknown>> }> {
    await this.requireOwned(ownerId, projectId);
    const rows = await this.prisma.projectCollaborator.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      items: rows.map((r) => ({
        userId: r.userId,
        name: byId.get(r.userId)?.name ?? '—',
        email: byId.get(r.userId)?.email ?? null,
        role: r.role,
        addedAt: r.createdAt.toISOString(),
      })),
    };
  }

  async invite(ownerId: string, projectId: string, email: string): Promise<{ items: Array<Record<string, unknown>> }> {
    await this.requireOwned(ownerId, projectId);
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('لا يوجد مستخدم بهذا البريد على وثبة');
    if (user.id === ownerId) throw new BadRequestException('أنت صاحب المشروع بالفعل');
    try {
      await this.prisma.projectCollaborator.create({ data: { projectId, userId: user.id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('هذا المتعاون مُضاف بالفعل');
      }
      throw e;
    }
    return this.list(ownerId, projectId);
  }

  async remove(ownerId: string, projectId: string, userId: string): Promise<{ removed: true }> {
    await this.requireOwned(ownerId, projectId);
    await this.prisma.projectCollaborator.deleteMany({ where: { projectId, userId } });
    return { removed: true };
  }
}
