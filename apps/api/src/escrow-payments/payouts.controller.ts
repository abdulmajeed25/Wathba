import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CursorQueryDto } from '../common/cursor-query.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('payouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @ApiOperation({ summary: 'Creator wallet — my payouts (cursor-paginated)' })
  async mine(@CurrentUser() jwt: JwtPayload, @Query() q: CursorQueryDto) {
    const take = Math.min(50, Math.max(1, q.take ?? 20));
    const page = await this.prisma.payout.findMany({
      where: { creatorId: jwt.sub },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(q.cursor && { cursor: { id: q.cursor }, skip: 1 }),
    });
    const nextCursor = page.length > take ? page[take]!.id : null;
    const items = page.slice(0, take);
    const total = items
      .filter((p) => p.status === 'SENT')
      .reduce((acc, p) => acc + p.amountHalalas, 0n);
    return {
      nextCursor,
      totalSentHalalas: Number(total),
      items: items.map((p) => ({
        id: p.id,
        projectId: p.projectId,
        amountHalalas: Number(p.amountHalalas),
        milestoneId: p.milestoneId,
        status: p.status,
        zatcaInvoiceId: p.zatcaInvoiceId,
        sentAt: p.sentAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }
}
