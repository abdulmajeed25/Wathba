import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { CurrentUser } from '../identity/current-user.decorator';
import type { JwtPayload } from '../identity/auth.service';
import { ChangeConsentService, RespondToChangeDto } from './change-consent.service';
import { ListProjectChangesDto } from './project-changes.service';

@Controller('pledges/:pledgeId/change-requests')
@UseGuards(JwtAuthGuard)
export class ChangeConsentController {
  constructor(private readonly consents: ChangeConsentService) {}
  @Get()
  list(@CurrentUser() user: JwtPayload, @Param('pledgeId', ParseUUIDPipe) pledgeId: string, @Query() query: ListProjectChangesDto) {
    return this.consents.list(user.sub, pledgeId, query.cursor);
  }
  @Post(':requestId/respond')
  respond(@CurrentUser() user: JwtPayload, @Param('pledgeId', ParseUUIDPipe) pledgeId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string, @Body() dto: RespondToChangeDto) {
    return this.consents.respond(user.sub, pledgeId, requestId, dto);
  }
}
