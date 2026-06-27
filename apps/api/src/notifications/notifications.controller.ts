import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get('me')
  @ApiOperation({ summary: 'List my notifications (newest first, optional unreadOnly)' })
  async list(
    @CurrentUser() jwt: JwtPayload,
    @Query('unread') unread?: string,
    @Query('take') take?: string,
  ) {
    const items = await this.svc.listMine(jwt.sub, {
      unreadOnly: unread === 'true',
      take: take ? Number(take) : undefined,
    });
    return {
      items: items.map((n) => this.svc.toPublic(n)),
      unreadCount: await this.svc.unreadCount(jwt.sub),
    };
  }

  @Post('me/read-all')
  @ApiOperation({ summary: 'Mark all my notifications read' })
  async readAll(@CurrentUser() jwt: JwtPayload) {
    return this.svc.markAllRead(jwt.sub);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a specific notification read' })
  async readOne(@CurrentUser() jwt: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.markRead(jwt.sub, id);
  }
}
