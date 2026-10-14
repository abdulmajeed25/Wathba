import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Project } from '@prisma/client';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

export class CreateProjectChangeDto {
  @IsUUID() clientRequestId!: string;
  @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) fundingGoalHalalas!: number;
  // Planning horizon, not a promise that a payment authorization lasts this long.
  @IsInt() @Min(1) @Max(36500) durationDays!: number;
  @IsString() @MinLength(20) @MaxLength(4000) reasonAr!: string;
}

export class ListProjectChangesDto {
  @IsOptional() @IsUUID() cursor?: string;
}

export function campaignTerms(p: Pick<Project, 'fundingGoalHalalas' | 'durationDays' | 'deadline' | 'releaseThresholdPct'>) {
  return {
    fundingGoalHalalas: p.fundingGoalHalalas.toString(),
    durationDays: p.durationDays,
    deadline: p.deadline.toISOString(),
    releaseThresholdPct: p.releaseThresholdPct,
  };
}

@Injectable()
export class ProjectChangesService {
  constructor(private readonly prisma: PrismaService) {}

  private async owned(userId: string, projectId: string) {
    const p = await this.prisma.project.findFirst({ where: { id: projectId, createdById: userId } });
    if (!p) throw new NotFoundException('المشروع غير موجود');
    return p;
  }

  async list(userId: string, projectId: string, cursor?: string) {
    await this.owned(userId, projectId);
    const rows = await this.prisma.projectChangeRequest.findMany({
      where: { projectId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return { items: rows.slice(0, 20), nextCursor: rows.length > 20 ? rows[19]!.id : null };
  }

  async create(userId: string, projectId: string, dto: CreateProjectChangeDto) {
    const p = await this.owned(userId, projectId);
    const reasonAr = dto.reasonAr.trim();
    if (reasonAr.length < 20) throw new BadRequestException('وضّح سبب التغيير في عشرين حرفًا على الأقل');
    const proposed = { fundingGoalHalalas: String(dto.fundingGoalHalalas), durationDays: dto.durationDays };
    const where = { projectId_clientRequestId: { projectId, clientRequestId: dto.clientRequestId } };
    const replay = async () => {
      const old = await this.prisma.projectChangeRequest.findUnique({ where });
      if (!old) return null;
      const terms = old.proposed as typeof proposed;
      if (old.requestedById !== userId || old.reasonAr !== reasonAr || terms.fundingGoalHalalas !== proposed.fundingGoalHalalas || terms.durationDays !== proposed.durationDays) {
        throw new ConflictException('معرّف المحاولة مستخدم لطلب مختلف؛ أعد تحميل الطلب قبل التعديل');
      }
      return old;
    };
    const existing = await replay();
    if (existing) return existing;
    if (!['LIVE', 'PAUSED'].includes(p.status)) throw new BadRequestException('طلبات تغيير الشروط متاحة للحملات المنشورة أو الموقوفة مؤقتًا');
    if (p.fundingGoalHalalas.toString() === proposed.fundingGoalHalalas && p.durationDays === proposed.durationDays) {
      throw new BadRequestException('لم تتغير قيمة الهدف أو مدة الحملة');
    }
    try {
      return await this.prisma.projectChangeRequest.create({ data: {
        projectId, requestedById: userId, clientRequestId: dto.clientRequestId,
        reasonAr, before: campaignTerms(p), proposed,
      } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const old = await replay();
        if (old) return old;
      }
      throw error;
    }
  }

  async withdraw(userId: string, projectId: string, requestId: string) {
    await this.owned(userId, projectId);
    const result = await this.prisma.projectChangeRequest.updateMany({
      where: { id: requestId, projectId, requestedById: userId, status: { in: ['SUBMITTED', 'ACCEPTED_FOR_PREPARATION', 'CONSENT_OPEN'] } },
      data: { status: 'WITHDRAWN' },
    });
    if (!result.count) throw new ConflictException('الطلب غير قابل للسحب أو تغيرت حالته؛ حدّث الصفحة');
    return { id: requestId, status: 'WITHDRAWN' };
  }
}
