import { Controller, Get, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Creator wallet — all my payouts' })
  async mine(@CurrentUser() jwt: JwtPayload) {
    const items = await this.prisma.payout.findMany({
      where: { creatorId: jwt.sub },
      orderBy: { createdAt: 'desc' },
    });
    const total = items
      .filter((p) => p.status === 'SENT')
      .reduce((acc, p) => acc + p.amountHalalas, 0n);
    return {
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
