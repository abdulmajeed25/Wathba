import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Fast aggregate for the campaign-page tabs nav. One round-trip returns
 * every count the public page renders. Hidden comments are excluded from
 * the public count.
 */
@Injectable()
export class TabCountsService {
  constructor(private readonly prisma: PrismaService) {}

  async forProject(projectId: string): Promise<{
    rewards: number;
    addons: number;
    comments: number;
    updates: number;
    faq: number;
    questions: number;
    contests: number;
  }> {
    const [rewards, addons, comments, updates, faq, questions, contests] = await Promise.all([
      this.prisma.rewardTier.count({ where: { projectId } }),
      this.prisma.addOn.count({ where: { projectId } }),
      this.prisma.comment.count({ where: { projectId, hidden: false } }),
      this.prisma.projectUpdate.count({ where: { projectId } }),
      this.prisma.faqItem.count({ where: { projectId } }),
      this.prisma.faqQuestion.count({ where: { projectId, status: 'PENDING' } }),
      this.prisma.contest.count({ where: { projectId } }),
    ]);
    return { rewards, addons, comments, updates, faq, questions, contests };
  }
}
