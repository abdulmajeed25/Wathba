import { ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { OptionalJwtAuthGuard } from '../identity/optional-jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

/** Private campaign subresources must not bypass the project-detail boundary. */
@Injectable()
export class ProjectVisibilityGuard extends OptionalJwtAuthGuard {
  constructor(private readonly prisma: PrismaService) { super(); }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request & { user?: { sub: string } }>();
    const projectId = req.params.projectId ?? req.params.id;
    const read = req.method === 'GET' || req.method === 'HEAD';
    const managementWrite = !read && req.method !== 'OPTIONS' && /\/projects\/[^/]+\/(reward-tiers|addons|updates|milestones|spend-logs|collaborators|rfqs|story)(\/|$)/.test(req.path);
    // Initial application writes (root PATCH, submit, withdraw) remain available.
    // Ops has its own permission-checked surface and audit pipeline.
    if ((!read && !managementWrite) || typeof projectId !== 'string' || !req.path.startsWith('/v1/projects/')) return true;
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(projectId)) return true;
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { status: true, hiddenAt: true, createdById: true, applicationApprovedAt: true } });
    if (!project) throw new NotFoundException('project not found');
    if (!project.hiddenAt && project.status !== 'DRAFT' && project.status !== 'UNDER_REVIEW') return true;
    await super.canActivate(context);
    if (req.user?.sub !== project.createdById) throw new NotFoundException('project not found');
    if (managementWrite && !project.applicationApprovedAt && (project.status === 'DRAFT' || project.status === 'UNDER_REVIEW')) {
      throw new ForbiddenException('تُفتح أدوات تجهيز الحملة بعد اعتماد الطلب الأولي');
    }
    return true;
  }
}
