import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FaqQuestionStatus,
  NotificationKind,
  type FaqItem,
  type FaqQuestion,
} from '@prisma/client';
import {
  AnswerFaqQuestionDto,
  AskFaqDto,
  CreateFaqItemDto,
  UpdateFaqItemDto,
} from './dto/faq.dto';

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- FaqItem CRUD ----------

  async listItems(projectId: string): Promise<FaqItem[]> {
    await this.requireProject(projectId);
    return this.prisma.faqItem.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createItem(
    creatorId: string,
    projectId: string,
    dto: CreateFaqItemDto,
  ): Promise<FaqItem> {
    await this.requireOwned(creatorId, projectId);
    return this.prisma.faqItem.create({
      data: {
        projectId,
        questionAr: dto.questionAr,
        answerAr: dto.answerAr,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateItem(
    creatorId: string,
    projectId: string,
    itemId: string,
    dto: UpdateFaqItemDto,
  ): Promise<FaqItem> {
    await this.requireOwned(creatorId, projectId);
    const item = await this.prisma.faqItem.findUnique({ where: { id: itemId } });
    if (!item || item.projectId !== projectId) throw new NotFoundException('FAQ item not found');
    return this.prisma.faqItem.update({
      where: { id: itemId },
      data: {
        ...(dto.questionAr !== undefined && { questionAr: dto.questionAr }),
        ...(dto.answerAr !== undefined && { answerAr: dto.answerAr }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async removeItem(
    creatorId: string,
    projectId: string,
    itemId: string,
  ): Promise<{ deleted: true }> {
    await this.requireOwned(creatorId, projectId);
    const item = await this.prisma.faqItem.findUnique({ where: { id: itemId } });
    if (!item || item.projectId !== projectId) throw new NotFoundException('FAQ item not found');
    await this.prisma.faqItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  // ---------- Incoming questions ("اسأل المبدع") ----------

  async ask(
    askerId: string,
    projectId: string,
    dto: AskFaqDto,
  ): Promise<FaqQuestion> {
    await this.requireProject(projectId);
    return this.prisma.faqQuestion.create({
      data: {
        projectId,
        askerId,
        bodyAr: dto.bodyAr,
        status: FaqQuestionStatus.PENDING,
      },
    });
  }

  async listQuestions(
    creatorId: string,
    projectId: string,
  ): Promise<FaqQuestion[]> {
    await this.requireOwned(creatorId, projectId);
    return this.prisma.faqQuestion.findMany({
      where: { projectId, status: { in: [FaqQuestionStatus.PENDING, FaqQuestionStatus.ANSWERED] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async answer(
    creatorId: string,
    projectId: string,
    questionId: string,
    dto: AnswerFaqQuestionDto,
  ): Promise<{ question: FaqQuestion; item: FaqItem | null }> {
    await this.requireOwned(creatorId, projectId);
    const q = await this.prisma.faqQuestion.findUnique({ where: { id: questionId } });
    if (!q || q.projectId !== projectId) throw new NotFoundException('question not found');
    if (q.status === FaqQuestionStatus.HIDDEN) {
      throw new BadRequestException('cannot answer a hidden question');
    }
    const publish = dto.publish !== false; // default true

    const result = await this.prisma.$transaction(async (tx) => {
      let item: FaqItem | null = null;
      if (publish) {
        // Push to end of the list by default.
        const last = await tx.faqItem.findFirst({
          where: { projectId },
          orderBy: { sortOrder: 'desc' },
          select: { sortOrder: true },
        });
        item = await tx.faqItem.create({
          data: {
            projectId,
            questionAr: q.bodyAr,
            answerAr: dto.answerAr,
            sortOrder: (last?.sortOrder ?? 0) + 1,
          },
        });
      }
      const updated = await tx.faqQuestion.update({
        where: { id: questionId },
        data: {
          status: FaqQuestionStatus.ANSWERED,
          answeredFaqItemId: item?.id ?? null,
        },
      });

      if (q.askerId) {
        await tx.notification.create({
          data: {
            userId: q.askerId,
            kind: NotificationKind.FAQ_ANSWERED,
            payload: {
              projectId,
              questionId,
              faqItemId: item?.id ?? null,
            },
          },
        });
      }
      return { question: updated, item };
    });
    return result;
  }

  // ---------- public shapes ----------

  toPublicItem(i: FaqItem): Record<string, unknown> {
    return {
      id: i.id,
      questionAr: i.questionAr,
      answerAr: i.answerAr,
      sortOrder: i.sortOrder,
    };
  }

  toPublicQuestion(q: FaqQuestion): Record<string, unknown> {
    return {
      id: q.id,
      projectId: q.projectId,
      askerId: q.askerId,
      bodyAr: q.bodyAr,
      status: q.status,
      answeredFaqItemId: q.answeredFaqItemId,
      createdAt: q.createdAt.toISOString(),
    };
  }

  // ---------- helpers ----------

  private async requireProject(projectId: string) {
    const p = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!p) throw new NotFoundException('project not found');
    return p;
  }

  private async requireOwned(creatorId: string, projectId: string) {
    const p = await this.requireProject(projectId);
    if (p.createdById !== creatorId) throw new ForbiddenException('not your project');
    return p;
  }
}
