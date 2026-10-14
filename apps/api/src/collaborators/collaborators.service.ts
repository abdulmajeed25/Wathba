import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { contentWorkspaceOpen, isUpdateEditor } from './content-access';

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

  private async requireOwned(ownerId: string, projectId: string, db: Prisma.TransactionClient = this.prisma) {
    const p = await db.project.findUnique({
      where: { id: projectId },
      select: { createdById: true, status: true, applicationApprovedAt: true },
    });
    if (!p) throw new NotFoundException('project not found');
    if (p.createdById !== ownerId) throw new ForbiddenException('not your project');
    return p;
  }

  async workspaces(userId: string) {
    const rows = await this.prisma.projectCollaborator.findMany({
      where: { userId, role: 'EDITOR', project: { hiddenAt: null, OR: [
        { applicationApprovedAt: { not: null } }, { status: { notIn: ['DRAFT', 'UNDER_REVIEW'] } },
      ] } },
      select: { project: { select: { id: true, titleAr: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { items: rows.map(row => ({ ...row.project, role: 'EDITOR' as const })) };
  }

  async workspace(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId },
      select: { id: true, titleAr: true, createdById: true, status: true, hiddenAt: true, applicationApprovedAt: true } });
    if (!project || !await isUpdateEditor(this.prisma, projectId, project, userId)) {
      throw new NotFoundException('مساحة المحتوى غير متاحة؛ ربما سُحب الوصول أو تغيرت حالة الحملة');
    }
    return { id: project.id, titleAr: project.titleAr, status: project.status, role: 'EDITOR' as const };
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
      await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId}::uuid FOR UPDATE`;
        const project = await this.requireOwned(ownerId, projectId, tx);
        if (!contentWorkspaceOpen(project)) throw new ForbiddenException('تُفتح إدارة الفريق بعد اعتماد الطلب الأولي');
        await tx.projectCollaborator.create({ data: { projectId, userId: user.id, role: 'EDITOR' } });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('هذا المتعاون مُضاف بالفعل');
      }
      throw e;
    }
    return this.list(ownerId, projectId);
  }

  async remove(ownerId: string, projectId: string, userId: string): Promise<{ removed: true }> {
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId}::uuid FOR UPDATE`;
      await this.requireOwned(ownerId, projectId, tx);
      await tx.projectCollaborator.deleteMany({ where: { projectId, userId } });
    });
    return { removed: true };
  }
}
