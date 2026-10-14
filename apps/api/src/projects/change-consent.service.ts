import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PledgeStatus, ProjectChangeDecision, type Project, type ProjectChangeRequest } from '@prisma/client';
import { IsEnum, IsUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { campaignTerms } from './project-changes.service';

export const affectedPledgeStatuses: PledgeStatus[] = ['HELD', 'PENDING_BNPL', 'PENDING_REAUTH', 'CAPTURED'];

export function consentTermsCurrent(row: Pick<ProjectChangeRequest, 'before'>, project: Project): boolean {
  const before = row.before as Record<string, unknown>;
  return ['LIVE', 'PAUSED'].includes(project.status) && project.deadline.getTime() > Date.now()
    && Object.entries(campaignTerms(project)).every(([key, value]) => before[key] === value);
}

export class RespondToChangeDto {
  @IsUUID() clientRequestId!: string;
  @IsEnum(ProjectChangeDecision) decision!: ProjectChangeDecision;
}

@Injectable()
export class ChangeConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, pledgeId: string, cursor?: string) {
    const pledge = await this.prisma.pledge.findFirst({ where: { id: pledgeId, backerId: userId }, include: { project: true } });
    if (!pledge) throw new NotFoundException('التعهد غير موجود');
    const rows = await this.prisma.projectChangeRequest.findMany({
      where: { projectId: pledge.projectId, consentOpenedAt: { not: null } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { responses: { where: { pledgeId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 } },
    });
    return { nextCursor: rows.length > 20 ? rows[19]!.id : null, items: rows.slice(0, 20).map(row => ({
      id: row.id, status: row.status, reasonAr: row.reasonAr, before: row.before, proposed: row.proposed,
      reviewNoteAr: row.reviewNoteAr, consentOpenedAt: row.consentOpenedAt,
      response: row.responses[0] ? { decision: row.responses[0].decision, createdAt: row.responses[0].createdAt } : null,
      canRespond: row.status === 'CONSENT_OPEN' && affectedPledgeStatuses.includes(pledge.status) && consentTermsCurrent(row, pledge.project),
    })) };
  }

  async respond(userId: string, pledgeId: string, requestId: string, dto: RespondToChangeDto) {
    // Lock order is project -> request -> pledge. Proposal withdrawal waits on
    // the same request row; settlement and terms changes wait on the project.
    return this.prisma.$transaction(async tx => {
      const owned = await tx.pledge.findFirst({ where: { id: pledgeId, backerId: userId }, select: { projectId: true } });
      if (!owned) throw new NotFoundException('التعهد غير موجود');
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${owned.projectId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "ProjectChangeRequest" WHERE "id" = ${requestId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Pledge" WHERE "id" = ${pledgeId}::uuid FOR UPDATE`;
      const pledge = await tx.pledge.findFirst({ where: { id: pledgeId, backerId: userId }, include: { project: true } });
      const row = await tx.projectChangeRequest.findUnique({ where: { id: requestId } });
      if (!pledge || !row || row.projectId !== pledge.projectId) throw new NotFoundException('الطلب غير موجود لهذا التعهد');
      const prior = await tx.projectChangeResponse.findUnique({ where: { pledgeId_clientRequestId: { pledgeId, clientRequestId: dto.clientRequestId } } });
      if (prior) {
        if (prior.requestId !== requestId || prior.decision !== dto.decision) throw new ConflictException('معرّف المحاولة مستخدم لقرار مختلف');
        return { id: prior.id, decision: prior.decision, createdAt: prior.createdAt };
      }
      if (row.status !== 'CONSENT_OPEN' || !affectedPledgeStatuses.includes(pledge.status) || !consentTermsCurrent(row, pledge.project)) {
        throw new ConflictException('لم يعد الطلب مفتوحًا أو تغيرت شروط الحملة أو حالة تعهدك؛ حدّث الصفحة');
      }
      // Responses remain append-only; preserve a deterministic latest answer
      // even when two decisions are submitted within the same millisecond.
      const last = await tx.projectChangeResponse.findFirst({ where: { requestId, pledgeId }, orderBy: { createdAt: 'desc' } });
      const response = await tx.projectChangeResponse.create({ data: {
        requestId, pledgeId, clientRequestId: dto.clientRequestId, decision: dto.decision,
        createdAt: new Date(Math.max(Date.now(), (last?.createdAt.getTime() ?? 0) + 1)),
        pledgeSnapshot: { backerId: userId, amountHalalas: pledge.amountHalalas.toString(), addOnsHalalas: pledge.addOnsHalalas.toString(),
          status: pledge.status, tierId: pledge.tierId, contractType: pledge.contractType, before: row.before, proposed: row.proposed },
      } });
      return { id: response.id, decision: response.decision, createdAt: response.createdAt };
    });
  }
}
